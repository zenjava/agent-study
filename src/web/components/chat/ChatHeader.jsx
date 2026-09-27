/**
 * 工作台顶部展示：按当前实现选择教程链接，并提供新对话操作。
 * 运行期间禁用重置，实际会话清理由上层回调完成。
 */
import React from 'react';
import { implementations } from '../../content/chat-config.js';

export function ChatHeader({ framework, busy, onReset }) {
  const frameworkLabel = implementations[framework].label;
  return <header className="topbar"><div className="brand"><span className="brand-icon" aria-hidden="true">◈</span><div><strong>订单助手<span className="brand-slash"> / </span><span className="brand-subtitle">Copilot</span></strong><span>把每一笔订单，看得更清楚。</span></div></div><div className="topbar-actions"><a className="learning-entry" href={implementations[framework].course} target="_blank" rel="noreferrer">{frameworkLabel} 导读 ↗</a><span className="powered">Powered by <b>CopilotKit</b></span><button className="new-chat" disabled={busy} onClick={onReset}>＋ 新对话</button></div></header>;
}
