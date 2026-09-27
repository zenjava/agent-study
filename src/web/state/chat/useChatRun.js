/**
 * 单次会话的运行状态：连接前端 Agent，维护草稿、事件轨迹、提交锁与取消操作。
 * 消息与 isRunning 仍由 CopilotKit 管理，本 hook 不复制其消息存储。
 */
import { useEffect, useRef, useState } from 'react';
import { useAgent, useCopilotKit } from '@copilotkit/react-core/v2';

/**
 * 连接当前前端 Agent，管理草稿、执行事件、同步提交锁及停止操作。
 * @param {object} options 当前会话配置。
 * @param {string} options.agentId Runtime 中注册的 Agent 标识。
 * @param {string} options.mode demo 或 live。
 * @param {object|null} options.config 公开配置，包含 keyConfigured。
 * @param {function(string): void} options.setError 页面错误状态更新函数。
 * @returns {object} Agent、就绪状态、草稿、事件、忙碌状态以及 send、stop 操作。
 */
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
  useEffect(/** 订阅已就绪 Agent 的观察事件，切换 Agent 时清理旧订阅。 */ () => {
    if (!isReady) return;
    const subscription = agent.subscribe({
      /**
       * 只接收 harness 自定义事件，将其中的领域记录追加到当前会话轨迹。
       * @param {object} payload AG-UI 回调参数。
       * @param {object} payload.event 自定义事件，含 name 和 value。
       * @returns {void}
       */
      onCustomEvent: ({ event }) => { if (event.name === 'harness') setEvents(/** 将新的领域事件追加到已有轨迹。 */ (previous) => [...previous, event.value]); },
    });
    return /** 在卸载或更换 Agent 时取消事件订阅。 */ () => subscription.unsubscribe();
  }, [agent, isReady]);

  /**
   * 检查运行条件、加入用户消息并启动 Agent，通过同步锁避免重复提交。
   * @param {string} question 用户输入的问题。
   * @returns {Promise<void>} 运行结束或错误已写入页面后完成；不满足条件时提前返回。
   */
  async function send(question) {
    if (!question.trim() || !isReady || submitLock.current || agent.isRunning) return;
    if (mode === 'live' && !config?.keyConfigured) { setError('请先在本机 .env 中配置模型 Key，再重启服务。'); return; }
    submitLock.current = true; setSubmitting(true); setError(''); setDraft('');
    agent.addMessage({ id: crypto.randomUUID(), role: 'user', content: question.trim() });
    try { await copilotkit.runAgent({ agent }); }
    catch (e) { setError(e.message || '本次请求未完成，请重试。'); }
    finally { submitLock.current = false; setSubmitting(false); }
  }
  /**
   * 通过 CopilotKit 请求停止当前运行，并用页面提示保留已收到的结果和用量。
   * @returns {Promise<void>} 停止结果或错误已写入页面状态后完成。
   */
  async function stop() {
    try { await copilotkit.stopAgent({ agent }); setError('本次生成已停止，已获取的结果和用量仍保留。'); }
    catch { setError('停止请求失败，请稍后重试。'); }
  }
  return { agent, isReady, draft, setDraft, events, busy, send, stop };
}
