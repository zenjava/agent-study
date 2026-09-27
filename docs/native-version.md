# 原生 JavaScript Agent

`src/agent/native/agent.mjs` 使用普通函数、原生 `fetch`、消息数组和 `for` 循环，不依赖模型 SDK、LangChain、LangGraph 或 Zod。共用的 `common/order-definition.mjs`、`common/model-transport.mjs`、`common/tools/get-order.mjs` 也没有第三方依赖。

## 先运行 Demo

```bash
npm run demo:native -- "A1001 谁在审批？"
npm run demo:native -- "查 A9999"
npm run demo:native -- "帮我查订单"
npm run demo:native -- "查 A1001 和 A1002"
```

无需安装框架或配置 Key。Demo 注入脚本模拟的 HTTP 响应，实际运行原生循环、参数校验、订单查询和消息追加；不会访问外部网络。成功查单通常出现两次模拟模型请求和一次工具执行。缺少订单号时直接追问，不执行工具；不存在的订单返回 `found: false`。

网页需安装依赖并构建：`npm ci --ignore-scripts` → `npm run build` → `npm run demo`。打开 `/?version=native`，选择本地演示；“查看调用详情”里能看到请求、脚本响应、工具调用、回传和最终回答。React 与 CopilotKit 只负责共用界面和协议接入。

## 接入真实模型

按 `.env.example` 配置本机 `.env` 后执行：

```bash
npm run agent:native -- "A1001 谁在审批？"
```

或用 `npm start` 启动网页，选“原生 JavaScript”与“真实模型”。网页路由为 `orders_native`，Demo 路由为 `demo_native`。前者使用原生 fetch，后者强制注入本地脚本响应，不使用环境中的真实 Key。

## 阅读顺序

1. `order-definition.mjs`：普通 JSON Schema、工具描述与 systemPrompt。Schema 是发给模型的说明；原生执行前另做参数检查。
2. `native/agent.mjs` 的 `messages`：system → 历史 → 本轮 user。每次运行独立创建，不提供长期记忆。
3. `for` 循环：构造 model/messages/tools，经 `transport.fetch` 发请求，读取 assistant 消息。
4. `executeTool`：只允许 getOrder，拒绝非法 JSON、空订单号和额外参数；错误也回传给模型。
5. `messages.push`：先保存 assistant 调用，再保存带相同 tool_call_id 的 tool 结果；下一轮请求才把结果发给模型。
6. `model-transport.mjs`：原生 fetch、超时、取消、原始响应与 usage、响应 ID 校验、脱敏错误。
7. `native/demo/model.demo.mjs`：只模拟模型，不替代 Agent 循环。它支持明确订单号、最近历史的订单号、多个订单和缺少订单号追问，不具备真实语言理解能力。

订单样本和 CLI 默认输入分别在 `common/demo/orders.demo.json`、`common/demo/inputs.demo.json`，查询函数从独立的数据文件读取样本。`demo/` 目录与 `.demo` 文件标记均使用小写。

## 教程与验证

`/learn/native` 有六节教程与独立进度。源码片段从当前文件提取，可点击文件名查看完整源码。完整循环章节直接运行原生 Agent，支持四种场景和事件回放，展示的 messages 是实际运行快照。

`test/native.test.mjs` 与另外两版共用行为契约，覆盖 HTTP 工具循环、工具 ID、错误参数、未知工具、usage、上下文、请求上限、超时、取消和 CLI。`test/native-demo.test.mjs` 验证离线 Demo；`test/server.test.mjs` 验证 Runtime 分发、工具结果及停止。

本地模拟测试验证实现与协议；外部模型的工具选择和自然语言回答需另外验证。原生版没有逐 Token 输出、自动重试、持久化或人工审批恢复。
