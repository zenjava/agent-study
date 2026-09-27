/**
 * 原生 Agent 的一次问答：手动维护消息、调用模型、执行工具，直到得到文字回答。
 * 只依赖本地纯 JavaScript 模块；fetchImpl 可替换为离线脚本供 Web 演示。
 */
import { getOrder } from '../common/tools/get-order.mjs';
import { orderToolDefinition, systemPrompt } from '../common/order-definition.mjs';
import { createModelTransport, validateBaseURL } from '../common/model-transport.mjs';

/**
 * 手动维护消息、模型请求与白名单工具调用，直到收到最终文字回答。
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
 * @param {typeof fetch} [options.fetchImpl=fetch] 可替换的 HTTP 实现，离线演示在此注入脚本模型。
 * @returns {Promise<string>} 模型的最终文字回答或补充信息请求。
 * @throws {Error} 配置无效、预算耗尽、请求失败或运行取消时拒绝。
 */
export async function runOrderQuestionNative({
  question, baseURL, model, apiKey, history = [],
  maxSteps = 4, timeoutMs = 30_000, log = console.log, onEvent = /** 未提供观察者时忽略领域事件。 */ () => {}, signal, fetchImpl = fetch,
}) {
  // 先校验配置与运行预算，错误输入在产生任何模型请求前结束。
  if (![baseURL, model, apiKey].every(/** 确认模型地址、名称和密钥均为非空字符串。 */ (value) => typeof value === 'string' && value.trim())) {
    throw new Error('请配置 LLM_BASE_URL、LLM_MODEL、LLM_API_KEY。' +
      '在项目目录执行 cp -n .env.example .env，再在本机编辑 .env；' +
      '使用 npm start 启动 Web 服务。');
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

/**
 * 执行白名单中的订单工具，将未知工具与无效参数转成可回传模型的错误结果。
 * @param {object} call 模型提出的工具调用，包含 type 和 function。
 * @returns {object} 订单查询结果或包含 code、message 的 error 对象。
 */
function executeTool(call) {
  /**
   * 构造可写入工具消息的结构化错误，不通过异常中断纠错循环。
   * @param {string} code 错误类型。
   * @param {string} message 面向模型的错误说明。
   * @returns {{error: {code: string, message: string}}} 工具失败结果。
   */
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
