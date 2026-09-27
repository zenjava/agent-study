/**
 * 助手消息展示适配：沿用 CopilotKit 的工具、Markdown 和工具栏插槽。
 * 订单卡片来自工具结果，解读文字来自助手 content，两者保持独立展示。
 */
import React from 'react';
import { CopilotChatAssistantMessage } from '@copilotkit/react-core/v2';

/**
 * 将助手文字、工具卡片和工具栏组合为同一条消息视图。
 * @param {object} props CopilotKit 传入的助手消息插槽属性。
 * @returns {React.ReactElement} 当前组件的渲染结果。
 */
export function AssistantMessage(props) {
  return (
    <CopilotChatAssistantMessage {...props}>
      {/** 将工具视图、Markdown 和可见工具栏填入助手消息布局。 */
      ({ message, markdownRenderer, toolCallsView, toolbar, toolbarVisible }) => (
        <section className="assistant-message" data-message-id={message.id}>
          <div className="answer-label">
            <span aria-hidden="true">✳︎</span>
            {message.content ? '助手解读' : '订单查询'}
          </div>
          {toolCallsView}
          {message.content && <div className="answer-content">{markdownRenderer}</div>}
          {toolbarVisible && toolbar}
        </section>
      )}
    </CopilotChatAssistantMessage>
  );
}
