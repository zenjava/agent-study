/**
 * 本机 HTTP 集成测试：启动真实 Harness 服务及脚本模型端，核对路由与 AG-UI 事件流。
 * 使用临时端口和虚构 Key；只验证协议链路，不验证真实模型的工具选择能力。
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createHarnessServer } from '../src/server/http-server.mjs';

const fakeKey = 'web-offline-key-not-a-secret';
/**
 * 在本机随机端口监听测试服务，并注册测试结束时的连接清理。
 * @param {import("node:test").TestContext} t 当前测试上下文。
 * @param {import("node:http").Server} server 待启动的 HTTP 服务。
 * @returns {Promise<string>} 含实际端口的本机访问地址。
 */
async function listen(t, server) {
  t.after(/** 测试结束时关闭活动连接，并等待 HTTP 服务完全退出。 */ async () => {
    server.closeAllConnections();
    await new Promise(/** 把 HTTP 服务关闭回调转换为可等待的完成信号。 */ (resolve) => server.close(resolve));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}

/**
 * 启动两阶段脚本模型和真实 Harness 服务，记录模型收到的实际请求。
 * @param {import("node:test").TestContext} t 当前测试上下文。
 * @param {number} [status=200] 脚本模型响应状态码。
 * @returns {Promise<{url: string, requests: Array<object>}>} Harness 地址及模拟供应商的请求记录。
 */
async function setup(t, status = 200) {
  const requests = [];
  const provider = await listen(t, createServer(/** 根据是否收到工具结果返回工具请求或最终回答，并报告固定测试用量。 */ async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push(JSON.parse(body));
    const call = { id: 'call_web', type: 'function', function: { name: 'getOrder', arguments: '{"orderId":"A1001"}' } };
    const first = !requests.at(-1).messages.some(/** 识别回传给模型的工具结果消息。 */ (message) => message.role === 'tool');
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status === 200 ? {
      usage: first
        ? { prompt_tokens: 120, completion_tokens: 15, total_tokens: 135 }
        : { prompt_tokens: 180, completion_tokens: 25, total_tokens: 205 },
      choices: [{
        finish_reason: first ? 'tool_calls' : 'stop',
        message: first
          ? { role: 'assistant', content: null, tool_calls: [call] }
          : { role: 'assistant', content: '订单等待审批，审批人为采购负责人。' },
      }],
    } : { error: fakeKey }));
  }));
  const url = await listen(t, createHarnessServer({ baseURL: provider, model: 'deepseek-flash', apiKey: fakeKey }));
  return { url, requests };
}

/**
 * 以标准 AG-UI 消息结构向 LangChain 运行接口提交一个测试问题。
 * @param {string} url Harness 服务地址。
 * @param {object} input 测试输入。
 * @param {string} input.question 用户问题。
 * @param {string} [input.agentId="orders"] Runtime 注册的 Agent 标识。
 * @param {Object<string, string>} [headers={}] 用于覆盖默认请求头的测试参数。
 * @returns {Promise<Response>} 运行接口返回的响应，成功时为 SSE 流。
 */
const post = (url, { question, agentId = 'orders' }, headers = {}) => fetch(`${url}/api/copilotkit/agent/${agentId}/run`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...headers },
  body: JSON.stringify({ threadId: 'test-thread', runId: 'test-run', state: {}, tools: [], context: [], forwardedProps: {}, messages: [{ id: 'u1', role: 'user', content: question }] }),
});
/**
 * 从已收齐的 SSE 文本中解析 data 行，保留协议事件顺序。
 * @param {string} text 完整 SSE 响应文本。
 * @returns {Array<object>} 解析后的 AG-UI 事件。
 */
const readEvents = (text) => text.split('\n').filter(/** 筛选包含协议数据的 SSE 行。 */ (line) => line.startsWith('data:')).map(/** 移除 SSE 数据前缀并解析协议事件。 */ (line) => JSON.parse(line.slice(5)));

