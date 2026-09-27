/**
 * LangChain 版问答：createAgent 接管模型与工具循环，中间件负责校验、限次和事件记录。
 * 输入由服务端或 CLI 提供；返回最终文字，执行过程通过 onEvent 交给观察面板与协议适配层。
 */
import { randomUUID } from 'node:crypto';
import { createAgent, createMiddleware } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { ToolMessage } from '@langchain/core/messages';
import { orderSchema, orderTool, systemPrompt } from './order-contract.mjs';
import { createModelTransport, validateBaseURL } from './model-transport.mjs';

// 从这里顺着读：配置模型 → 注册工具/中间件 → invoke；循环与消息回传交给 LangChain。
export async function runOrderQuestion({
  question, baseURL, model, apiKey, history = [],
  maxSteps = 4, timeoutMs = 30_000, log = console.log, onEvent = () => {}, signal,
}) {
  // 先校验配置与运行预算，错误输入在产生任何模型请求前结束。
  if (![baseURL, model, apiKey].every((value) => typeof value === 'string' && value.trim())) {
    throw new Error('请配置 LLM_BASE_URL、LLM_MODEL、LLM_API_KEY。' +
      '在项目目录执行 cp -n .env.example .env，再在本机编辑 .env；' +
      '使用 node --env-file=.env src/agent/cli/langchain.mjs 启动。');
  }
  if (['replace-with-your-deepseek-api-key', 'replace-with-your-openai-api-key'].includes(apiKey.trim())) {
    throw new Error('请在本机 .env 中将 LLM_API_KEY 的占位符替换为你的 DeepSeek API key，' +
      '然后使用 node --env-file=.env src/agent/cli/langchain.mjs 启动。不要把密钥发到聊天中。');
  }
  if (typeof question !== 'string' || !question.trim()) throw new Error('请输入问题。');
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1 ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
    throw new Error('maxSteps 和 timeoutMs 必须是有效的正整数。');
  }
  const safeBaseURL = validateBaseURL(baseURL);
  // 日志和事件统一脱敏；事件经过 JSON 序列化得到当时快照，后续消息追加不会改写旧记录。
  const redact = (text) => text.replaceAll(apiKey, '[REDACTED]');
  const write = (text) => log(redact(text));
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
    // 模型返回后检查请求上限并整理工具调用；不在这个阶段执行业务函数。
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
      response.tool_calls = rawCalls.map((raw) => {
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
    // 工具执行前做白名单与严格参数校验，再记录结果及匹配的调用 ID。
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
