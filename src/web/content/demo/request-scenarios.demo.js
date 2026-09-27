/**
 * LangChain 请求实验室的固定脚本：实际查询虚构订单，再组织精简的教学报文。
 * 模型响应与请求次数是预设演示，不代表真实模型一定采取同样步骤。
 */
import { getOrder } from '../../../agent/common/tools/get-order.mjs';

const json = (value) => JSON.stringify(value, null, 2);

export function scenarioSteps(scenario) {
  const missing = scenario === 'missing';
  const orderId = scenario === 'absent' ? 'A9999' : 'A1001';
  const question = missing ? '帮我查一下订单进度。' : `${orderId} 谁在审批？`;
  // 直接使用项目里的纯业务函数；所有模型响应是教学用的固定脚本。
  const fullResult = missing ? null : getOrder({ orderId });
  const result = fullResult?.found ? { found: true, order: { orderId, status: fullResult.order.status, currentApprover: fullResult.order.currentApprover, approverName: fullResult.order.approverName, totalAmount: fullResult.order.totalAmount } } : fullResult;
  const call = { id: 'call_demo_1', type: 'function', function: { name: 'getOrder', arguments: json({ orderId }) } };
  const user = { role: 'user', content: question };
  const system = { role: 'system', content: '你是订单查询助手。订单信息必须调用 getOrder；缺少订单号请追问；found 为 false 表示未找到。' };
  const tools = [{ type: 'function', function: { name: 'getOrder', description: '按订单号查询订单', parameters: { type: 'object', properties: { orderId: { type: 'string' } }, required: ['orderId'], additionalProperties: false } } }];
  const requested = { role: 'assistant', content: null, tool_calls: [call] };
  const toolResult = { role: 'tool', name: 'getOrder', tool_call_id: call.id, content: json(result) };
  const answer = missing ? '请提供要查询的订单号，例如 **A1001**。' : fullResult.found ? `**A1001** 正在审批中，当前由 **${fullResult.order.currentApprover}**（${fullResult.order.approverName}）审批。` : '**A9999** 未找到，请核对订单号。';
  const first = { label: '发送问题', actor: 'Node → 模型', title: '第 1 次模型请求', desc: '一起发送系统规则、用户问题、可用工具定义。此时模型尚未拿到订单数据。', payload: { messages: [system, user], tools }, requests: 1, executions: 0 };
  const last = { label: missing ? '追问订单号' : '组织回答', actor: '模型 → Node → 页面', title: missing ? '没有订单号，先追问' : '模型给出最终文字', desc: missing ? '这个场景只有一次模型请求，没有执行工具。真实模型仍可能偏离指令，需要持续验证。' : 'content 是模型组织的 Markdown。卡片使用之前的工具结果，文字使用这个 content。本轮结束。', payload: { role: 'assistant', content: answer }, requests: missing ? 1 : 2, executions: missing ? 0 : 1, answer, result };
  if (missing) return [first, last];
  return [first,
    { label: '选择工具', actor: '模型 → Node', title: '模型提出调用请求', desc: 'name 选择工具，arguments 提供参数，id 标识这一次调用。模型没有执行 getOrder。', payload: requested, requests: 1, executions: 0 },
    { label: '执行查询', actor: 'LangChain → getOrder', title: '程序实际执行一次工具', desc: '后端校验参数后执行 getOrder。ToolMessage 的 tool_call_id 对上刚才的 id，content 装入业务结果。', payload: toolResult, requests: 1, executions: 1 },
    { label: '带回结果', actor: 'Node → 模型', title: '第 2 次模型请求', desc: '将 assistant 的调用记录与 tool 的结果追加到 messages。模型现在才看见订单信息。这一步没有再次执行 getOrder。', payload: { messages: [system, user, requested, toolResult], tools }, requests: 2, executions: 1 },
    last,
  ];
}