test('页面通过后端串起真实函数与模拟模型，流式返回可观察的步骤', /** 验证：页面通过后端串起真实函数与模拟模型，流式返回可观察的步骤。 */ async (t) => {
  const { url, requests } = await setup(t);
  const response = await post(url, { question: 'A1001 谁在审批？' });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const text = await response.text();
  const stream = readEvents(text);
  const events = stream.filter(/** 识别CUSTOM事件。 */ (event) => event.type === 'CUSTOM').map(/** 读取 AG-UI 自定义事件承载的领域记录。 */ (event) => event.value);
  assert.deepEqual(events.map(/** 提取事件类型以检查发生顺序。 */ (event) => event.type), [
    'start', 'request', 'usage', 'response', 'tool_call', 'tool_result', 'tool_return', 'request', 'usage', 'response', 'answer', 'complete',
  ]);
  assert.equal(stream.at(-1).type, 'RUN_FINISHED');
  assert.equal(events.find(/** 识别tool_result事件。 */ (event) => event.type === 'tool_result').data.result.order.currentApprover, '采购负责人');
  assert.deepEqual(events.filter(/** 识别usage事件。 */ (event) => event.type === 'usage').map(/** 提取请求序号与总用量，核对两次请求的计量记录。 */ ({ step, data }) => [step, data.total_tokens]), [[1, 135], [2, 205]]);
  assert.equal(requests[1].messages.at(-1).tool_call_id, 'call_web');
  assert.ok(!text.includes(fakeKey));
});

test('只提供白名单静态文件和非秘密配置，不提供 .env 或源码', /** 验证：只提供白名单静态文件和非秘密配置，不提供 .env 或源码。 */ async (t) => {
  const { url } = await setup(t);
  const config = await (await fetch(`${url}/api/config`)).json();
  assert.deepEqual(config, { model: 'deepseek-flash' });
  for (const path of ['/.env', '/.env.example', '/step2.mjs', '/.git/config', '/agent/langchain.mjs', '/server/http-server.mjs', '/src/agent/native/agent.mjs', '/src/server/http-server.mjs']) {
    assert.equal((await fetch(`${url}${path}`)).status, 404);
  }
  const page = await fetch(url);
  const builtPage = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8').catch(/** 构建产物不存在时返回空值，其他文件读取错误继续抛出。 */ (error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (builtPage === null) {
    assert.equal(page.status, 503);
    assert.match((await page.json()).error, /npm run build/);
  } else {
    assert.equal(page.status, 200);
    assert.equal(await page.text(), builtPage);
  }
  const runtimePage = await fetch(`${url}/learn/runtime`);
  const builtLesson = await readFile(new URL('../dist/learn.html', import.meta.url), 'utf8').catch(/** 构建产物不存在时返回空值，其他文件读取错误继续抛出。 */ (error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  assert.equal(runtimePage.status, builtLesson === null ? 503 : 200);
  if (builtLesson !== null) assert.equal(await runtimePage.text(), builtLesson);
  const architecturePage = await fetch(`${url}/learn/architecture`);
  assert.equal(architecturePage.status, builtLesson === null ? 503 : 200);
  if (builtLesson !== null) assert.equal(await architecturePage.text(), builtLesson);
});

test('无效输入和跨站请求不会触发模型', /** 验证：无效输入和跨站请求不会触发模型。 */ async (t) => {
  const { url, requests } = await setup(t);
  for (const question of ['', 'x'.repeat(2001)]) {
    const response = await post(url, { question });
    assert.equal(response.status, 200);
    const events = readEvents(await response.text());
    assert.equal(events.at(-1).type, question ? 'RUN_ERROR' : 'RUN_FINISHED');
  }
  assert.equal((await post(url, { question: 'A1001' }, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post(url, { question: 'A1001' }, { Origin: 'https://untrusted.example' })).status, 403);
  assert.equal(requests.length, 0);
});

test('模型失败产生可见错误事件，不伪造回答也不转发敏感错误原文', /** 验证：模型失败产生可见错误事件，不伪造回答也不转发敏感错误原文。 */ async (t) => {
  const { url } = await setup(t, 401);
  const text = await (await post(url, { question: 'A1001' })).text();
  const events = readEvents(text);
  assert.equal(events.at(-1).type, 'RUN_ERROR');
  assert.match(events.at(-1).message, /HTTP 401/);
  assert.ok(!text.includes(fakeKey));
});

test('真实模型提交后由服务端校验 Key，缺失或占位符均返回可见错误，演示仍可运行', /** 验证：Key 校验只影响真实模型请求，不影响演示或空运行。 */ async (t) => {
  for (const apiKey of [undefined, 'replace-with-your-deepseek-api-key']) {
    const url = await listen(t, createHarnessServer({ baseURL: 'http://127.0.0.1:9', model: 'deepseek-flash', apiKey }));
    assert.deepEqual(await (await fetch(`${url}/api/config`)).json(), { model: 'deepseek-flash' });
    for (const agentId of ['orders', 'orders_graph', 'orders_native']) {
      const response = await post(url, { agentId, question: 'A1001 谁在审批？' });
      assert.equal(response.status, 200);
      const events = readEvents(await response.text());
      assert.equal(events[0].type, 'RUN_STARTED');
      assert.equal(events.at(-1).type, 'RUN_ERROR');
      assert.match(events.at(-1).message, /本机 \.env.*模型 Key/);
      assert.equal(events.some(/** 确认缺少 Key 时不会产生模型请求事件。 */ (event) => event.type === 'CUSTOM' && event.value.type === 'request'), false);
    }
    const demo = readEvents(await (await post(url, { agentId: 'demo_native', question: '查 A1001' })).text());
    assert.equal(demo.at(-1).type, 'RUN_FINISHED');
    assert.ok(demo.some(/** 确认演示模式仍可得到真实订单查询结果。 */ (event) => event.type === 'TOOL_CALL_RESULT'));
    const empty = readEvents(await (await post(url, { question: '' })).text());
    assert.equal(empty.at(-1).type, 'RUN_FINISHED');
  }
});

test('已删除的旧页面资源与运行接口返回 404，不调用模型', /** 验证：已删除的旧页面资源与运行接口返回 404，不调用模型。 */ async (t) => {
  const { url, requests } = await setup(t);
  for (const path of ['/app.js', '/style.css', '/web/legacy/index.html']) {
    assert.equal((await fetch(`${url}${path}`)).status, 404);
  }
  const response = await fetch(`${url}/api/run`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: 'A1001' }),
  });
  assert.equal(response.status, 404);
  assert.equal(requests.length, 0);
});

