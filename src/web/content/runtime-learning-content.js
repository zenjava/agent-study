/**
 * Copilot Runtime 独立课程：说明三种 Web Agent 共用的连接、分发、事件和界面路径。
 * 源码节选来自构建时白名单，解释页面到 Agent 的共用链路。
 */
import { excerpt } from './source-files.js';

export const runtimeConcepts = [
  { name: 'Copilot Runtime', place: 'Node 后端', title: 'Agent 的服务接入层', description: '维护可用 Agent 的名称映射，提供发现、运行、停止等 HTTP 接口，并把 Agent 事件返回给前端。当前它与 src/server/http-server.mjs 运行在同一个 Node 进程里。它接到 orders 请求后交给 OrderAgent，模型与工具编排由选中的原生、LangChain 或 LangGraph 实现完成。', code: 'new CopilotRuntime({\n  agents: {\n    orders: createOrderAgent(config),\n    orders_native: createOrderAgent(config, { runner: runOrderQuestionNative }),\n    orders_graph: createOrderAgent(config, { runner: runOrderQuestionGraph }),\n    demo: createOrderAgent(config, { demo: true }),\n    demo_native: createOrderAgent(config, { demo: true, runner: runNativeDemo })\n  }\n})', source: 'src/server/copilot-handler.mjs' },
  { name: 'Provider', place: 'React 页面', title: '配置地址，并共享客户端上下文', description: 'CopilotKitProvider 包住页面，让子组件中的 Hooks 拿到同一套客户端配置。runtimeUrl 指向自己的后端；agentId 指定想运行的 Agent。CopilotChatConfigurationProvider 另外配置聊天文案等选项。', code: '<CopilotKitProvider\n  runtimeUrl="/api/copilotkit"\n  agentId="orders"\n>\n  <Workspace />\n</CopilotKitProvider>', source: 'src/web/pages/chat/ChatPage.jsx · 精简示例' },
  { name: '前端 Agent', place: '浏览器内存', title: '后端 Agent 在前端的代理对象', description: 'useAgent 返回前端代理及就绪状态。agent.messages 是消息，agent.isRunning 是运行状态。useCopilotKit 返回客户端；这里调用它的 runAgent，把当前消息发给 Runtime。模型与工具循环仍在 Node 后端执行。', code: 'const { agent, isReady } = useAgent({ agentId: "orders" });\nconst { copilotkit } = useCopilotKit();\n\n// 用户提交问题后：\nagent.addMessage({\n  id: crypto.randomUUID(), role: "user",\n  content: "A1001 谁在审批？"\n});\nawait copilotkit.runAgent({ agent });', source: 'src/web/state/chat/useChatRun.js · 精简示例，完整入口含并发与错误处理' },
  { name: '后端 OrderAgent', place: 'Node 后端', title: '我们写的 AG-UI 适配器', description: '它继承 AbstractAgent，run(input) 接收消息和会话上下文，返回 Observable 事件流。它整理历史、调用业务 Agent、转换事件并处理取消。clone() 让 Runtime 为运行复制实例。Observable 可以理解为持续送来多条事件的通道。', code: 'class OrderAgent extends AbstractAgent {\n  run(input) {\n    return new Observable((subscriber) => {\n      // 接收 input.messages / threadId / runId\n      // 调用已注入的 runner\n      // subscriber.next(...) 逐条发出 AG-UI 事件\n    });\n  }\n}', source: 'src/server/order-agent.mjs · 结构示意' },
  { name: '问答实现', place: 'Node 后端', title: '模型与工具的编排器', description: 'Runtime 通过 OrderAgent 调用选中的 runner：原生版手写消息与工具循环，LangChain 版使用 Runnable 与本地工具循环，LangGraph 版使用 StateGraph。三者都能决定模型、调用工具并生成回答。', code: 'orders → LangChain Runnable + 本地循环\norders_native → 原生 messages 循环\norders_graph → LangGraph StateGraph', source: 'src/server/copilot-handler.mjs · 分发示意' },
  { name: 'AG-UI / SSE', place: '前后端之间', title: '事件的格式与传输方式', description: 'AG-UI 约定消息类型与字段：运行开始、工具参数、工具结果、文本片段、结束或失败。SSE 是本项目传送这些事件的 HTTP 流格式。AG-UI 的 TOOL_CALL_RESULT 来自后端转换，不能与模型 API 返回的 tool_calls 原始结构混为一谈。', code: '// 一条发给页面的工具结果事件（节选）\n{\n  type: "TOOL_CALL_RESULT",\n  toolCallId: "run_1:call_1",\n  role: "tool",\n  content: "{\\"found\\":true,\\"order\\":{...}}"\n}', source: 'src/server/order-agent.mjs · 协议示意，订单字段省略' },
  { name: 'useRenderTool', place: 'React 页面', title: '声明一种工具结果如何展示', description: 'name: getOrder 将工具结果绑定到 OrderCard。组件收到 status、parameters、result，按业务字段显示加载状态、错误或订单。这个 Hook 注册的是 UI 展示，不会替你在后端查询数据库。', code: 'const agentId = "orders";\nuseRenderTool({\n  name: "getOrder", agentId,\n  parameters: z.object({ orderId: z.string() }),\n  render: OrderCard\n}, [agentId]);', source: 'src/web/pages/chat/ChatWorkspace.jsx · 精简示例' },
];


