# LangChain.js 版本说明

当前实现位于 `src/agent/langchain/agent.mjs`。它使用 LangChain 的 `ChatOpenAI`、`ChatPromptTemplate`、`MessagesPlaceholder`、`tool`、`ToolMessage` 和 Runnable `pipe`，不调用 `createAgent` 或 `@langchain/langgraph`。这里比较的是两种可切换的**编排架构**：LangChain 组件加本地循环，与 LangGraph 的显式状态图。两者共用模型配置、订单工具、HTTP 观察层和 Web 协议。

## 一轮查单如何运行

1. `prompt.pipe(chatModel.bindTools([orderTool]))` 组成一次模型调用链。`bindTools` 将工具定义提供给模型，并不执行工具。
2. `chain.invoke({ messages })` 发送一次模型请求，返回 `AIMessage`。
3. 本地循环读取模型的 `tool_calls`，校验工具名称和 Zod 参数；合法时调用 `orderTool.invoke(call)`，非法时返回带相同调用 ID 的错误 `ToolMessage`。
4. 将模型消息和工具结果加入 `messages`，下一次 `chain.invoke` 让模型读取结果。没有新工具请求时返回最终文字。

`maxSteps` 限制模型请求次数；最后一次响应仍要求调用工具时停止，避免执行无法回传的查询。`model-transport.mjs` 记录实际 HTTP 请求、原始 usage、响应、超时与取消。服务端只在收到真实提问后检查模型 Key。当前没有持久化会话、长期记忆或逐 Token 模型输出。

## 与另两版的边界

- 原生 JavaScript 版自己构造 HTTP 请求体和普通消息对象，也自己执行工具循环。
- LangChain 版通过模型适配器、Prompt、Runnable、Tool 和消息类处理协议与工具对象；循环由本地代码控制。
- LangGraph 版使用 `StateGraph`、`MessagesValue` reducer、模型/工具节点和条件边控制循环。

三版共用 `test/order-agent-contract.mjs`，验证请求、工具结果、参数纠错、调用 ID、上限、错误、历史与用量。`npm test` 和 `npm run build` 验证代码与构建；模拟模型测试不代表外部模型的回答质量。
