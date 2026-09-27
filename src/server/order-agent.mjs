/**
 * 将订单 Agent 的领域事件转换为 AG-UI 消息，供前端卡片、文字和调用统计消费。
 * 同时裁剪文字历史、传递取消信号；不把会话持久化到数据库。
 */
import { AbstractAgent } from '@ag-ui/client';
import { Observable } from 'rxjs';
import { runOrderQuestion } from '../agent/langchain/agent.mjs';
import { runDemo } from '../agent/common/demo/rules.demo.mjs';

/**
 * 提取最后一条有效用户问题及最近二十条文字历史，丢弃客户端工具和系统消息。
 * @param {Array<{role: string, content: *}>} [messages=[]] 前端提交的消息列表。
 * @returns {{question: string, history: Array<{role: string, content: string}>}} 本轮问题与裁剪后的历史；无有效问题时返回空值。
 * @throws {Error} 当前问题超过 2000 个字符时抛出。
 */
export function toConversation(messages = []) {
  const last = messages.at(-1);
  if (last?.role !== 'user' || typeof last.content !== 'string' || !last.content.trim()) {
    return { question: '', history: [] };
  }
  if (last.content.length > 2000) throw new Error('问题最多 2000 个字符。');
  const history = messages.slice(0, -1).filter(/** 只保留内容非空的用户和助手文字，排除系统指令及工具结果。 */ (message) =>
    ['user', 'assistant'].includes(message.role) && typeof message.content === 'string' && message.content.trim(),
  ).slice(-20).map(/** 复制消息角色并限制单条历史文本的长度。 */ ({ role, content }) => ({ role, content: content.slice(0, 6000) }));
  return { question: last.content.trim(), history };
}

/**
 * 将演示标记与查询实现注入 AG-UI 代理，供 Runtime 按 agentId 调用。
 * @param {object} config 服务端模型配置。
 * @param {object} [options={}] 实现选择参数。
 * @param {boolean} [options.demo=false] 是否将观察事件标记为演示模式。
 * @param {Function} [options.runner] 问答函数，默认按 demo 选择规则演示或 LangChain 实现。
 * @returns {OrderAgent} 新建的协议代理实例。
 */
export function createOrderAgent(config, { demo = false, runner = demo ? runDemo : runOrderQuestion } = {}) {
  return new OrderAgent(config, demo, runner);
}

// AG-UI 协议代理：Runtime 调用 run 获得 Observable，每个订阅对应可取消的一次运行。
class OrderAgent extends AbstractAgent {
  /**
   * 保存运行配置与问答实现，并为当前代理建立取消控制器集合。
   * @param {object} config 服务端模型配置。
   * @param {boolean} demo 是否运行演示模式。
   * @param {Function} runner 接收问题、历史和事件回调的问答实现。
   */
  constructor(config, demo, runner) {
    super({ description: demo ? '本地订单演示，不调用模型' : '订单查询助手' });
    this.config = config; this.demo = demo; this.runner = runner;
    this.controllers = new Set();
  }

  /**
   * 复制代理配置与执行函数，使 Runtime 的每次运行拥有独立的取消控制器集合。
   * @returns {OrderAgent} 配置相同、运行状态独立的新实例。
   */
  clone() { return new OrderAgent(this.config, this.demo, this.runner); }

  /**
   * 取消当前实例上的所有运行，再调用 AG-UI 基类的停止逻辑。
   * @returns {void}
   */
  abortRun() {
    for (const controller of this.controllers) controller.abort();
    super.abortRun();
  }