test('Copilot Runtime 通过标准 AG-UI 协议提供演示与真实模型代理', /** 验证：Copilot Runtime 通过标准 AG-UI 协议提供演示与真实模型代理。 */ async (t) => {
  const { url, requests } = await setup(t);
  const info = await (await fetch(`${url}/api/copilotkit/info`)).json();
  assert.ok(info.agents.orders && info.agents.orders_graph && info.agents.orders_native && info.agents.demo && info.agents.demo_native);
  /**
   * 向指定演示 Agent 提交问题并解析 SSE 事件，用于比较不同演示模式。
   * @param {string} agentId Runtime 注册的 Agent 标识。
   * @param {string} question 本轮测试问题。
   * @returns {Promise<Array<object>>} 当前运行的 AG-UI 事件。
   */
  const run = async (agentId, question) => {
    const response = await fetch(`${url}/api/copilotkit/agent/${agentId}/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ threadId: `thread-${agentId}`, runId: `run-${agentId}`, state: {}, tools: [], context: [], forwardedProps: {}, messages: [{ id: 'u1', role: 'user', content: question }] }),
    });
    assert.equal(response.status, 200);
    return (await response.text()).split('\n').filter(/** 筛选包含协议数据的 SSE 行。 */ (line) => line.startsWith('data:')).map(/** 移除 SSE 数据前缀并解析协议事件。 */ (line) => JSON.parse(line.slice(5)));
  };
  const demo = await run('demo', 'A1002 什么时候到？');
  assert.equal(requests.length, 0);
  assert.equal(JSON.parse(demo.find(/** 识别TOOL_CALL_RESULT事件。 */ (e) => e.type === 'TOOL_CALL_RESULT').content).order.orderId, 'A1002');
  assert.equal(demo.at(-1).type, 'RUN_FINISHED');
  const live = await run('orders', 'A1001 谁在审批？');
  assert.equal(requests.length, 2);
  assert.equal(live.filter(/** 识别CUSTOM 中的 usage事件。 */ (e) => e.type === 'CUSTOM' && e.value.type === 'usage').length, 2);
  assert.equal(live.at(-1).type, 'RUN_FINISHED');
  const graph = await run('orders_graph', 'A1001 谁在审批？');
  assert.equal(requests.length, 4);
  assert.equal(graph.filter(/** 识别CUSTOM 中的 usage事件。 */ (e) => e.type === 'CUSTOM' && e.value.type === 'usage').length, 2);
  assert.deepEqual(graph.filter(/** 识别CUSTOM 中的 graph_node事件。 */ (e) => e.type === 'CUSTOM' && e.value.type === 'graph_node').map(/** 提取图节点名称以验证调度顺序。 */ (e) => e.value.data.node), ['model', 'tools', 'model']);
  assert.equal(JSON.parse(graph.find(/** 识别TOOL_CALL_RESULT事件。 */ (e) => e.type === 'TOOL_CALL_RESULT').content).order.orderId, 'A1001');
  assert.equal(graph.at(-1).type, 'RUN_FINISHED');
  const native = await run('orders_native', 'A1001 谁在审批？');
  assert.equal(requests.length, 6);
  assert.equal(JSON.parse(native.find(/** 识别TOOL_CALL_RESULT事件。 */ (e) => e.type === 'TOOL_CALL_RESULT').content).order.orderId, 'A1001');
  assert.equal(native.at(-1).type, 'RUN_FINISHED');
  const nativeDemo = await run('demo_native', 'A1002 什么时候到？');
  assert.equal(requests.length, 6, '原生 Demo 不应触发配置的模型 API');
  assert.equal(nativeDemo.filter(/** 识别CUSTOM 中的 request事件。 */ (e) => e.type === 'CUSTOM' && e.value.type === 'request').length, 2);
  assert.ok(nativeDemo.filter(/** 识别CUSTOM事件。 */ (e) => e.type === 'CUSTOM').every(/** 确认每条原生演示记录都带有演示模式标记。 */ (e) => e.value.mode === 'demo'));
  assert.equal(JSON.parse(nativeDemo.find(/** 识别TOOL_CALL_RESULT事件。 */ (e) => e.type === 'TOOL_CALL_RESULT').content).order.orderId, 'A1002');
  assert.equal(nativeDemo.at(-1).type, 'RUN_FINISHED');
});

for (const agentId of ['orders', 'orders_graph', 'orders_native']) {
  test(`Copilot Runtime ${agentId} 停止接口中断悬挂响应，前端流及时结束`, { timeout: 4000 }, /** 验证：Copilot Runtime ${agentId} 停止接口中断悬挂响应，前端流及时结束。 */ async (t) => {
    let started;
    const received = new Promise(/** 保存请求到达通知函数，使停止测试先等待模型连接建立。 */ (resolve) => { started = resolve; });
    const provider = await listen(t, createServer(/** 消费模型请求并保持响应体未结束，通知测试可以发起停止。 */ async (req, res) => {
      for await (const chunk of req) { /* 消费输入，响应体保持未完成。 */ }
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{'); started();
    }));
    const url = await listen(t, createHarnessServer({ baseURL: provider, model: 'offline', apiKey: fakeKey }));
    const response = await fetch(`${url}/api/copilotkit/agent/${agentId}/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: 'cancel-thread', runId: 'cancel-run', state: {}, tools: [], context: [], forwardedProps: {}, messages: [{ id: 'u', role: 'user', content: 'A1001' }] }),
    });
    const output = response.text();
    await received;
    const stopped = await fetch(`${url}/api/copilotkit/agent/${agentId}/stop/cancel-thread`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId: 'cancel-run' }),
    });
    assert.equal(stopped.status, 200);
    const events = (await output).split('\n').filter(/** 筛选包含协议数据的 SSE 行。 */ (line) => line.startsWith('data:')).map(/** 移除 SSE 数据前缀并解析协议事件。 */ (line) => JSON.parse(line.slice(5)));
    assert.match(events.find(/** 识别RUN_ERROR事件。 */ (e) => e.type === 'RUN_ERROR').message, /取消/);
  });

}
