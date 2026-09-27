/**
 * 原生 Agent 的离线模型替身：根据请求中的消息生成固定 HTTP 响应。
 * 只替换模型端，工具校验、查单和循环仍执行实际代码；不能用来判断真实模型的表现。
 */
import { runOrderQuestionNative } from '../agent.mjs';

/**
 * 用本地脚本响应替代外部模型，执行真实的原生 Agent 循环与订单查询。
 * @param {object} options 原生 Agent 参数；模型地址、名称、密钥和 fetchImpl 将由演示覆盖。
 * @param {string} options.question 本轮用户问题。
 * @param {Array<{role: string, content: string}>} [options.history=[]] 用于追问的文字历史。
 * @param {function(object): void} [options.onEvent] 执行事件接收函数。
 * @param {function(string): void} [options.log=console.log] 日志接收函数。
 * @param {AbortSignal} [options.signal] 外部取消信号。
 * @param {number} [options.maxSteps=4] 模拟模型请求次数上限。
 * @param {number} [options.timeoutMs=30000] 每次模拟请求的超时毫秒数。
 * @returns {Promise<string>} 固定规则生成的最终文字，不代表真实模型能力。
 * @throws {Error} 运行参数无效、达到请求上限或执行被取消时拒绝。
 */
export function runNativeDemo(options) {
  return runOrderQuestionNative({
    ...options, baseURL: 'http://localhost', model: 'native-scripted-demo', apiKey: 'native-demo-key',
    fetchImpl: scriptedFetch,
  });
}

/**
 * 根据本轮消息模拟 Chat Completions 响应，生成工具请求、查询总结或订单号追问。
 * @param {RequestInfo|URL} _url 为兼容 fetch 保留的地址参数，不发起网络请求。
 * @param {object} init 模拟请求配置。
 * @param {string} init.body 包含 messages 的 JSON 请求体。
 * @param {AbortSignal} [init.signal] 请求取消信号。
 * @returns {Promise<Response>} 标记为 demo 且 Token 用量为零的模型协议响应。
 * @throws {Error} 已取消请求或请求体不是合法 JSON 时拒绝。
 */
async function scriptedFetch(_url, { body, signal }) {
  signal?.throwIfAborted();
  const { messages } = JSON.parse(body);
  // 只消费最后一条用户消息之后的工具结果，避免将上一轮结果误当作本轮已完成查询。
  const userIndex = messages.findLastIndex(/** 定位最后一条用户消息，划定本轮工具结果的范围。 */ (message) => message.role === 'user');
  const results = messages.slice(userIndex + 1).filter(/** 只保留本轮已返回的工具消息。 */ (message) => message.role === 'tool').map(/** 将工具消息的 JSON 正文解析为查询结果。 */ (message) => JSON.parse(message.content));
  let message;
  if (results.length) {
    const answers = results.map(/** 按成功、未找到或工具错误生成固定格式的演示回答。 */ (result) => {
      if (result.error) return `工具执行失败：${result.error.message}`;
      if (!result.found) return `没有找到订单 **${result.orderId}**。`;
      const order = result.order;
      return `**${order.orderId} · ${order.status}**\n\n含税金额 **¥${order.totalAmount.toLocaleString('zh-CN')}**，供应商：${order.supplier}。` +
        (order.currentApprover ? `当前由 **${order.currentApprover}** 审批。` : `配送：${order.delivery.status}；预计日期：${order.expectedAt}。`) +
        `\n\n付款：${order.payment.status}，已付 ¥${order.payment.paidAmount.toLocaleString('zh-CN')}。`;
    });
    message = { role: 'assistant', content: `${answers.join('\n\n')}\n\n*原生循环 Demo · 脚本模拟模型，未请求外部 API。*` };
  } else {
    const question = messages[userIndex]?.content ?? '';
    const previous = messages.slice(0, userIndex).filter(/** 只保留用于理解追问的用户和助手文字。 */ (message) => ['user', 'assistant'].includes(message.role)).map(/** 提取先前消息正文，供脚本寻找最近的订单号。 */ (message) => message.content).join(' ');
    // 优先使用本题订单号；缺少时取历史最后一个，去重后最多查三单，便于演示多工具调用。
    const ids = [...new Set(question.toUpperCase().match(/\bA\d+\b/g) ?? previous.toUpperCase().match(/\bA\d+\b/g)?.slice(-1) ?? [])].slice(0, 3);
    message = ids.length ? {
      role: 'assistant', content: null,
      tool_calls: ids.map(/** 为每张订单构造具有独立调用 ID 的工具请求。 */ (orderId, index) => ({ id: `native_demo_${index + 1}`, type: 'function', function: { name: 'getOrder', arguments: JSON.stringify({ orderId }) } })),
    } : { role: 'assistant', content: '请提供订单号，例如 A1001。\n\n*脚本模拟模型，未请求外部 API。*' };
  }
  // 显式标记 demo 与零用量，避免把脚本执行统计展示成真实模型费用。
  return new Response(JSON.stringify({
    model: 'native-scripted-demo', demo: true,
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    choices: [{ finish_reason: message.tool_calls ? 'tool_calls' : 'stop', message }],
  }), { headers: { 'Content-Type': 'application/json' } });
}