  /**
   * 将一次问答适配为 AG-UI 事件流；每次订阅创建独立运行，取消订阅会中断底层请求。
   * @param {object} input Runtime 提供的运行请求，包含 runId、threadId 和 messages。
   * @returns {import("rxjs").Observable<object>} 发出运行、工具、回答和观察事件的流。
   */
  run(input) {
    return new Observable(/** 为每个订阅建立取消控制器，启动问答并返回释放运行的清理函数。 */ (subscriber) => {
      const controller = new AbortController();
      this.controllers.add(controller);
      const { runId, threadId } = input;
      /**
       * 仅向仍处于订阅状态的观察者发送 AG-UI 事件。
       * @param {object} event 待发送的协议事件。
       * @returns {void}
       */
      const send = (event) => { if (!subscriber.closed) subscriber.next(event); };
      /**
       * 为领域事件附加运行 ID 和模式，并包装为 AG-UI 自定义事件。
       * @param {object} event 原始领域事件。
       * @returns {void}
       */
      const trace = (event) => send({ type: 'CUSTOM', name: 'harness', value: { ...event, runId, mode: this.demo ? 'demo' : 'live' } });
      /**
       * 为供应商工具调用 ID 添加运行前缀，避免不同问答中的同名调用覆盖 UI 结果。
       * @param {string} id 供应商返回的工具调用 ID。
       * @returns {string} 当前运行内的工具调用标识。
       */
      const callId = (id) => `${runId}:${id}`;
      /**
       * 保留原始领域记录，并将工具请求、结果及回答转换为前端可消费的 AG-UI 事件。
       * @param {object} event 包含 type、data 和 step 的领域事件。
       * @returns {void}
       */
      const onEvent = (event) => {
        trace(event);
        const { type, data, step } = event;
        // START/ARGS/END 描述调用参数；END 不代表工具执行完成，真正结果由 RESULT 事件提供。
        if (type === 'tool_call') {
          send({ type: 'TOOL_CALL_START', toolCallId: callId(data.id), toolCallName: data.function.name, parentMessageId: `${runId}:tool:${step}` });
          send({ type: 'TOOL_CALL_ARGS', toolCallId: callId(data.id), delta: data.function.arguments });
          send({ type: 'TOOL_CALL_END', toolCallId: callId(data.id) });
        } else if (type === 'tool_result') {
          send({ type: 'TOOL_CALL_RESULT', messageId: `${callId(data.tool_call_id)}:result`, toolCallId: callId(data.tool_call_id), role: 'tool', content: JSON.stringify(data.result) });
        } else if (type === 'answer') {
          const messageId = `${runId}:answer`;
          send({ type: 'TEXT_MESSAGE_START', messageId, role: 'assistant' });
          send({ type: 'TEXT_MESSAGE_CONTENT', messageId, delta: data.content });
          send({ type: 'TEXT_MESSAGE_END', messageId });
        }
      };
      (/** 执行本轮问答，发送开始与终态事件，并在结束时释放控制器。 */ async () => {
        send({ type: 'RUN_STARTED', runId, threadId });
        try {
          const { question, history } = toConversation(input.messages);
          // CopilotChat 初次连接会启动空运行；它不应产生费用。
          if (question) {
            // 真实模型配置在收到问题后由服务端判断，演示模式不需要 Key。
            const key = this.config.apiKey;
            if (!this.demo && (typeof key !== 'string' || !key.trim() || key.trim().startsWith('replace-with-'))) {
              throw new Error('请先在本机 .env 中配置模型 Key，再重启服务。');
            }
            trace({ type: 'start', data: { question } });
            const options = { ...this.config, question, history, onEvent,
              /**
               * 忽略控制台日志，由事件流或测试断言记录运行结果。
               * @returns {void}
               */
              log: () => {}, signal: controller.signal };
            await this.runner(options);
            trace({ type: 'complete' });
          }
          send({ type: 'RUN_FINISHED', runId, threadId });
        } catch (error) {
          let message = error instanceof Error ? error.message : '运行失败，请重试。';
          if (this.config.apiKey) message = message.replaceAll(this.config.apiKey, '[REDACTED]');
          trace({ type: 'error', data: { message } });
          send({ type: 'RUN_ERROR', message });
        } finally { this.controllers.delete(controller); subscriber.complete(); }
      })();
      return /** 取消底层运行并从当前代理移除其控制器。 */ () => { controller.abort(); this.controllers.delete(controller); };
    });
  }
}
