/**
 * 订单业务层：读取独立存放的虚构订单数据，提供完整查询与侧栏摘要。
 * 不依赖模型、HTTP 或界面；数据只保存在当前进程内存中，查询没有写入副作用。
 */
// 三种演示场景分别为待审批、配送中和已完成；金额以人民币元计且含税。
import orders from '../demo/orders.demo.json' with { type: 'json' };

// 普通 JavaScript 函数：接收订单号，返回查询结果。
export function getOrder({ orderId }) {
  const order = orders.find((item) => item.orderId === orderId);

  if (!order) {
    return { found: false, orderId };
  }

  // 返回深拷贝，调用方修改明细、配送或流程数组时不会污染后续查询。
  return { found: true, order: structuredClone(order) };
}

// 侧栏只需要摘要字段；完整订单留给工具查询返回，减少初始页面数据体积。
export function listOrderSummaries() {
  return orders.map(({ orderId, title, status, statusCode, totalAmount, department }) =>
    ({ orderId, title, status, statusCode, totalAmount, department }));
}
