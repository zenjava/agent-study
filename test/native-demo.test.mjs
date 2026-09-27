/**
 * 原生 Demo 测试：验证真实循环、真实工具结果及无 node_modules 的独立 CLI 运行。
 * 模型由本地脚本替代，测试中的零 Token 是演示约定，不是供应商计量结果。
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyFile, mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runNativeDemo } from '../src/agent/native/demo/model.demo.mjs';

test('原生 CLI 在没有 node_modules 的独立目录运行 Demo', async (t) => {
  // 复制到独立临时目录运行，防止测试误从仓库 node_modules 找到依赖而掩盖无框架要求。
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'harness-native-standalone-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const file of ['native/agent.mjs', 'native/demo/model.demo.mjs', 'common/order-definition.mjs', 'common/model-transport.mjs', 'common/tools/get-order.mjs', 'common/demo/orders.demo.json', 'common/demo/inputs.demo.json', 'native/cli.mjs']) {
    const target = join(directory, file);
    await mkdir(join(target, '..'), { recursive: true });
    await copyFile(new URL(`../src/agent/${file}`, import.meta.url), target);
  }
  const { stdout, stderr } = await promisify(execFile)(process.execPath, [join(directory, 'native/cli.mjs'), '--demo', '查 A1001'], { cwd: directory, timeout: 5000 });
  assert.equal(stderr, '');
  assert.match(stdout, /第 2 次请求/);
  assert.match(stdout, /采购负责人/);
  assert.match(stdout, /脚本模拟模型/);
});

for (const [question, found] of [['查 A1001', true], ['查 A9999', false]]) {
  test(`原生 Demo 完整循环：${question}`, async () => {
    const events = [];
    const result = await runNativeDemo({ question, log: () => {}, onEvent: (event) => events.push(event) });
    assert.match(result, /脚本模拟模型/);
    assert.equal(events.filter((e) => e.type === 'request').length, 2);
    assert.equal(events.find((e) => e.type === 'tool_result').data.result.found, found);
    assert.equal(events.filter((e) => e.type === 'usage').reduce((sum, e) => sum + e.data.total_tokens, 0), 0);
    const returned = events.filter((e) => e.type === 'request')[1].data.messages.at(-1);
    assert.equal(returned.role, 'tool');
    assert.equal(returned.tool_call_id, 'native_demo_1');
  });
}

test('原生 Demo 无订单号时追问；连续追问复用文字历史并重新查询', async () => {
  const events = [];
  const run = (options) => runNativeDemo({ log: () => {}, onEvent: (event) => events.push(event), ...options });
  assert.match(await run({ question: '帮我查订单' }), /请提供订单号/);
  assert.equal(events.filter((e) => e.type === 'tool_call').length, 0);
  const answer = await run({ question: '它多少钱', history: [{ role: 'user', content: '查 A1002' }] });
  assert.match(answer, /27,900/);
  assert.equal(events.find((e) => e.type === 'tool_result').data.result.order.orderId, 'A1002');
});
