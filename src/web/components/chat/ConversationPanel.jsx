/**
 * 对话区展示：组合版本和模式开关、调用统计、示例问题与 CopilotChatView。
 * 所有业务状态和操作由页面注入；空消息时显示欢迎场景，否则展示实际对话。
 */
import React from 'react';
import { CopilotChatView } from '@copilotkit/react-core/v2';
import { implementations } from '../../content/chat-config.js';
import { Composer } from './Composer.jsx';
import { AssistantMessage } from './AssistantMessage.jsx';
import { TracePanel } from './TracePanel.jsx';

export function ConversationPanel({ agentId, framework, onFramework, mode, config,
  orders, error, setError, onMode, agent, isReady, draft, setDraft, events, busy, send, stop, choose }) {
  const frameworkLabel = implementations[framework].label;
  return <main className="conversation"><div className="conversation-header"><div className="conversation-title"><span className={`connection-dot ${isReady ? 'ready' : ''}`} /><strong>{busy ? '正在查询订单…' : '订单工作台'}</strong></div><div className="mode-switch" aria-label="测试模式"><button aria-pressed={mode === 'demo'} disabled={busy} onClick={() => onMode('demo')}>本地演示</button><button aria-pressed={mode === 'live'} disabled={busy} onClick={() => onMode('live')}>真实模型</button></div></div>
        <section className="implementation-bar" aria-label="实现版本"><div className="implementation-heading"><span>实现版本</span><div className="mode-switch">{Object.entries(implementations).map(([id, item]) => <button key={id} aria-pressed={framework === id} disabled={busy} onClick={() => onFramework(id)}>{item.label}</button>)}</div><code>{implementations[framework].detail}</code></div><p>{mode === 'demo' ? (framework === 'native' ? '当前执行原生循环；模型由本地脚本模拟，不请求外部 API。' : `当前为共用固定规则演示；切换“真实模型”后使用 ${frameworkLabel}。`) : `当前使用 ${frameworkLabel} · ${agentId}`}<span>切换版本或模式会开始新对话。</span></p></section>
        <TracePanel events={events} mode={mode} framework={frameworkLabel} running={busy} />
        <div className="mobile-samples" aria-label="示例订单">{orders.map((order) => <button key={order.orderId} disabled={busy} onClick={() => choose(`请查看 ${order.orderId} 的订单详情，并说明当前进度。`)}>{order.orderId}<span>{order.status}</span></button>)}</div>
        {error && <div className="error-banner" role="alert">{error}<button aria-label="关闭提示" onClick={() => setError('')}>×</button></div>}
        <div className="chat-container"><CopilotChatView className="order-chat" messages={agent.messages} isRunning={busy} messageView={{ assistantMessage: AssistantMessage, className: 'conversation-messages' }} scrollView={{ className: 'conversation-scroll' }} input={Composer} inputValue={draft} onInputChange={setDraft} onSubmitMessage={send} onStop={stop} autoScroll="pin-to-send" welcomeScreen={false}>
          {({ scrollView, input }) => <><div className={`chat-scroll-zone ${agent.messages.length === 0 ? 'is-empty' : ''}`}>{agent.messages.length === 0 ? <div className="welcome"><div className="welcome-icon" aria-hidden="true">✳︎</div><div className="panel-eyebrow">LESS SEARCHING. MORE CLARITY.</div><h1>订单的每一步，<br /><em>一问就清楚。</em></h1><p>从采购审批到配送签收，<br />让零散的信息变成一张清晰的订单卡片。</p><div className="welcome-prompts"><button disabled={!isReady || busy} onClick={() => send('A1001 现在到哪一步了，谁在审批？')}><span><b>谁在审批？</b><small>查询 A1001 的当前进度</small></span><span>↗</span></button><button disabled={!isReady || busy} onClick={() => send('A1002 什么时候送到，付了多少钱？')}><span><b>什么时候送到？</b><small>查看 A1002 的配送与付款</small></span><span>↗</span></button></div><small>示例数据 · 只读查询 · 支持连续追问</small></div> : scrollView}</div><div className="chat-composer-zone">{input}<p className="composer-note">{mode === 'demo' ? (framework === 'native' ? '原生循环 Demo · 脚本模拟模型 · 不消耗 Token' : '本地演示 · 固定规则回答 · 不消耗 Token') : `${frameworkLabel} · ${config?.model || '真实模型'} · 发送后产生 API 用量`}</p></div></>}
        </CopilotChatView></div>
      </main>;
}
