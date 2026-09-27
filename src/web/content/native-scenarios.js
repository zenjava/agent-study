/**
 * 原生离线回放配置：每个场景依次包含标识、显示名称和发送给脚本模型的问题。
 * 事件名称表也充当回放筛选列表，未列出的底层事件不会成为独立回放步骤。
 */
export const scenarios = [
  ['found', '查到订单', 'A1001 谁在审批？'],
  ['absent', '订单不存在', '查 A9999'],
  ['missing', '缺少订单号', '帮我查订单'],
  ['multiple', '多个订单', '查 A1001 和 A1002'],
];
export const names = { request: '请求模拟模型', response: '脚本模型响应', tool_call: '工具调用请求', tool_result: '实际查询结果', tool_return: '准备回传结果', answer: '最终回答' };
