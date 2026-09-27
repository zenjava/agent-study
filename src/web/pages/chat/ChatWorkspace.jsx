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

/**
 * 注册订单工具卡片，将会话运行状态分发到页头、侧栏和对话区域。
 * @param {object} props 当前会话、配置、订单和页面操作集合。
 * @param {string} props.agentId Runtime 注册的 Agent 标识。
 * @param {string} props.framework 当前 Agent 实现标识。
 * @param {string} props.mode demo 或 live。
 * @param {Array<object>} props.orders 服务端提供的订单摘要。
 * @param {object|null} props.config 公开模型配置，包含模型名和密钥是否已配置。
 * @param {function(string): void} props.setError 更新错误提示的函数。
 * @param {function(): void} props.onReset 开启新对话的回调。
 * @param {function(string): void} props.onFramework 切换实现的回调。
 * @param {function(string): void} props.onMode 切换运行模式的回调。
 * @param {string} props.error 当前错误提示。
 * @returns {React.ReactElement} 当前组件的渲染结果。
 */
export function ChatWorkspace(props) {
  const { agentId, framework, orders, config, onReset } = props;
  const run = useChatRun(props);
  const { busy, isReady, setDraft } = run;
  // 前后端用同名 getOrder 关联工具与卡片；这是渲染注册，不在浏览器执行订单查询。
  useRenderTool({ name: 'getOrder', agentId, parameters: z.object({ orderId: z.string() }), render: OrderCard }, [agentId]);
  /**
   * 将示例问题填入草稿并聚焦输入框，等待用户主动发送。
   * @param {string} question 要填入的预设问题。
   * @returns {void}
   */
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
