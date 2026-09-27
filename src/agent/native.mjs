/**
 * 原生 Agent 的一次问答：手动维护消息、调用模型、执行工具，直到得到文字回答。
 * 只依赖本地纯 JavaScript 模块；fetchImpl 可替换为离线脚本，Web 与 CLI 共用同一循环。
 */
import { getOrder } from './tools/get-order.mjs';
import { orderToolDefinition, systemPrompt } from './order-definition.mjs';
import { createModelTransport, validateBaseURL } from './model-transport.mjs';

// 原生 Agent：手写消息数组、HTTP 请求、工具执行与继续/结束判断。
export async function runOrderQuestionNative({
  question, baseURL, model, apiKey, history = [],
  maxSteps = 4, timeoutMs = 30_000, log = console.log, onEvent = () => {}, signal, fetchImpl = fetch,
}) {
  // 先校验配置与运行预算，错误输入在产生任何模型请求前结束。
  if (![baseURL, model, apiKey].every((value) => typeof value === 'string' && value.trim())) {
    throw new Error('请配置 LLM_BASE_URL、LLM_MODEL、LLM_API_KEY。' +
      '在项目目录执行 cp -n .env.example .env，再在本机编辑 .env；' +
      '使用 node --env-file=.env src/agent/cli/native.mjs 启动。');
  }
  if (['replace-with-your-deepseek-api-key', 'replace-with-your-openai-api-key'].includes(apiKey.trim())) {
    throw new Error('请在本机 .env 中将 LLM_API_KEY 的占位符替换为你的 DeepSeek API key，再重启服务。');
  }
  if (typeof question !== 'string' || !question.trim()) throw new Error('请输入问题。');
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1 ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
    throw new Error('maxSteps 和 timeoutMs 必须是有效的正整数。');
  }
  const endpoint = `${validateBaseURL(baseURL)}/chat/completions`;
  // 日志和事件统一脱敏；事件经过 JSON 序列化得到当时快照，后续消息追加不会改写旧记录。
  const redact = (text) => text.replaceAll(apiKey, '[REDACTED]');
  const write = (text) => log(redact(text));
  const emit = (type, step, data) => onEvent(JSON.parse(redact(JSON.stringify({ type, step, data }))));
  const transport = createModelTransport({ timeoutMs, signal, emit, write, fetchImpl });
  // 每次问答重新建立上下文；复制调用方历史，避免本轮追加消息污染外部状态。
  const messages = [
    { role: 'system', content: systemPrompt },
    ...structuredClone(history),
    { role: 'user', content: question },
  ];

  for (let step = 1; step <= maxSteps; step += 1) {
    if (signal?.aborted) throw new Error('本次请求已取消。');
    // 1. 把完整消息和工具说明发给模型。底层观察层使用原生 fetch。
    const body = { model, messages, tools: [orderToolDefinition] };
    if (model.startsWith('deepseek-')) body.thinking = { type: 'disabled' };
    await transport.fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body), signal,
    });
    const message = transport.response.choices[0].message;
    const calls = message.tool_calls ?? [];

    // 2. 没有工具请求时结束；回答也可能是要求用户补充订单号。
    if (!calls.length) {
      write(`[模型回答] ${message.content}`);
      emit('answer', step, { content: message.content });
      return message.content;
    }
    // 最后一次请求仍要求工具时直接报上限，防止已无下一轮回答机会却继续执行业务。
    if (step === maxSteps) throw new Error(`达到 ${maxSteps} 次模型请求上限，仍未得到最终回答。`);
    messages.push({ role: 'assistant', content: message.content ?? null, tool_calls: calls });

    for (const call of calls) {
      if (signal?.aborted) throw new Error('本次请求已取消。');
      // 3. 执行白名单工具。模型只能提出请求，不能直接执行 JavaScript。
      write(`[模型 → Node] 工具调用请求：${JSON.stringify(call)}`);
      emit('tool_call', step, call);
      const result = executeTool(call);
      write(`[Node] ${result.error ? '工具校验失败' : '执行 getOrder'}：${JSON.stringify(result)}`);
      emit('tool_result', step, { tool_call_id: call.id, result });
      // 4. 用相同 tool_call_id 回传结果，下一轮 fetch 才把结果交给模型。
      const toolMessage = { role: 'tool', name: call.function?.name ?? 'unknown', tool_call_id: call.id, content: JSON.stringify(result) };
      messages.push(toolMessage);
      emit('tool_return', step, toolMessage);
      write(`[Node → 模型] 已准备工具结果，tool_call_id=${call.id}，将在下一次请求发送。`);
    }
  }
}

// 只调度允许的工具；将未知工具和参数错误转为可回传结果，让模型下一轮有机会纠正。
function executeTool(call) {
  const failure = (code, message) => ({ error: { code, message } });
  if (call.type !== 'function' || call.function?.name !== 'getOrder') {
    return failure('UNKNOWN_TOOL', '只支持 getOrder 工具。');
  }
  // arguments 在协议中必须是 JSON 字符串，解析成功后还要校验对象形状和字段。
  let args;
  try {
    if (typeof call.function.arguments !== 'string') throw new Error();
    args = JSON.parse(call.function.arguments);
  } catch { return failure('INVALID_ARGUMENTS', 'arguments 必须是合法的 JSON 字符串。'); }
  if (!args || Array.isArray(args) || typeof args !== 'object' || Object.keys(args).length !== 1 ||
      typeof args.orderId !== 'string' || !args.orderId.trim()) {
    return failure('INVALID_ARGUMENTS', '参数只能包含 orderId，且必须是非空字符串。');
  }
  return getOrder({ orderId: args.orderId });
}
