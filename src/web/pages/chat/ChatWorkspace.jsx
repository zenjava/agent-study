/**
 * 聊天工作台组装：注册工具卡片，将运行状态与事件回调交给各展示区域。
 * 这里连接状态与组件，不直接请求模型，也不保存另一份消息列表。
 */
import React from 'react';
import { useRenderTool } from '@copilotkit/react-core/v2';
import { z } from 'zod';
import { OrderCard } from '../../components/chat/OrderCard.jsx';
import { ChatHeader } from '../../components/chat/ChatHeader.jsx';
import { OrderSidebar } from '../../components/chat/OrderSidebar.jsx';
import { ConversationPanel } from '../../components/chat/ConversationPanel.jsx';
import { useChatRun } from '../../state/chat/useChatRun.js';

export function ChatWorkspace(props) {
  const { agentId, framework, orders, config, onReset } = props;
  const run = useChatRun(props);
  const { busy, isReady, setDraft } = run;
  // 前后端用同名 getOrder 关联工具与卡片；这是渲染注册，不在浏览器执行订单查询。
  useRenderTool({ name: 'getOrder', agentId, parameters: z.object({ orderId: z.string() }), render: OrderCard }, [agentId]);
  // 示例订单只填写草稿并聚焦输入框，是否发送仍由用户决定。
  function choose(question) {
    setDraft(question);
    document.querySelector('textarea[aria-label="输入订单问题"]')?.focus();
  }
  return <div className="app-shell">
    <ChatHeader framework={framework} busy={busy} onReset={onReset} />
    <div className="workspace">
      <OrderSidebar orders={orders} busy={busy} choose={choose} isReady={isReady} config={config} />
      <ConversationPanel {...props} {...run} choose={choose} />
    </div>
    <footer className="app-footer"><span>HARNESS <i>／</i> 工具调用实验台</span><span>示例数据仅用于学习和测试 · 不执行审批、付款或修改</span></footer>
  </div>;
}
