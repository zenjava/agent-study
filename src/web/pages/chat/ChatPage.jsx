/**
 * 聊天页最外层：连接页面级会话状态与 CopilotKit Provider。
 * Provider 的 key 定义会话边界，版本、模式或会话编号变化都会重建内部消息和运行状态。
 */
import React from 'react';
import { CopilotKitProvider, CopilotChatConfigurationProvider } from '@copilotkit/react-core/v2';
import { chatLabels } from '../../content/chat-config.js';
import { useChatSession } from '../../state/chat/useChatSession.js';
import { ChatWorkspace } from './ChatWorkspace.jsx';

/**
 * 以页面状态配置 CopilotKit Provider，并通过 key 明确新会话边界。
 * @returns {React.ReactElement} 当前组件的渲染结果。
 */
export function ChatPage() {
  const { mode, framework, agentId, session, config, orders, error, setError,
    changeFramework, changeMode, resetSession } = useChatSession();
  // 实现、模式或会话编号变化时，重新挂载内部会话状态。
  return (
    <CopilotKitProvider
      key={`${framework}-${mode}-${session}`}
      runtimeUrl="/api/copilotkit"
      agentId={agentId}
      enableInspector={false}
      onError={/** 将 Provider 报告的错误显示在当前页面。 */ ({ error: e }) => {
        setError(e.message);
      }}
    >
      <CopilotChatConfigurationProvider agentId={agentId} labels={chatLabels}>
        <ChatWorkspace
          agentId={agentId}
          framework={framework}
          onFramework={changeFramework}
          mode={mode}
          config={config}
          orders={orders}
          error={error}
          setError={setError}
          onMode={changeMode}
          onReset={resetSession}
        />
      </CopilotChatConfigurationProvider>
    </CopilotKitProvider>
  );
}
