import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getOrder, listOrderSummaries } from '../src/get-order.mjs';

test('订单明细、金额、收货和流程信息可用于卡片展示，金额与行项目一致', () => {
  const summaries = listOrderSummaries();
  assert.equal(summaries.length, 3);
  assert.equal(new Set(summaries.map((order) => order.status)).size, 3);
  for (const summary of summaries) {
    const { order, found } = getOrder({ orderId: summary.orderId });
    assert.equal(found, true);
    assert.equal(order.totalAmount, order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
    assert.ok(order.supplier && order.delivery.address && order.timeline.length >= 3);
    assert.equal(summary.totalAmount, order.totalAmount);
    assert.equal(order.isDemo, true);
  }
});

test('未知订单不制造业务数据，查询结果不能修改内存订单', () => {
  assert.deepEqual(getOrder({ orderId: 'A9999' }), { found: false, orderId: 'A9999' });
  getOrder({ orderId: 'A1001' }).order.items[0].quantity = 999;
  assert.equal(getOrder({ orderId: 'A1001' }).order.items[0].quantity, 10);
});
