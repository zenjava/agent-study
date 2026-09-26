import React, { useState } from 'react';

export const money = (amount) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 }).format(amount);

export function OrderCard({ status, parameters, result }) {
  const [tab, setTab] = useState('items');
  if (status !== 'complete') return <div className="tool-loading" role="status"><span className="spinner" />正在查询订单 {parameters?.orderId || '…'}<small>读取商品、审批与配送信息</small></div>;
  let payload;
  try { payload = typeof result === 'string' ? JSON.parse(result) : result; } catch { /* 展示可见错误，避免整段对话崩溃。 */ }
  if (!payload) return <div className="result-notice">订单结果格式异常，请重新查询。</div>;
  if (payload.error) return <div className="result-notice">查询失败：{payload.error.message}</div>;
  if (!payload.found) return <div className="result-notice"><strong>没有找到 {payload.orderId}</strong><p>请核对订单号。示例订单为 A1001、A1002、A1003。</p></div>;
  const o = payload.order;
  return <article className="order-card" aria-label={`订单 ${o.orderId} 详情`}>
    <div className="order-card-heading"><span className="order-ref"><span aria-hidden="true">▤</span> 采购订单 <b>{o.orderId}</b></span><span className={`status-pill ${o.statusCode}`}><span aria-hidden="true">●</span> {o.status}</span></div>
    <h3>{o.title}</h3>
    <p className="supplier">{o.supplier}</p>
    <div className="order-hero"><div><span>订单含税总额</span><strong>{money(o.totalAmount)}</strong></div><div className="order-hero-meta"><span>{o.items.length} 类商品 · {o.items.reduce((sum, item) => sum + item.quantity, 0)} 件</span><span>{o.createdAt} 创建</span></div></div>
    <dl className="order-facts"><div><dt>申请人 / 部门</dt><dd>{o.applicant} · {o.department}</dd></div><div><dt>{o.currentApprover ? '当前审批人' : '配送状态'}</dt><dd>{o.currentApprover ? `${o.currentApprover} · ${o.approverName}` : o.delivery.status}</dd></div></dl>
    <div className="card-tabs" role="tablist" aria-label={`${o.orderId} 信息分类`}>
      {[['items', '商品明细'], ['timeline', '订单流程'], ['delivery', '配送与结算']].map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}
    </div>
    <div className="card-tab-panel" role="tabpanel">
      {tab === 'items' && <div className="items-table-wrap"><table className="items-table"><thead><tr><th>商品 / 规格</th><th>数量 / 单价</th><th>小计</th></tr></thead><tbody>{o.items.map((item, index) => <tr key={item.sku}><td><div className="product-cell"><span className="product-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><strong>{item.name}</strong><small>{item.specification}</small><small className="mobile-quantity">{item.quantity} {item.unit} × {money(item.unitPrice)}</small></div></div></td><td>{item.quantity} {item.unit}<small>{money(item.unitPrice)}</small></td><td>{money(item.quantity * item.unitPrice)}</td></tr>)}</tbody></table></div>}
      {tab === 'timeline' && <ol className="order-timeline">{o.timeline.map((item, i) => <li className={item.state} key={item.title}><span className="timeline-dot">{item.state === 'done' ? '✓' : i + 1}</span><div><strong>{item.title}</strong><span>{item.owner}</span></div><time>{item.date}</time></li>)}</ol>}
      {tab === 'delivery' && <div className="delivery-grid"><section><h4>配送信息</h4><p>{o.delivery.address}</p><p>收件人：{o.delivery.recipient}</p><p>计划到货：{o.expectedAt}</p>{o.delivery.carrier && <p>{o.delivery.carrier} · {o.delivery.trackingNumber}</p>}</section><section><h4>付款与发票</h4><p>{o.payment.status} · 已付 {money(o.payment.paidAmount)}</p><p>{o.payment.terms}</p><p>{o.invoice.type} · {o.invoice.status}</p></section></div>}
    </div>
    <div className="order-note">{o.note}</div>
    <div className="order-card-footer"><span>✓ 来自订单查询结果</span><span>虚构教学数据</span></div>
  </article>;
}
