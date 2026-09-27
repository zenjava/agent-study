/**
 * 三版 Agent 共用的模型 HTTP 适配层，记录每次请求、响应和供应商原始 usage。
 * 负责请求超时、取消、协议校验与错误收敛；不执行工具，也不决定是否继续问模型。
 */
/**
 * 为一次问答创建 HTTP 观察层，统一记录请求、校验响应并处理超时和取消。
 * @param {object} options 传输配置与观察回调。
 * @param {number} options.timeoutMs 每次请求及读取响应体的超时毫秒数。
 * @param {AbortSignal} [options.signal] 调用方取消信号。
 * @param {function(string, number, *): void} options.emit 领域事件接收函数。
 * @param {function(string): void} options.write 已由调用方封装的日志函数。
 * @param {typeof fetch} [options.fetchImpl=fetch] 可替换的 HTTP 实现。
 * @returns {object} 包含 fetch 方法及 step、response、failure 只读访问器的传输对象。
 */
export function createModelTransport({ timeoutMs, signal: callerSignal, emit, write, fetchImpl = fetch }) {
  // 这些闭包变量属于一次 Agent 问答；step 记录实际 HTTP 请求次数，failure 保留统一错误。
  let step = 0;
  let lastResponse;
  let failure;
  return {
    /**
     * 读取本次问答已经发出的模型 HTTP 请求次数。
     * @returns {number} 从 0 开始累计的请求数。
     */
    get step() { return step; },
    /**
     * 读取最近一次已解析的供应商响应，供编排层保留原始工具参数。
     * @returns {object|undefined} 最近一次 JSON 响应；尚无响应时为 undefined。
     */
    get response() { return lastResponse; },
    /**
     * 读取传输层最近一次归一化的错误，供上层优先展示稳定的失败原因。
     * @returns {Error|undefined} 尚未失败时为 undefined。
     */
    get failure() { return failure; },
    /**
     * 发送一次模型请求并读取完整响应，记录原始用量与响应后校验协议。
     * @param {RequestInfo|URL} input 模型接口地址或请求对象。
     * @param {RequestInit} init 请求配置，body 必须是 JSON 字符串。
     * @returns {Promise<Response>} 可由原生循环或模型 SDK 再次读取的 JSON 响应。
     * @throws {Error} 请求被取消、超时、网络失败或响应不符合约定时拒绝。
     */
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

/**
 * 检查模型回复是否可继续处理，确保结束原因、回答和工具调用 ID 有效。
 * @param {object} data 解析后的 Chat Completions 响应。
 * @returns {void}
 * @throws {Error} 消息缺失、输出未正常完成或工具调用 ID 缺失、重复时抛出。
 */
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
  const ids = calls.map(/** 提取每个工具调用的 ID，用于检查缺失及重复。 */ (call) => call?.id);
  if (ids.some(/** 检查工具调用 ID 是否缺失、空白或类型错误。 */ (id) => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) {
    throw new Error('模型工具调用 ID 缺失或重复，无法关联结果。');
  }
}

/**
 * 校验模型基础地址，仅允许 HTTPS 或本机 HTTP，并移除末尾斜线。
 * @param {string} baseURL 模型服务的基础地址。
 * @returns {string} 不带末尾斜线的完整地址。
 * @throws {Error} 地址无效、协议不允许或包含凭据、查询参数、片段时抛出。
 */
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
