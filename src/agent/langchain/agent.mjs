/**
 * LangChain 版问答：createAgent 接管模型与工具循环，中间件负责校验、限次和事件记录。
 * 输入由服务端或 CLI 提供；返回最终文字，执行过程通过 onEvent 交给观察面板与协议适配层。
 */
import { randomUUID } from 'node:crypto';
import { createAgent, createMiddleware } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { ToolMessage } from '@langchain/core/messages';
import { orderSchema, orderTool, systemPrompt } from '../common/order-contract.mjs';
import { createModelTransport, validateBaseURL } from '../common/model-transport.mjs';

/**
 * 将模型与工具循环交给 LangChain，通过中间件执行校验、限次和事件记录。
 * @param {object} options 一次问答的运行配置。
 * @param {string} options.question 当前用户问题，不得为空。
 * @param {string} options.baseURL 兼容 Chat Completions 的模型基础地址。
 * @param {string} options.model 模型名称。
 * @param {string} options.apiKey 仅在服务端使用的模型密钥。
 * @param {Array<{role: string, content: string}>} [options.history=[]] 由调用方提供的先前文字消息。
 * @param {number} [options.maxSteps=4] 模型请求次数上限。
 * @param {number} [options.timeoutMs=30000] 单次请求及读取响应体的超时毫秒数。
 * @param {function(string): void} [options.log=console.log] 脱敏日志接收函数。
 * @param {function(object): void} [options.onEvent] 脱敏执行事件的接收函数。
 * @param {AbortSignal} [options.signal] 外部取消信号。
 * @returns {Promise<string>} 模型的最终文字回答或补充信息请求。
 * @throws {Error} 配置无效、预算耗尽、请求失败或运行取消时拒绝。
 */
