/**
 * 结果展示教学图：对比工具 JSON 到订单卡片、模型文字到 Markdown 的两条路径。
 * 这里的示例内容是静态说明，不参与工作台真实消息渲染。
 */
import React from 'react';
import example from '../../content/demo/render-paths.demo.json';

export function RenderPaths() {
  return <div className="render-paths"><div><span className="eyebrow">工具结果</span><code>{example.toolPayload}</code><span className="flow-down">↓ getOrder → OrderCard</span><div className="mini-order"><small>采购订单 {example.orderId} <span>{example.status}</span></small><strong>{example.amount}</strong><p>{example.approverRole} · {example.approverName}</p></div></div><div><span className="eyebrow">模型回答</span><code>{example.answer}</code><span className="flow-down">↓ content → Markdown renderer</span><div className="mini-answer">当前由 <strong>{example.approverRole}</strong> 审批。<small>模型组织的自然语言解读</small></div></div></div>;
}
