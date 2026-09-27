/**
 * 图演示的固定消息快照：读取虚构订单后组织预设的节点与状态变化。
 * 只用于教学回放，不执行 LangGraph，也不代表模型必然选择这些分支。
 */
import { getOrder } from '../../../agent/common/tools/get-order.mjs';

/**
 * 为所选场景生成图节点、条件边及消息状态的教学步骤。
 * @param {string} scenario 场景标识：found（查到）、absent（未找到）或 missing（缺少订单号）。
 * @returns {Array<object>} 按执行顺序排列的图回放快照。
 */
export function graphSteps(scenario) {
  const missing = scenario === 'missing';
  const orderId = scenario === 'absent' ? 'A9999' : 'A1001';
  const order = getOrder({ orderId });
  const question = missing ? '请查一下订单进度。' : `${orderId} 谁在审批？`;
  const answer = missing ? '请提供订单号。' : order.found ? `${orderId} 正在等待${order.order.currentApprover}审批。` : `没有找到 ${orderId}。`;
  const result = order.found ? { found: true, order: { orderId, status: order.order.status, currentApprover: order.order.currentApprover } } : order;
  const user = { role: 'user', content: question };
  const aiCall = { role: 'assistant', tool_calls: [{ id: 'call_graph_1', name: 'getOrder', args: { orderId } }] };
  const tool = { role: 'tool', tool_call_id: 'call_graph_1', content: JSON.stringify(result) };
  const final = { role: 'assistant', content: answer };
  // 缺少订单号时跳过工具节点；其余场景依次展示请求工具、回传结果和再次生成回答。
  const steps = [
    { label: 'START', node: 'START', desc: 'invoke 传入初始状态。当前只有用户问题，尚未请求模型。', messages: [user], requests: 0, tools: 0 },
    { label: '模型节点', node: 'model', desc: missing ? '模型没有足够信息，直接生成追问；不要求调用工具。' : '模型读入问题与工具说明，返回 getOrder 调用请求。', messages: [user, missing ? final : aiCall], requests: 1, tools: 0 },
    { label: '条件分支', node: 'route', desc: missing ? '没有 tool_calls，routeAfterModel 返回 END。' : '存在 tool_calls，routeAfterModel 返回 tools；这个判断不请求模型。', messages: [user, missing ? final : aiCall], requests: 1, tools: 0 },
    ...missing ? [] : [
      { label: '工具节点', node: 'tools', desc: '校验参数后查询一次订单，返回 ToolMessage。reducer 把新消息加入状态。', messages: [user, aiCall, tool], requests: 1, tools: 1 },
      { label: '再问模型', node: 'model', desc: '沿 tools → model 返回；模型读到查询结果，生成最终文字。这里没有再查订单。', messages: [user, aiCall, tool, final], requests: 2, tools: 1 },
    ],
    { label: 'END', node: 'END', desc: '最后的模型消息没有新的 tool_calls，图结束，调用方从 result.messages 读取回答。', messages: missing ? [user, final] : [user, aiCall, tool, final], requests: missing ? 1 : 2, tools: missing ? 0 : 1 },
  ];
  return steps;
}
