/**
 * 单次会话的运行状态：连接前端 Agent，维护草稿、事件轨迹、提交锁与取消操作。
 * 消息与 isRunning 仍由 CopilotKit 管理，本 hook 不复制其消息存储。
 */
import { useEffect, useRef, useState } from 'react';
import { useAgent, useCopilotKit } from '@copilotkit/react-core/v2';

// 随 Provider 会话存在的状态：消息代理、运行事件、提交锁和取消。
export function useChatRun({ agentId, mode, config, setError }) {
  const { agent, isReady } = useAgent({ agentId });
  const { copilotkit } = useCopilotKit();
  const [draft, setDraft] = useState('');
  const [events, setEvents] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  // ref 可同步阻止同一渲染周期内重复提交；submitting 用于驱动按钮的可见状态。
  const submitLock = useRef(false);
  const busy = submitting || agent.isRunning;
  // 只订阅当前已就绪的 Agent；切换会话时取消旧订阅，防止事件重复累加。
  useEffect(() => {
    if (!isReady) return;
    const subscription = agent.subscribe({
      onCustomEvent: ({ event }) => { if (event.name === 'harness') setEvents((previous) => [...previous, event.value]); },
    });
    return () => subscription.unsubscribe();
  }, [agent, isReady]);

  // 提交顺序：检查可运行条件 → 加入用户消息 → 请求 Runtime；finally 确保提交锁释放。
  async function send(question) {
    if (!question.trim() || !isReady || submitLock.current || agent.isRunning) return;
    if (mode === 'live' && !config?.keyConfigured) { setError('请先在本机 .env 中配置模型 Key，再重启服务。'); return; }
    submitLock.current = true; setSubmitting(true); setError(''); setDraft('');
    agent.addMessage({ id: crypto.randomUUID(), role: 'user', content: question.trim() });
    try { await copilotkit.runAgent({ agent }); }
    catch (e) { setError(e.message || '本次请求未完成，请重试。'); }
    finally { submitLock.current = false; setSubmitting(false); }
  }
  // 通过 SDK 请求后端中断，保留已经收到的卡片和用量，供用户核对部分结果。
  async function stop() {
    try { await copilotkit.stopAgent({ agent }); setError('本次生成已停止，已获取的结果和用量仍保留。'); }
    catch { setError('停止请求失败，请稍后重试。'); }
  }
  return { agent, isReady, draft, setDraft, events, busy, send, stop };
}
