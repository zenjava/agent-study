/**
 * Token 上下文教学图：勾选历史消息后展示两次请求都会携带的上下文组成。
 * 不估算 Token 或费用，实际用量以工作台的供应商 usage 为准。
 */
import React, { useState } from 'react';

/**
 * 通过是否包含历史消息的开关，演示多次请求如何累计 Token。
 * @returns {React.ReactElement} 当前组件的渲染结果。
 */
export function TokenGuide() {
  const [showHistory, setShowHistory] = useState(false);
  return <section className="token-guide"><div className="section-heading"><div><span className="eyebrow">CONTEXT & COST</span><h3>Token 为什么会叠加？</h3></div><label><input type="checkbox" checked={showHistory} onChange={/** 按复选框状态决定演示是否包含历史消息。 */ (event) => setShowHistory(event.target.checked)} />加入历史对话</label></div><div className="context-row"><b>请求 1</b><div><span>系统规则</span><span>工具定义</span>{showHistory && <span className="history-chip">历史消息</span>}<span>当前问题</span></div></div><div className="context-row"><b>请求 2</b><div><span>系统规则</span><span>工具定义</span>{showHistory && <span className="history-chip">历史消息</span>}<span>当前问题</span><span className="new-chip">工具调用记录</span><span className="new-chip">订单结果</span></div></div><p>第二次请求会再次携带上下文。完整订单和历史越长，输入通常越多。这里仅表示内容组成，不估算 Token 数；真实消耗读取供应商的 usage，缓存计价另看供应商规则。</p><p>实验台按 <code>runId + step</code> 关联每次请求；顶部汇总是当前会话累计。缺少 usage 显示未知，不能当作 0。LangChain 自身的本地函数执行不消耗模型 Token。</p></section>;
}
