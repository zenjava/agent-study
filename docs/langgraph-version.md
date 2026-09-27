# 并存的 LangGraph 学习版本

LangChain 实现在 `src/agent/langchain/agent.mjs`，LangGraph 实现在 `src/agent/langgraph/agent.mjs`。比较对象是 `createAgent` 高层 API 与显式 `StateGraph`；LangChain Agent 本身也基于 LangGraph。

## 运行链路

- 页面分别选择实现版本与 demo/live 模式。切换开始新对话，避免历史和用量混合；运行中禁止切换。
- `orders` 继续调用 LangChain；`orders_graph` 注入 LangGraph runner；`demo` 保持共用固定规则并明确提示。
- LangGraph 使用 `StateSchema({ messages: MessagesValue })`，model / tools 两个节点和 model 后的条件边。
- 两版共用 `src/agent/common/order-contract.mjs`、`common/tools/get-order.mjs`、`common/model-transport.mjs`、AG-UI 桥接与 UI。模型连接和编排代码各自保留，便于顺着单一文件学习。
- 模型节点每次加入系统消息并调用模型；工具节点执行校验和查询，返回 ToolMessage。新的消息 ID 由程序生成，避免重复响应 ID 导致 reducer 覆盖历史。
- `graph_node` 与 `graph_edge` 是额外的教学事件；Token 始终由实际 HTTP 响应 usage 统计。

## 学习教程

- `/learn/runtime`：三种 Web 实现共用的 Runtime 接入、协议适配与事件渲染四节。
- `/learn`（兼容 `/learn/langchain`）：LangChain 七节。
- `/learn/langgraph`：六节，包括 State / Reducer、Node、Edge、compile / invoke、交互图及两版对照。
- 进度分别保存在 `harness-learning-runtime-v1`、`harness-learning-v1` 和 `harness-learning-langgraph-v1`；重置只影响当前路线。
- 教学图是零用量固定脚本，源码节选来自构建时的白名单文件；不读取 `.env`。

## 验证与边界

`npm test` 运行共用行为契约及 Runtime 集成验证：成功、未找到、无订单号追问、错误参数纠正、多工具 ID、请求上限、HTTP 错误、用量、历史和两版取消。模型 HTTP 对端用本机固定脚本替代，Agent、Graph、工具、HTTP 与 SSE 均运行真实实现。

`npm run build` 后检查工作台切换、两条教程、源码片段及图中的计数。浏览器中的共用本地演示不能证明真实 LangGraph 模型调用；需单独验证模拟模型链路或外部服务。

两版目前都不逐 Token 输出，也未配置持久化、人工审批或自动恢复。接入 checkpointer / interrupt 时需要另外设计存储、权限、恢复和副作用幂等。

参考：[Graph API 快速入门](https://docs.langchain.com/oss/javascript/langgraph/quickstart)、[Graph API 概念](https://docs.langchain.com/oss/javascript/langgraph/graph-api)。仓库锁定 `@langchain/langgraph` 1.4.18。
