/**
 * 将订单 Agent 的领域事件转换为 AG-UI 消息，供前端卡片、文字和调用统计消费。
 * 同时裁剪文字历史、传递取消信号；不把会话持久化到数据库。
 */
import { AbstractAgent } from '@ag-ui/client';
import { Observable } from 'rxjs';
import { runOrderQuestion } from '../agent/langchain.mjs';
import { getOrder } from '../agent/tools/get-order.mjs';

// 历史用于追问理解；工具结果始终由服务器重新查询，客户端不能注入 system。
export function toConversation(messages = []) {
  const last = messages.at(-1);
  if (last?.role !== 'user' || typeof last.content !== 'string' || !last.content.trim()) {
    return { question: '', history: [] };
  }
  if (last.content.length > 2000) throw new Error('问题最多 2000 个字符。');
  const history = messages.slice(0, -1).filter((message) =>
    ['user', 'assistant'].includes(message.role) && typeof message.content === 'string' && message.content.trim(),
  ).slice(-20).map(({ role, content }) => ({ role, content: content.slice(0, 6000) }));
  return { question: last.content.trim(), history };
}

// 通过 runner 注入不同编排实现；demo 标记同时决定前端观察记录的模式说明。
export function createOrderAgent(config, { demo = false, runner = demo ? runDemo : runOrderQuestion } = {}) {
  return new OrderAgent(config, demo, runner);
}

// AG-UI 协议代理：Runtime 调用 run 获得 Observable，每个订阅对应可取消的一次运行。
class OrderAgent extends AbstractAgent {
  constructor(config, demo, runner) {
    super({ description: demo ? '本地订单演示，不调用模型' : '订单查询助手' });
    this.config = config; this.demo = demo; this.runner = runner;
    this.controllers = new Set();
  }

  // Runtime 会为每次运行复制 Agent，配置与查询实现由服务端保留。
  clone() { return new OrderAgent(this.config, this.demo, this.runner); }

  // 显式停止所有当前运行，并继续调用基类的停止逻辑。
  abortRun() {
    for (const controller of this.controllers) controller.abort();
    super.abortRun();
  }

  // 把一次运行包装为事件流；订阅清理时同步取消底层模型请求。
  run(input) {
    return new Observable((subscriber) => {
      const controller = new AbortController();
      this.controllers.add(controller);
      const { runId, threadId } = input;
      const send = (event) => { if (!subscriber.closed) subscriber.next(event); };
      // 自定义 harness 事件保留领域细节，标准工具与文字事件另行驱动聊天 UI。
      const trace = (event) => send({ type: 'CUSTOM', name: 'harness', value: { ...event, runId, mode: this.demo ? 'demo' : 'live' } });
      // 将提供商调用 ID 加上 runId，避免不同轮次都返回 call_1 时覆盖旧卡片。
      const callId = (id) => `${runId}:${id}`;
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
      (async () => {
        send({ type: 'RUN_STARTED', runId, threadId });
        try {
          const { question, history } = toConversation(input.messages);
          // CopilotChat 初次连接会启动空运行；它不应产生费用。
          if (question) {
            trace({ type: 'start', data: { question } });
            const options = { ...this.config, question, history, onEvent, log: () => {}, signal: controller.signal };
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
      return () => { controller.abort(); this.controllers.delete(controller); };
    });
  }
}

// 共用固定规则 Demo：通过订单号匹配生成查询事件，不经过任何模型编排框架。
async function runDemo({ question, history, onEvent, signal }) {
  const explicit = question.toUpperCase().match(/\bA\d+\b/g);
  const previous = history.map((message) => message.content).join(' ').toUpperCase().match(/\bA\d+\b/g);
  const orderIds = [...new Set(explicit ?? previous?.slice(-1) ?? [])].slice(0, 3);
  if (!orderIds.length) {
    onEvent({ type: 'answer', step: 1, data: { content: '请提供要查询的订单号，例如 **A1001**。\n\n当前为本地演示，回答由固定规则生成。' } });
    return;
  }
  const answers = [];
  for (const [index, orderId] of orderIds.entries()) {
    const id = `demo_${index + 1}`;
    onEvent({ type: 'tool_call', step: 1, data: { id, type: 'function', function: { name: 'getOrder', arguments: JSON.stringify({ orderId }) } } });
    // 短暂延迟用于展示工具加载态，同时支持停止按钮即时中断演示。
    await new Promise((resolve, reject) => {
      if (signal.aborted) return reject(new Error('本次请求已取消。'));
      const abort = () => { clearTimeout(timer); reject(new Error('本次请求已取消。')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 350);
      signal.addEventListener('abort', abort, { once: true });
    });
    const result = getOrder({ orderId });
    onEvent({ type: 'tool_result', step: 1, data: { tool_call_id: id, result } });
    if (!result.found) answers.push(`没有找到订单 **${orderId}**，请检查订单号。`);
    else {
      const order = result.order;
      answers.push(`**${orderId} · ${order.status}**\n\n含税总额 **¥${order.totalAmount.toLocaleString('zh-CN')}**，供应商为${order.supplier}。` +
        (order.currentApprover ? `当前由 **${order.currentApprover}** 审批，尚未发货。` : `配送状态：${order.delivery.status}。`) +
        `\n\n付款：${order.payment.status}；发票：${order.invoice.status}。详细商品和流程见上方订单卡片。`);
    }
  }
  onEvent({ type: 'answer', step: 1, data: { content: `${answers.join('\n\n---\n\n')}\n\n*本地演示 · 固定规则回答，未调用大模型。*` } });
}
