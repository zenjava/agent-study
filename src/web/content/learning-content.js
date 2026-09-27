/**
 * LangChain 课程数据、基础概念和项目文件地图。
 * 每节的 points、snippets、quiz 分别驱动正文、源码标签和小测；answer 是从零开始的选项索引。
 */
import { excerpt } from './source-files.js';

export const lessons = [
  {
    id: 'map', name: '先看全貌', subtitle: '认清四个角色', minutes: '3 min',
    title: '一个问题，四种分工。',
    intro: '沿着“查一下 A1001 谁在审批”走一遍。先认清每层做什么，再读具体代码。',
    takeaway: '你写业务能力，模型选择能力，LangChain 编排调用，CopilotKit 展示结果。',
    points: [
      ['入口在页面', 'src/web/state/chat/useChatRun.js 把问题加入消息列表，通过 CopilotKit 的 runAgent 发给 /api/copilotkit。src/server/http-server.mjs 接住 HTTP 请求，再交给 Copilot Runtime。'],
      ['桥接层传递消息', 'src/server/order-agent.mjs 把页面消息整理成 question 和 history，再调用 src/agent/langchain/agent.mjs。它还把后端事件转换成前端能理解的 AG-UI 事件。这里的 OrderAgent 是协议适配器，不是另一个大模型。'],
      ['两种模式，走不同分支', 'orders 进入 LangChain 和真实模型；demo 使用固定规则、本地订单数据，不调用模型。学习页也是固定脚本演示，独立于这两个运行入口。'],
    ],
    snippets: [
      { label: '① 页面入口：runAgent', note: '订单输入框通过 onSubmitMessage={send} 调用这个函数。agent.addMessage 先加入用户问题，copilotkit.runAgent({ agent }) 再向后端发起本轮运行。这里的 runAgent 属于 CopilotKit。', ...excerpt('src/web/state/chat/useChatRun.js', 'async function send(question)', 'finally { submitLock') },
      { label: '② agent 从哪里来', note: 'useAgent 获取与 agentId 对应的前端 Agent 对象，保存消息与运行状态；useCopilotKit 获取负责发起运行的客户端。orders 对应真实模型，demo 对应本地演示。', ...excerpt('src/web/state/chat/useChatRun.js', 'const { agent, isReady } = useAgent', 'const { copilotkit } = useCopilotKit();') },
      { label: '③ 连接哪个后端', note: 'CopilotKitProvider 的 runtimeUrl 指向 /api/copilotkit，agentId 指定使用哪个后端 Agent。前端发出的是对话消息，模型 Key 由后端配置。', ...excerpt('src/web/pages/chat/ChatPage.jsx', 'return <CopilotKitProvider', '<CopilotChatConfigurationProvider agentId=') },
      { label: '④ 后端注册与分发', note: 'Copilot Runtime 将三种实现和两种本地演示映射到 src/server/order-agent.mjs 的 OrderAgent。它整理 question 和 history，orders 分支调用 src/agent/langchain/agent.mjs；orders_graph 分支调用新增的 src/agent/langgraph/agent.mjs。', ...excerpt('src/server/copilot-handler.mjs', 'const runtime =', 'return createCopilotRuntimeHandler') },
      { label: '⑤ LangChain：invoke', note: '进入 runOrderQuestion 后，才会创建 LangChain Agent 并调用 invoke。invoke 在 Node 后端编排模型与工具循环；它与页面上的 copilotkit.runAgent 是前后衔接的两个入口。', ...excerpt('src/agent/langchain/agent.mjs', 'const agent = createAgent', 'const content = result.messages.at(-1).content;') },
    ],
    quiz: { question: '模型真正需要查询订单时，谁负责执行 getOrder？', options: ['大模型直接进入数据库执行', 'Node 程序通过 LangChain 执行已注册的工具', 'CopilotKit 根据 Markdown 生成并执行查询'], answer: 1, explanation: '模型只提出工具调用请求。实际执行发生在 Node 后端，LangChain 找到注册的工具函数并调用它。' },
  },
  {
    id: 'langchain', name: 'LangChain 核心概念', subtitle: '先掌握开发词汇', minutes: '8 min',
    title: '把几个核心概念，连成一条工作链。',
    intro: 'LangChain 提供模型适配、消息、工具和 Agent 编排等组件。用当前订单助手对照这些名字，就能看懂 createAgent 的配置和 invoke 的输入输出。',
    takeaway: 'Model 产生消息，Tool 执行业务，Agent 编排循环；Prompt 提供指令，State 保存运行数据，Middleware 放入代码控制。',
    points: [
      ['先读懂 createAgent 的四个输入', 'model 是模型适配器，tools 是程序允许使用的能力，systemPrompt 是开发者指令，middleware 是执行控制点。createAgent 组装它们；真正开始这一轮任务的是后面的 agent.invoke。'],
      ['沿着 messages 追踪一次运行', '传入 history 和当前用户问题；模型回复的 AIMessage 可能带 tool_calls。工具执行后产生 ToolMessage，再交给模型继续。invoke 返回的 result 是包含 messages 的状态对象；本项目取最后一条消息的 content，作为最终文字。'],
      ['约定格式，还要验证业务', '工具的输入 Schema、工具返回的业务 JSON、模型的最终回答，是三份不同的约定。Schema 可以检查字段与类型；订单是否真实、权限是否满足、金额是否正确，仍需要业务服务和确定性代码保证。'],
    ],
    snippets: [
      { label: '1. 组装与运行', note: '这几行把 Model、Tool、Prompt、Middleware 组合起来。messages 是输入状态的一部分，result.messages 是运行后的消息；这一次 invoke 内部可以发出多次模型请求。', ...excerpt('src/agent/langchain/agent.mjs', 'const agent = createAgent', 'const content = result.messages.at(-1).content;') },
      { label: '2. 模型适配器', note: 'ChatOpenAI 将 LangChain 消息转换为当前配置的模型 API 请求。本项目使用 Chat Completions 协议；模型调用日志和 Token 用量通过 transport.fetch 记录。', ...excerpt('src/agent/langchain/agent.mjs', 'const chatModel =', 'configuration: { baseURL:') },
      { label: '3. 工具与参数', note: 'orderSchema 约束工具输入，tool 的回调执行业务并序列化结果。模型看到工具的说明与参数定义，不会拿到这个函数的源码。', ...excerpt('src/agent/common/order-contract.mjs', 'const orderSchema =', 'schema: orderSchema,') },
      { label: '4. 中间件与消息', note: 'wrapToolCall 在执行前校验工具名称和参数。校验失败时返回 ToolMessage，并保持相同的 tool_call_id，供模型理解哪一次调用出了错。', ...excerpt('src/agent/langchain/agent.mjs', 'wrapToolCall:', 'return message;') },
      { label: '5. 当前的历史管理', note: '当前项目从前端传来的消息提取最近的用户和助手文字。本轮新查到的工具结果由 LangChain 放回本轮 messages；没有配置跨运行的 checkpointer。', ...excerpt('src/server/order-agent.mjs', 'const history =', 'return { question: last.content.trim(), history };') },
    ],
    quiz: { question: '执行一次 await agent.invoke({ messages })，意味着什么？', options: ['固定只发送一次模型请求，并返回字符串', '开始一轮 Agent 运行，可能多次请求模型和执行工具，最终返回包含 messages 的状态', '自动保存长期记忆，并把返回值渲染成订单卡片'], answer: 1, explanation: 'invoke 表示运行这个对象。模型的 invoke 返回模型消息；Agent 的 invoke 执行编排过程。当前项目从 result.messages 取最后的回答，持久化和 UI 展示由其他机制承担。' },
  },
  {
    id: 'tool', name: '定义一个工具', subtitle: '函数 + 名称 + Schema', minutes: '4 min',
    title: '把业务函数，变成模型可选的能力。',
    intro: '工具有两个面：给模型看的说明，以及程序真正执行的函数。它们通过同一个工具名称关联。',
    takeaway: 'tool() 包装已有业务函数。模型看到名称、描述和参数定义，不会收到函数的 JavaScript 源码。',
    points: [
      ['先有普通业务函数', 'src/agent/common/tools/get-order.mjs 的 getOrder({ orderId }) 查询本地数组。找到就返回 { found: true, order }，找不到就返回 { found: false, orderId }。这里还没有接入真实 ERP 或数据库。'],
      ['再注册为工具', 'src/agent/common/order-contract.mjs 中 tool() 的第一个参数是执行函数；第二个参数写 name、description、schema。Zod 描述 orderId 是字符串，执行前还会校验非空及额外字段。'],
      ['输入与输出是两份约定', 'schema 约束的是输入参数。输出业务含义由返回字段、工具描述和 systemPrompt 共同解释。当前代码没有给返回值定义一份完整的输出 Schema；更复杂的状态码、金额单位应该显式说明。found 由业务函数产生。'],
    ],
    snippets: [
      { label: '工具注册', ...excerpt('src/agent/common/order-contract.mjs', 'const orderSchema =', 'schema: orderSchema,') },
      { label: '虚构订单数据', ...excerpt('src/agent/common/demo/orders.demo.json', '"orderId": "A1001"', '"statusCode": "pending"') },
      { label: '真正的业务函数', ...excerpt('src/agent/common/tools/get-order.mjs', 'export function getOrder', 'return { found: true, order: structuredClone(order) };') },
    ],
    quiz: { question: 'getOrder 返回 found: false，代表什么？', options: ['业务函数没找到该订单', '要求模型输出 false 格式', '告诉页面关闭 Markdown 渲染'], answer: 0, explanation: 'found 是我们定义的业务字段。业务函数计算它，模型和页面按约定理解它；它不是模型 API 的统一控制字段。' },
  },
  {
    id: 'model', name: '连接与约束模型', subtitle: '模型适配器 + 提示词', minutes: '3 min',
    title: '告诉模型能做什么、应该怎么做。',
    intro: '配置回答“连到哪里”，提示词回答“按什么规则工作”。二者都由后端提供。',
    takeaway: 'ChatOpenAI 是协议适配器；实际连接哪家模型，由 baseURL、model 和 apiKey 决定。',
    points: [
      ['连接模型服务', '服务启动时从环境变量读取模型地址、名称和 Key。当前 ChatOpenAI 使用 Chat Completions 协议，也能连接兼容该协议的 DeepSeek 服务。Key 留在 Node 后端。'],
      ['写清业务规则', 'systemPrompt 要求订单信息必须查工具、缺少订单号就追问、金额含税不重复加税，并让回答用简洁中文 Markdown。它是开发者写的字符串，作为系统消息随请求发送。'],
      ['提示词不等于强校验', '“不要猜测”是模型指令，不能保证每次都遵守。参数合法性、可用工具、超时和调用上限由代码检查。当前项目也没有对最终回答里的每个业务结论做自动事实核验。'],
    ],
    snippets: [
      { label: '模型连接', ...excerpt('src/agent/langchain/agent.mjs', 'const chatModel =', 'configuration: { baseURL:') },
      { label: '系统提示词', ...excerpt('src/agent/common/order-definition.mjs', 'const systemPrompt =', '页面会自动显示详细订单卡片') },
      { label: '对话历史', ...excerpt('src/server/order-agent.mjs', 'const history =', 'return { question: last.content.trim(), history };') },
    ],
    quiz: { question: '想防止模型调用不允许的接口，最可靠的实现位置在哪里？', options: ['只在提示词里多写几次“禁止”', '把按钮隐藏起来', '在后端限制工具列表并校验调用参数'], answer: 2, explanation: '提示词帮助模型理解意图，后端代码决定是否执行。权限和业务规则需要在执行侧落实；这个示例目前只允许 getOrder。' },
  },
  {
    id: 'loop', name: '看懂 Agent 循环', subtitle: '亲手走一次请求', minutes: '5 min',
    title: '两次问模型，一次查订单。',
    intro: '点击下面的步骤，看同一个 call_demo_1 怎样从工具请求走到工具结果，再进入第二次模型请求。',
    takeaway: 'createAgent().invoke() 负责循环：问模型 → 执行工具 → 补入结果 → 再问模型 → 得到回答。',
    points: [
      ['从 invoke 开始', '传入历史消息和当前问题，框架再加入 systemPrompt 和 tools。模型若返回 tool_calls，框架选择相应工具；不再要求调用工具并返回最终文本时，这一轮运行结束。'],
      ['中间件保留控制点', 'wrapModelCall 围绕模型调用，wrapToolCall 围绕工具执行。这里用它们记录请求、限制次数、校验参数，并把参数或工具名称错误包装成 ToolMessage 供模型纠正。handler(request) 表示继续执行被包裹的操作。'],
      ['区分三种计数', '一次用户提问是一次 run；一次 HTTP 模型请求是一个 step；一次工具执行有自己的 tool_call_id。常见查询是 1 run、2 次模型请求、1 次 getOrder；追问订单号可能只需 1 次模型请求。'],
    ],
    snippets: [
      { label: '启动 Agent', ...excerpt('src/agent/langchain/agent.mjs', 'const agent = createAgent', 'emit(\'answer\'') },
      { label: '执行与回传工具', ...excerpt('src/agent/langchain/agent.mjs', 'wrapToolCall:', 'return message;') },
      { label: '模型调用边界', ...excerpt('src/agent/langchain/agent.mjs', 'wrapModelCall:', 'calls.clear();') },
    ],
    quiz: { question: '查完订单后，为什么通常还要调用一次模型？', options: ['为了再查询一次同样的订单', '把查到的数据交给模型，让它组织针对问题的回答', '因为 LangChain 固定要求每个问题调用两次'], answer: 1, explanation: '第一次模型决定查询什么，第二次模型阅读工具结果并回答用户。工具执行与模型请求是两类操作；实际次数由任务和模型输出决定。' },
  },
  {
    id: 'render', name: '把结果交给界面', subtitle: '订单卡片与文字分开', minutes: '3 min',
    title: '同一份业务结果，走向两个展示出口。',
    intro: '你看到的订单卡片与自然语言解读，来自不同的数据通道。理解这一点，就不会把 Markdown 和业务组件混在一起。',
    takeaway: '工具结果 JSON → OrderCard；模型回答文本 → Markdown renderer。',
    points: [
      ['用名称选组件，用 ID 找调用', '前端 useRenderTool 注册 name: getOrder 对应 OrderCard。AG-UI 用 toolCallId 关联这一次调用的参数与结果；后端给供应商的调用 ID 加上 runId，避免跨轮重复 ID 覆盖旧卡片。'],
      ['卡片直接读业务数据', 'OrderCard 解析 result，检查 error 和 found，再读取 payload.order。商品、审批、配送、付款都是 React 按字段渲染，卡片金额直接来自工具结果。'],
      ['文字是模型的总结', 'AssistantMessage 分别放置 toolCallsView 和 markdownRenderer。流式传输的是运行事件；当前模型配置 streaming: false，因此最终文字是拿到完整回答后一次推送，并非逐 Token 输出。'],
    ],
    snippets: [
      { label: '工具绑定组件', ...excerpt('src/web/pages/chat/ChatWorkspace.jsx', 'useRenderTool({ name:', 'useRenderTool({ name:') },
      { label: '两个展示出口', ...excerpt('src/web/components/chat/AssistantMessage.jsx', 'function AssistantMessage', '</section>}</CopilotChatAssistantMessage>;') },
      { label: '卡片读取结果', ...excerpt('src/web/components/chat/OrderCard.jsx', 'export function OrderCard', 'const o = payload.order;') },
      { label: '事件协议转换', ...excerpt('src/server/order-agent.mjs', 'const callId =', "} else if (type === 'answer')") },
    ],
    quiz: { question: '订单卡片的总金额来自哪里？', options: ['从模型生成的 Markdown 中提取', '由 CopilotKit 根据订单号猜测', 'getOrder 返回的 order.totalAmount'], answer: 2, explanation: '业务组件直接使用工具返回值，模型的中文总结单独渲染。两种出口可以同时出现，但彼此不承担数据解析。' },
  },
  {
    id: 'practice', name: '开始自己的开发', subtitle: '成本、边界与扩展清单', minutes: '4 min',
    title: '掌握骨架，再把业务放进去。',
    intro: '接下来可以做两个练习：先替换订单的数据来源，再尝试增加一个新工具。每次只改一条完整链路。',
    takeaway: '先把业务函数做好，再注册工具、校验执行、连接展示，最后用可观察的请求验证。',
    points: [
      ['练习一：替换数据源', '把 src/agent/common/tools/get-order.mjs 的本地数组查询换成真实业务服务，尽量保留 { found, order } 约定。如果改为异步函数，要把 tool 回调改为 async，await 结果后再 JSON.stringify；同步的本地演示分支也需要相应适配。'],
      ['练习二：增加 getSupplier', '写业务函数和 Zod 参数定义 → tool() 注册 → 放进 createAgent 的 tools 数组 → 扩展 wrapToolCall 的名称白名单和参数校验 → 前端按名称注册供应商卡片。只往 tools 数组加工具还不够，当前中间件只允许 getOrder。'],
      ['验证成功，也验证失败', '现有 tests 用本地模拟模型检查工具 ID、参数错误、未找到、取消、超时和用量。先 npm test，再 npm run build。浏览器查看请求链；真实模型的表现仍需单独验证。复杂业务还要补权限校验、审批确认、幂等和业务评估。'],
    ],
    snippets: [
      { label: '记录实际请求与用量', ...excerpt('src/agent/common/model-transport.mjs', 'const body =', 'validateResponse(lastResponse);') },
      { label: '限制执行范围', ...excerpt('src/agent/langchain/agent.mjs', 'let error;', 'const result = JSON.parse(message.content);') },
      { label: '默认运行预算', ...excerpt('src/agent/langchain/agent.mjs', 'export async function runOrderQuestion', '}) {') },
    ],
    quiz: { question: '加入 getSupplier 后，模型调用却被拒绝，最先应该检查什么？', options: ['当前 wrapToolCall 仍只允许 getOrder，且还在用订单参数 Schema', '必须换一个更贵的模型', 'Markdown 渲染器不支持新名称'], answer: 0, explanation: '工具注册与执行边界必须一起更新，并为新工具使用对应的参数校验。前端是否注册卡片影响展示，不能替代后端能力注册。' },
  },
];

