/**
 * 全栈架构教程的数据：一条真实模型查单路径与三个可切换的 Agent 实现。
 * 每个代码片段均从构建时源码白名单定位，避免手写行号随代码移动而失效。
 */
import { excerpt } from './source-files.js';

export const architectureLessons = [{ id: 'architecture', name: '全栈架构总图', subtitle: 'Web → 服务端 → Agent' }];

/**
 * 为架构节点生成附带真实源码行号的代码入口。
 * @param {string} label 代码片段的用途。
 * @param {string} file 源码白名单中的路径。
 * @param {string} start 首行锚点。
 * @param {string} end 末行锚点。
 * @returns {object} 用途、文件、行号和代码节选。
 */
const source = (label, file, start, end) => ({ label, ...excerpt(file, start, end) });

const implementations = {
  native: {
    name: '原生 JavaScript', agentId: 'orders_native',
    runner: source('手写请求循环', 'src/agent/native/agent.mjs', 'for (let step', 'const calls = message.tool_calls ?? [];'),
    tool: source('白名单与参数校验', 'src/agent/native/agent.mjs', 'function executeTool(call)', 'return getOrder({ orderId: args.orderId });'),
    toolReturn: source('工具消息与调用 ID', 'src/agent/native/agent.mjs', 'const toolMessage =', "emit('tool_return', step, toolMessage);"),
    answer: source('原生循环结束', 'src/agent/native/agent.mjs', 'if (!calls.length)', 'return message.content;'),
    note: '普通 JavaScript 手动维护 messages、模型请求、工具执行和再次请求。',
  },
  langchain: {
    name: 'LangChain', agentId: 'orders',
    runner: source('createAgent 与 invoke', 'src/agent/langchain/agent.mjs', 'const agent = createAgent', 'const content = result.messages.at(-1).content;'),
    tool: source('中间件校验工具', 'src/agent/langchain/agent.mjs', 'wrapToolCall: async', 'const result = JSON.parse(message.content);'),
    toolReturn: source('ToolMessage 与事件', 'src/agent/langchain/agent.mjs', "emit('tool_result', step", 'return message;'),
    answer: source('取出最终回答', 'src/agent/langchain/agent.mjs', "emit('answer', transport.step", 'return content;'),
    note: 'createAgent 管理工具循环；中间件负责校验、限次与观察事件。',
  },
  langgraph: {
    name: 'LangGraph', agentId: 'orders_graph',
    runner: source('StateGraph 节点与边', 'src/agent/langgraph/agent.mjs', 'const graph = new StateGraph', '.compile();'),
    tool: source('tools 节点校验与执行', 'src/agent/langgraph/agent.mjs', 'async function toolsNode', 'const result = JSON.parse(message.content);'),
    toolReturn: source('工具结果加入状态', 'src/agent/langgraph/agent.mjs', "emit('tool_result', transport.step", 'messages.push(message);'),
    answer: source('graph.invoke 与最终回答', 'src/agent/langgraph/agent.mjs', 'const result = await graph.invoke', 'return content;'),
    note: 'StateGraph 显式连接 model、tools 和条件边，工具结果返回 model 节点。',
  },
};

/**
 * 按选定实现给同一条全栈链路填入节点说明、交接内容和可跳转源码。
 * @param {'native'|'langchain'|'langgraph'} framework 当前真实模型实现。
 * @returns {Array<object>} 按请求和返回顺序排列的十六个节点。
 */