/** 三种 Web Agent 共用的接入路线；章节进度与各实现教程分别保存。 */
export const runtimeLessons = [
  {
    id: 'runtime-map', name: '先看共同链路', subtitle: 'Runtime 在哪一层', minutes: '4 min',
    title: '三种 Agent 实现，共用一条页面接入链路。',
    intro: '工作台切换原生 JavaScript、LangChain 或 LangGraph 时，页面仍通过同一个 Copilot Runtime 提交问题和接收结果。',
    takeaway: 'Provider → Runtime → OrderAgent → 选中的问答实现 → AG-UI 事件 → 页面。',
    points: [
      ['先分清分工', 'Copilot Runtime 根据 agentId 找到后端 Agent，负责运行接口与事件传输。原生循环、LangChain Runnable + 本地循环 和 LangGraph StateGraph 才决定怎样调用模型与工具；切换编排方式不需要重写 Web 协议。'],
      ['同一套页面，五个后端标识', 'orders、orders_graph、orders_native 对应三种真实模型实现；demo 是框架版共用的固定规则，demo_native 用脚本模型运行原生循环。这些名称在 Runtime 的 agents 表中注册。'],
      ['沿源码读到底', '页面 Provider 配置 /api/copilotkit；Node 服务把请求交给 Runtime；OrderAgent 整理问题与历史、调用选定 runner，并把执行过程转换为 AG-UI 事件。工具卡片与调用面板再消费这些事件。'],
    ],
    snippets: [
      { label: '页面选择后端 Agent', note: 'mode 和 framework 共同决定 agentId，三种 Web 实现仍使用同一个 Runtime 地址。', ...excerpt('src/web/state/chat/useChatSession.js', "const agentId =", 'const [session, setSession]') },
      { label: 'Runtime 注册五个入口', note: 'Runtime 负责名字到后端 Agent 的分发；runner 决定进入哪种编排实现。', ...excerpt('src/server/copilot-handler.mjs', 'const runtime =', 'return createCopilotRuntimeHandler') },
      { label: '接入层调用实现', note: 'OrderAgent.run 在每次运行中调用注入的 runner，随后把领域事件转为页面可消费的事件。', ...excerpt('src/server/order-agent.mjs', 'const options =', 'await this.runner(options);') },
    ],
    quiz: { question: '把 Web 工作台从 LangChain 切到 LangGraph，Copilot Runtime 会怎样变化？', options: ['继续通过同一 Runtime，按新的 agentId 选择后端实现', '浏览器绕过 Runtime 直接调用模型 API', 'Runtime 会自动把原生循环改写成图'], answer: 0, explanation: '三种实现共用 Web 接入层；变化的是 Runtime 选中的后端 runner。' },
  },
  {
    id: 'runtime-connect', name: '从页面接入服务', subtitle: 'Provider、路由与注册', minutes: '5 min',
    title: '先约定地址，再按名字找到 Agent。',
    intro: 'CopilotKitProvider 给页面提供客户端上下文；本机 Node 服务承接 /api/copilotkit，再把 Web Request 交给 Runtime handler。模型密钥始终由服务端配置。',
    takeaway: 'runtimeUrl 选服务地址，agentId 选已注册的后端 Agent；两者都不是模型名或工具名。',
    points: [
      ['页面发起运行', 'useChatRun 从 useAgent 获取前端 Agent，先加入用户消息，再调用 copilotkit.runAgent({ agent })。提交锁避免同一渲染周期重复发送。'],
      ['服务端挂载 Runtime', 'createCopilotHandler 注册 agents 并返回处理 Web Request 的 handler。http-server.mjs 只接受本机同源请求，限制输入大小，再将响应体逐块回写浏览器。'],
      ['标识各有用途', 'agentId 匹配 agents 对象的键；getOrder 是工具名称；tool_call_id 对应模型提出的一次调用。threadId 标识会话，runId 标识这次运行。它们不因名称相似而互相替代。'],
    ],
    snippets: [
      { label: 'Provider 地址与 agentId', ...excerpt('src/web/pages/chat/ChatPage.jsx', '<CopilotKitProvider', '<CopilotChatConfigurationProvider') },
      { label: '前端提交消息', ...excerpt('src/web/state/chat/useChatRun.js', 'async function send(question)', 'finally { submitLock') },
      { label: '注册 Runtime handler', ...excerpt('src/server/copilot-handler.mjs', 'const runtime =', 'return createCopilotRuntimeHandler') },
      { label: 'Node HTTP 转发', ...excerpt('src/server/http-server.mjs', 'const response = await handler(new Request', 'const reader = response.body?.getReader();') },
    ],
    quiz: { question: '页面的 agentId="orders_native" 应对应哪里？', options: ['模型服务的 model 字段', 'Copilot Runtime 的 agents.orders_native 键', 'getOrder 工具的 orderId 参数'], answer: 1, explanation: 'agentId 是接入层用来选择后端 Agent 的标识；工具和模型各有自己的名称。' },
  },
  {
    id: 'runtime-run', name: '适配执行和事件', subtitle: 'runner、ID 与取消', minutes: '6 min',
    title: '后端执行一次问答，页面收到同一种事件。',
    intro: 'OrderAgent 是本项目写的 AG-UI 适配器。它把前端消息整理成 question 和 history，再运行当前实现，并将工具与文字结果映射成标准事件。',
    takeaway: '编排实现可以替换；同一协议适配器负责运行、事件关联和取消传播。',
    points: [
      ['一次运行的输入', 'toConversation 只保留最近的用户与助手文字，拒绝客户端注入 system 或 tool 消息；OrderAgent.run 取得 runId 与 threadId，并为当前订阅建立 AbortController。'],
      ['把领域事件变成协议事件', '工具请求发送 TOOL_CALL_START、ARGS、END，查询结果另发 TOOL_CALL_RESULT；最终文字发送 TEXT_MESSAGE_START、CONTENT、END。END 只表示调用参数或文字结束，不等于工具结果已经返回。'],
      ['关联和停止', '供应商 tool_call_id 加上 runId 后成为前端的 toolCallId，防止多轮复用同一调用 ID 时覆盖旧卡片。用户停止时，取消信号向下传给当前 runner 和模型 HTTP 请求。'],
    ],
    snippets: [
      { label: '过滤客户端历史', ...excerpt('src/server/order-agent.mjs', 'export function toConversation', 'return { question: last.content.trim(), history };') },
      { label: '选择和注入 runner', ...excerpt('src/server/order-agent.mjs', 'export function createOrderAgent', 'return new OrderAgent(config, demo, runner);') },
      { label: '工具与文字事件', ...excerpt('src/server/order-agent.mjs', 'const callId =', "send({ type: 'TEXT_MESSAGE_END'") },
      { label: '停止底层运行', ...excerpt('src/server/order-agent.mjs', 'abortRun() {', 'super.abortRun();') },
    ],
    quiz: { question: 'TOOL_CALL_END 到达时，订单查询已经完成了吗？', options: ['一定完成', '模型已经付款', '还不能确定，查询结果由 TOOL_CALL_RESULT 单独返回'], answer: 2, explanation: 'TOOL_CALL_END 结束的是调用参数流；真正的业务结果由后续的 TOOL_CALL_RESULT 携带。' },
  },
  {
    id: 'runtime-render', name: '事件怎样成为界面', subtitle: '卡片、用量与会话边界', minutes: '5 min',
    title: '工具结果进卡片，回答文字进对话。',
    intro: 'Runtime 通过响应流把 AG-UI 事件交回前端 Agent。页面渲染工具卡片、回答及执行记录；这里还要分清一次会话与长期记忆。',
    takeaway: 'AG-UI 约定事件含义，SSE 传输事件；订单卡片、Token 面板分别读取自己需要的数据。',
    points: [
      ['两条展示路径', 'ChatWorkspace 用 useRenderTool 将 getOrder 绑定到 OrderCard；工具结果以 toolCallId 关联到卡片。TEXT_MESSAGE 形成助手回答，交给聊天视图展示。'],
      ['额外的观察记录', 'OrderAgent 同时发送 CUSTOM/harness 领域事件。useChatRun 收集它们，TracePanel 再按 runId、请求序号汇总模型请求与用量；演示的零用量不等于真实模型免费。'],
      ['会话并非自动持久化', '本项目没有持久化数据库、跨重启会话记忆或共享业务 state。追问依赖当前页面携带并由服务端筛选的历史消息。切换实现或模式时 Provider 重建，开始新会话。'],
      ['实际验证范围', '离线测试验证 Runtime 分发、工具 ID、事件流与停止链路；脚本模型不能证明真实模型每次都会选中正确工具或给出正确业务结论。'],
    ],
    snippets: [
      { label: '注册订单卡片', ...excerpt('src/web/pages/chat/ChatWorkspace.jsx', 'useRenderTool({', '}, [agentId]);') },
      { label: '工具结果与助手文字', ...excerpt('src/server/order-agent.mjs', "if (type === 'tool_call')", "send({ type: 'TEXT_MESSAGE_END'") },
      { label: '收集观察事件', ...excerpt('src/web/state/chat/useChatRun.js', 'onCustomEvent:', 'subscription.unsubscribe();') },
      { label: '关联用量与请求', ...excerpt('src/web/components/chat/TracePanel.jsx', 'export function requestUsages', 'return { ...event, usage: response?.data ?? null };') },
    ],
    quiz: { question: 'threadId 存在，是否说明重启后还能恢复本次对话？', options: ['不能；本项目没有配置持久化，历史来自当前请求', '能；任何 Runtime 都自动保存数据库', '能；只要有工具卡片就会保存'], answer: 0, explanation: 'threadId 是会话标识，不等于存储机制。本项目没有接入长期会话数据库。' },
  },
];