// 概念卡片是精简教学示意；下方 SourceReader 才是按行定位的真实项目源码。
export const langchainConcepts = [
  {
    name: 'Model · 模型', place: '已使用 · ChatOpenAI', title: '用统一接口连接模型服务',
    description: 'Chat Model 接收消息并返回 AIMessage，内容可能是文本或工具调用请求。ChatOpenAI 是适配器，实际服务由 baseURL、model 和 apiKey 决定。换模型还要检查工具调用、消息格式等能力是否兼容。',
    code: 'const chatModel = new ChatOpenAI({\n  model, apiKey,\n  configuration: { baseURL },\n});\n// 本项目把它交给 createAgent\n// 单独调用模型时，也可以这样写：\nconst reply = await chatModel.invoke([\n  { role: "user", content: "你好" },\n]); // AIMessage',
    source: '对应 src/agent/langchain/agent.mjs · 精简示意；单独的模型 invoke 不负责执行工具。',
    doc: 'https://docs.langchain.com/oss/javascript/langchain/models',
  },
  {
    name: 'Message · 消息', place: '已使用 · messages / ToolMessage', title: '用角色和调用 ID 组织上下文',
    description: 'SystemMessage 放指令，HumanMessage 放用户问题，AIMessage 放模型回复，ToolMessage 放工具结果。也可传 role/content 对象。模型返回的 tool_calls[].id 与结果的 tool_call_id 关联一次调用；字段含义仍由我们定义。',
    code: '// 模型提出调用：AIMessage 的部分字段\n{\n  tool_calls: [{ id: "call_1", name: "getOrder",\n    args: { orderId: "A9999" } }]\n}\n// 程序执行后，返回对应的工具消息\nnew ToolMessage({\n  tool_call_id: "call_1", name: "getOrder",\n  content: JSON.stringify({ found: false, orderId: "A9999" }),\n});',
    source: '字段示意 · LangChain 的 args 是对象；本项目原始 API 的 function.arguments 是 JSON 字符串。',
    doc: 'https://docs.langchain.com/oss/javascript/langchain/messages',
  },
  {
    name: 'Tool · 工具', place: '已使用 · tool + Zod', title: '把业务函数注册为可调用的能力',
    description: 'name 让程序找到工具，description 帮助模型选择，schema 定义输入参数。模型只提出调用请求，Node 中的函数才执行查询。输入校验不等于订单权限检查，也不会自动生成返回结果的业务定义。',
    code: 'const orderTool = tool(\n  ({ orderId }) => JSON.stringify(getOrder({ orderId })),\n  {\n    name: "getOrder",\n    description: "按订单号查询订单",\n    schema: orderSchema,\n  },\n);',
    source: '对应 src/agent/common/order-contract.mjs → src/agent/common/tools/get-order.mjs · 精简示意；实际查询本地虚构订单。',
    doc: 'https://docs.langchain.com/oss/javascript/langchain/tools',
  },
  {
    name: 'Prompt · 提示词', place: '已使用 · systemPrompt', title: '告诉模型任务、规则与回答方式',
    description: '本项目用字符串写系统指令，要求先查订单、缺少编号就追问、回答用中文 Markdown。完整模型上下文还包括用户问题、历史、工具定义和工具结果。ChatPromptTemplate 可帮助组装有变量的提示词；这里没有使用它。',
    code: 'const systemPrompt =\n  "你是订单查询助手。订单信息必须调用 getOrder。" +\n  "无法确定订单号时请追问，不要猜测。";\n\nconst agent = createAgent({\n  model: chatModel, tools: [orderTool], systemPrompt,\n});',
    source: '对应 src/agent/common/order-contract.mjs · 规则节选；提示词影响模型行为，执行限制还要写在代码里。',
    doc: 'https://docs.langchain.com/oss/javascript/langchain/agents#system-prompt',
  },
  {
    name: 'Agent · 编排', place: '已使用 · createAgent / invoke', title: '根据模型输出，继续调用工具或结束',
    description: 'createAgent 创建模型与工具的循环；invoke 开始执行。Agent 看到工具请求就执行并补回结果，模型不再要求调用工具时走向结束。当前项目还加了模型请求上限。invoke 返回状态对象，我们从 messages 取最终文字。',
    code: 'const agent = createAgent({\n  model: chatModel, tools: [orderTool],\n  systemPrompt, middleware: [middleware],\n});\nconst result = await agent.invoke({\n  messages: [...history, { role: "user", content: question }],\n});\nconst answer = result.messages.at(-1).content;',
    source: '对应 src/agent/langchain/agent.mjs · 精简示意；真实源码还传入取消信号和图执行步数限制。',
    doc: 'https://docs.langchain.com/oss/javascript/langchain/agents',
  },
  {
    name: 'Middleware · 中间件', place: '已使用 · createMiddleware', title: '在模型调用和工具执行处加入控制',
    description: 'wrapModelCall 包裹一次模型调用，wrapToolCall 包裹一次工具执行。await handler(request) 表示继续执行，再拿到结果。当前中间件检查调用次数、工具名称和参数，并记录事件；底层 transport 另管超时、HTTP 报文与用量。',
    code: '// 结构示意：真实校验逻辑见下方源码\nconst middleware = createMiddleware({\n  name: "OrderTraceAndLimits",\n  wrapToolCall: async (request, handler) => {\n    // 执行前：校验名称和参数\n    const message = await handler(request);\n    // 执行后：记录工具结果\n    return message;\n  },\n});',
    source: '对应 src/agent/langchain/agent.mjs · 这里是 LangChain 的执行中间件，与 HTTP / Copilot Runtime 中间件分属不同层。',
    doc: 'https://docs.langchain.com/oss/javascript/langchain/middleware/overview',
  },
  {
    name: 'State · 状态与记忆', place: '已使用 messages · 未配置持久化', title: '分清运行中的数据和跨轮保存的数据',
    description: 'Agent state 承载运行数据，本项目主要用 messages。当前每轮重新创建 Agent，并手动传入 history。需要自动恢复会话时，可配置 checkpointer 并使用稳定的 thread_id；是否跨重启保留取决于存储实现。跨会话的长期记忆还需另外设计 Store 和读写逻辑。',
    code: '// 当前实现：由调用方传入历史\nconst result = await agent.invoke({\n  messages: [...history, { role: "user", content: question }],\n});\n// 未配置 checkpointer / store\n// result.messages 包含本轮新增的调用、结果和回复',
    source: '对应 src/server/order-agent.mjs + src/agent/langchain/agent.mjs · AG-UI 的 threadId 没有自动映射成 LangChain 的持久化会话。',
    doc: 'https://docs.langchain.com/oss/javascript/langchain/short-term-memory',
  },
  {
    name: 'Runnable · 调用接口', place: '已使用 invoke · 未使用 pipe 链', title: 'invoke 是入口，Chain 是预先安排的组合',
    description: '很多 LangChain 组件遵循 Runnable 接口：invoke 执行一个输入，stream 逐步产出，batch 处理一批输入。Chain 可以通过 pipe 把步骤按顺序连接。Agent 则根据模型输出决定是否走工具分支、是否继续循环。不能仅凭方法名判断会请求几次模型。',
    code: '// 扩展示意：本项目没有使用这条固定链\n// prompt: ChatPromptTemplate，parser: StringOutputParser\nconst chain = prompt.pipe(chatModel).pipe(parser);\nconst text = await chain.invoke({ question: "你好" });\n\n// 当前项目运行的是工具调用 Agent\nconst result = await agent.invoke({ messages });',
    source: '概念示意，变量需要自行定义 · 当前模型 streaming: false；页面收到 SSE 不代表模型正在逐 Token 输出。',
    doc: 'https://docs.langchain.com/oss/javascript/langchain/models#invocation',
  },
  {
    name: 'Structured output · 输出', place: '扩展概念 · 当前未配置', title: '需要程序消费的最终字段，再约定输出 Schema',
    description: 'responseFormat 用来约定 Agent 最终输出的结构，并在 structuredResponse 中读取。支持方式取决于模型与策略。它不同于工具输入 schema，也不同于 getOrder 返回的 JSON。结构符合约定，仍不保证业务结论正确。',
    code: '// 扩展示意：使用前需要确认模型支持\nconst agent = createAgent({\n  model: chatModel, tools: [orderTool], systemPrompt,\n  responseFormat: z.object({\n    summary: z.string().describe("查询结论"),\n  }),\n});\nconst result = await agent.invoke({ messages });\nconst data = result.structuredResponse;',
    source: '当前项目没有 responseFormat；最终回答是 Markdown，订单卡片直接读取工具 JSON。',
    doc: 'https://docs.langchain.com/oss/javascript/langchain/structured-output',
  },
];

