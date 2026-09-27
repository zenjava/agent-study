/**
 * 三版 Agent 共享的行为契约：通过本地 HTTP 脚本回复，验证请求、工具回传和执行边界。
 * 传入不同 runner 即可复用同一组断言，避免三版验证标准漂移。
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { getOrder } from '../src/agent/common/tools/get-order.mjs';

const fakeKey = 'offline-test-key-not-a-secret';
const options = {
  question: 'A1001 现在到哪一步了，谁在审批？',
  model: 'offline-scripted-model',
  apiKey: fakeKey,
  /**
   * 忽略控制台日志，由事件流或测试断言记录运行结果。
   * @returns {void}
   */
  log: () => {},
};

/**
 * 构造可替换参数、名称和 ID 的协议工具调用，覆盖合法及非法输入。
 * @param {string} [args] JSON 参数文本，默认查询 A1001。
 * @param {string} [name="getOrder"] 工具名称。
 * @param {string} [id="call_1"] 工具调用 ID。
 * @returns {object} Chat Completions 格式的工具调用。
 */
function toolCall(args = '{"orderId":"A1001"}', name = 'getOrder', id = 'call_1') {
  return { id, type: 'function', function: { name, arguments: args } };
}

/**
 * 构造最小供应商响应，保留固定响应 ID 以检验框架是否错误去重。
 * @param {object} message 模型返回的消息。
 * @param {string} [finishReason] 结束原因，默认根据工具调用选择 tool_calls 或 stop。
 * @returns {{body: object}} 可由本地模型服务器返回的响应。
 */
function completion(message, finishReason = message.tool_calls?.length ? 'tool_calls' : 'stop') {
  return {
    body: {
      id: 'chatcmpl-offline', object: 'chat.completion', created: 0,
      model: options.model,
      choices: [{ index: 0, message, finish_reason: finishReason }],
    },
  };
}

/**
 * 将一个或多个工具调用包装为模拟模型响应。
 * @param {...object} calls 协议格式的工具调用。
 * @returns {{body: object}} 请求执行工具的模型响应。
 */
const callReply = (...calls) => completion({ role: 'assistant', content: null, tool_calls: calls });
/**
 * 将最终文字包装为正常结束的模拟模型响应。
 * @param {string} content 模型回答文本。
 * @returns {{body: object}} 不包含工具调用的模型响应。
 */
const textReply = (content) => completion({ role: 'assistant', content });

/**
 * 启动按脚本顺序回复的本机模型服务器，记录实际请求，并在测试结束时释放连接。
 * @param {import("node:test").TestContext} t 当前测试上下文。
 * @param {Array<object>} replies 响应脚本，支持 body、raw、status 和 hang；耗尽后复用末项。
 * @returns {Promise<{baseURL: string, requests: Array<object>}>} 模型基础地址及实时累积的请求列表。
 */
