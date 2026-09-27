/**
 * 三版 Agent 共用的模型 HTTP 适配层，记录每次请求、响应和供应商原始 usage。
 * 负责请求超时、取消、协议校验与错误收敛；不执行工具，也不决定是否继续问模型。
 */
// SDK 与原生 Agent 共用的 HTTP 观察层：保留实际请求、原始响应与 usage，不负责 Agent 循环。
export function createModelTransport({ timeoutMs, signal: callerSignal, emit, write, fetchImpl = fetch }) {
  // 这些闭包变量属于一次 Agent 问答；step 记录实际 HTTP 请求次数，failure 保留统一错误。
  let step = 0;
  let lastResponse;
  let failure;
  return {
    get step() { return step; },
    get response() { return lastResponse; },
    get failure() { return failure; },
    async fetch(input, init) {
      // 每次请求单独计时，并合并外部取消和 SDK 信号；读取响应体也使用同一个信号。
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = AbortSignal.any([timeout, callerSignal, init?.signal].filter(Boolean));
      const body = JSON.parse(init.body);
      step += 1;
      write(`[第 ${step} 次请求] Node → 模型：发送 ${body.messages.length} 条消息和 getOrder 定义。`);
      emit('request', step, body);
      try {
        // 调用方负责序列化；禁止重定向，超时覆盖完整响应体读取。
        const response = await fetchImpl(input, { ...init, signal, redirect: 'error' });
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error(`模型请求失败：HTTP ${response.status}。请检查配置或服务配额。`);
        }
        const text = await response.text();
        try { lastResponse = JSON.parse(text); }
        catch { throw new Error('模型响应不是合法 JSON。'); }
        // 原始 usage 避免 SDK 将缺失值变为 0，或丢掉供应商的缓存明细。
        emit('usage', step, lastResponse?.usage ?? null);
        emit('response', step, lastResponse);
        validateResponse(lastResponse);
        return new Response(text, { status: response.status, headers: { 'Content-Type': 'application/json' } });
      } catch (error) {
        if (callerSignal?.aborted) failure = new Error('本次请求已取消。');
        else if (timeout.aborted) failure = new Error(`模型请求超时（${timeoutMs} 毫秒）。`);
        else if (error instanceof Error && error.message.startsWith('模型')) failure = error;
        else failure = new Error('模型网络请求失败，请检查 API 地址、网络及证书。');
        // 不向日志转发 SDK 错误、服务端错误体或鉴权头。
        throw failure;
      }
    },
  };
}

// 先验证协议是否可继续处理；工具名称和参数的业务校验由各 Agent 完成。
function validateResponse(data) {
  const choice = data?.choices?.[0];
  const message = choice?.message;
  if (message?.role !== 'assistant') throw new Error('模型响应格式错误：缺少 assistant 消息。');
  if (!['stop', 'tool_calls'].includes(choice.finish_reason)) {
    throw new Error('模型输出未正常完成，可能被截断或拦截。');
  }
  const calls = message.tool_calls ?? [];
  if (!Array.isArray(calls)) throw new Error('模型响应格式错误：tool_calls 应为数组。');
  if (!calls.length && (choice.finish_reason !== 'stop' || typeof message.content !== 'string' || !message.content.trim())) {
    throw new Error('模型没有返回有效回答或工具调用。');
  }
  // 一次响应中的每个调用必须有唯一 ID，否则工具结果无法可靠对应原调用。
  const ids = calls.map((call) => call?.id);
  if (ids.some((id) => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) {
    throw new Error('模型工具调用 ID 缺失或重复，无法关联结果。');
  }
}

// 真实服务要求 HTTPS；只为本机离线测试允许 HTTP，且不接受 URL 内嵌的凭据或参数。
export function validateBaseURL(baseURL) {
  let url;
  try { url = new URL(baseURL); } catch { throw new Error('LLM_BASE_URL 必须是完整的 API 基础地址。'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.username || url.password || url.search || url.hash) {
    throw new Error('LLM_BASE_URL 需使用 HTTPS（本机可用 HTTP），且不能包含凭据、查询参数或片段。');
  }
  return url.href.replace(/\/+$/, '');
}
