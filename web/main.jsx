import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CopilotKitProvider, CopilotChatConfigurationProvider, CopilotChatView, CopilotChatAssistantMessage, useAgent, useCopilotKit, useRenderTool } from '@copilotkit/react-core/v2';
import { z } from 'zod';
import '@copilotkit/react-core/v2/styles.css';
import './style.css';
import { OrderCard, money } from './OrderCard.jsx';
import { TracePanel } from './TracePanel.jsx';

const labels = { chatInputPlaceholder: '问问订单进度、商品明细或物流…', welcomeMessageText: '让订单，自己说清楚。', assistantMessageToolbarCopyMessageLabel: '复制回答', assistantMessageToolbarCopyCodeLabel: '复制代码', assistantMessageToolbarCopyCodeCopiedLabel: '已复制', userMessageToolbarCopyMessageLabel: '复制问题', chatDisclaimerText: '订单均为虚构教学数据。' };

function App() {
  const [mode, setMode] = useState('demo');
  const [session, setSession] = useState(0);
  const [config, setConfig] = useState(null);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    Promise.all(['/api/config', '/api/orders'].map(async (url) => {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('读取配置失败，请刷新页面。');
      return response.json();
    })).then(([nextConfig, data]) => { setConfig(nextConfig); setOrders(data.orders); }).catch((e) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, []);
  return <CopilotKitProvider key={`${mode}-${session}`} runtimeUrl="/api/copilotkit" agentId={mode === 'demo' ? 'demo' : 'orders'} enableInspector={false} onError={({ error: e }) => setError(e.message)}>
    <CopilotChatConfigurationProvider agentId={mode === 'demo' ? 'demo' : 'orders'} labels={labels}>
      <Workspace mode={mode} config={config} orders={orders} error={error} setError={setError} onMode={(next) => { setError(''); setMode(next); }} onReset={() => { setError(''); setSession((value) => value + 1); }} />
    </CopilotChatConfigurationProvider>
  </CopilotKitProvider>;
}

