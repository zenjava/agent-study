import { pathToFileURL } from 'node:url';
import { getOrder } from './src/get-order.mjs';

// 这是发给模型的“函数说明书”，不是函数实现。
const tools = [{
  type: 'function',
  function: {
    name: 'getOrder',
    description: '根据订单号查询完整订单：状态、审批人、供应商、商品明细、含税金额、付款、发票、配送和流程时间线。',
    parameters: {
      type: 'object',
      properties: { orderId: { type: 'string', description: '订单号，例如 A1001' } },
      required: ['orderId'],
      additionalProperties: false,
    },
  },
}];

// 从这里顺着读：发请求 → 收到调用请求 → Node 执行 → 回传结果 → 再请求。
export async function runOrderQuestion({
  question, baseURL, model, apiKey, history = [],
  maxSteps = 4, timeoutMs = 30_000, log = console.log, onEvent = () => {}, signal,
}) {
  if (![baseURL, model, apiKey].every((value) => typeof value === 'string' && value.trim())) {
    throw new Error('请配置 LLM_BASE_URL、LLM_MODEL、LLM_API_KEY。' +
      '在项目目录执行 cp -n .env.example .env，再在本机编辑 .env；' +
      '使用 node --env-file=.env step2.mjs 启动。');
  }
  if (['replace-with-your-deepseek-api-key', 'replace-with-your-openai-api-key'].includes(apiKey.trim())) {
    throw new Error('请在本机 .env 中将 LLM_API_KEY 的占位符替换为你的 DeepSeek API key，' +
      '然后使用 node --env-file=.env step2.mjs 启动。不要把密钥发到聊天中。');
  }
  if (typeof question !== 'string' || !question.trim()) throw new Error('请输入问题。');
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1 ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
    throw new Error('maxSteps 和 timeoutMs 必须是有效的正整数。');
  }
  const endpoint = completionEndpoint(baseURL);
  const write = (text) => log(text.replaceAll(apiKey, '[REDACTED]'));
  // 页面只接收脱敏后的数据快照；命令行仍按原来的方式运行。
  const emit = (type, step, data) => onEvent(JSON.parse(
    JSON.stringify({ type, step, data }).replaceAll(apiKey, '[REDACTED]'),
  ));
  const messages = [
    {
      role: 'system',
      content: '你是订单查询助手。任何订单信息必须调用 getOrder，以工具结果为准。' +
        '可以根据之前对话确定用户追问的订单号；无法确定时请追问，不要猜测。' +
        'found 为 false 时说明未找到；工具出错时纠正参数或说明失败。' +
        '所有订单都是虚构教学数据，不执行审批、付款或修改。金额含税，不重复加税。' +
        '页面会自动显示详细订单卡片，因此回答用简洁中文 Markdown 突出用户关心的信息，不必重复整个卡片。',
    },
    ...history,
    { role: 'user', content: question },
  ];

  for (let step = 1; step <= maxSteps; step += 1) {
    // 1. Node 把对话和工具定义发给模型，每次都带上已有消息。
    write(`[第 ${step} 次请求] Node → 模型：发送 ${messages.length} 条消息和 getOrder 定义。`);
    const body = { model, messages, tools };
    // DeepSeek 默认启用思考模式；入门示例显式关闭，参数直接放在 HTTP 请求体中。
    if (model.startsWith('deepseek-')) body.thinking = { type: 'disabled' };
    emit('request', step, body);
    const data = await requestCompletion(endpoint, apiKey, body, timeoutMs, signal);
    // 每个 HTTP 响应单独计量；即使回答被截断，也保留接口已报告的消耗。
    // 缺失用量用 null 表示，不把未知消耗记成 0。
    emit('usage', step, data?.usage ?? null);
    const choice = data?.choices?.[0];
    const message = choice?.message;
    if (message?.role !== 'assistant') throw new Error('模型响应格式错误：缺少 assistant 消息。');
    if (!['stop', 'tool_calls'].includes(choice.finish_reason)) {
      throw new Error('模型输出未正常完成，可能被截断或拦截。');
    }
    const calls = message.tool_calls ?? [];
    if (!Array.isArray(calls)) throw new Error('模型响应格式错误：tool_calls 应为数组。');

    // 2. 没有工具调用时，这条文本就是本轮回答（也可能是追问）。
    if (calls.length === 0) {
      if (choice.finish_reason !== 'stop' || typeof message.content !== 'string' || !message.content.trim()) {
        throw new Error('模型没有返回有效回答或工具调用。');
      }
      write(`[模型回答] ${message.content}`);
      emit('answer', step, { content: message.content });
      return message.content;
    }

    const ids = calls.map((call) => call?.id);
    if (ids.some((id) => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) {
      throw new Error('模型工具调用 ID 缺失或重复，无法关联结果。');
    }
    // 最后一次请求若仍要求调用，停止执行，避免产生无法回传的结果。
    if (step === maxSteps) break;
    messages.push(message);

    for (const call of calls) {
      // 3. 模型只提出请求；Node 校验名称/参数，并调用第一步的真实函数。
      write(`[模型 → Node] 工具调用请求：${JSON.stringify(call)}`);
      emit('tool_call', step, call);
      const result = executeTool(call);
      write(`[Node] ${result.error ? '工具校验失败' : '执行 getOrder'}：${JSON.stringify(result)}`);
      emit('tool_result', step, { tool_call_id: call.id, result });

      // 4. 把调用 ID 和结果一起放回对话，下一次循环才真正发送给模型。
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      emit('tool_return', step, messages.at(-1));
      write(`[Node → 模型] 已准备工具结果，tool_call_id=${call.id}，将在下一次请求发送。`);
    }
  }
  throw new Error(`达到 ${maxSteps} 次模型请求上限，仍未得到最终回答。`);
}

