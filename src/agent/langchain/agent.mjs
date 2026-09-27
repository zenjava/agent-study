/**
 * LangChain 版问答：用 Prompt、Runnable、模型消息和 Tool 编排工具循环。
 * 循环由本文件控制，不创建 LangGraph 状态图或使用基于它的 createAgent。
 */
import { ChatOpenAI } from '@langchain/openai';
import { ToolMessage } from '@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { orderSchema, orderTool, systemPrompt } from '../common/order-contract.mjs';
import { createModelTransport, validateBaseURL } from '../common/model-transport.mjs';

/**
 * 通过 LangChain Runnable 请求模型，并在本文件中处理工具调用与消息回填。
 * @param {object} options 一次问答的运行配置。
 * @param {string} options.question 当前用户问题，不得为空。
 * @param {string} options.baseURL 兼容 Chat Completions 的模型基础地址。
 * @param {string} options.model 模型名称。
 * @param {string} options.apiKey 仅在服务端使用的模型密钥。
 * @param {Array<{role: string, content: string}>} [options.history=[]] 先前文字消息。
 * @param {number} [options.maxSteps=4] 模型请求次数上限。
 * @param {number} [options.timeoutMs=30000] 单次请求超时毫秒数。
 * @param {function(string): void} [options.log=console.log] 脱敏日志接收函数。
 * @param {function(object): void} [options.onEvent] 脱敏事件接收函数。
 * @param {AbortSignal} [options.signal] 外部取消信号。
 * @returns {Promise<string>} 模型的最终文字回答。
 * @throws {Error} 配置无效、预算耗尽、请求失败或运行取消时拒绝。
 */
export async function runOrderQuestion({
  question, baseURL, model, apiKey, history = [],
  maxSteps = 4, timeoutMs = 30_000, log = console.log, onEvent = /** 未提供观察者时忽略领域事件。 */ () => {}, signal,
}) {
  if (![baseURL, model, apiKey].every(/** 检查模型配置是否为非空字符串。 */ (value) => typeof value === 'string' && value.trim())) {
    throw new Error('请配置 LLM_BASE_URL、LLM_MODEL、LLM_API_KEY。' +
      '在项目目录执行 cp -n .env.example .env，再在本机编辑 .env；' +
      '使用 npm start 启动 Web 服务。');
  }
  if (['replace-with-your-deepseek-api-key', 'replace-with-your-openai-api-key'].includes(apiKey.trim())) {
    throw new Error('请在本机 .env 中将 LLM_API_KEY 的占位符替换为你的 DeepSeek API key，' +
      '然后重启 Web 服务。不要把密钥发到聊天中。');
  }
  if (typeof question !== 'string' || !question.trim()) throw new Error('请输入问题。');
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1 ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
    throw new Error('maxSteps 和 timeoutMs 必须是有效的正整数。');
  }
  const safeBaseURL = validateBaseURL(baseURL);
  /**
   * 把模型密钥从日志和事件中替换为占位标记。
   * @param {string} text 待脱敏文本。
   * @returns {string} 脱敏文本。
   */
  const redact = (text) => text.replaceAll(apiKey, '[REDACTED]');
  /**
   * 将脱敏后的运行信息交给调用方。
   * @param {string} text 原始日志。
   * @returns {void}
   */
  const write = (text) => log(redact(text));
  /**
   * 生成事件快照并通知观察者。
   * @param {string} type 事件类型。
   * @param {number} step 模型请求序号。
   * @param {*} data 事件数据。
   * @returns {void}
   */
  const emit = (type, step, data) => onEvent(JSON.parse(redact(JSON.stringify({ type, step, data }))));
  const transport = createModelTransport({ timeoutMs, signal, emit, write });
  const chatModel = new ChatOpenAI({
    model, apiKey, streaming: false, useResponsesApi: false, maxRetries: 0,
    modelKwargs: model.startsWith('deepseek-') ? { thinking: { type: 'disabled' } } : {},
    configuration: { baseURL: safeBaseURL, fetch: transport.fetch, maxRetries: 0 },
  });
  // LCEL 组合负责一次模型调用；工具执行和循环由下方显式控制。
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt], new MessagesPlaceholder('messages'),
  ]);
  const modelWithTools = chatModel.bindTools([orderTool]);
  const chain = prompt.pipe(modelWithTools);
  const messages = [...history, { role: 'user', content: question }];

  try {
    for (let step = 1; step <= maxSteps; step += 1) {
      if (signal?.aborted) throw new Error('本次请求已取消。');
      const response = await chain.invoke({ messages }, { signal });
      const rawCalls = transport.response.choices[0].message.tool_calls ?? [];
      if (rawCalls.length && step === maxSteps) {
        throw new Error(`达到 ${maxSteps} 次模型请求上限，仍未得到最终回答。`);
      }
      // SDK 将坏 JSON 放入 invalid_tool_calls；保留原始调用，以便回传结构化错误。
      response.tool_calls = rawCalls.map(/** 整理供应商工具调用为 AIMessage 格式。 */ (raw) => {
        let args;
        try { args = JSON.parse(raw.function?.arguments); } catch { /* 由工具校验回传错误。 */ }
        return { id: raw.id, name: raw.function?.name ?? 'unknown', args: args ?? {}, type: 'tool_call' };
      });
      response.invalid_tool_calls = [];
      messages.push(response);
      if (!rawCalls.length) {
        const content = response.content;
        if (typeof content !== 'string' || !content.trim()) throw new Error('模型没有返回有效回答或工具调用。');
        write(`[模型回答] ${content}`);
        emit('answer', step, { content });
        return content;
      }
      for (const [index, raw] of rawCalls.entries()) {
        if (signal?.aborted) throw new Error('本次请求已取消。');
        const call = response.tool_calls[index];
        write(`[模型 → Node] 工具调用请求：${JSON.stringify(raw)}`);
        emit('tool_call', step, raw);
        let error;
        if (raw.type !== 'function' || raw.function?.name !== 'getOrder') {
          error = { code: 'UNKNOWN_TOOL', message: '只支持 getOrder 工具。' };
        } else if (typeof raw.function.arguments !== 'string' || !orderSchema.safeParse(call.args).success) {
          error = { code: 'INVALID_ARGUMENTS', message: '参数必须是合法 JSON，只能包含非空字符串 orderId。' };
        }
        const message = error
          ? new ToolMessage({ content: JSON.stringify({ error }), tool_call_id: call.id, name: call.name, status: 'error' })
          : await orderTool.invoke(call, { signal });
        const result = JSON.parse(message.content);
        write(`[Node] ${error ? '工具校验失败' : '执行 getOrder'}：${message.content}`);
        emit('tool_result', step, { tool_call_id: message.tool_call_id, result });
        emit('tool_return', step, { role: 'tool', name: message.name, tool_call_id: message.tool_call_id, content: message.content });
        write(`[Node → 模型] 已准备工具结果，tool_call_id=${message.tool_call_id}，将在下一次请求发送。`);
        messages.push(message);
      }
    }
    throw new Error(`达到 ${maxSteps} 次模型请求上限，仍未得到最终回答。`);
  } catch (error) {
    if (signal?.aborted) throw new Error('本次请求已取消。');
    if (transport.failure) throw transport.failure;
    throw new Error(`Agent 执行失败：${redact(error instanceof Error ? error.message : '未知错误')}`);
  }
}