function Composer({ value = '', onChange, onSubmitMessage, onStop, isRunning }) {
  const submit = () => { if (value.trim() && !isRunning) onSubmitMessage?.(value); };
  return <div className="composer"><textarea aria-label="输入订单问题" placeholder="问问订单进度、商品明细或物流…" value={value} maxLength={2000} rows={2} onChange={(e) => onChange?.(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} /><div className="composer-bottom"><span>↵ 发送 · Shift + Enter 换行</span>{isRunning ? <button className="send-button stop" aria-label="停止生成" onClick={onStop}>停止 ■</button> : <button className="send-button" aria-label="发送问题" disabled={!value.trim()} onClick={submit}>发送 ↑</button>}</div></div>;
}

function AssistantMessage(props) {
  return <CopilotChatAssistantMessage {...props}>{({ message, markdownRenderer, toolCallsView, toolbar, toolbarVisible }) => <section className="assistant-message" data-message-id={message.id}>
    <div className="answer-label"><span aria-hidden="true">✳︎</span>{message.content ? '助手解读' : '订单查询'}</div>
    {toolCallsView}
    {message.content && <div className="answer-content">{markdownRenderer}</div>}
    {toolbarVisible && toolbar}
  </section>}</CopilotChatAssistantMessage>;
}

function Workspace({ mode, config, orders, error, setError, onMode, onReset }) {
  const agentId = mode === 'demo' ? 'demo' : 'orders';
  const { agent, isReady } = useAgent({ agentId });
  const { copilotkit } = useCopilotKit();
  const [draft, setDraft] = useState('');
  const [events, setEvents] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const busy = submitting || agent.isRunning;
  useRenderTool({ name: 'getOrder', agentId, parameters: z.object({ orderId: z.string() }), render: OrderCard }, [agentId]);
  useEffect(() => {
    if (!isReady) return;
    const subscription = agent.subscribe({
      onCustomEvent: ({ event }) => { if (event.name === 'harness') setEvents((previous) => [...previous, event.value]); },
    });
    return () => subscription.unsubscribe();
  }, [agent, isReady]);

  async function send(question) {
    if (!question.trim() || !isReady || submitLock.current || agent.isRunning) return;
    if (mode === 'live' && !config?.keyConfigured) { setError('请先在本机 .env 中配置模型 Key，再重启服务。'); return; }
    submitLock.current = true; setSubmitting(true); setError(''); setDraft('');
    agent.addMessage({ id: crypto.randomUUID(), role: 'user', content: question.trim() });
    try { await copilotkit.runAgent({ agent }); }
    catch (e) { setError(e.message || '本次请求未完成，请重试。'); }
    finally { submitLock.current = false; setSubmitting(false); }
  }
  async function stop() {
    try { await copilotkit.stopAgent({ agent }); setError('本次生成已停止，已获取的结果和用量仍保留。'); }
    catch { setError('停止请求失败，请稍后重试。'); }
  }
  function choose(question) { setDraft(question); document.querySelector('textarea[aria-label="输入订单问题"]')?.focus(); }

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-icon" aria-hidden="true">◈</span><div><strong>订单助手<span className="brand-slash"> / </span><span className="brand-subtitle">Copilot</span></strong><span>把每一笔订单，看得更清楚。</span></div></div><div className="topbar-actions"><span className="powered">Powered by <b>CopilotKit</b></span><button className="new-chat" disabled={busy} onClick={onReset}>＋ 新对话</button></div></header>
    <div className="workspace">
      <aside className="order-sidebar"><div className="panel-eyebrow">WORKSPACE / 01</div><h2>从一张订单开始</h2><p className="panel-caption">选个场景，看看 AI 如何展示业务信息。</p>
        <div className="section-label">示例订单 <span>03</span></div>
        <div className="sample-orders">{orders.map((order, i) => <button className={`sample-order ${order.statusCode}`} key={order.orderId} disabled={busy} onClick={() => choose(`请查看 ${order.orderId} 的订单详情，并说明当前进度。`)}><div className="sample-top"><span>{order.orderId}</span><span className={`status-pill ${order.statusCode}`}>{order.status}</span></div><strong>{order.title.split(' · ')[1]}</strong><p>{order.department} <span>{money(order.totalAmount)}</span></p><span className="sample-bottom">{['查看审批与明细', '查看物流与付款', '查看验收与发票'][i]} <span>↗</span></span></button>)}</div>
        <div className="section-label edge-cases">更多测试</div><button className="text-action" disabled={busy} onClick={() => choose('请查一下 A9999 的订单。')}>查询不存在的订单 <span>↗</span></button><button className="text-action" disabled={busy} onClick={() => choose('请帮我查一下订单进度。')}>不提供订单号 <span>↗</span></button>
        <div className="sidebar-footer"><span className={`connection-dot ${isReady ? 'ready' : ''}`} />{isReady ? '本地服务已连接' : '正在连接服务…'}<small>{config?.model || '读取模型配置…'} · {config?.keyConfigured ? 'Key 已配置' : 'Key 未配置'}</small></div>
      </aside>
      <main className="conversation"><div className="conversation-header"><div className="conversation-title"><span className={`connection-dot ${isReady ? 'ready' : ''}`} /><strong>{busy ? '正在查询订单…' : '订单工作台'}</strong></div><div className="mode-switch" aria-label="测试模式"><button aria-pressed={mode === 'demo'} disabled={busy} onClick={() => onMode('demo')}>本地演示</button><button aria-pressed={mode === 'live'} disabled={busy} onClick={() => onMode('live')}>真实模型</button></div></div>
        <TracePanel events={events} mode={mode} running={busy} />
        <div className="mobile-samples" aria-label="示例订单">{orders.map((order) => <button key={order.orderId} disabled={busy} onClick={() => choose(`请查看 ${order.orderId} 的订单详情，并说明当前进度。`)}>{order.orderId}<span>{order.status}</span></button>)}</div>
        {error && <div className="error-banner" role="alert">{error}<button aria-label="关闭提示" onClick={() => setError('')}>×</button></div>}
        <div className="chat-container"><CopilotChatView className="order-chat" messages={agent.messages} isRunning={busy} messageView={{ assistantMessage: AssistantMessage, className: 'conversation-messages' }} scrollView={{ className: 'conversation-scroll' }} input={Composer} inputValue={draft} onInputChange={setDraft} onSubmitMessage={send} onStop={stop} autoScroll="pin-to-send" welcomeScreen={false}>
          {({ scrollView, input }) => <><div className={`chat-scroll-zone ${agent.messages.length === 0 ? 'is-empty' : ''}`}>{agent.messages.length === 0 ? <div className="welcome"><div className="welcome-icon" aria-hidden="true">✳︎</div><div className="panel-eyebrow">LESS SEARCHING. MORE CLARITY.</div><h1>订单的每一步，<br /><em>一问就清楚。</em></h1><p>从采购审批到配送签收，<br />让零散的信息变成一张清晰的订单卡片。</p><div className="welcome-prompts"><button disabled={!isReady || busy} onClick={() => send('A1001 现在到哪一步了，谁在审批？')}><span><b>谁在审批？</b><small>查询 A1001 的当前进度</small></span><span>↗</span></button><button disabled={!isReady || busy} onClick={() => send('A1002 什么时候送到，付了多少钱？')}><span><b>什么时候送到？</b><small>查看 A1002 的配送与付款</small></span><span>↗</span></button></div><small>示例数据 · 只读查询 · 支持连续追问</small></div> : scrollView}</div><div className="chat-composer-zone">{input}<p className="composer-note">{mode === 'demo' ? '本地演示 · 固定规则回答 · 不消耗 Token' : `${config?.model || '真实模型'} · 发送后产生 API 用量 · 虚构示例数据`}</p></div></>}
        </CopilotChatView></div>
      </main>
    </div>
    <footer className="app-footer"><span>HARNESS <i>／</i> 工具调用实验台</span><span>示例数据仅用于学习和测试 · 不执行审批、付款或修改</span></footer>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