async function serve(t, replies) {
  const requests = [];
  const server = createServer(/** 记录实际模型 HTTP 请求，并按脚本序号返回响应或保持响应体挂起。 */ async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    requests.push({ method: req.method, url: req.url, headers: req.headers, body: JSON.parse(raw) });
    // 按请求次数顺序返回脚本，耗尽后重复最后一项，用于验证持续工具请求的限次行为。
    const reply = replies[Math.min(requests.length - 1, replies.length - 1)];
    res.writeHead(reply.status ?? 200, { 'Content-Type': 'application/json' });
    if (reply.hang) {
      res.write('{"choices":'); // 已收到响应头，但响应体始终不结束。
      return;
    }
    res.end(reply.raw ?? JSON.stringify(reply.body));
  });
  t.after(/** 测试结束时关闭活动连接，并等待 HTTP 服务完全退出。 */ async () => {
    server.closeAllConnections();
    await new Promise(/** 把 HTTP 服务关闭回调转换为可等待的完成信号。 */ (resolve) => server.close(resolve));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { baseURL: `http://127.0.0.1:${server.address().port}/v1`, requests };
}

/**
 * 为指定 Agent 实现注册共用行为测试，验证 HTTP 工具循环和执行边界。
 * @param {Function} runOrderQuestion 待测的异步问答函数。
 * @returns {void}
 */
export function orderAgentContract(runOrderQuestion) {
  for (const orderId of ['A1001', 'A9999']) {
    test(`HTTP 完整循环：${orderId} 的真实查询结果按调用 ID 回传`, /** 验证：HTTP 完整循环：${orderId} 的真实查询结果按调用 ID 回传。 */ async (t) => {
      const call = toolCall(JSON.stringify({ orderId }));
      const expectedResult = getOrder({ orderId });
      const answer = orderId === 'A1001' ? '订单等待审批，当前审批人为采购负责人。' : '没有找到该订单。';
      const api = await serve(t, [callReply(call), textReply(answer)]);
      const logs = [];
      const events = [];
      const result = await runOrderQuestion({
        ...options, baseURL: `${api.baseURL}/`,
        /**
         * 收集脱敏后的日志文本，供测试检查关键执行步骤和密钥隔离。
         * @param {string} line 当前日志。
         * @returns {number} 已记录的日志条数。
         */
        log: (line) => logs.push(line),
        /**
         * 收集 Agent 领域事件，供后续协议或工具结果断言使用。
         * @param {object} event 当前步骤的领域事件。
         * @returns {number} 收集后的事件数量。
         */
        onEvent: (event) => events.push(event),
      });

      assert.equal(result, answer);
      assert.equal(api.requests.length, 2);
      const [first, second] = api.requests;
      assert.equal(first.method, 'POST');
      assert.equal(first.url, '/v1/chat/completions');
      assert.equal(first.headers.authorization, `Bearer ${fakeKey}`);
      assert.equal(first.body.model, options.model);
      assert.equal(first.body.thinking, undefined);
      assert.deepEqual(first.body.messages.at(-1), { role: 'user', content: options.question });
      assert.equal(first.body.tools[0].function.name, 'getOrder');
      assert.deepEqual(first.body.tools[0].function.parameters.required, ['orderId']);
      assert.deepEqual(second.body.messages.slice(0, 2), first.body.messages);
      assert.deepEqual(second.body.messages[2].tool_calls, [call]);
      assert.deepEqual(second.body.messages[3], {
        role: 'tool', name: 'getOrder', tool_call_id: 'call_1', content: JSON.stringify(expectedResult),
      });
      assert.match(logs.join('\n'), /Node.*getOrder/);
      assert.ok(!logs.join('\n').includes(fakeKey));
      assert.deepEqual(events.filter(/** 排除图专属事件，使三种实现共用同一执行顺序断言。 */ (event) => !event.type.startsWith('graph_')).map(/** 提取事件类型以检查发生顺序。 */ (event) => event.type), [
        'request', 'usage', 'response', 'tool_call', 'tool_result', 'tool_return', 'request', 'usage', 'response', 'answer',
      ]);
      assert.equal(events.find(/** 识别request事件。 */ (event) => event.type === 'request').data.messages.length, 2); // 保留当时快照，不随后续 push 改变。
      assert.equal(events.find(/** 识别request事件，并限定为第二次模型请求。 */ (event) => event.type === 'request' && event.step === 2).data.messages.length, 4);
      assert.deepEqual(events.find(/** 识别tool_result事件。 */ (event) => event.type === 'tool_result').data.result, expectedResult);
      assert.ok(!JSON.stringify(events).includes(fakeKey));
    });
  }

  test('每次模型响应的 Token usage 按请求序号报告，并保留缓存明细', /** 验证：每次模型响应的 Token usage 按请求序号报告，并保留缓存明细。 */ async (t) => {
    const first = callReply(toolCall());
    const second = textReply('订单等待审批。');
    first.body.usage = { prompt_tokens: 140, completion_tokens: 12, total_tokens: 152, prompt_cache_hit_tokens: 100 };
    second.body.usage = { prompt_tokens: 220, completion_tokens: 34, total_tokens: 254 };
    const api = await serve(t, [first, second]);
    const events = [];
    await runOrderQuestion({ ...options, baseURL: api.baseURL,
      /**
       * 收集 Agent 领域事件，供后续协议或工具结果断言使用。
       * @param {object} event 当前步骤的领域事件。
       * @returns {number} 收集后的事件数量。
       */
      onEvent: (event) => events.push(event) });
    assert.deepEqual(events.filter(/** 识别usage事件。 */ (event) => event.type === 'usage'), [
      { type: 'usage', step: 1, data: first.body.usage },
      { type: 'usage', step: 2, data: second.body.usage },
    ]);
    assert.ok(events.findIndex(/** 识别usage事件。 */ (event) => event.type === 'usage') < events.findIndex(/** 识别tool_call事件。 */ (event) => event.type === 'tool_call'));
    assert.equal(api.requests[1].body.messages.some(/** 检测供应商用量是否错误混入对话消息。 */ (message) => 'usage' in message), false);
  });

  test('接口缺少 usage 时标记为未知，仍正常返回回答', /** 验证：接口缺少 usage 时标记为未知，仍正常返回回答。 */ async (t) => {
    const api = await serve(t, [textReply('请提供订单号。')]);
    const events = [];
    const answer = await runOrderQuestion({ ...options, baseURL: api.baseURL,
      /**
       * 收集 Agent 领域事件，供后续协议或工具结果断言使用。
       * @param {object} event 当前步骤的领域事件。
       * @returns {number} 收集后的事件数量。
       */
      onEvent: (event) => events.push(event) });
    assert.equal(answer, '请提供订单号。');
    assert.deepEqual(events.find(/** 识别usage事件。 */ (event) => event.type === 'usage'), { type: 'usage', step: 1, data: null });
  });

  test('模型回答被截断时，仍报告这次请求已经消耗的 Token', /** 验证：模型回答被截断时，仍报告这次请求已经消耗的 Token。 */ async (t) => {
    const reply = completion({ role: 'assistant', content: '半句话' }, 'length');
    reply.body.usage = { prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 };
    const api = await serve(t, [reply]);
    const events = [];
    await assert.rejects(runOrderQuestion({ ...options, baseURL: api.baseURL,
      /**
       * 收集 Agent 领域事件，供后续协议或工具结果断言使用。
       * @param {object} event 当前步骤的领域事件。
       * @returns {number} 收集后的事件数量。
       */
      onEvent: (event) => events.push(event) }), /未正常完成/);
    assert.deepEqual(events.find(/** 识别usage事件。 */ (event) => event.type === 'usage')?.data, reply.body.usage);
  });

  test('一次返回多个工具调用时，每个结果保留各自的调用 ID', /** 验证：一次返回多个工具调用时，每个结果保留各自的调用 ID。 */ async (t) => {
    const api = await serve(t, [
      callReply(toolCall(), toolCall('{"orderId":"A9999"}', 'getOrder', 'call_2')),
      textReply('已分别查询。'),
    ]);
    await runOrderQuestion({ ...options, baseURL: api.baseURL });
    const results = api.requests[1].body.messages.filter(/** 识别回传给模型的工具结果消息。 */ (message) => message.role === 'tool');
    assert.deepEqual(results.map(/** 提取结果消息关联的工具调用 ID。 */ (item) => item.tool_call_id), ['call_1', 'call_2']);
    assert.deepEqual(results.map(/** 读取工具结果中的订单命中标记。 */ (item) => JSON.parse(item.content).found), [true, false]);
  });

  // 参数错误是可回传的工具结果；下一次模型回复修正后，仍应能完成真实业务查询。
  for (const [label, call, code] of [
    ['未知工具', toolCall('{}', 'deleteOrder'), 'UNKNOWN_TOOL'],
    ['非法 JSON', toolCall('{oops'), 'INVALID_ARGUMENTS'],
    ['null 参数', toolCall('null'), 'INVALID_ARGUMENTS'],
    ['非字符串订单号', toolCall('{"orderId":1001}'), 'INVALID_ARGUMENTS'],
    ['空订单号', toolCall('{"orderId":"  "}'), 'INVALID_ARGUMENTS'],
    ['缺失订单号', toolCall('{}'), 'INVALID_ARGUMENTS'],
    ['多余参数', toolCall('{"orderId":"A1001","extra":true}'), 'INVALID_ARGUMENTS'],
  ]) {
    test(`${label}：向模型回传错误，允许下一轮纠正`, /** 验证：${label}：向模型回传错误，允许下一轮纠正。 */ async (t) => {
      const api = await serve(t, [callReply(call), callReply(toolCall()), textReply('纠正后已查到订单。')]);
      await runOrderQuestion({ ...options, baseURL: api.baseURL });
      const failedResult = api.requests[1].body.messages.at(-1);
      assert.equal(failedResult.tool_call_id, call.id);
      assert.equal(JSON.parse(failedResult.content).error.code, code);
      assert.equal(JSON.parse(api.requests[2].body.messages.at(-1).content).found, true);
    });
  }

  test('缺少调用 ID 时停止，避免回传无法关联的结果', /** 验证：缺少调用 ID 时停止，避免回传无法关联的结果。 */ async (t) => {
    const call = toolCall();
    delete call.id;
    const api = await serve(t, [callReply(call)]);
    await assert.rejects(runOrderQuestion({ ...options, baseURL: api.baseURL }), /调用 ID/);
    assert.equal(api.requests.length, 1);
  });

  test('模型持续请求工具时，最多发出指定次数的请求', /** 验证：模型持续请求工具时，最多发出指定次数的请求。 */ async (t) => {
    const api = await serve(t, [callReply(toolCall())]);
    await assert.rejects(runOrderQuestion({ ...options, baseURL: api.baseURL, maxSteps: 2 }), /达到.*2.*上限/);
    assert.equal(api.requests.length, 2);
  });

  test('超时覆盖响应体读取', /** 验证：超时覆盖响应体读取。 */ async (t) => {
    const api = await serve(t, [{ hang: true }]);
    await assert.rejects(runOrderQuestion({ ...options, baseURL: api.baseURL, timeoutMs: 100 }), /超时/);
  });

  test('HTTP 错误不输出服务端响应体或密钥', /** 验证：HTTP 错误不输出服务端响应体或密钥。 */ async (t) => {
    const api = await serve(t, [{ status: 401, raw: `reflected: ${fakeKey}` }]);
    await assert.rejects(runOrderQuestion({ ...options, baseURL: api.baseURL }), /** 确认鉴权失败只暴露状态码，不包含响应体中的虚构密钥。 */ (error) => {
      assert.match(error.message, /HTTP 401/);
      assert.ok(!error.message.includes(fakeKey));
      return true;
    });
  });

  for (const [label, reply, error] of [
    ['非 JSON 响应', { raw: '<html>bad gateway</html>' }, /JSON/],
    ['缺少消息', { body: { choices: [] } }, /响应格式/],
    ['空回答', textReply(''), /没有.*回答/],
    ['回答被截断', completion({ role: 'assistant', content: '半句话' }, 'length'), /未正常完成/],
  ]) {
    test(label, /** 验证：label。 */ async (t) => {
      const api = await serve(t, [reply]);
      await assert.rejects(runOrderQuestion({ ...options, baseURL: api.baseURL }), error);
    });
  }

  test('模型可以直接追问，程序不会伪造工具调用', /** 验证：模型可以直接追问，程序不会伪造工具调用。 */ async (t) => {
    const api = await serve(t, [textReply('请提供订单号。')]);
    assert.equal(await runOrderQuestion({ ...options, baseURL: api.baseURL }), '请提供订单号。');
    assert.equal(api.requests.length, 1);
  });

  test('缺少配置时在发出请求之前报错', /** 验证：缺少配置时在发出请求之前报错。 */ async () => {
    await assert.rejects(runOrderQuestion({ question: options.question }), /** 确认缺少配置时提示必需环境变量和本机初始化步骤。 */ (error) => {
      assert.match(error.message, /LLM_BASE_URL.*LLM_MODEL.*LLM_API_KEY/);
      assert.match(error.message, /cp -n \.env\.example \.env/);
      assert.ok(error.message.includes('npm start'));
      return true;
    });
  });

  for (const provider of ['deepseek', 'openai']) {
    test(`${provider} 密钥占位符未替换时不发请求，并提示本机配置步骤`, /** 验证：${provider} 密钥占位符未替换时不发请求，并提示本机配置步骤。 */ async (t) => {
      const api = await serve(t, [textReply('不应请求到这里。')]);
      await assert.rejects(runOrderQuestion({
        ...options, baseURL: api.baseURL, apiKey: `replace-with-your-${provider}-api-key`,
      }), /本机.*\.env.*LLM_API_KEY.*DeepSeek API key/);
      assert.equal(api.requests.length, 0);
    });
  }

  test('DeepSeek 工具循环使用根路径端点，并在每次请求关闭思考模式', /** 验证：DeepSeek 工具循环使用根路径端点，并在每次请求关闭思考模式。 */ async (t) => {
    const api = await serve(t, [callReply(toolCall()), textReply('A1001 等待采购负责人审批。')]);
    const answer = await runOrderQuestion({
      ...options, baseURL: api.baseURL.replace(/\/v1$/, ''), model: 'deepseek-flash',
    });
    assert.equal(answer, 'A1001 等待采购负责人审批。');
    assert.equal(api.requests.length, 2);
    for (const request of api.requests) {
      assert.equal(request.url, '/chat/completions');
      assert.equal(request.body.model, 'deepseek-flash');
      assert.deepEqual(request.body.thinking, { type: 'disabled' });
      assert.equal(request.body.tools[0].function.name, 'getOrder');
    }
    const toolResult = api.requests[1].body.messages.at(-1);
    assert.equal(toolResult.tool_call_id, 'call_1');
    assert.equal(JSON.parse(toolResult.content).order.currentApprover, '采购负责人');
  });

  test('完整展示每次模型原始响应，并对响应内容脱敏', /** 验证：完整展示每次模型原始响应，并对响应内容脱敏。 */ async (t) => {
    const reply = textReply(`请提供订单号。${fakeKey}`);
    reply.body.usage = { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 };
    const api = await serve(t, [reply]);
    const events = [];
    await runOrderQuestion({ ...options, baseURL: api.baseURL,
      /**
       * 收集 Agent 领域事件，供后续协议或工具结果断言使用。
       * @param {object} event 当前步骤的领域事件。
       * @returns {number} 收集后的事件数量。
       */
      onEvent: (event) => events.push(event) });
    const response = events.find(/** 识别response事件。 */ (event) => event.type === 'response');
    assert.ok(response, '页面应能查看模型返回的完整 JSON');
    assert.equal(response.step, 1);
    assert.equal(response.data.choices[0].message.content, '请提供订单号。[REDACTED]');
    assert.deepEqual(response.data.usage, reply.body.usage);
    assert.ok(!JSON.stringify(events).includes(fakeKey));
  });

  test('连续追问保留先前文字，工具结果仍来自本轮查询', /** 验证：连续追问保留先前文字，工具结果仍来自本轮查询。 */ async (t) => {
    const api = await serve(t, [callReply(toolCall()), textReply('含税金额为 48600 元。')]);
    const history = [{ role: 'user', content: '查 A1001' }, { role: 'assistant', content: 'A1001 等待审批' }];
    await runOrderQuestion({ ...options, baseURL: api.baseURL, history, question: '它多少钱？' });
    assert.deepEqual(api.requests[0].body.messages.slice(1, -1), history);
    assert.equal(api.requests[0].body.messages.at(-1).content, '它多少钱？');
    assert.equal(JSON.parse(api.requests[1].body.messages.at(-1).content).order.totalAmount, 48600);
  });

  test('限流响应不自动重试，避免隐藏请求与用量', /** 验证：限流响应不自动重试，避免隐藏请求与用量。 */ async (t) => {
    const api = await serve(t, [{ status: 429, raw: `private error ${fakeKey}` }]);
    const events = [];
    await assert.rejects(runOrderQuestion({ ...options, baseURL: api.baseURL,
      /**
       * 收集 Agent 领域事件，供后续协议或工具结果断言使用。
       * @param {object} event 当前步骤的领域事件。
       * @returns {number} 收集后的事件数量。
       */
      onEvent: (event) => events.push(event) }), /HTTP 429/);
    assert.equal(api.requests.length, 1);
    assert.deepEqual(events.filter(/** 排除图专属事件，使三种实现共用同一执行顺序断言。 */ (event) => !event.type.startsWith('graph_')).map(/** 提取事件类型以检查发生顺序。 */ (event) => event.type), ['request']);
  });

  test('重复工具 ID 被拒绝；最后一次模型响应不再执行工具', /** 验证：重复工具 ID 被拒绝；最后一次模型响应不再执行工具。 */ async (t) => {
    const duplicate = await serve(t, [callReply(toolCall(), toolCall())]);
    await assert.rejects(runOrderQuestion({ ...options, baseURL: duplicate.baseURL }), /调用 ID/);
    const api = await serve(t, [callReply(toolCall())]);
    const events = [];
    await assert.rejects(runOrderQuestion({ ...options, baseURL: api.baseURL, maxSteps: 1,
      /**
       * 收集 Agent 领域事件，供后续协议或工具结果断言使用。
       * @param {object} event 当前步骤的领域事件。
       * @returns {number} 收集后的事件数量。
       */
      onEvent: (event) => events.push(event) }), /达到.*1.*上限/);
    assert.equal(api.requests.length, 1);
    assert.equal(events.some(/** 识别tool_result事件。 */ (event) => event.type === 'tool_result'), false);
  });

}
