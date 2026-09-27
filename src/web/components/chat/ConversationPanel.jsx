/**
 * 对话区展示：组合版本和模式开关、调用统计、示例问题与 CopilotChatView。
 * 所有业务状态和操作由页面注入；空消息时显示欢迎场景，否则展示实际对话。
 */
import React from 'react';
import { CopilotChatView } from '@copilotkit/react-core/v2';
import { implementations } from '../../content/chat-config.js';
import { welcomePrompts, detailQuestion } from '../../content/demo/chat-prompts.demo.js';
import { Composer } from './Composer.jsx';
import { AssistantMessage } from './AssistantMessage.jsx';
import { TracePanel } from './TracePanel.jsx';

/**
 * 组装实现与模式开关、事件观察、欢迎问题和对话视图。
 * @param {object} props 组件输入。
 * @param {string} props.agentId Runtime 注册的 Agent 标识。
 * @param {string} props.framework 当前 Agent 实现标识。
 * @param {function(string): void} props.onFramework 切换实现的回调。
 * @param {string} props.mode demo 或 live。
 * @param {object|null} props.config 公开模型配置，包含模型名和密钥是否已配置。
 * @param {Array<object>} props.orders 服务端提供的订单摘要。
 * @param {string} props.error 当前错误提示。
 * @param {function(string): void} props.setError 更新错误提示的函数。
 * @param {function(string): void} props.onMode 切换运行模式的回调。
 * @param {object} props.agent CopilotKit 前端 Agent，包含当前消息和运行状态。
 * @param {boolean} props.isReady 当前 Agent 是否已就绪。
 * @param {string} props.draft 当前问题草稿。
 * @param {function(string): void} props.setDraft 更新草稿的函数。
 * @param {Array<object>} props.events 当前会话或回放的执行事件。
 * @param {boolean} props.busy 当前是否提交中或运行中。
 * @param {function(string): Promise<void>} props.send 提交问题的操作。
 * @param {function(): Promise<void>} props.stop 停止运行的操作。
 * @param {function(string): void} props.choose 填入示例问题并聚焦输入框的操作。
 * @returns {React.ReactElement} 当前组件的渲染结果。
 */
export function ConversationPanel({ agentId, framework, onFramework, mode, config,
  orders, error, setError, onMode, agent, isReady, draft, setDraft, events, busy, send, stop, choose }) {
  const frameworkLabel = implementations[framework].label;
  return <main className="conversation"><div className="conversation-header"><div className="conversation-title"><span className={`connection-dot ${isReady ? 'ready' : ''}`} /><strong>{busy ? '正在查询订单…' : '订单工作台'}</strong></div><div className="mode-switch" aria-label="测试模式"><button aria-pressed={mode === 'demo'} disabled={busy} onClick={/** 切换到本地演示模式。 */ () => onMode('demo')}>本地演示</button><button aria-pressed={mode === 'live'} disabled={busy} onClick={/** 切换到真实模型模式。 */ () => onMode('live')}>真实模型</button></div></div>
        <section className="implementation-bar" aria-label="实现版本"><div className="implementation-heading"><span>实现版本</span><div className="mode-switch">{Object.entries(implementations).map(/** 为每种 Agent 实现渲染切换按钮。 */ ([id, item]) => <button key={id} aria-pressed={framework === id} disabled={busy} onClick={/** 选择当前按钮对应的 Agent 实现。 */ () => onFramework(id)}>{item.label}</button>)}</div><code>{implementations[framework].detail}</code></div><p>{mode === 'demo' ? (framework === 'native' ? '当前执行原生循环；模型由本地脚本模拟，不请求外部 API。' : `当前为共用固定规则演示；切换“真实模型”后使用 ${frameworkLabel}。`) : `当前使用 ${frameworkLabel} · ${agentId}`}<span>切换版本或模式会开始新对话。</span></p></section>
        <TracePanel events={events} mode={mode} framework={frameworkLabel} running={busy} />
        <div className="mobile-samples" aria-label="示例订单">{orders.map(/** 渲染移动端示例订单入口。 */ (order) => <button key={order.orderId} disabled={busy} onClick={/** 将所选订单的详情问题填入草稿。 */ () => choose(detailQuestion(order.orderId))}>{order.orderId}<span>{order.status}</span></button>)}</div>
        {error && <div className="error-banner" role="alert">{error}<button aria-label="关闭提示" onClick={/** 清空当前错误提示。 */ () => setError('')}>×</button></div>}
        <div className="chat-container"><CopilotChatView className="order-chat" messages={agent.messages} isRunning={busy} messageView={{ assistantMessage: AssistantMessage, className: 'conversation-messages' }} scrollView={{ className: 'conversation-scroll' }} input={Composer} inputValue={draft} onInputChange={setDraft} onSubmitMessage={send} onStop={stop} autoScroll="pin-to-send" welcomeScreen={false}>
          {/** 根据是否已有消息选择欢迎区或对话滚动区，并放置受控输入组件。 */ ({ scrollView, input }) => <><div className={`chat-scroll-zone ${agent.messages.length === 0 ? 'is-empty' : ''}`}>{agent.messages.length === 0 ? <div className="welcome"><div className="welcome-icon" aria-hidden="true">✳︎</div><div className="panel-eyebrow">LESS SEARCHING. MORE CLARITY.</div><h1>订单的每一步，<br /><em>一问就清楚。</em></h1><p>从采购审批到配送签收，<br />让零散的信息变成一张清晰的订单卡片。</p><div className="welcome-prompts">{welcomePrompts.map(/** 为每个欢迎问题渲染可发送的快捷按钮。 */ (prompt) => <button key={prompt.question} disabled={!isReady || busy} onClick={/** 发送当前欢迎问题。 */ () => send(prompt.question)}><span><b>{prompt.title}</b><small>{prompt.detail}</small></span><span>↗</span></button>)}</div><small>示例数据 · 只读查询 · 支持连续追问</small></div> : scrollView}</div><div className="chat-composer-zone">{input}<p className="composer-note">{mode === 'demo' ? (framework === 'native' ? '原生循环 Demo · 脚本模拟模型 · 不消耗 Token' : '本地演示 · 固定规则回答 · 不消耗 Token') : `${frameworkLabel} · ${config?.model || '真实模型'} · 发送后产生 API 用量`}</p></div></>}
        </CopilotChatView></div>
      </main>;
}
