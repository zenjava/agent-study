# 第一步：用普通函数查订单

命令行教学部分使用原生 Node.js ESM，不需要安装依赖；新版网页使用 React + CopilotKit。

```text
harness/
├── index.mjs          # 入口：读取输入 → 调用函数 → 打印结果
├── src/
│   └── get-order.mjs  # 内存订单数据和 getOrder 函数
└── README.md
```

在项目目录运行：

```bash
node index.mjs A1001
```

返回（以下只摘录核心字段，现已包含完整商品、金额与流程信息）：

```json
{
  "found": true,
  "order": {
    "orderId": "A1001",
    "status": "等待审批",
    "currentApprover": "采购负责人"
  }
}
```

查询不存在的订单：

```bash
node index.mjs A9999
```

返回：

```json
{
  "found": false,
  "orderId": "A9999"
}
```

直接运行 `node index.mjs` 时，默认查询 `A1001`。

从 `index.mjs` 开始看：

1. **输入**：命令行提供订单号，入口组装成 `{ orderId: 'A1001' }`。
2. **查询**：Node.js 调用 `getOrder({ orderId })`，函数在内存数组中查找订单。
3. **输出**：找到时返回 `{ found: true, order }`；未找到时返回 `{ found: false, orderId }`。入口将结果打印出来。

此时没有模型参与。`getOrder` 就是普通 JavaScript 函数，由 Node.js 执行。未来接入模型后，模型会提出工具调用请求，Node.js 仍负责执行这个函数，再把结果回传给模型，由模型组织回答。

# 第二步：让模型提出工具调用请求

入口是 `step2.mjs`，继续使用第一步的 `src/get-order.mjs`。仍然没有第三方依赖；使用 Node.js 22 或更高版本，开发验证版本为 22.22.1。

```text
harness/
├── index.mjs          # 第一步：直接查询
├── step2.mjs          # 第二步：模型请求与工具循环，按注释 1 → 4 阅读
├── src/get-order.mjs  # 两步共用的真实查询函数
├── test/step2.test.mjs # 本地 HTTP 模拟测试
├── .env.example      # DeepSeek 配置模板，密钥为占位符，可加入 Git
├── .gitignore        # 忽略 .env 和 .env.*，保留 .env.example
└── README.md
```

## 配置并启动

