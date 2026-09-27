/**
 * 受控输入组件：草稿由上层保存，组件处理输入、提交与停止按钮。
 * 普通 Enter 发送，Shift + Enter 换行；中文输入法组合输入期间不触发提交。
 */
import React from 'react';

export function Composer({ value = '', onChange, onSubmitMessage, onStop, isRunning }) {
  const submit = () => { if (value.trim() && !isRunning) onSubmitMessage?.(value); };
  return <div className="composer"><textarea aria-label="输入订单问题" placeholder="问问订单进度、商品明细或物流…" value={value} maxLength={2000} rows={2} onChange={(e) => onChange?.(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} /><div className="composer-bottom"><span>↵ 发送 · Shift + Enter 换行</span>{isRunning ? <button className="send-button stop" aria-label="停止生成" onClick={onStop}>停止 ■</button> : <button className="send-button" aria-label="发送问题" disabled={!value.trim()} onClick={submit}>发送 ↑</button>}</div></div>;
}
