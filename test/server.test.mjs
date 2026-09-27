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
// 使用操作系统分配的空闲端口；测试结束强制关闭连接，避免悬挂的流阻塞进程退出。
async function listen(t, server) {
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}

// 模型端按是否已经收到工具消息返回两阶段回复，实际 HTTP 和工具查询仍走项目代码。
async function setup(t, status = 200) {
  const requests = [];
  const provider = await listen(t, createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push(JSON.parse(body));
    const call = { id: 'call_web', type: 'function', function: { name: 'getOrder', arguments: '{"orderId":"A1001"}' } };
    const first = !requests.at(-1).messages.some((message) => message.role === 'tool');
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

const post = (url, { question }, headers = {}) => fetch(`${url}/api/copilotkit/agent/orders/run`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...headers },
  body: JSON.stringify({ threadId: 'test-thread', runId: 'test-run', state: {}, tools: [], context: [], forwardedProps: {}, messages: [{ id: 'u1', role: 'user', content: question }] }),
});
const readEvents = (text) => text.split('\n').filter((line) => line.startsWith('data:')).map((line) => JSON.parse(line.slice(5)));

test('页面通过后端串起真实函数与模拟模型，流式返回可观察的步骤', async (t) => {
  const { url, requests } = await setup(t);
  const response = await post(url, { question: 'A1001 谁在审批？' });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const text = await response.text();
  const stream = readEvents(text);
  const events = stream.filter((event) => event.type === 'CUSTOM').map((event) => event.value);
  assert.deepEqual(events.map((event) => event.type), [
    'start', 'request', 'usage', 'response', 'tool_call', 'tool_result', 'tool_return', 'request', 'usage', 'response', 'answer', 'complete',
  ]);
  assert.equal(stream.at(-1).type, 'RUN_FINISHED');
  assert.equal(events.find((event) => event.type === 'tool_result').data.result.order.currentApprover, '采购负责人');
  assert.deepEqual(events.filter((event) => event.type === 'usage').map(({ step, data }) => [step, data.total_tokens]), [[1, 135], [2, 205]]);
  assert.equal(requests[1].messages.at(-1).tool_call_id, 'call_web');
  assert.ok(!text.includes(fakeKey));
});

test('只提供白名单静态文件和非秘密配置，不提供 .env 或源码', async (t) => {
  const { url } = await setup(t);
  const config = await (await fetch(`${url}/api/config`)).json();
  assert.deepEqual(config, { model: 'deepseek-flash', keyConfigured: true });
  for (const path of ['/.env', '/.env.example', '/step2.mjs', '/.git/config', '/agent/langchain.mjs', '/server/http-server.mjs', '/src/agent/native.mjs', '/src/server/http-server.mjs']) {
    assert.equal((await fetch(`${url}${path}`)).status, 404);
  }
  const page = await fetch(url);
  const builtPage = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8').catch((error) => {
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
});

test('无效输入和跨站请求不会触发模型', async (t) => {
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

test('模型失败产生可见错误事件，不伪造回答也不转发敏感错误原文', async (t) => {
  const { url } = await setup(t, 401);
  const text = await (await post(url, { question: 'A1001' })).text();
  const events = readEvents(text);
  assert.equal(events.at(-1).type, 'RUN_ERROR');
  assert.match(events.at(-1).message, /HTTP 401/);
  assert.ok(!text.includes(fakeKey));
});

test('已删除的旧页面资源与运行接口返回 404，不调用模型', async (t) => {
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

test('Copilot Runtime 通过标准 AG-UI 协议提供演示与真实模型代理', async (t) => {
  const { url, requests } = await setup(t);
  const info = await (await fetch(`${url}/api/copilotkit/info`)).json();
  assert.ok(info.agents.orders && info.agents.orders_graph && info.agents.orders_native && info.agents.demo && info.agents.demo_native);
  const run = async (agentId, question) => {
    const response = await fetch(`${url}/api/copilotkit/agent/${agentId}/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ threadId: `thread-${agentId}`, runId: `run-${agentId}`, state: {}, tools: [], context: [], forwardedProps: {}, messages: [{ id: 'u1', role: 'user', content: question }] }),
    });
    assert.equal(response.status, 200);
    return (await response.text()).split('\n').filter((line) => line.startsWith('data:')).map((line) => JSON.parse(line.slice(5)));
  };
  const demo = await run('demo', 'A1002 什么时候到？');
  assert.equal(requests.length, 0);
  assert.equal(JSON.parse(demo.find((e) => e.type === 'TOOL_CALL_RESULT').content).order.orderId, 'A1002');
  assert.equal(demo.at(-1).type, 'RUN_FINISHED');
  const live = await run('orders', 'A1001 谁在审批？');
  assert.equal(requests.length, 2);
  assert.equal(live.filter((e) => e.type === 'CUSTOM' && e.value.type === 'usage').length, 2);
  assert.equal(live.at(-1).type, 'RUN_FINISHED');
  const graph = await run('orders_graph', 'A1001 谁在审批？');
  assert.equal(requests.length, 4);
  assert.equal(graph.filter((e) => e.type === 'CUSTOM' && e.value.type === 'usage').length, 2);
  assert.deepEqual(graph.filter((e) => e.type === 'CUSTOM' && e.value.type === 'graph_node').map((e) => e.value.data.node), ['model', 'tools', 'model']);
  assert.equal(JSON.parse(graph.find((e) => e.type === 'TOOL_CALL_RESULT').content).order.orderId, 'A1001');
  assert.equal(graph.at(-1).type, 'RUN_FINISHED');
  const native = await run('orders_native', 'A1001 谁在审批？');
  assert.equal(requests.length, 6);
  assert.equal(JSON.parse(native.find((e) => e.type === 'TOOL_CALL_RESULT').content).order.orderId, 'A1001');
  assert.equal(native.at(-1).type, 'RUN_FINISHED');
  const nativeDemo = await run('demo_native', 'A1002 什么时候到？');
  assert.equal(requests.length, 6, '原生 Demo 不应触发配置的模型 API');
  assert.equal(nativeDemo.filter((e) => e.type === 'CUSTOM' && e.value.type === 'request').length, 2);
  assert.ok(nativeDemo.filter((e) => e.type === 'CUSTOM').every((e) => e.value.mode === 'demo'));
  assert.equal(JSON.parse(nativeDemo.find((e) => e.type === 'TOOL_CALL_RESULT').content).order.orderId, 'A1002');
  assert.equal(nativeDemo.at(-1).type, 'RUN_FINISHED');
});

for (const agentId of ['orders', 'orders_graph', 'orders_native']) {
  test(`Copilot Runtime ${agentId} 停止接口中断悬挂响应，前端流及时结束`, { timeout: 4000 }, async (t) => {
    let started;
    const received = new Promise((resolve) => { started = resolve; });
    const provider = await listen(t, createServer(async (req, res) => {
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
    const events = (await output).split('\n').filter((line) => line.startsWith('data:')).map((line) => JSON.parse(line.slice(5)));
    assert.match(events.find((e) => e.type === 'RUN_ERROR').message, /取消/);
  });

}