export async function runOrderQuestion({
  question, baseURL, model, apiKey, history = [],
  maxSteps = 4, timeoutMs = 30_000, log = console.log, onEvent = /** 未提供观察者时忽略领域事件。 */ () => {}, signal,
}) {
  // 先校验配置与运行预算，错误输入在产生任何模型请求前结束。
  if (![baseURL, model, apiKey].every(/** 确认模型地址、名称和密钥均为非空字符串。 */ (value) => typeof value === 'string' && value.trim())) {
    throw new Error('请配置 LLM_BASE_URL、LLM_MODEL、LLM_API_KEY。' +
      '在项目目录执行 cp -n .env.example .env，再在本机编辑 .env；' +
      '使用 node --env-file=.env src/agent/langchain/cli.mjs 启动。');
  }
  if (['replace-with-your-deepseek-api-key', 'replace-with-your-openai-api-key'].includes(apiKey.trim())) {
    throw new Error('请在本机 .env 中将 LLM_API_KEY 的占位符替换为你的 DeepSeek API key，' +
      '然后使用 node --env-file=.env src/agent/langchain/cli.mjs 启动。不要把密钥发到聊天中。');
  }
  if (typeof question !== 'string' || !question.trim()) throw new Error('请输入问题。');
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1 ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
    throw new Error('maxSteps 和 timeoutMs 必须是有效的正整数。');
  }
  const safeBaseURL = validateBaseURL(baseURL);
  /**
   * 替换本次运行的模型密钥，防止日志或事件泄露鉴权信息。
   * @param {string} text 待脱敏文本。
   * @returns {string} 将密钥替换为占位标记后的文本。
   */
  const redact = (text) => text.replaceAll(apiKey, '[REDACTED]');
  /**
   * 将脱敏后的运行信息交给调用方日志函数。
   * @param {string} text 原始日志文本。
   * @returns {void}
   */
  const write = (text) => log(redact(text));
  /**
   * 生成脱敏的事件快照并通知观察者，避免后续状态变更改写旧记录。
   * @param {string} type 事件类型。
   * @param {number} step 当前模型请求序号，从 1 开始。
   * @param {*} data 本次事件的数据。
   * @returns {void}
   */
  const emit = (type, step, data) => onEvent(JSON.parse(redact(JSON.stringify({ type, step, data }))));
  const transport = createModelTransport({ timeoutMs, signal, emit, write });

  // ChatOpenAI 也可连接 DeepSeek 等兼容 Chat Completions 的接口。
  const chatModel = new ChatOpenAI({
    model, apiKey, streaming: false, useResponsesApi: false, maxRetries: 0,
    modelKwargs: model.startsWith('deepseek-') ? { thinking: { type: 'disabled' } } : {},
    configuration: { baseURL: safeBaseURL, fetch: transport.fetch, maxRetries: 0 },
  });
  let boundaryError;
  // 按调用 ID 保存供应商原始参数，使工具中间件仍能识别 SDK 解析失败的输入。
  const calls = new Map();
  const middleware = createMiddleware({
    name: 'OrderTraceAndLimits',
    /**
     * 执行模型中间件：检查请求预算，保留原始工具参数，并为框架消息生成独立 ID。
     * @param {object} request LangChain 模型调用上下文。
     * @param {function(object): Promise<object>} handler 继续执行模型调用的框架函数。
     * @returns {Promise<object>} 已整理工具调用的模型消息。
     * @throws {Error} 模型失败或最后一次请求仍要求调用工具时拒绝。
     */
    wrapModelCall: async (request, handler) => {
      const response = await handler(request);
      const rawCalls = transport.response.choices[0].message.tool_calls ?? [];
      if (rawCalls.length && transport.step >= maxSteps) {
        boundaryError = new Error(`达到 ${maxSteps} 次模型请求上限，仍未得到最终回答。`);
        throw boundaryError;
      }
      calls.clear();
      // SDK 会将坏 JSON 放入 invalid_tool_calls。保留这些调用并回传结构化错误，
      // 避免 Agent 将“参数解析失败”误当作“模型已经回答完毕”。
      response.tool_calls = rawCalls.map(/** 保留供应商原始参数，生成框架可消费的工具调用，并把坏参数留给工具层处理。 */ (raw) => {
        let args;
        try { args = JSON.parse(raw.function?.arguments); } catch { /* 交给工具中间件回传错误。 */ }
        calls.set(raw.id, { raw, args });
        return { id: raw.id, name: raw.function?.name ?? 'unknown', args: args ?? {}, type: 'tool_call' };
      });
      response.invalid_tool_calls = [];
      // 内部消息使用独立 ID；供应商响应 ID 仍完整保留在 response 事件里。
      response.id = randomUUID();
      return response;
    },
    /**
     * 执行工具中间件：校验名称和参数，以同一调用 ID 返回结果并记录工具事件。
     * @param {object} request 包含 toolCall 的 LangChain 工具调用上下文。
     * @param {function(object): Promise<object>} handler 执行已注册工具的框架函数。
     * @returns {Promise<import("@langchain/core/messages").ToolMessage>} 正常查询结果或结构化校验错误。
     */
    wrapToolCall: async (request, handler) => {
      const { raw, args } = calls.get(request.toolCall.id);
      const step = transport.step;
      write(`[模型 → Node] 工具调用请求：${JSON.stringify(raw)}`);
      emit('tool_call', step, raw);
      let error;
      if (raw.type !== 'function' || raw.function?.name !== 'getOrder') {
        error = { code: 'UNKNOWN_TOOL', message: '只支持 getOrder 工具。' };
      } else if (typeof raw.function.arguments !== 'string' || !orderSchema.safeParse(args).success) {
        error = { code: 'INVALID_ARGUMENTS', message: '参数必须是合法 JSON，只能包含非空字符串 orderId。' };
      }
      // 成功时由 LangChain 调用已注册的 tool；校验失败仍返回同一调用 ID。
      const message = error
        ? new ToolMessage({ content: JSON.stringify({ error }), tool_call_id: request.toolCall.id, name: request.toolCall.name, status: 'error' })
        : await handler(request);
      const result = JSON.parse(message.content);
      write(`[Node] ${error ? '工具校验失败' : '执行 getOrder'}：${message.content}`);
      emit('tool_result', step, { tool_call_id: message.tool_call_id, result });
      emit('tool_return', step, { role: 'tool', name: message.name, tool_call_id: message.tool_call_id, content: message.content });
      write(`[Node → 模型] 已准备工具结果，tool_call_id=${message.tool_call_id}，将在下一次请求发送。`);
      return message;
    },
  });
  // 将模型、工具、系统规则和中间件装配起来；invoke 才真正开始这一轮执行。
  const agent = createAgent({ model: chatModel, tools: [orderTool], systemPrompt, middleware: [middleware] });
  try {
    // 无手写 for 循环或 messages.push：框架负责执行工具、追加 ToolMessage、再次请求模型。
    const result = await agent.invoke({ messages: [...history, { role: 'user', content: question }] }, {
      signal, recursionLimit: maxSteps * 3 + 5,
    });
    const content = result.messages.at(-1).content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('模型没有返回有效回答或工具调用。');
    write(`[模型回答] ${content}`);
    emit('answer', transport.step, { content });
    return content;
  } catch (error) {
    if (signal?.aborted) throw new Error('本次请求已取消。');
    if (transport.failure) throw transport.failure;
    if (boundaryError) throw boundaryError;
    // LangChain 错误可能包含请求上下文，只展示脱敏后的简短说明。
    throw new Error(`Agent 执行失败：${redact(error instanceof Error ? error.message : '未知错误')}`);
  }
}