function executeTool(call) {
  const failure = (code, message) => ({ error: { code, message } });
  // 白名单：不能根据模型给出的名字任意执行代码。
  if (call.type !== 'function' || call.function?.name !== 'getOrder') {
    return failure('UNKNOWN_TOOL', '只支持 getOrder 工具。');
  }
  let args;
  try {
    if (typeof call.function.arguments !== 'string') throw new Error();
    args = JSON.parse(call.function.arguments);
  } catch {
    return failure('INVALID_ARGUMENTS', 'arguments 必须是合法的 JSON 字符串。');
  }
  if (!args || Array.isArray(args) || typeof args !== 'object' ||
      Object.keys(args).length !== 1 || typeof args.orderId !== 'string' || !args.orderId.trim()) {
    return failure('INVALID_ARGUMENTS', '参数只能包含 orderId，且必须是非空字符串。');
  }
  return getOrder({ orderId: args.orderId });
}

function completionEndpoint(baseURL) {
  let url;
  try { url = new URL(baseURL); } catch { throw new Error('LLM_BASE_URL 必须是完整的 API 基础地址。'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.username || url.password || url.search || url.hash) {
    throw new Error('LLM_BASE_URL 需使用 HTTPS（本机可用 HTTP），且不能包含凭据、查询参数或片段。');
  }
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/chat/completions`;
  return url;
}

// 原生 fetch 发 HTTP，不使用 SDK；超时包括连接和响应体读取。
async function requestCompletion(endpoint, apiKey, body, timeoutMs, callerSignal) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = callerSignal ? AbortSignal.any([timeout, callerSignal]) : timeout;
  let response;
  let text;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal,
      redirect: 'error',
    });
    if (response.ok) text = await response.text();
    else await response.body?.cancel();
  } catch {
    if (callerSignal?.aborted) throw new Error('本次请求已取消。');
    if (signal.aborted) throw new Error(`模型请求超时（${timeoutMs} 毫秒）。`);
    throw new Error('模型网络请求失败，请检查 API 地址、网络及证书。');
  }
  // 不输出服务端错误原文或请求头，避免带出密钥。
  if (!response.ok) throw new Error(`模型请求失败：HTTP ${response.status}。请检查配置或服务配额。`);
  try { return JSON.parse(text); } catch { throw new Error('模型响应不是合法 JSON。'); }
}

// 直接 node 运行时才启动；导入测试时不会连接任何真实模型。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runOrderQuestion({
      question: process.argv.slice(2).join(' ') || 'A1001 现在到哪一步了，谁在审批？',
      baseURL: process.env.LLM_BASE_URL,
      model: process.env.LLM_MODEL,
      apiKey: process.env.LLM_API_KEY,
    });
  } catch (error) {
    console.error(`运行失败：${error.message}`);
    process.exitCode = 1;
  }
}