export function getArchitectureSteps(framework) {
  const selected = implementations[framework] ?? implementations.langchain;
  return [
    {
      id: 'provider', lane: 'web', col: 1, row: 1, title: 'Provider 建立连接', meta: 'React / CopilotKit',
      summary: '页面配置 Runtime 地址与当前 agentId。',
      detail: 'CopilotKitProvider 在聊天页外层建立客户端上下文。切换实现或模式会重建 Provider，后续 useAgent 才能拿到与后端同名的 Agent。此步是提交前已有的页面连接。',
      handoff: '用户在 Composer 输入订单问题。',
      sources: [source('Provider 与服务地址', 'src/web/pages/chat/ChatPage.jsx', '<CopilotKitProvider', '<CopilotChatConfigurationProvider')],
    },
    {
      id: 'composer', lane: 'web', col: 1, row: 2, title: '用户提交问题', meta: 'Web / Composer',
      summary: '输入框把问题交给上层 send。',
      detail: '发送按钮或普通 Enter 调用 submit；组件只负责输入交互，不自行访问模型，也不读取模型 Key。示例路径从“查询 A1001”开始。',
      handoff: 'onSubmitMessage 将问题交给 useChatRun。',
      sources: [source('输入框提交', 'src/web/components/chat/Composer.jsx', 'const submit =', '  };')],
    },
    {
      id: 'client-agent', lane: 'web', col: 1, row: 3, title: '前端 Agent 发起运行', meta: 'Web / runAgent',
      summary: '追加用户消息并调用 runAgent。',
      detail: 'useAgent 持有当前消息与运行状态。send 先加用户消息，再由 copilotkit.runAgent 发起这一轮；提交锁阻止同一时刻重复发送。',
      handoff: 'CopilotKit 客户端向 /api/copilotkit 发送运行请求。',
      sources: [source('消息与 runAgent', 'src/web/state/chat/useChatRun.js', 'async function send(question)', 'finally { submitLock')],
    },
    {
      id: 'http', lane: 'server', col: 2, row: 3, title: 'HTTP 接入与转发', meta: 'Node / /api/copilotkit',
      summary: '校验同源请求并转交 Runtime。',
      detail: 'Node HTTP 服务限制来源和请求体大小，按需创建 Runtime handler，并把请求适配成 Web Request。这里不进行模型或工具编排。',
      handoff: 'HTTP handler 将请求交给 Copilot Runtime。',
      sources: [source('请求入口与转发', 'src/server/http-server.mjs', "if (path.startsWith('/api/copilotkit'))", 'const handler = await copilotHandler;')],
    },
    {
      id: 'runtime', lane: 'server', col: 2, row: 4, title: 'Runtime 选择 Agent', meta: 'Node / Copilot Runtime',
      summary: `agentId=${selected.agentId} 匹配后端注册表。`,
      detail: '同一个 Runtime 注册原生、LangChain、LangGraph 三种真实实现，以及两种本地演示。当前选择只决定注入哪个 runner；Web 接口和订单工具保持共用。',
      handoff: 'Runtime 调用对应的 OrderAgent 实例。',
      sources: [source('Agent 注册与分发', 'src/server/copilot-handler.mjs', 'const runtime = new CopilotRuntime', 'return createCopilotRuntimeHandler')],
    },
    {
      id: 'order-agent', lane: 'server', col: 2, row: 5, title: 'OrderAgent 准备运行', meta: 'Node / AG-UI 适配',
      summary: '提取问题与历史，在后端检查 Key。',
      detail: 'toConversation 只保留最近的用户和助手文字。收到真实问题后，服务端检查模型 Key；缺失时发出 RUN_ERROR，后续模型请求不会发生。正常运行则传入取消信号、历史和事件回调。这里没有持久化记忆。',
      handoff: `配置有效时，调用 ${selected.name} runner。`,
      sources: [
        source('最近文字历史', 'src/server/order-agent.mjs', 'export function toConversation', 'return { question: last.content.trim(), history };'),
        source('Key 校验与 runner 调用', 'src/server/order-agent.mjs', 'const { question, history } =', 'await this.runner(options);'),
      ],
    },
    {
      id: 'runner', lane: 'agent', col: 3, row: 5, title: `${selected.name} 编排`, meta: `Agent / ${selected.agentId}`,
      summary: selected.note,
      detail: `${selected.note} 这条图展示的是查询成功且模型选择 getOrder 的一次典型真实模式流程；模型也可能先追问订单号，实际请求次数不固定。`,
      handoff: '准备系统规则、历史、工具定义，向模型发送第一轮请求。',
      sources: [selected.runner],
    },
    {
      id: 'transport', lane: 'agent', col: 3, row: 6, title: '模型 HTTP 传输', meta: 'Agent / transport',
      summary: '记录请求并处理超时、取消和用量。',
      detail: '三种 Agent 都共用模型传输层。它记录每次请求和原始 usage，校验响应，处理超时与取消；真正的工具执行仍由选中的 Agent 决定。',
      handoff: '带 messages 与 getOrder 定义请求外部模型 API。',
      sources: [source('请求记录与发送', 'src/agent/common/model-transport.mjs', 'async fetch(input, init)', "emit('request', step, body);")],
    },
    {
      id: 'model-call', lane: 'external', col: 4, row: 6, title: '模型返回工具意图', meta: '外部 / 模型 API',
      summary: '模型可提出 getOrder 工具调用。',
      detail: '模型服务不在本仓库中。它收到系统规则、对话和工具定义后返回文字或 tool_calls。此图按返回 getOrder({orderId:"A1001"}) 的路径演示；模型不会直接执行 Node 函数。链接指向本项目读取与校验模型响应的代码。',
      handoff: 'tool_calls 返回 Agent，由本地代码校验并执行。',
      sources: [source('读取与校验模型响应', 'src/agent/common/model-transport.mjs', 'const response = await fetchImpl', 'validateResponse(lastResponse);')],
    },
    {
      id: 'tool-boundary', lane: 'agent', col: 3, row: 7, title: '工具执行边界', meta: 'Agent / getOrder',
      summary: '校验名称和参数，再执行工具。',
      detail: '模型只提出工具调用意图。原生版手写白名单与参数校验；LangChain 用 wrapToolCall；LangGraph 在 toolsNode 中校验。未知工具或坏参数返回结构化错误，不会放任模型执行任意函数。',
      handoff: '合法的 orderId 进入共享 getOrder 业务函数。',
      sources: [selected.tool],
    },
    {
      id: 'order-data', lane: 'external', col: 4, row: 7, title: '查询订单事实', meta: '本地数据 / getOrder',
      summary: '在虚构订单数据中查找 A1001。',
      detail: 'getOrder 是普通 JavaScript 业务函数，三种实现共用。当前查的是项目内虚构 JSON 数据；真实模型模式也使用这份样本，没有连接真实 ERP 或执行审批、付款。',
      handoff: '返回 {found, order}，由 Agent 包装为工具结果。',
      sources: [source('共享订单查询', 'src/agent/common/tools/get-order.mjs', 'export function getOrder', 'return { found: true, order: structuredClone(order) };')],
    },
    {
      id: 'tool-return', lane: 'agent', col: 3, row: 8, title: '工具结果回到消息', meta: 'Agent / tool_call_id',
      summary: '按调用 ID 回填查询结果。',
      detail: '工具结果以与请求相同的 tool_call_id 回到本轮消息。框架版使用 ToolMessage 或工具节点状态；原生版手动追加 tool 消息。随后 Agent 再请求模型组织回答。',
      handoff: '带工具结果发起下一次模型请求。',
      sources: [selected.toolReturn],
    },
    {
      id: 'model-answer', lane: 'external', col: 4, row: 8, title: '模型组织回答', meta: '外部 / 第二次请求',
      summary: '模型读取订单结果后生成文字。',
      detail: '典型查单会再次请求模型，让它根据工具提供的事实回答。这里不是浏览器直接请求模型；模型也不能把 Markdown 当成业务数据来源。当前配置 streaming: false，最终文字一次返回。',
      handoff: '完整回答返回 Agent，结束本轮工具循环。',
      sources: [source('响应与用量事件', 'src/agent/common/model-transport.mjs', 'const text = await response.text();', 'return new Response(text')],
    },
    {
      id: 'agent-answer', lane: 'agent', col: 3, row: 9, title: 'Agent 确认最终答案', meta: 'Agent / answer',
      summary: '提取回答并发出 answer 领域事件。',
      detail: 'Agent 验证最终文字非空，再产生 answer 事件。LangGraph 从 graph.invoke 的 messages 读取；LangChain 从 agent.invoke 读取；原生版从模型响应读取。',
      handoff: 'answer 与工具事件交给 OrderAgent 转换成 AG-UI。',
      sources: [selected.answer],
    },
    {
      id: 'agui', lane: 'server', col: 2, row: 9, title: 'AG-UI 事件回传', meta: 'Node / SSE',
      summary: '工具、回答和轨迹转换为事件流。',
      detail: 'OrderAgent 把工具调用、工具结果和最终文字转为 TOOL_CALL_*、TOOL_CALL_RESULT、TEXT_MESSAGE_*；自定义 harness 事件保留请求与用量。HTTP 层将 Runtime 的 SSE 响应逐块写回浏览器。',
      handoff: '浏览器接收事件，按名称和调用 ID 更新视图。',
      sources: [
        source('领域事件转 AG-UI', 'src/server/order-agent.mjs', 'const onEvent = (event) =>', "send({ type: 'TEXT_MESSAGE_END'"),
        source('HTTP 逐块回传', 'src/server/http-server.mjs', 'const reader = response.body?.getReader();', 'res.end();'),
      ],
    },
    {
      id: 'render', lane: 'web', col: 1, row: 9, title: 'Web 展示结果', meta: 'React / 订单与轨迹',
      summary: '订单卡片、助手文字和用量分别渲染。',
      detail: 'useRenderTool 将 getOrder 结果绑定 OrderCard；助手文字走 Markdown 视图；TracePanel 展示请求、工具和供应商 usage。订单卡片读取工具 JSON，不从模型文字里猜字段。',
      handoff: '本轮完成；下一次追问会携带页面当前会话的部分历史。',
      sources: [
        source('订单卡片注册', 'src/web/pages/chat/ChatWorkspace.jsx', 'useRenderTool({', '}, [agentId]);'),
        source('助手文字与卡片', 'src/web/components/chat/AssistantMessage.jsx', 'export function AssistantMessage', '</CopilotChatAssistantMessage>'),
        source('调用与用量面板', 'src/web/components/chat/TracePanel.jsx', 'export function requestUsages', 'return { ...event, usage: response?.data ?? null };'),
      ],
    },
  ];
}
