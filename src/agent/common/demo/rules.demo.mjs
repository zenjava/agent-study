/**
 * 共用演示响应生成器：用固定规则与虚构订单生成工具事件和回答。
 * .demo 表示这里模拟模型决策，不经过真实模型；AG-UI 适配由服务层负责。
 */
import { getOrder } from '../tools/get-order.mjs';

// 共用固定规则 Demo：通过订单号匹配生成查询事件，不经过任何模型编排框架。
export async function runDemo({ question, history, onEvent, signal }) {
  const explicit = question.toUpperCase().match(/\bA\d+\b/g);
  const previous = history.map((message) => message.content).join(' ').toUpperCase().match(/\bA\d+\b/g);
  const orderIds = [...new Set(explicit ?? previous?.slice(-1) ?? [])].slice(0, 3);
  if (!orderIds.length) {
    onEvent({ type: 'answer', step: 1, data: { content: '请提供要查询的订单号，例如 **A1001**。\n\n当前为本地演示，回答由固定规则生成。' } });
    return;
  }
  const answers = [];
  for (const [index, orderId] of orderIds.entries()) {
    const id = `demo_${index + 1}`;
    onEvent({ type: 'tool_call', step: 1, data: { id, type: 'function', function: { name: 'getOrder', arguments: JSON.stringify({ orderId }) } } });
    // 短暂延迟用于展示工具加载态，同时支持停止按钮即时中断演示。
    await new Promise((resolve, reject) => {
      if (signal.aborted) return reject(new Error('本次请求已取消。'));
      const abort = () => { clearTimeout(timer); reject(new Error('本次请求已取消。')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 350);
      signal.addEventListener('abort', abort, { once: true });
    });
    const result = getOrder({ orderId });
    onEvent({ type: 'tool_result', step: 1, data: { tool_call_id: id, result } });
    if (!result.found) answers.push(`没有找到订单 **${orderId}**，请检查订单号。`);
    else {
      const order = result.order;
      answers.push(`**${orderId} · ${order.status}**\n\n含税总额 **¥${order.totalAmount.toLocaleString('zh-CN')}**，供应商为${order.supplier}。` +
        (order.currentApprover ? `当前由 **${order.currentApprover}** 审批，尚未发货。` : `配送状态：${order.delivery.status}。`) +
        `\n\n付款：${order.payment.status}；发票：${order.invoice.status}。详细商品和流程见上方订单卡片。`);
    }
  }
  onEvent({ type: 'answer', step: 1, data: { content: `${answers.join('\n\n---\n\n')}\n\n*本地演示 · 固定规则回答，未调用大模型。*` } });
}
