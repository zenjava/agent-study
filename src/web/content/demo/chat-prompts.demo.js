/**
 * 工作台的预设演示问题与场景名称；只用于填入或发送示例输入。
 * 模型和工具不依赖这些文案判断权限或业务结果。
 */
export const welcomePrompts = [
  { question: 'A1001 现在到哪一步了，谁在审批？', title: '谁在审批？', detail: '查询 A1001 的当前进度' },
  { question: 'A1002 什么时候送到，付了多少钱？', title: '什么时候送到？', detail: '查看 A1002 的配送与付款' },
];
export const sampleActions = ['查看审批与明细', '查看物流与付款', '查看验收与发票'];
export const absentQuestion = '请查一下 A9999 的订单。';
export const missingQuestion = '请帮我查一下订单进度。';

// 订单列表由服务端提供，此处只按用户选择的编号生成预设问题。
export const detailQuestion = (orderId) => `请查看 ${orderId} 的订单详情，并说明当前进度。`;
