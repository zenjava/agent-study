/**
 * 原生 Agent 的离线模型替身：根据请求中的消息生成固定 HTTP 响应。
 * 只替换模型端，工具校验、查单和循环仍执行实际代码；不能用来判断真实模型的表现。
 */
import { runOrderQuestionNative } from '../agent.mjs';

// 用脚本模拟模型 HTTP 响应，真正执行 native/agent.mjs 的循环和 getOrder。
// 无外部网络、无模型 Key；脚本判断不代表真实模型的理解能力。
export function runNativeDemo(options) {
  return runOrderQuestionNative({
    ...options, baseURL: 'http://localhost', model: 'native-scripted-demo', apiKey: 'native-demo-key',
    fetchImpl: scriptedFetch,
  });
}

// 实现 fetch 所需的最小接口：接收请求体，返回兼容 Chat Completions 的 Response。
async function scriptedFetch(_url, { body, signal }) {
  signal?.throwIfAborted();
  const { messages } = JSON.parse(body);
  // 只消费最后一条用户消息之后的工具结果，避免将上一轮结果误当作本轮已完成查询。
  const userIndex = messages.findLastIndex((message) => message.role === 'user');
  const results = messages.slice(userIndex + 1).filter((message) => message.role === 'tool').map((message) => JSON.parse(message.content));
  let message;
  if (results.length) {
    const answers = results.map((result) => {
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
    const previous = messages.slice(0, userIndex).filter((message) => ['user', 'assistant'].includes(message.role)).map((message) => message.content).join(' ');
    // 优先使用本题订单号；缺少时取历史最后一个，去重后最多查三单，便于演示多工具调用。
    const ids = [...new Set(question.toUpperCase().match(/\bA\d+\b/g) ?? previous.toUpperCase().match(/\bA\d+\b/g)?.slice(-1) ?? [])].slice(0, 3);
    message = ids.length ? {
      role: 'assistant', content: null,
      tool_calls: ids.map((orderId, index) => ({ id: `native_demo_${index + 1}`, type: 'function', function: { name: 'getOrder', arguments: JSON.stringify({ orderId }) } })),
    } : { role: 'assistant', content: '请提供订单号，例如 A1001。\n\n*脚本模拟模型，未请求外部 API。*' };
  }
  // 显式标记 demo 与零用量，避免把脚本执行统计展示成真实模型费用。
  return new Response(JSON.stringify({
    model: 'native-scripted-demo', demo: true,
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    choices: [{ finish_reason: message.tool_calls ? 'tool_calls' : 'stop', message }],
  }), { headers: { 'Content-Type': 'application/json' } });
}