export const fileMap = [
  ['src/agent/native/agent.mjs', '原生 Agent', '用 fetch、messages 和 for 循环编排工具调用'],
  ['src/agent/native/demo/model.demo.mjs', '原生 Demo', '用本地脚本模拟模型，执行真实原生循环'],
  ['src/agent/common/order-definition.mjs', '业务定义', '无框架的工具说明、JSON Schema 与系统提示词'],
  ['src/server/main.mjs', '启动入口', '读取环境配置，启动 HTTP 服务'],
  ['src/web/entries/main.jsx', '浏览器入口', '加载样式并挂载 React 页面'],
  ['src/web/pages/chat/ChatPage.jsx', '聊天页面', '组装 Provider 与会话工作台'],
  ['src/web/state/chat/useChatSession.js', '会话状态', '读取配置、选择模式与版本、重置会话'],
  ['src/web/state/chat/useChatRun.js', '运行状态', '收集问题、发起运行、订阅事件、停止请求'],
  ['src/web/pages/chat/ChatWorkspace.jsx', '页面组装', '注册工具卡片并连接状态与组件'],
  ['src/web/components/chat/OrderCard.jsx', '业务组件', '把工具 JSON 显示成订单卡片'],
  ['src/web/components/chat/TracePanel.jsx', '调用记录', '按 runId + step 关联每次模型请求的用量'],
  ['src/server/http-server.mjs', 'HTTP 服务', '提供页面、处理 API 请求、转发事件流'],
  ['src/server/copilot-handler.mjs', 'Runtime', '注册三种真实 Agent 与两种本地演示'],
  ['src/server/order-agent.mjs', '协议桥接', '整理历史、转换 AG-UI 事件、处理取消'],
  ['src/agent/langchain/agent.mjs', 'Agent 核心', '定义工具与提示词，配置模型并 invoke'],
  ['src/agent/langgraph/agent.mjs', '另一实现', 'LangGraph 显式定义状态、模型/工具节点和条件边'],
  ['src/agent/common/order-contract.mjs', '共用约定', 'LangChain / LangGraph 的 Zod Schema 与工具注册'],
  ['src/agent/common/demo/orders.demo.json', '演示数据', '三种虚构订单，供三版 Agent 与教学页共用'],
  ['src/agent/common/tools/get-order.mjs', '业务能力', '读取虚构订单；未来替换为业务接口'],
  ['src/agent/common/model-transport.mjs', '请求观察', '记录真实报文、原始 usage、超时与响应检查'],
];
