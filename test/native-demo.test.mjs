/**
 * 原生 Demo 测试：验证真实循环、真实工具结果和上下文行为。
 * 模型由本地脚本替代，测试中的零 Token 是演示约定，不是供应商计量结果。
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runNativeDemo } from '../src/agent/native/demo/model.demo.mjs';

for (const [question, found] of [['查 A1001', true], ['查 A9999', false]]) {
  test(`原生 Demo 完整循环：${question}`, /** 验证：原生 Demo 完整循环：${question}。 */ async () => {
    const events = [];
    const result = await runNativeDemo({ question,
      /**
       * 忽略控制台日志，由事件流或测试断言记录运行结果。
       * @returns {void}
       */
      log: () => {},
      /**
       * 收集 Agent 领域事件，供后续协议或工具结果断言使用。
       * @param {object} event 当前步骤的领域事件。
       * @returns {number} 收集后的事件数量。
       */
      onEvent: (event) => events.push(event) });
    assert.match(result, /脚本模拟模型/);
    assert.equal(events.filter(/** 识别request事件。 */ (e) => e.type === 'request').length, 2);
    assert.equal(events.find(/** 识别tool_result事件。 */ (e) => e.type === 'tool_result').data.result.found, found);
    assert.equal(events.filter(/** 识别usage事件。 */ (e) => e.type === 'usage').reduce(/** 累计演示报告的 Token 数，核对零用量约定。 */ (sum, e) => sum + e.data.total_tokens, 0), 0);
    const returned = events.filter(/** 识别request事件。 */ (e) => e.type === 'request')[1].data.messages.at(-1);
    assert.equal(returned.role, 'tool');
    assert.equal(returned.tool_call_id, 'native_demo_1');
  });
}

test('原生 Demo 无订单号时追问；连续追问复用文字历史并重新查询', /** 验证：原生 Demo 无订单号时追问；连续追问复用文字历史并重新查询。 */ async () => {
  const events = [];
  /**
   * 使用共享事件容器运行一轮原生演示，便于断言连续追问的上下文行为。
   * @param {object} options 当前问题及可选历史。
   * @returns {Promise<string>} 原生演示的最终回答。
   */
  const run = (options) => runNativeDemo({
    /**
     * 忽略控制台日志，由事件流或测试断言记录运行结果。
     * @returns {void}
     */
    log: () => {},
    /**
     * 收集 Agent 领域事件，供后续协议或工具结果断言使用。
     * @param {object} event 当前步骤的领域事件。
     * @returns {number} 收集后的事件数量。
     */
    onEvent: (event) => events.push(event), ...options });
  assert.match(await run({ question: '帮我查订单' }), /请提供订单号/);
  assert.equal(events.filter(/** 识别tool_call事件。 */ (e) => e.type === 'tool_call').length, 0);
  const answer = await run({ question: '它多少钱', history: [{ role: 'user', content: '查 A1002' }] });
  assert.match(answer, /27,900/);
  assert.equal(events.find(/** 识别tool_result事件。 */ (e) => e.type === 'tool_result').data.result.order.orderId, 'A1002');
});
