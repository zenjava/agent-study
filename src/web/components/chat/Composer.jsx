/**
 * 受控输入组件：草稿由上层保存，组件处理输入、提交与停止按钮。
 * 普通 Enter 发送，Shift + Enter 换行；中文输入法组合输入期间不触发提交。
 */
import React from 'react';

/**
 * 渲染受控问题输入框，处理输入法、回车提交和停止生成。
 * @param {object} props 组件输入。
 * @param {string} [props.value=""] 当前问题草稿。
 * @param {function(string): void} [props.onChange] 草稿变化回调。
 * @param {function(string): *} [props.onSubmitMessage] 提交问题的回调。
 * @param {function(): *} [props.onStop] 停止当前运行的回调。
 * @param {boolean} props.isRunning 是否正在运行。
 * @returns {React.ReactElement} 当前组件的渲染结果。
 */
export function Composer({ value = '', onChange, onSubmitMessage, onStop, isRunning }) {
  /**
   * 在草稿非空且当前未运行时通知上层提交，保留原始输入供上层处理。
   * @returns {void}
   */
  const submit = () => {
    if (value.trim() && !isRunning) {
      onSubmitMessage?.(value);
    }
  };

  return (
    <div className="composer">
      <textarea
        aria-label="输入订单问题"
        placeholder="问问订单进度、商品明细或物流…"
        value={value}
        maxLength={2000}
        rows={2}
        onChange={/** 将输入框当前文本传给上层草稿回调。 */ (e) => onChange?.(e.target.value)}
        onKeyDown={/** 仅在非组合输入且未按 Shift 时拦截 Enter 并提交问题。 */ (e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <div className="composer-bottom">
        <span>↵ 发送 · Shift + Enter 换行</span>
        {isRunning ? (
          <button className="send-button stop" aria-label="停止生成" onClick={onStop}>停止 ■</button>
        ) : (
          <button className="send-button" aria-label="发送问题" disabled={!value.trim()} onClick={submit}>发送 ↑</button>
        )}
      </div>
    </div>
  );
}
