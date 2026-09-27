/**
 * 订单业务层：读取独立存放的虚构订单数据，提供完整查询与侧栏摘要。
 * 不依赖模型、HTTP 或界面；数据只保存在当前进程内存中，查询没有写入副作用。
 */
// 三种演示场景分别为待审批、配送中和已完成；金额以人民币元计且含税。
import orders from '../demo/orders.demo.json' with { type: 'json' };

/**
 * 按订单号查询虚构数据，成功时返回深拷贝，避免调用方修改共享订单。
 * @param {object} params 查询参数。
 * @param {string} params.orderId 要精确匹配的订单号。
 * @returns {({found: true, order: object}|{found: false, orderId: string})} 查到的订单快照或未找到标记。
 */
export function getOrder({ orderId }) {
  const order = orders.find(/** 按订单号精确匹配当前虚构订单。 */ (item) => item.orderId === orderId);

  if (!order) {
    return { found: false, orderId };
  }

  // 返回深拷贝，调用方修改明细、配送或流程数组时不会污染后续查询。
  return { found: true, order: structuredClone(order) };
}

/**
 * 生成订单侧栏所需的摘要，省略明细、配送及审批流程等完整数据。
 * @returns {Array<{orderId: string, title: string, status: string, statusCode: string, totalAmount: number, department: string}>} 订单摘要列表，金额单位为人民币元。
 */
export function listOrderSummaries() {
  return orders.map(/** 只选取侧栏展示所需的订单摘要字段。 */ ({ orderId, title, status, statusCode, totalAmount, department }) =>
    ({ orderId, title, status, statusCode, totalAmount, department }));
}
