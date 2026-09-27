/**
 * 桌面订单侧栏：用摘要展示示例订单，并将预设问题交给上层填入输入框。
 * 同时展示连接与配置状态，不在侧栏独立查询完整订单。
 */
import React from 'react';
import { sampleActions, absentQuestion, missingQuestion, detailQuestion } from '../../content/demo/chat-prompts.demo.js';
import { money } from './OrderCard.jsx';

/**
 * 展示服务端提供的订单摘要与边界场景，点击后只将问题交给上层填入。
 * @param {object} props 组件输入。
 * @param {Array<object>} props.orders 服务端提供的订单摘要。
 * @param {boolean} props.busy 当前是否提交中或运行中。
 * @param {function(string): void} props.choose 填入示例问题并聚焦输入框的操作。
 * @param {boolean} props.isReady 当前 Agent 是否已就绪。
 * @param {object|null} props.config 公开模型配置，包含模型名和密钥是否已配置。
 * @returns {React.ReactElement} 当前组件的渲染结果。
 */
export function OrderSidebar({ orders, busy, choose, isReady, config }) {
  return <aside className="order-sidebar"><div className="panel-eyebrow">WORKSPACE / 01</div><h2>从一张订单开始</h2><p className="panel-caption">选个场景，看看 AI 如何展示业务信息。</p>
        <div className="section-label">示例订单 <span>{String(orders.length).padStart(2, '0')}</span></div>
        <div className="sample-orders">{orders.map(/** 渲染带状态、金额和部门的订单摘要按钮。 */ (order, i) => <button className={`sample-order ${order.statusCode}`} key={order.orderId} disabled={busy} onClick={/** 将所选订单的详情问题交给上层填入。 */ () => choose(detailQuestion(order.orderId))}><div className="sample-top"><span>{order.orderId}</span><span className={`status-pill ${order.statusCode}`}>{order.status}</span></div><strong>{order.title.split(' · ')[1]}</strong><p>{order.department} <span>{money(order.totalAmount)}</span></p><span className="sample-bottom">{sampleActions[i]} <span>↗</span></span></button>)}</div>
        <div className="section-label edge-cases">更多测试</div><button className="text-action" disabled={busy} onClick={/** 填入查询不存在订单的预设问题。 */ () => choose(absentQuestion)}>查询不存在的订单 <span>↗</span></button><button className="text-action" disabled={busy} onClick={/** 填入缺少订单号的预设问题。 */ () => choose(missingQuestion)}>不提供订单号 <span>↗</span></button>
        <div className="sidebar-footer"><span className={`connection-dot ${isReady ? 'ready' : ''}`} />{isReady ? '本地服务已连接' : '正在连接服务…'}<small>{config?.model || '读取模型配置…'} · {config?.keyConfigured ? 'Key 已配置' : 'Key 未配置'}</small></div>
      </aside>;
}