本例使用 **DeepSeek 官方 API + `deepseek-flash`**。按 2026-09-26 核实的[官方模型文档](https://api-docs.deepseek.com/quick_start/pricing/)，这个模型支持工具调用，价格低于同页的 Pro 模型，适合先练习简单查订单。模型名仍由环境变量配置。

先在项目目录创建配置文件（已有 `.env` 时不覆盖）：

```bash
cd /Users/bytedance/Documents/ChatGPT/harness
cp -n .env.example .env
```

打开本机 `.env`。模板已填好地址和模型；在 [DeepSeek 开放平台](https://platform.deepseek.com/)申请好 API key 后，将 `LLM_API_KEY` 的占位符替换为它，不要将密钥发到聊天中。如果此前已有 OpenAI 或其他服务的 `.env`，复制命令不会更新旧配置：请手动将地址、模型改成下面的值，并填入 DeepSeek 密钥，不能沿用其他服务的密钥。

```dotenv
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-flash
LLM_API_KEY=replace-with-your-deepseek-api-key
```

| 配置 | 含义 |
| --- | --- |
| `LLM_BASE_URL` | 官方 API 基础地址 `https://api.deepseek.com`，程序追加 `/chat/completions`，最终请求地址为 `https://api.deepseek.com/chat/completions`。 |
| `LLM_MODEL` | 默认 `deepseek-flash`，可改成你有权限使用、支持该协议的模型。 |
| `LLM_API_KEY` | 你在 DeepSeek 开放平台申请的密钥，必须替换占位符。 |

这里沿用项目的 `LLM_*` 变量名，密钥应填入 `LLM_API_KEY`。程序不会读取 Codex 登录信息，DeepSeek 的 API 权限和余额由你的开放平台账户提供。

保存后启动：

```bash
node --env-file=.env step2.mjs "A1001 现在到哪一步了，谁在审批？"
```

也可以将这三项设为环境变量后，运行 `node step2.mjs "A1001 谁在审批？"`。未提供问题时使用默认的 A1001 查询。已有环境变量优先于 `.env` 中的同名值，切换服务时请一并检查。

接口格式按 DeepSeek 官方 [Tool Calls](https://api-docs.deepseek.com/guides/tool_calls/) 和 [Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/) 核实。它兼容 OpenAI 格式，继续使用 `system` 消息、`tools`、`tool_calls` 和 `tool_call_id`，查询函数及工具循环保持原来的分工。

DeepSeek 当前默认开启思考模式。本例对 `deepseek-` 开头的模型，在每次 HTTP 请求体中直接加入 `thinking: { type: 'disabled' }`，使用非思考模式观察工具调用；这是原生 `fetch` 参数，无需 SDK 的 `extra_body` 包装。未来若启用思考模式，需要遵循官方[思考模式文档](https://api-docs.deepseek.com/guides/thinking_mode/)完整回传 `reasoning_content`。本例未启用 Beta `strict` 模式，工具参数由 Node 校验。

若提示配置缺失或占位符未替换，按错误中的步骤编辑本机 `.env`。实际请求失败时程序会显示 HTTP 状态码；密钥权限、模型访问和 API 余额需在你的 DeepSeek 开放平台账户中核实。

## 按两次请求理解

下面的 JSON 是教学示意，省略了外围字段；调用 ID 和最终措辞由实际模型生成。

**第一次请求：Node → 模型。** Node 发送自然语言问题、系统要求和 `getOrder` 的工具定义。定义只描述函数名、用途和参数格式，模型没有拿到本地函数源码或订单数组。

```json
{ "role": "user", "content": "A1001 现在到哪一步了，谁在审批？" }
```

**第一次返回：模型 → Node。** 模型决定查询订单时，返回一条带有 `tool_calls` 的 assistant 消息：

```json
{
  "role": "assistant",
  "content": null,
  "tool_calls": [{
    "id": "call_1",
    "type": "function",
    "function": {
      "name": "getOrder",
      "arguments": "{\"orderId\":\"A1001\"}"
    }
  }]
}
```

注意，`arguments` 是 JSON **字符串**。此时订单还没有被查询。Node 用 `JSON.parse` 解析参数，确认工具名只能是 `getOrder`，参数只能包含非空字符串 `orderId`，然后执行：

```js
const result = getOrder({ orderId: args.orderId });
```

**第二次请求：Node → 模型。** Node 保留前面的对话和 assistant 工具调用消息，再追加查询结果，一起发送：

```json
{
  "role": "tool",
  "tool_call_id": "call_1",
  "content": "{\"found\":true,\"order\":{\"orderId\":\"A1001\",\"status\":\"等待审批\",\"currentApprover\":\"采购负责人\"}}"
}
```

`tool_call_id` 对应模型刚才给出的 `id`，用于说明“这是哪一次调用的结果”。`content` 也是 JSON 字符串。不是只把查询结果单独发过去。

**第二次返回：模型 → Node。** 模型根据工具结果组织中文回答，例如“订单 A1001 正在等待审批，当前审批人为采购负责人”。Node 打印文本并结束。

所以，模型负责理解提问、提出调用请求、组织回答；Node 负责请求模型、校验参数、执行函数、维护消息历史和控制循环。这个 `for` 循环就是本例中承接这些工作的最小 Harness。第一步的函数没有变成模型里的代码。

## 循环的边界

- 正常查询通常需要两次模型请求。模型也可能直接追问订单号，此时不会执行工具。
- 默认最多请求模型 4 次，每次请求限时 30 秒，超时包括响应体读取。最后一次若仍要求调用工具，程序停止并报错。
- 未知工具或非法参数不会执行函数，而是将结构化错误按调用 ID 回传，模型可在剩余次数内纠正。不存在的订单是正常的 `found: false` 查询结果。
- 缺少/重复调用 ID、HTTP 失败、非法 JSON、响应截断或空回答会报错退出，退出码为 1。
- 日志展示调用请求、查询结果和回传 ID，不打印鉴权头或服务端错误原文。配置密钥若出现在教学日志中会被替换为 `[REDACTED]`。

## 离线验证与真实调用的区别

```bash
node --test test/step2.test.mjs
```

测试只启动监听 `127.0.0.1` 随机端口的模拟 HTTP 服务，使用固定假密钥，不需要 `.env`，不连接真实模型。它执行真实的 `fetch`、参数校验、`getOrder` 和结果回传，检查发送给 HTTP 对端的消息及调用 ID。

**模拟服务的工具请求和最终回答是预先写好的。** 测试证明程序能走通协议和错误处理，不能证明真实模型会正确选择工具或正确回答。DeepSeek 专项用例检查 `/chat/completions` 路径、`deepseek-flash` 模型名、每次请求关闭思考模式，以及真实查询结果按调用 ID 回传。本机填好有效密钥后，通过命令行或下面的页面测试真实链路。

# 第三步：CopilotKit 订单助手

网页采用 React 19 + CopilotKit 1.74.0 的 v2 API，构建工具为 Vite。使用自托管 Runtime，不需要 Copilot Cloud 账号。既有 CLI 和 `/api/run` 接口保留。

```bash
npm ci --ignore-scripts
npm run build
npm start
```

打开 [订单助手](http://127.0.0.1:3210)。`npm start` 读取本机 `.env`；没有配置文件时可以用 `npm run demo`，只体验本地演示。修改网页后重新构建并刷新，修改后端或 `.env` 后重启。构建产物在 `dist/`，服务器只允许首页及 assets 下的静态产物。

## 怎么测试

- **本地演示（默认）**：点击首页的快捷问题，或点左侧订单填入问题再发送。演示用固定规则选择工具和生成回答，实际执行 `getOrder`，通过与真实模式相同的 AG-UI / CopilotKit 渲染链路显示卡片；不连接模型，模型请求次数和 Token 均为 0。
- **真实模型**：切换后发送问题，后端才使用 `.env` 的 Key 调用所配置模型；发送的内容包括问题、最近对话、工具定义与工具查询结果。初始页面连接、切换模式和查看订单列表均不触发模型请求。真实调用按供应商 API 用量计费。
- **卡片**：点击“商品明细 / 订单流程 / 配送与结算”，查看不同业务信息。工具结果由服务器提供，前端注册 `useRenderTool({ name: 'getOrder', ... })` 映射为 `OrderCard`。
- **连续追问**：同一会话可接着问“它多少钱”“什么时候到”；最多保留最近 20 条用户和助手文字给后端。缺少可确定的订单号时应追问。工具结果由服务端重新查询。
- **新对话**：重建对话和统计，运行时禁止切换模式或清空。点击“停止”取消当前生成，已产生的卡片与统计保留。刷新页面会丢失前端历史，本例未提供持久化会话管理。

| 订单 | 场景 | 含税总额 | 可验证内容 |
| --- | --- | ---: | --- |
| A1001 | 等待审批 | ¥48,600 | 当前审批人、显示器/扩展坞/支架、待付款 |
| A1002 | 配送中 | ¥27,900 | 预计到货日期、示例运单、30% 订金 |
| A1003 | 已完成 | ¥12,800 | 验收、付款完成、已开票 |
| A9999 | 不存在 | — | 未找到提示，不制造订单信息 |

订单、人员、供应商、地址和运单全部为虚构教学数据，不执行审批、付款或修改。真实模型仍可能返回不准确的文字，业务字段以卡片和原始工具结果为准。

## Token 与调用关系

对话顶部始终展示会话 Token 总量，点击「查看调用详情」可展开本会话汇总和每次模型请求的输入/输出/合计 Token，按 `runId + step` 关联，来自模型 `usage.prompt_tokens` / `completion_tokens` / `total_tokens`。展开记录可查看请求、工具结果和原始 usage。缺失用量显示 `—`，仅汇总已知值，不把失败或未知用量当成 0；部分请求有数据时明确显示覆盖次数。真实返回的 0 会正常显示 0。当前不计算费用。

一次查单通常为两次模型请求、一次 getOrder；订单卡片直接使用工具查询结果，渲染卡片无需额外请求模型。

```text
CopilotKit 对话 / useRenderTool
  → /api/copilotkit（自托管 Copilot Runtime）
  → OrderAgent（AG-UI 与教学事件之间的适配）
  → runOrderQuestion（原有模型循环）
  → getOrder（完整示例订单）
  → AG-UI 工具结果 / 文字 / 自定义 usage 事件
  → OrderCard + Markdown 回答 + 调用统计
```

代码分工：

```text
web/main.jsx             CopilotKit Provider、ChatView、输入与会话
web/OrderCard.jsx        getOrder 结果的业务卡片
web/TracePanel.jsx       每次请求用量与 JSON 过程
web/style.css            页面与响应式样式
src/get-order.mjs        三种示例订单、列表摘要与真实查询函数
src/order-agent.mjs      AG-UI 适配、多轮上下文、明确标注的演示逻辑
src/copilot-handler.mjs  自托管 Runtime，关闭框架遥测
step2.mjs               原有原生 fetch 工具循环，新增可选 history
server.mjs              本机 HTTP、静态文件、配置与 Runtime 路由
public/                 保留的上一版原生页面源码
```

## 验证

```bash
npm test
npm run build
```

自动化测试仅使用 localhost 模拟模型和假密钥，不读取 `.env`。覆盖订单金额一致性、工具 ID 关联、用量缺失、失败、上下文筛选和 Copilot Runtime 标准 HTTP 链路。浏览器验证的本地演示和模拟模型，不能代替外部 DeepSeek 模型的实际效果验证。

参考：[CopilotKit 工具渲染](https://docs.copilotkit.ai/reference/hooks/useRenderTool)、[自托管 Runtime](https://docs.copilotkit.ai/runtime-server-adapter)。本项目使用的 CopilotKit 开源包为 MIT，依赖许可保留于各包 LICENSE 中。
