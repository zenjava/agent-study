/**
 * 助手消息展示适配：沿用 CopilotKit 的工具、Markdown 和工具栏插槽。
 * 订单卡片来自工具结果，解读文字来自助手 content，两者保持独立展示。
 */
import React from 'react';
import { CopilotChatAssistantMessage } from '@copilotkit/react-core/v2';

export function AssistantMessage(props) {
  return <CopilotChatAssistantMessage {...props}>{({ message, markdownRenderer, toolCallsView, toolbar, toolbarVisible }) => <section className="assistant-message" data-message-id={message.id}>
    <div className="answer-label"><span aria-hidden="true">✳︎</span>{message.content ? '助手解读' : '订单查询'}</div>
    {toolCallsView}
    {message.content && <div className="answer-content">{markdownRenderer}</div>}
    {toolbarVisible && toolbar}
  </section>}</CopilotChatAssistantMessage>;
}
