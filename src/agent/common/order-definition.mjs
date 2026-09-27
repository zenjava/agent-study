/**
 * 面向模型的工具说明、JSON Schema 和系统提示词，是三版实现共享的业务约定。
 * 这些数据本身不会执行查询；真正的参数验证与工具调用发生在 Agent 中。
 */
// 不依赖框架的工具说明；原生版和框架适配共用业务定义。
export const orderDescription = '根据订单号查询完整订单：状态、审批人、供应商、商品明细、含税金额、付款、发票、配送和流程时间线。';
// 只允许订单号这一项；这份 Schema 提示模型如何传参，不能替代运行时校验。
export const orderParameters = {
  type: 'object',
  properties: { orderId: { type: 'string', description: '订单号，例如 A1001' } },
  required: ['orderId'],
  additionalProperties: false,
};
export const orderToolDefinition = {
  type: 'function',
  function: { name: 'getOrder', description: orderDescription, parameters: orderParameters },
};

// 提示词约束回答方式；工具白名单、参数检查和请求上限仍须由代码落实。
export const systemPrompt = '你是订单查询助手。任何订单信息必须调用 getOrder，以工具结果为准。' +
  '可以根据之前对话确定用户追问的订单号；无法确定时请追问，不要猜测。' +
  'found 为 false 时说明未找到；工具出错时纠正参数或说明失败。' +
  '所有订单都是虚构教学数据，不执行审批、付款或修改。金额含税，不重复加税。' +
  '页面会自动显示详细订单卡片，因此回答用简洁中文 Markdown 突出用户关心的信息，不必重复整个卡片。';
