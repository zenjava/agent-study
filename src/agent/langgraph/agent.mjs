/**
 * LangGraph 版问答：用状态、模型节点、工具节点和条件边显式描述执行顺序。
 * 节点返回新增消息，由 reducer 合并；当前图没有配置 checkpointer 或长期记忆。
 */
import { randomUUID } from 'node:crypto';
import { StateGraph, StateSchema, MessagesValue, START, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, ToolMessage } from '@langchain/core/messages';
import { orderSchema, orderTool, systemPrompt } from '../common/order-contract.mjs';
import { createModelTransport, validateBaseURL } from '../common/model-transport.mjs';

// MessagesValue 用内置 reducer 合并消息：节点只需返回新增消息，不手动重写整个历史。
const OrderState = new StateSchema({ messages: MessagesValue });

// 与 LangChain 版保持相同输入/事件/返回值；此处显式构建图，不调用 createAgent。
export async function runOrderQuestionGraph({
  question, baseURL, model, apiKey, history = [],
  maxSteps = 4, timeoutMs = 30_000, log = console.log, onEvent = () => {}, signal,
}) {
  // 先校验配置与运行预算，错误输入在产生任何模型请求前结束。
  if (![baseURL, model, apiKey].every((value) => typeof value === 'string' && value.trim())) {
    throw new Error('请配置 LLM_BASE_URL、LLM_MODEL、LLM_API_KEY。' +
      '在项目目录执行 cp -n .env.example .env，再在本机编辑 .env；' +
      '使用 node --env-file=.env src/agent/langgraph/cli.mjs 启动。');
  }
  if (['replace-with-your-deepseek-api-key', 'replace-with-your-openai-api-key'].includes(apiKey.trim())) {
    throw new Error('请在本机 .env 中将 LLM_API_KEY 的占位符替换为你的 DeepSeek API key，再重启服务。');
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
  const chatModel = new ChatOpenAI({
    model, apiKey, streaming: false, useResponsesApi: false, maxRetries: 0,
    modelKwargs: model.startsWith('deepseek-') ? { thinking: { type: 'disabled' } } : {},
    configuration: { baseURL: safeBaseURL, fetch: transport.fetch, maxRetries: 0 },
  });
  // bindTools 只给模型提供工具定义；真正的执行由下面的 toolsNode 负责。
  const modelWithTools = chatModel.bindTools([orderTool]);
  // 保存本次模型节点产生的原始调用，供紧接着的工具节点严格校验。
  const calls = new Map();

  // 模型节点读取当前全部消息并新增一条回复；系统规则每次请求重新附加。
  async function modelNode(state) {
    if (signal?.aborted) throw new Error('本次请求已取消。');
    emit('graph_node', transport.step + 1, { node: 'model', messageCount: state.messages.length });
    const response = await modelWithTools.invoke([new SystemMessage(systemPrompt), ...state.messages], { signal });
    const rawCalls = transport.response.choices[0].message.tool_calls ?? [];
    // 与原版本相同：最后一次模型请求仍要求工具时，停止，不再执行额外查询。
    if (rawCalls.length && transport.step >= maxSteps) throw new Error(`达到 ${maxSteps} 次模型请求上限，仍未得到最终回答。`);
    calls.clear();
    response.tool_calls = rawCalls.map((raw) => {
      let args;
      try { args = JSON.parse(raw.function?.arguments); } catch { /* 工具节点返回结构化参数错误。 */ }
      calls.set(raw.id, { raw, args });
      return { id: raw.id, name: raw.function?.name ?? 'unknown', args: args ?? {}, type: 'tool_call' };
    });
    response.invalid_tool_calls = [];
    // 消息 ID 必须独立；重复供应商响应 ID 不应让 reducer 覆盖之前的消息。
    response.id = randomUUID();
    return { messages: [response] };
  }

  // 依次执行本次回复中的工具调用，保持调用 ID，再把所有结果作为新增消息返回。
  async function toolsNode(state) {
    emit('graph_node', transport.step, { node: 'tools', messageCount: state.messages.length });
    const messages = [];
    for (const call of state.messages.at(-1).tool_calls) {
      if (signal?.aborted) throw new Error('本次请求已取消。');
      const { raw, args } = calls.get(call.id);
      write(`[模型 → Node] 工具调用请求：${JSON.stringify(raw)}`);
      emit('tool_call', transport.step, raw);
      let error;
      if (raw.type !== 'function' || raw.function?.name !== 'getOrder') {
        error = { code: 'UNKNOWN_TOOL', message: '只支持 getOrder 工具。' };
      } else if (typeof raw.function.arguments !== 'string' || !orderSchema.safeParse(args).success) {
        error = { code: 'INVALID_ARGUMENTS', message: '参数必须是合法 JSON，只能包含非空字符串 orderId。' };
      }
      const message = error
        ? new ToolMessage({ content: JSON.stringify({ error }), tool_call_id: call.id, name: call.name, status: 'error' })
        : await orderTool.invoke(call, { signal });
      const result = JSON.parse(message.content);
      write(`[Node] ${error ? '工具校验失败' : '执行 getOrder'}：${message.content}`);
      emit('tool_result', transport.step, { tool_call_id: message.tool_call_id, result });
      emit('tool_return', transport.step, { role: 'tool', name: message.name, tool_call_id: message.tool_call_id, content: message.content });
      write(`[Node → 模型] 已准备工具结果，tool_call_id=${message.tool_call_id}，将在下一次请求发送。`);
      messages.push(message);
    }
    emit('graph_edge', transport.step, { from: 'tools', to: 'model', reason: '带回工具结果，继续回答' });
    return { messages };
  }

  // 只根据最后一条模型消息是否要求工具选择下一条边，不由自然语言猜测执行状态。
  function routeAfterModel(state) {
    const next = state.messages.at(-1).tool_calls?.length ? 'tools' : END;
    emit('graph_edge', transport.step, { from: 'model', to: next, reason: next === END ? '没有新的工具请求，本轮结束' : '模型请求调用工具' });
    return next;
  }

  // 明确声明执行拓扑；工具结果回到模型节点，只有不再请求工具才走结束边。
  const graph = new StateGraph(OrderState)
    .addNode('model', modelNode)
    .addNode('tools', toolsNode)
    .addEdge(START, 'model')
    .addConditionalEdges('model', routeAfterModel, ['tools', END])
    .addEdge('tools', 'model')
    .compile();
  try {
    const result = await graph.invoke({ messages: [...history, { role: 'user', content: question }] }, {
      // 图的递归限制预留节点调度余量；模型请求次数仍由 transport.step 与 maxSteps 单独限制。
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
    throw new Error(`LangGraph 执行失败：${redact(error instanceof Error ? error.message : '未知错误')}`);
  }
}
