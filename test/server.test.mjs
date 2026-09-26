import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { createHarnessServer } from '../server.mjs';

const fakeKey = 'web-offline-key-not-a-secret';
async function listen(t, server) {
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}

async function setup(t, status = 200) {
  const requests = [];
  const provider = await listen(t, createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push(JSON.parse(body));
    const call = { id: 'call_web', type: 'function', function: { name: 'getOrder', arguments: '{"orderId":"A1001"}' } };
    const first = requests.length === 1;
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

const post = (url, body, headers = {}) => fetch(`${url}/api/run`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});

test('页面通过后端串起真实函数与模拟模型，流式返回可观察的步骤', async (t) => {
  const { url, requests } = await setup(t);
  const response = await post(url, { question: 'A1001 谁在审批？' });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/x-ndjson/);
  const text = await response.text();
  const events = text.trim().split('\n').map(JSON.parse);
  assert.deepEqual(events.map((event) => event.type), [
    'request', 'usage', 'tool_call', 'tool_result', 'tool_return', 'request', 'usage', 'answer', 'complete',
  ]);
  assert.equal(events[3].data.result.order.currentApprover, '采购负责人');
  assert.deepEqual(events.filter((event) => event.type === 'usage').map(({ step, data }) => [step, data.total_tokens]), [[1, 135], [2, 205]]);
  assert.equal(requests[1].messages.at(-1).tool_call_id, 'call_web');
  assert.ok(!text.includes(fakeKey));
});

test('只提供白名单静态文件和非秘密配置，不提供 .env 或源码', async (t) => {
  const { url } = await setup(t);
  const config = await (await fetch(`${url}/api/config`)).json();
  assert.deepEqual(config, { model: 'deepseek-flash', keyConfigured: true });
  for (const path of ['/.env', '/.env.example', '/step2.mjs', '/.git/config']) {
    assert.equal((await fetch(`${url}${path}`)).status, 404);
  }
  const page = await fetch(url);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /工具调用实验台/);
});

test('无效输入和跨站请求不会触发模型', async (t) => {
  const { url, requests } = await setup(t);
  for (const question of ['', 123, 'x'.repeat(2001)]) {
    assert.equal((await post(url, { question })).status, 400);
  }
  assert.equal((await post(url, { question: 'A1001' }, { Origin: 'https://untrusted.example' })).status, 403);
  assert.equal(requests.length, 0);
});

test('模型失败产生可见错误事件，不伪造回答也不转发敏感错误原文', async (t) => {
  const { url } = await setup(t, 401);
  const text = await (await post(url, { question: 'A1001' })).text();
  const events = text.trim().split('\n').map(JSON.parse);
  assert.deepEqual(events.map((event) => event.type), ['request', 'error']);
  assert.match(events.at(-1).data.message, /HTTP 401/);
  assert.ok(!text.includes(fakeKey));
});

test('Copilot Runtime 通过标准 AG-UI 协议提供演示与真实模型代理', async (t) => {
  const { url, requests } = await setup(t);
  const info = await (await fetch(`${url}/api/copilotkit/info`)).json();
  assert.ok(info.agents.orders && info.agents.demo);
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
});

test('Copilot Runtime 停止接口中断悬挂响应，前端流及时结束', { timeout: 4000 }, async (t) => {
  let started;
  const received = new Promise((resolve) => { started = resolve; });
  const provider = await listen(t, createServer(async (req, res) => {
    for await (const chunk of req) { /* 消费输入，响应体保持未完成。 */ }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{'); started();
  }));
  const url = await listen(t, createHarnessServer({ baseURL: provider, model: 'offline', apiKey: fakeKey }));
  const response = await fetch(`${url}/api/copilotkit/agent/orders/run`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId: 'cancel-thread', runId: 'cancel-run', state: {}, tools: [], context: [], forwardedProps: {}, messages: [{ id: 'u', role: 'user', content: 'A1001' }] }),
  });
  const output = response.text();
  await received;
  const stopped = await fetch(`${url}/api/copilotkit/agent/orders/stop/cancel-thread`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId: 'cancel-run' }),
  });
  assert.equal(stopped.status, 200);
  const events = (await output).split('\n').filter((line) => line.startsWith('data:')).map((line) => JSON.parse(line.slice(5)));
  assert.match(events.find((e) => e.type === 'RUN_ERROR').message, /取消/);
});
