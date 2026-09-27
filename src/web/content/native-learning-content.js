/**
 * 原生 JavaScript 课程数据：从消息与工具说明到手写循环、执行边界和三版对照。
 * 章节 ID 用于导航与进度记录；小测答案用从零开始的选项索引表示。
 */
import { excerpt } from './source-files.js';

export const nativeLessons = [
  {
    id: 'native-map', name: '原生版的边界', subtitle: '模型、程序、界面', minutes: '3 min',
    title: '先看清：谁思考，谁执行。',
    intro: '原生版不使用 LangChain、LangGraph、模型 SDK 或 Zod。Agent 由普通 JavaScript 函数组成；网页继续复用 React、CopilotKit 和 AG-UI。',
    takeaway: '模型返回工具调用意图；你的程序校验、执行工具，并决定是否继续请求。',
    points: [
      ['Web 收集问题', '页面只发送用户消息。真实模式的 orders_native 路由把问题交给原生 Agent；模型 Key 留在 Node 进程中。'],
      ['服务端适配协议', 'OrderAgent 整理历史，将原生 Agent 的 request、tool_result、answer 事件转为 AG-UI；它不替原生版管理模型循环。'],
      ['Agent 独立于界面', 'native/agent.mjs 只依赖工具函数、普通 JSON 定义和原生 HTTP 观察层。工作台的本地演示无需 Key；真实模型模式使用本机配置。'],
    ],
    snippets: [
      { label: '纯 JavaScript 依赖', ...excerpt('src/agent/native/agent.mjs', 'import { getOrder', "from '../common/model-transport.mjs'") },
      { label: '网页如何选中原生版', ...excerpt('src/server/copilot-handler.mjs', 'const runtime =', 'return createCopilotRuntimeHandler') },
      { label: 'Web 接入层', ...excerpt('src/server/order-agent.mjs', 'const options =', 'await this.runner(options);') },
    ],
    quiz: { question: '这里“无框架”指哪一层？', options: ['整个网页都不用 React', 'Agent 核心独立于框架，Web 继续共用现有界面', '模型不再需要 HTTP 接口'], answer: 1, explanation: '无框架是 Agent 的实现边界；网页仍通过现有服务接入。' },
  },
  {
    id: 'native-messages', name: '消息与工具说明', subtitle: '模型实际看见什么', minutes: '4 min',
    title: 'messages 是上下文，tools 是能力说明。',
    intro: '一次 HTTP 请求包含 model、messages 和 tools。工具说明是普通 JSON Schema；它不包含查询函数源码，也不会自动执行函数。',
    takeaway: '声明工具只是在告诉模型“可以请求什么”；执行仍由程序负责。',
    points: [
      ['三类初始消息', 'system 提供业务规则，history 是先前的用户与助手文字，最后一条 user 是当前问题。服务端过滤客户端 system 和 tool 消息。'],
      ['工具 Schema', 'getOrder 只接受字符串 orderId，additionalProperties 为 false。真正执行之前，原生代码还会检查 JSON、非空字符串和额外字段。'],
      ['历史不等于长期记忆', '每轮重新创建 messages。当前没有持久化数据库、checkpointer 或跨重启的长期记忆；历史来自页面本次会话。'],
    ],
    snippets: [
      { label: '初始消息', ...excerpt('src/agent/native/agent.mjs', 'const messages = [', '{ role: \'user\', content: question },') },
      { label: 'JSON 工具说明', ...excerpt('src/agent/common/order-definition.mjs', 'export const orderParameters', 'function: { name:') },
      { label: '历史过滤', ...excerpt('src/server/order-agent.mjs', 'const history =', 'return { question: last.content.trim(), history };') },
    ],
    quiz: { question: '模型能看到 tools，是否意味着它能直接执行 getOrder？', options: ['可以，Schema 就是函数代码', '不可以，Node 程序需要读取调用请求并执行函数', '只有第一次可以'], answer: 1, explanation: '模型只能生成函数名和 JSON 参数；工具代码不在模型服务里。' },
  },
  {
    id: 'native-loop', name: '跑一次完整循环', subtitle: '实际代码与事件回放', minutes: '6 min',
    title: '两次请求，中间发生了一次工具执行。',
    intro: '下面直接执行项目中的原生 Agent 和 getOrder，用本地脚本模拟模型响应。可以逐个查看实际产生的请求和事件；所有内容都在浏览器本地完成，不请求外部 API。',
    takeaway: '第一轮模型要工具，程序执行并补入结果；第二轮模型才知道订单内容。',
    points: [
      ['请求', 'for 循环每次构造 HTTP 请求。transport.fetch 观察原始报文，真实模式最终调用原生 fetch，Demo 注入脚本响应。'],
      ['分支', '没有 tool_calls 就返回文本；有 tool_calls 则保留 assistant 消息并逐个执行工具。没有订单号时，模型也可以直接追问。'],
      ['继续', '所有工具结果补回 messages 后再进入下一次循环。一次用户提交可以触发多次模型请求，不是一次调用等于一次 HTTP。'],
    ],
    snippets: [
      { label: '循环与 HTTP 请求', ...excerpt('src/agent/native/agent.mjs', 'for (let step', 'const calls = message.tool_calls ?? [];') },
      { label: '结束或执行工具', ...excerpt('src/agent/native/agent.mjs', 'if (!calls.length)', 'const result = executeTool(call);') },
      { label: 'Demo 替换的部分', ...excerpt('src/agent/native/demo/model.demo.mjs', 'export function runNativeDemo', 'fetchImpl: scriptedFetch,') },
    ],
    quiz: { question: '第一次模型返回 tool_calls 后，应该做什么？', options: ['直接当作最终答案显示', '校验并执行工具，把结果放回 messages 后再次请求', '丢弃原消息，只发订单 JSON'], answer: 1, explanation: '保留 assistant 的调用请求，并用同一 ID 放入 tool 消息，模型才能关联结果。' },
  },
  {
    id: 'native-tools', name: '执行与回传', subtitle: '白名单、参数、调用 ID', minutes: '4 min',
    title: '工具结果必须回到正确的调用。',
    intro: '模型返回的函数名和 arguments 都是输入数据。原生实现不会 eval 它们，而是只执行允许的 getOrder。',
    takeaway: 'tool_call_id 关联一次调用和一次结果；它与工具名、会话 ID 各有职责。',
    points: [
      ['执行前校验', '未知工具返回 UNKNOWN_TOOL；参数解析失败或形状不对返回 INVALID_ARGUMENTS。错误也作为工具结果回传，让模型在预算内纠正。'],
      ['保留关联', '每条 tool 消息携带原调用 ID。一次响应提出多个调用时，每个结果都要保留自己的 ID；重复或缺失 ID 的响应会被拒绝。'],
      ['真实业务函数', 'getOrder 查询本地虚构订单，找到返回 found: true，找不到返回 found: false。它不执行付款、审批或数据修改。'],
    ],
    snippets: [
      { label: '白名单与参数验证', ...excerpt('src/agent/native/agent.mjs', 'function executeTool', 'return getOrder({ orderId: args.orderId });') },
      { label: '回传消息', ...excerpt('src/agent/native/agent.mjs', 'const toolMessage =', "emit('tool_return'") },
      { label: '订单函数', ...excerpt('src/agent/common/tools/get-order.mjs', 'export function getOrder', 'return { found: true, order: structuredClone(order) };') },
    ],
    quiz: { question: '遇到未知工具名时，原生版会怎样处理？', options: ['动态 import 同名文件', '返回结构化错误，不执行任意代码', '自动换成 getOrder'], answer: 1, explanation: '白名单控制可执行的能力；不能因为模型提出一个名字就执行它。' },
  },
  {
    id: 'native-limits', name: '限制与可观察性', subtitle: '取消、超时与用量', minutes: '4 min',
    title: '能运行，还要能停止、能解释。',
    intro: '手写循环意味着你也负责请求上限、取消信号、HTTP 错误、响应校验和记录。三种实现共用无框架的 HTTP 观察层。',
    takeaway: '超时覆盖整个响应体；用量来自响应，缺失时保持未知。',
    points: [
      ['预算', 'maxSteps 限制模型请求次数。最后一次响应若还需要工具，立即停止，不执行已经无法回传的额外查询。'],
      ['中断', '页面停止经 AG-UI 传到 AbortController。AbortSignal.any 合并调用方取消和超时，fetch 与响应体读取均受控制。'],
      ['证据', 'request、response、usage、tool_call 和 tool_result 分别记录真实过程，密钥会脱敏。Demo 的零用量来自脚本，不代表真实模型免费。'],
    ],
    snippets: [
      { label: '请求上限', ...excerpt('src/agent/native/agent.mjs', 'if (step === maxSteps)', 'messages.push({ role:') },
      { label: '取消与超时', ...excerpt('src/agent/common/model-transport.mjs', 'const timeout =', 'const body = JSON.parse(init.body);') },
      { label: '原始响应与用量', ...excerpt('src/agent/common/model-transport.mjs', 'const text = await response.text();', 'validateResponse(lastResponse);') },
    ],
    quiz: { question: '模型响应里没有 usage，应该显示什么？', options: ['0 Token', '根据字数估计并当作真实消耗', '未知，仅汇总已知用量'], answer: 2, explanation: '没有数据与真实的 0 不同；不能把未知消耗当作免费。' },
  },
  {
    id: 'native-compare', name: '对照三种实现', subtitle: '同一业务，不同编排', minutes: '4 min',
    title: '看懂手写循环，再看框架接管了什么。',
    intro: '三个版本共用订单数据、业务规则、事件语义与界面。比较的是编排方式，不是三个不同的大模型。',
    takeaway: '原生版显式写循环；LangChain 托管循环；LangGraph 显式写状态与节点。',
    points: [
      ['原生 JavaScript', 'fetch 负责请求，messages.push 保存调用与结果，for 和 if 决定继续或结束。适合从头理解工具调用协议。'],
      ['LangChain', 'createAgent 与中间件负责模型和工具循环。业务代码聚焦工具与约束，框架负责追加 ToolMessage 和继续调用。'],
      ['LangGraph', 'StateGraph 显式表达 model、tools 和条件边。状态由 reducer 合并，编排结构适合扩展为更多节点。当前未配置持久化和人工恢复。'],
    ],
    snippets: [
      { label: '原生 for', ...excerpt('src/agent/native/agent.mjs', 'for (let step', 'const calls = message.tool_calls ?? [];') },
      { label: 'LangChain createAgent', ...excerpt('src/agent/langchain/agent.mjs', 'const agent = createAgent', 'const content = result.messages.at(-1).content;') },
      { label: 'LangGraph StateGraph', ...excerpt('src/agent/langgraph/agent.mjs', 'const graph = new StateGraph', '.compile();') },
    ],
    quiz: { question: '切换编排实现后，订单卡片为什么可以继续复用？', options: ['三种模型总会生成相同 Markdown', '后端统一输出 AG-UI 工具结果，卡片依据 getOrder 的数据渲染', '浏览器会重新执行订单函数'], answer: 1, explanation: '共享工具数据契约和服务端协议适配，让同一界面接入三种实现。' },
  },
];
