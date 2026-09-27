/**
 * 纯业务数据测试：核对明细总额、卡片字段、未知订单以及查询结果的拷贝隔离。
 * 不使用模型或网络，失败表示业务数据约定本身不一致。
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getOrder, listOrderSummaries } from '../src/agent/common/tools/get-order.mjs';

test('订单明细、金额、收货和流程信息可用于卡片展示，金额与行项目一致', /** 验证：订单明细、金额、收货和流程信息可用于卡片展示，金额与行项目一致。 */ () => {
  const summaries = listOrderSummaries();
  assert.equal(summaries.length, 3);
  assert.equal(new Set(summaries.map(/** 提取订单状态，核对示例覆盖的业务场景。 */ (order) => order.status)).size, 3);
  for (const summary of summaries) {
    const { order, found } = getOrder({ orderId: summary.orderId });
    assert.equal(found, true);
    assert.equal(order.totalAmount, order.items.reduce(/** 累计商品数量乘单价，核对订单明细总额。 */ (sum, item) => sum + item.quantity * item.unitPrice, 0));
    assert.ok(order.supplier && order.delivery.address && order.timeline.length >= 3);
    assert.equal(summary.totalAmount, order.totalAmount);
    assert.equal(order.isDemo, true);
  }
});

test('未知订单不制造业务数据，查询结果不能修改内存订单', /** 验证：未知订单不制造业务数据，查询结果不能修改内存订单。 */ () => {
  assert.deepEqual(getOrder({ orderId: 'A9999' }), { found: false, orderId: 'A9999' });
  getOrder({ orderId: 'A1001' }).order.items[0].quantity = 999;
  assert.equal(getOrder({ orderId: 'A1001' }).order.items[0].quantity, 10);
});
