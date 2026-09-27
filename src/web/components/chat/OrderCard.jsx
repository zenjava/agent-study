/**
 * getOrder 工具结果的业务卡片：区分加载、异常、未找到与成功四类状态。
 * 成功结果中的金额、审批和配送信息直接来自查询数据；本地状态仅控制详情标签。
 */
import examples from '../../../agent/common/demo/inputs.demo.json';
import React, { useState } from 'react';

/**
 * 按人民币格式展示含税金额，不额外计算税额。
 * @param {number} amount 以人民币元为单位的金额。
 * @returns {string} 包含货币符号、千分位及最多两位小数的文本。
 */
export const money = (amount) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 }).format(amount);

/**
 * 根据工具状态展示加载、错误、未找到或订单详情，标签切换仅影响本地展示。
 * @param {object} props 组件输入。
 * @param {string} props.status 工具执行状态，complete 表示结果已返回。
 * @param {object} props.parameters 工具输入，包含可选的 orderId。
 * @param {object|string|undefined} props.result 工具结果对象或 JSON 文本。
 * @returns {React.ReactElement} 当前组件的渲染结果。
 */
export function OrderCard({ status, parameters, result }) {
  const [tab, setTab] = useState('items');
  if (status !== 'complete') return <div className="tool-loading" role="status"><span className="spinner" />正在查询订单 {parameters?.orderId || '…'}<small>读取商品、审批与配送信息</small></div>;
  // AG-UI 结果可能已是对象，也可能仍是 JSON 字符串；解析失败只降级当前卡片。
  let payload;
  try { payload = typeof result === 'string' ? JSON.parse(result) : result; } catch { /* 展示可见错误，避免整段对话崩溃。 */ }
  if (!payload) return <div className="result-notice">订单结果格式异常，请重新查询。</div>;
  if (payload.error) return <div className="result-notice">查询失败：{payload.error.message}</div>;
  if (!payload.found) return <div className="result-notice"><strong>没有找到 {payload.orderId}</strong><p>请核对订单号。示例订单为 {examples.orderIds.join('、')}。</p></div>;
  const o = payload.order;
  return <article className="order-card" aria-label={`订单 ${o.orderId} 详情`}>
    <div className="order-card-heading"><span className="order-ref"><span aria-hidden="true">▤</span> 采购订单 <b>{o.orderId}</b></span><span className={`status-pill ${o.statusCode}`}><span aria-hidden="true">●</span> {o.status}</span></div>
    <h3>{o.title}</h3>
    <p className="supplier">{o.supplier}</p>
    <div className="order-hero"><div><span>订单含税总额</span><strong>{money(o.totalAmount)}</strong></div><div className="order-hero-meta"><span>{o.items.length} 类商品 · {o.items.reduce(/** 累加明细数量，展示订单商品总件数。 */ (sum, item) => sum + item.quantity, 0)} 件</span><span>{o.createdAt} 创建</span></div></div>
    <dl className="order-facts"><div><dt>申请人 / 部门</dt><dd>{o.applicant} · {o.department}</dd></div><div><dt>{o.currentApprover ? '当前审批人' : '配送状态'}</dt><dd>{o.currentApprover ? `${o.currentApprover} · ${o.approverName}` : o.delivery.status}</dd></div></dl>
    <div className="card-tabs" role="tablist" aria-label={`${o.orderId} 信息分类`}>
      {[['items', '商品明细'], ['timeline', '订单流程'], ['delivery', '配送与结算']].map(/** 渲染商品、流程及配送结算的分类标签。 */ ([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={/** 切换订单详情的当前标签。 */ () => setTab(id)}>{label}</button>)}
    </div>
    <div className="card-tab-panel" role="tabpanel">
      {tab === 'items' && <div className="items-table-wrap"><table className="items-table"><thead><tr><th>商品 / 规格</th><th>数量 / 单价</th><th>小计</th></tr></thead><tbody>{o.items.map(/** 渲染一行商品名称、数量、单价和小计。 */ (item, index) => <tr key={item.sku}><td><div className="product-cell"><span className="product-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><strong>{item.name}</strong><small>{item.specification}</small><small className="mobile-quantity">{item.quantity} {item.unit} × {money(item.unitPrice)}</small></div></div></td><td>{item.quantity} {item.unit}<small>{money(item.unitPrice)}</small></td><td>{money(item.quantity * item.unitPrice)}</td></tr>)}</tbody></table></div>}
      {tab === 'timeline' && <ol className="order-timeline">{o.timeline.map(/** 按完成状态渲染一项订单流程及负责人。 */ (item, i) => <li className={item.state} key={item.title}><span className="timeline-dot">{item.state === 'done' ? '✓' : i + 1}</span><div><strong>{item.title}</strong><span>{item.owner}</span></div><time>{item.date}</time></li>)}</ol>}
      {tab === 'delivery' && <div className="delivery-grid"><section><h4>配送信息</h4><p>{o.delivery.address}</p><p>收件人：{o.delivery.recipient}</p><p>计划到货：{o.expectedAt}</p>{o.delivery.carrier && <p>{o.delivery.carrier} · {o.delivery.trackingNumber}</p>}</section><section><h4>付款与发票</h4><p>{o.payment.status} · 已付 {money(o.payment.paidAmount)}</p><p>{o.payment.terms}</p><p>{o.invoice.type} · {o.invoice.status}</p></section></div>}
    </div>
    <div className="order-note">{o.note}</div>
    <div className="order-card-footer"><span>✓ 来自订单查询结果</span><span>虚构教学数据</span></div>
  </article>;
}
