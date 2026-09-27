/**
 * LangGraph 课程数据：从显式状态图到节点、工具、条件边和框架对照。
 * 源码节选通过稳定文字锚点定位当前文件，避免手写行号随代码改动失效。
 */
import { excerpt } from './source-files.js';

export const graphLessons = [
  {
    id: 'graph-map', name: '先看两种实现', subtitle: '同一业务，两种编排', minutes: '3 min',
    title: '业务相同，把编排过程展开成图。',
    intro: 'LangChain 版由 createAgent 组装循环；这个新版本使用 LangGraph StateGraph，自己定义状态、节点和流转规则。两份实现同时保留，可以在工作台切换。',
    takeaway: 'LangGraph 不是另一家大模型。它让我们显式决定：先运行哪个节点，下一步走哪条边。',
    points: [
      ['从页面选择到后端入口', '工作台选择 LangChain + 真实模型，对应 orders → src/agent/langchain.mjs；选择 LangGraph + 真实模型，对应 orders_graph → src/agent/langgraph.mjs。本地演示是两版共用的固定规则，不执行这两个模型编排入口。'],
      ['共享业务，分别编排', 'src/agent/order-contract.mjs 提供相同的工具 Schema、描述和 systemPrompt，get-order.mjs 提供同一份订单。两版还共用模型 HTTP 观察层、AG-UI 桥接层和订单卡片，便于比较编排代码的差别。'],
      ['LangChain Agent 基于 LangGraph', 'LangChain 的 createAgent 底层也使用 LangGraph。本教程比较的是高层 Agent API 与显式 Graph API，不是两个完全无关的模型服务。这里仍使用 LangChain 的模型和消息组件。'],
    ],
    snippets: [
      { label: '1. 图的完整骨架', note: '顺着 START → model → 条件分支读。有工具请求走 tools，再回 model；没有工具请求走 END。', ...excerpt('src/agent/langgraph.mjs', 'const graph = new StateGraph', '.compile();') },
      { label: '2. 两个后端入口', note: '原有 orders 保留；orders_graph 注入新的 runner。两版仍经过同一个 OrderAgent 适配 AG-UI。', ...excerpt('src/server/copilot-handler.mjs', 'const runtime =', 'return createCopilotRuntimeHandler') },
      { label: '3. 页面选择版本', note: 'framework 与 mode 是两个维度。只有真实模型模式才分流到 orders / orders_graph。切换后重建 Provider，避免两版消息与统计混在一起。', ...excerpt('src/web/state/chat/useChatSession.js', "const [mode, setMode]", 'const agentId =') },
      { label: '4. 保留的 LangChain 版', note: '这份代码继续使用 createAgent，没有被图实现替换。', ...excerpt('src/agent/langchain.mjs', 'const agent = createAgent', 'const content = result.messages.at(-1).content;') },
    ],
    quiz: { question: '在工作台选择 LangGraph + 真实模型后，变化发生在哪里？', options: ['换成了另一家模型公司', '后端改为执行显式 StateGraph，订单数据和 UI 仍共用', '原 LangChain 代码会被删除'], answer: 1, explanation: '变化是编排实现。两个版本都使用本机配置的模型服务，也共用 getOrder 和 CopilotKit 页面。' },
  },
  {
    id: 'graph-state', name: 'State 与 Reducer', subtitle: '节点之间传什么', minutes: '4 min',
    title: 'State 是接力的数据，Reducer 决定怎样合并。',
    intro: '图中的节点通过 state 读取已有数据，再返回局部更新。本项目最重要的状态字段就是 messages。',
    takeaway: '节点返回 { messages: [新消息] }，MessagesValue 的 reducer 负责把它合入已有状态。',
    points: [
      ['StateSchema：声明状态结构', 'OrderState 用 StateSchema 声明 messages。初始内容是历史文字和当前用户问题；模型节点会新增 AIMessage，工具节点会新增 ToolMessage。系统提示词在每次模型调用时单独加入。'],
      ['Reducer：更新规则', 'MessagesValue 提供消息 reducer：新的消息 ID 追加到列表，已有 ID 的消息可被更新。它不是无条件覆盖整个 messages，也不是简单地永远 concat。模型响应 ID 被改为独立 UUID，避免供应商重复 ID 覆盖旧消息。'],
      ['状态与记忆是不同问题', '这里的 state 在一次 graph.invoke 内流转；没有配置 checkpointer，因此不会自动保存成可跨重启恢复的会话。追问历史仍由前端传来，再经 toConversation 过滤。'],
    ],
    snippets: [
      { label: '1. 定义状态', ...excerpt('src/agent/langgraph.mjs', '// MessagesValue', 'const OrderState =') },
      { label: '2. 模型节点返回更新', note: '只返回本次生成的一条消息；reducer 负责与已有 messages 合并。', ...excerpt('src/agent/langgraph.mjs', '// 消息 ID 必须独立', 'return { messages: [response] };') },
      { label: '3. 初始状态与结果', ...excerpt('src/agent/langgraph.mjs', 'const result = await graph.invoke', 'const content = result.messages.at(-1).content;') },
    ],
    quiz: { question: '模型节点为什么只返回 { messages: [response] }？', options: ['MessagesValue 会把局部更新合入已有消息状态', '前面的历史已经不需要了', '每次只能保存一条消息'], answer: 0, explanation: '节点返回的是状态更新，不是必须重写全部历史。具体怎么合并，取决于该字段的 reducer。' },
  },
  {
    id: 'graph-nodes', name: 'Model 与 Tools 节点', subtitle: '每个节点做一件事', minutes: '5 min',
    title: '一个节点问模型，一个节点执行业务。',
    intro: 'Node 是图里的执行函数。它读取 state，完成明确的工作，再返回状态更新；节点本身不一定包含 AI。',
    takeaway: 'bindTools 提供说明，modelNode 获取决策，toolsNode 才真正执行工具。',
    points: [
      ['modelNode：把上下文交给模型', 'modelWithTools 由 chatModel.bindTools([orderTool]) 得到。节点把 systemPrompt 和 state.messages 发给模型，得到 AIMessage，并保留 tool_calls。坏 JSON 参数也保留为待处理的调用，交给工具节点返回错误。'],
      ['toolsNode：检查后执行', '遍历模型提出的工具调用，校验 name 和 orderSchema，再 await orderTool.invoke(call)。失败时构造带相同 tool_call_id 的 ToolMessage；成功时工具封装返回 ToolMessage。图本身不会替你实现订单权限。'],
      ['为什么没有直接用 ToolNode', 'LangGraph 提供现成的 ToolNode。这里写出工具节点，是为了展示参数校验、ID 关联、错误回传与日志记录。正常业务可以选用现成节点，再按需求补控制点。'],
      ['节点执行不等于模型请求', 'toolsNode 运行 JavaScript 查询，自己不消耗模型 Token。它返回的数据进入下一次模型上下文后，才计入那次模型请求的输入用量。'],
    ],
    snippets: [
      { label: '1. 给模型工具定义', ...excerpt('src/agent/langgraph.mjs', '// bindTools', 'const modelWithTools =') },
      { label: '2. 模型节点', ...excerpt('src/agent/langgraph.mjs', 'async function modelNode', 'return { messages: [response] };') },
      { label: '3. 工具校验与执行', ...excerpt('src/agent/langgraph.mjs', 'let error;', 'const result = JSON.parse(message.content);') },
      { label: '4. 共用工具定义', ...excerpt('src/agent/order-contract.mjs', 'export const orderSchema', 'schema: orderSchema,') },
    ],
    quiz: { question: '只调用 chatModel.bindTools([orderTool])，工具会自动执行吗？', options: ['会，模型拿到了函数源码', '会，浏览器帮模型执行', '不会，它只绑定工具定义；本版本由 toolsNode 执行'], answer: 2, explanation: '模型输出的是调用请求。接住请求、校验并实际执行，属于程序编排的职责。' },
  },
  {
    id: 'graph-edges', name: 'Edge 与条件分支', subtitle: '谁决定下一步', minutes: '4 min',
    title: '模型提供决策数据，代码选择下一条边。',
    intro: '普通边表示固定下一步；条件边通过一个函数读取 state，返回目标节点。START 和 END 表示图的入口与结束。',
    takeaway: '有 tool_calls → tools；没有 tool_calls → END；工具完成 → model。',
    points: [
      ['普通边：固定流转', 'addEdge(START, model) 指定入口；addEdge(tools, model) 指定查完后必须回到模型。这里没有再次查订单，只是让模型读结果。'],
      ['条件边：读取状态做分支', 'routeAfterModel 检查最后一条消息的 tool_calls。返回 tools 进入工具节点；返回 END 结束图。这段 if 判断是确定性的程序逻辑，模型产生 tool_calls 的过程仍具有不确定性。'],
      ['两种上限防止无限循环', 'maxSteps 限制实际模型 HTTP 请求次数；最后一次仍要求查工具就停止。recursionLimit 限制图的执行步数，它不是 Token 数，也不等于模型请求数。取消信号继续传到模型请求与工具节点。'],
    ],
    snippets: [
      { label: '1. 条件函数', ...excerpt('src/agent/langgraph.mjs', 'function routeAfterModel', 'return next;') },
      { label: '2. 把边连起来', ...excerpt('src/agent/langgraph.mjs', 'const graph = new StateGraph', '.compile();') },
      { label: '3. 模型请求上限', ...excerpt('src/agent/langgraph.mjs', '// 与原版本相同：最后一次', 'calls.clear();') },
    ],
    quiz: { question: 'tools → model 这条边表示什么？', options: ['再执行一次 getOrder', '把工具结果交回模型，继续生成回答或作出决策', '把订单保存到长期记忆'], answer: 1, explanation: '走到 model 节点才再次请求模型。工具执行与模型请求是不同操作，通常查一次订单需要两次模型请求。' },
  },
  {
    id: 'graph-loop', name: '亲手走一次图', subtitle: '看节点、状态与计数', minutes: '5 min',
    title: '跟着同一个问题，看状态怎样变化。',
    intro: '下面是零 API 用量的固定教学脚本。点步骤，看当前节点、状态消息数以及模型和工具的调用次数。真实执行记录在工作台“查看调用详情”中。',
    takeaway: '图走了多个步骤，不代表每个步骤都请求模型。看实际 HTTP 请求和工具执行记录。',
    points: [
      ['compile 不会查询订单', 'compile() 检查图结构并生成可运行对象。graph.invoke({ messages }) 才开始运行，从 START 进入 model，并沿边推进。'],
      ['观察消息累积', '本例 state.messages 从用户问题开始，再增加模型工具请求、工具结果、模型回答。系统提示词在模型节点里加入请求，没有作为 state 的一条消息累计。'],
      ['记录与展示仍共用原链路', '图版本额外报告 graph_node、graph_edge。OrderAgent 将它们作为 CUSTOM/harness 事件送给 TracePanel；工具结果和最终文字仍走标准 AG-UI 事件。'],
      ['当前文字并非逐 Token 输出', '两版均保留 streaming: false。页面可以逐步展示执行事件，但最终回答拿到完整文字后再展示。LangGraph 的 stream 能力需要另行接入模型片段与事件转换。'],
    ],
    snippets: [
      { label: '1. 运行并取出结果', ...excerpt('src/agent/langgraph.mjs', 'const result = await graph.invoke', "emit('answer'") },
      { label: '2. 节点记录', ...excerpt('src/agent/langgraph.mjs', 'async function modelNode', 'const response = await modelWithTools.invoke') },
      { label: '3. 桥接到页面', ...excerpt('src/server/order-agent.mjs', 'const trace =', 'const { type, data, step } = event;') },
    ],
    quiz: { question: '正常查单走 model → tools → model，通常有几次模型请求？', options: ['三次，每个节点都请求模型', '一次，invoke 只调用一次', '两次，tools 节点只执行业务函数'], answer: 2, explanation: '第一次模型提出工具请求，工具执行后第二次模型读结果并回答。实际次数可能因为追问、纠错或更多工具调用而变化。' },
  },
  {
    id: 'graph-compare', name: '对照与下一步', subtitle: '何时需要显式状态图', minutes: '4 min',
    title: '先保持业务一致，再比较控制方式。',
    intro: '两种写法都能完成当前订单查询。学习时先比较同一任务的消息与工具结果，再决定业务需要哪一层抽象。',
    takeaway: '常规工具循环可以用 createAgent；需要显式业务分支、节点和恢复流程时，再深入 Graph API。',
    points: [
      ['代码控制点的对应关系', 'LangChain 的 wrapModelCall 对应图版本 modelNode 中的模型调用前后；wrapToolCall 的校验对应 toolsNode；内置的继续判断在图版本成为 routeAfterModel。'],
      ['练习：增加一个供应商节点', '先确定数据依赖和状态字段，再写节点及 reducer、连接边，并定义失败路径。只有让模型自主选择某个能力时，才需要把这个能力声明为模型工具；普通确定性节点也可以调用业务服务。'],
      ['Checkpointer、interrupt 与恢复', 'Checkpointer 保存执行状态；interrupt 可暂停等待外部输入；Command 可用于恢复或控制状态与路由。这些能力需要显式配置，本项目目前没有持久化、人工审批或自动恢复。启用前还要设计权限与幂等。'],
      ['共享测试是比较的基线', 'test/order-agent-contract.mjs 同时验证三版的成功查询、未找到、参数纠错、调用 ID、请求上限、HTTP 错误和 Token 用量。Runtime 集成测试再检查版本分发和取消。通过模拟模型测试不代表真实模型每次都会遵守规则。'],
    ],
    snippets: [
      { label: 'LangChain：高层 Agent', ...excerpt('src/agent/langchain.mjs', 'const agent = createAgent', 'const content = result.messages.at(-1).content;') },
      { label: 'LangGraph：显式状态图', ...excerpt('src/agent/langgraph.mjs', 'const graph = new StateGraph', 'const content = result.messages.at(-1).content;') },
    ],
    quiz: { question: '仅把实现改成 StateGraph，就自动拥有持久化和人工审批了吗？', options: ['没有，还需要配置存储、中断、恢复和业务控制', '有，compile 会自动连接数据库', '有，只要页面存在 threadId 就可以'], answer: 0, explanation: '框架提供这些能力，但必须按业务显式接入。当前示例只展示可观察的订单查询图。' },
  },
];
