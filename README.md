# 目录与启动方式

源码统一放在 `src/`，测试放在同级 `test/`，配置留在根目录。`src/server/` 和 `src/agent/` 都运行在 Node.js 中，分别负责服务接入与模型/工具编排。

```text
harness/
├── src/
│   ├── web/                    # React 页面、组件、教程、样式
│   │   ├── entries/           # main / learn：样式加载、页面选择、React 挂载
│   │   ├── pages/             # chat / learning：页面与 Provider 组装
│   │   ├── components/        # chat / learning：业务卡片、输入框、教学组件
│   │   ├── state/             # chat / learning：会话、运行、学习进度与 Demo hooks
│   │   ├── content/           # 课程定义、源码白名单与版本配置
│   │   │   └── demo/          # 页面演示场景、提示词与预览数据
│   │   ├── styles/            # 聊天、教程样式与设计变量
│   │   ├── index.html         # 工作台 HTML 壳
│   │   └── learn.html         # 三种实现与 Runtime 教程共用的 HTML 壳
│   ├── server/
│   │   ├── main.mjs            # HTTP 服务启动入口
│   │   ├── http-server.mjs     # 路由、静态资源与响应流
│   │   ├── copilot-handler.mjs # Copilot Runtime 注册与分发
│   │   └── order-agent.mjs     # AG-UI 适配、历史与取消
│   └── agent/
│       ├── native/             # 原生 JavaScript 实现
│       │   ├── agent.mjs       # fetch + messages + 手写循环
│       │   └── demo/
│       │       └── model.demo.mjs # 脚本模型驱动的原生循环演示
│       ├── langchain/
│       │   └── agent.mjs       # createAgent 编排
│       ├── langgraph/
│       │   └── agent.mjs       # StateGraph 编排
│       └── common/
│           ├── order-definition.mjs # 无框架的工具说明与系统提示词
│           ├── order-contract.mjs   # 两种框架实现共用的工具适配
│           ├── model-transport.mjs  # HTTP 观察、校验、超时与取消
│           ├── tools/get-order.mjs  # 三版共用的订单查询函数
│           └── demo/
│               ├── orders.demo.json # 虚构订单样本
│               └── rules.demo.mjs   # 框架版共用的固定规则演示
├── test/                       # 三版行为契约与服务集成测试
├── docs/                       # 学习与设计文档
├── package.json
├── package-lock.json
├── vite.config.mjs
├── .env.example
└── .gitignore
```

Web 服务通过根目录的 npm scripts 启动：

| 命令 | 用途 |
| --- | --- |
| `npm run build` | 将 Web 构建到根目录 `dist/` |
| `npm run demo` | 启动 Web 服务，不加载 `.env` |
| `npm start` | 启动 Web 服务并加载 `.env` |
| `npm test` | 运行离线行为与本地 HTTP 集成测试 |

网页首次使用先执行 `npm ci --ignore-scripts`、`npm run build`，再执行 `npm run demo`。默认地址为 `http://127.0.0.1:3210`。

工作台调用链：`src/web/state/chat/useChatRun.js` → HTTP → `src/server/http-server.mjs` → Copilot Runtime → AG-UI 适配 → `src/agent/{native,langchain,langgraph}/agent.mjs` → `src/agent/common/tools/get-order.mjs`。

每种实现的编排代码放在自己的子目录。`common` 集中跨实现复用的业务定义、数据查询和模型通信；其中 `order-contract.mjs` 只供 LangChain / LangGraph 使用。原生版直接导入不依赖框架的公共模块，浏览器离线 Demo 不会间接加载框架依赖。

演示数据按归属集中到小写 `demo/` 目录，文件使用小写 `.demo` 标记，再接格式扩展名（如 `orders.demo.json`、`model.demo.mjs`）。跨实现共享数据放在 `src/agent/common/demo/`，原生模拟模型放在 `src/agent/native/demo/`，页面场景与预览数据放在 `src/web/content/demo/`。查询函数、组件和状态只引用这些文件。测试内部夹具仍留在 `test/`。

本项目尚未接入生产订单数据；真实模型模式也查询同一组虚构订单。这里分离的是演示数据与执行代码。接入真实订单时可替换 `getOrder` 的数据来源。

Web 分层与修改入口见 [Web 目录说明](docs/web-structure.md)。入口只负责挂载，页面组装组件，业务状态集中在 hooks；课程内容与样式单独存放。组件自己的标签切换、小测选项等局部交互留在组件内。

原生版的“无框架”指 Agent 核心：不用 LangChain、LangGraph、模型 SDK 或 Zod，只有普通 JavaScript 与原生 fetch；Web 继续共用 React/CopilotKit。模型与工具请求在 Node 执行。原生教程中的离线回放也能在浏览器执行同一份纯 JS Agent，模型响应由本地脚本模拟。

# 原生 JavaScript 版本

从 [原生版教程说明](docs/native-version.md) 开始，或启动服务后打开 `/learn/native`。工作台选择“原生 JavaScript”：

- **本地演示**走 `demo_native`，实际执行原生循环、参数校验、getOrder 和消息回传，只替换模型响应；无需 Key、不调用外部 API，统计明确标注模拟请求。
- **真实模型**走 `orders_native`，使用 `.env`，通过原生 fetch 调用兼容 Chat Completions 接口。

教程包含六节：实现边界、messages 与工具说明、完整循环、工具执行与回传、执行限制、三版对照。循环演示支持查到订单、订单不存在、缺少订单号和多个订单，展示当前代码实际产生的事件快照。学习进度与其他实现课程及 Runtime 课程分开保存。

# 第一步：理解普通函数查单

`src/agent/common/tools/get-order.mjs` 的 `getOrder({ orderId })` 在虚构订单样本中查找订单。找到时返回 `{ found: true, order }`，找不到时返回 `{ found: false, orderId }`。它是普通 JavaScript 函数，由 Node.js 执行，不需要模型。工作台中选择示例订单并发送问题，可以看到 Agent 调用它后返回的业务卡片；订单数据来自 `src/agent/common/demo/orders.demo.json`。

接入模型后，模型只提出 `getOrder` 工具调用请求。服务端校验并执行函数，再把结果回传给模型组织回答。

# 第二步：让模型提出工具调用请求

模型与工具循环由 `src/agent/langchain/agent.mjs` 中的 LangChain.js `createAgent` 管理，`ChatOpenAI` 连接兼容接口；`src/agent/langgraph/agent.mjs` 则以显式图编排同一业务函数。使用 Node.js 22 或更高版本，并先运行 `npm ci --ignore-scripts` 安装锁定依赖。

```text
src/agent/native/agent.mjs          原生模型与工具循环
src/agent/langchain/agent.mjs       LangChain createAgent 编排
src/agent/langgraph/agent.mjs       LangGraph StateGraph 编排
src/agent/common/order-contract.mjs 框架工具 Schema 与注册
src/agent/common/tools/get-order.mjs 三版共用的订单查询函数
src/agent/common/model-transport.mjs HTTP 请求、响应和 usage 观察层
src/server/copilot-handler.mjs      Web Runtime 注册与分发
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

保存后运行 `npm run build` 和 `npm start`，打开工作台，选择实现版本与「真实模型」并发送问题。已有环境变量优先于 `.env` 中的同名值，切换服务时请一并检查。

接口格式按 DeepSeek 官方 [Tool Calls](https://api-docs.deepseek.com/guides/tool_calls/) 和 [Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/) 核实。它兼容 OpenAI 格式，继续使用 `system` 消息、`tools`、`tool_calls` 和 `tool_call_id`，查询函数及工具循环保持原来的分工。

DeepSeek 当前默认开启思考模式。本例对 `deepseek-` 开头的模型，在每次 HTTP 请求体中直接加入 `thinking: { type: 'disabled' }`，使用非思考模式观察工具调用；这个参数通过 `ChatOpenAI.modelKwargs` 放到实际 HTTP 请求体中，无需 `extra_body` 包装。未来若启用思考模式，需要遵循官方[思考模式文档](https://api-docs.deepseek.com/guides/thinking_mode/)完整回传 `reasoning_content`。本例未启用供应商的 Beta `strict` 模式，工具参数由服务端 Zod Schema 校验。

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

注意，`arguments` 是 JSON **字符串**。此时订单还没有被查询。LangChain 将参数转换成工具调用对象；我们的中间件确认工具名只能是 `getOrder`，Zod Schema 要求参数只能包含非空字符串 `orderId`，通过后由 LangChain 调用注册的工具函数：

```js
const orderTool = tool(({ orderId }) => JSON.stringify(getOrder({ orderId })), {
  name: 'getOrder',
  description: '根据订单号查询完整订单信息。',
  schema: orderSchema,
});
```

**第二次请求：Node → 模型。** Node 保留前面的对话和 assistant 工具调用消息，再追加查询结果，一起发送：

```json
{
  "role": "tool",
  "name": "getOrder",
  "tool_call_id": "call_1",
  "content": "{\"found\":true,\"order\":{\"orderId\":\"A1001\",\"status\":\"等待审批\",\"currentApprover\":\"采购负责人\"}}"
}
```

`tool_call_id` 对应模型刚才给出的 `id`，用于说明“这是哪一次调用的结果”。`content` 也是 JSON 字符串。不是只把查询结果单独发过去。

**第二次返回：模型 → Node。** 模型根据工具结果组织中文回答，例如“订单 A1001 正在等待审批，当前审批人为采购负责人”。Node 返回文本，经 Runtime 显示在页面。

模型负责理解提问、提出调用请求和组织回答。运行在 Node.js 中的 LangChain 负责调用模型、执行注册工具、追加 ToolMessage 和继续循环；我们负责业务函数、规则和可观察性。`src/agent/langchain/agent.mjs` 没有手写 `for` 循环或 `messages.push`，第一步的查询函数仍是普通服务端代码。

## 循环的边界

- 正常查询通常需要两次模型请求。模型也可能直接追问订单号，此时不会执行工具。
- 默认最多请求模型 4 次，每次请求限时 30 秒，超时包括响应体读取。最后一次若仍要求调用工具，程序停止并报错。
- 未知工具或非法参数不会执行函数，而是将结构化错误按调用 ID 回传，模型可在剩余次数内纠正。不存在的订单是正常的 `found: false` 查询结果。
- 缺少/重复调用 ID、HTTP 失败、非法 JSON、响应截断或空回答会结束本次运行并展示错误。
- 日志展示调用请求、查询结果和回传 ID，不打印鉴权头或服务端错误原文。配置密钥若出现在教学日志中会被替换为 `[REDACTED]`。

## 离线验证与真实调用的区别

```bash
node --test test/langchain.test.mjs
```

测试只启动监听 `127.0.0.1` 随机端口的模拟 HTTP 服务，使用固定假密钥，不需要 `.env`，不连接真实模型。它执行真实的 LangChain Agent、ChatOpenAI HTTP 请求、参数校验、`getOrder` 和结果回传，检查发送给 HTTP 对端的消息及调用 ID。

**模拟服务的工具请求和最终回答是预先写好的。** 测试证明程序能走通协议和错误处理，不能证明真实模型会正确选择工具或正确回答。DeepSeek 专项用例检查 `/chat/completions` 路径、`deepseek-flash` 模型名、每次请求关闭思考模式，以及真实查询结果按调用 ID 回传。本机填好有效密钥后，通过下面的页面测试真实链路。

# 第三步：CopilotKit 订单助手

网页采用 React 19 + CopilotKit 1.74.0 的 v2 API，构建工具为 Vite。使用自托管 Runtime，不需要 Copilot Cloud 账号。网页统一通过 `/api/copilotkit` 运行 Agent。

```bash
npm ci --ignore-scripts
npm run build
npm start
```

打开 [订单助手](http://127.0.0.1:3210)。`npm start` 读取本机 `.env`；没有配置文件时可以用 `npm run demo`，只体验本地演示。修改网页后重新构建并刷新，修改后端或 `.env` 后重启。构建产物在 `dist/`，服务器只允许首页、学习页及 assets 下的静态产物。首次运行须先执行 `npm run build`；缺少页面产物时返回 503 并提示构建。

### 交互式代码导读

打开 [Copilot Runtime 学习页](http://127.0.0.1:3210/learn/runtime)，先读三种 Web 实现共用的页面接入、Agent 分发与事件回传；再按需进入[原生 JavaScript](http://127.0.0.1:3210/learn/native)、[LangChain](http://127.0.0.1:3210/learn) 或 [LangGraph](http://127.0.0.1:3210/learn/langgraph) 学习页。工作台顶部的导读入口跟随当前实现版本；每条实现教程和学习页顶部都可跳转到 Runtime 教程。

- Copilot Runtime 独立四节：共用 Web 链路、Provider 与 HTTP 注册、OrderAgent 执行及 AG-UI 事件、页面渲染与会话边界。
- LangChain 保留七节内容，依次讲解项目分工、LangChain 核心概念、工具定义、模型配置、Agent 循环、结果渲染、可靠性与 Token。
- LangGraph 新增六节：两版分工、State / Reducer、模型与工具节点、普通边与条件边、逐步走图、两版对照与扩展。各课程学习进度独立保存，旧版进度继续保留。
- LangGraph 教学图可逐步查看状态消息、分支和两类调用计数；它是固定脚本，工作台的真实执行记录则由后端图节点产生。
- 请求实验室提供查到订单、订单不存在、缺少订单号三种固定脚本，可逐步查看消息与调用计数；不请求模型、不消耗 API Token。
- LangChain 第一节保留 Web 到 Agent 的简要入口，完整的 Provider、前端代理、Runtime、后端 Agent、AG-UI、路由与 ID 映射集中在独立 Runtime 教程。
- LangChain 核心概念章节提供 Model、Message、Tool、Prompt、Agent、Middleware、State、Runnable 和结构化输出九张概念卡，区分运行入口，并解释记忆、LangGraph / LangSmith、RAG 的适用位置；附官方文档和真实源码，标注当前已使用与尚未接入的能力。
- 代码片段来自构建时明确列出的仓库源码，显示实际行号；不导入 `.env`。修改被引用的源码后需重新 `npm run build`。
- 每节小测答对后保存本浏览器的学习进度，可随时跳转章节。学习进度与订单对话独立。

页面入口是 `src/web/learn.html`、`src/web/entries/learn.jsx`，页面组装在 `src/web/pages/learning/`，课程在 `src/web/content/*learning-content.js`，源码白名单与节选定位在 `src/web/content/source-files.js`，样式在 `src/web/styles/learn.css`。Vite 使用两个 HTML 入口；四条课程共用页面壳，独立的交互导读位于 `src/web/components/learning/`。学习页只阅读构建时源码，不加载 Copilot Runtime，也不替代真实模型验证。四条路线分别保存进度，已有三条路线的存储 key 保持不变。

## 三个实现版本并存

工作台有两个独立选项：**实现版本（原生 JavaScript / LangChain / LangGraph）**和**测试模式（本地演示 / 真实模型）**。

| 实现与模式 | Runtime Agent ID | 实际执行 |
| --- | --- | --- |
| 原生 JavaScript + 真实模型 | `orders_native` | `src/agent/native/agent.mjs` 的手写循环 |
| 原生 JavaScript + 本地演示 | `demo_native` | 执行原生循环，脚本模拟模型响应 |
| LangChain + 真实模型 | `orders` | `src/agent/langchain/agent.mjs` 的 `runOrderQuestion` / `createAgent` |
| LangGraph + 真实模型 | `orders_graph` | `src/agent/langgraph/agent.mjs` 的 `runOrderQuestionGraph` / `StateGraph` |
| LangChain / LangGraph + 本地演示 | `demo` | 共用固定规则，查询真实的本地虚构数据，不运行模型编排 |

切换版本或模式会开始新对话，消息和 Token 统计同时重置；运行中禁用切换。三版使用同一份模型配置、业务规则和订单数据。LangGraph 额外在调用详情展示 `graph_node`、`graph_edge` 事件，不把图节点数当作模型请求数。

图路径为 `START → model → tools → model → END`；model 后按是否含 tool_calls 选择 tools 或 END。三版均保留请求上限、超时、取消、参数校验和脱敏。当前均未启用逐 Token 文字输出、持久化或人工审批恢复。

## 怎么测试

- **共用本地演示（LangChain / LangGraph 默认）**：点击首页的快捷问题，或点左侧订单填入问题再发送。演示用固定规则选择工具和生成回答，实际执行 `getOrder`，通过与真实模式相同的 AG-UI / CopilotKit 渲染链路显示卡片；不连接模型，模型请求次数和 Token 均为 0。
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

对话顶部始终展示会话 Token 总量，点击「查看调用详情」可展开本会话汇总和每次模型请求的输入/输出/合计 Token，按 `runId + step` 关联，来自模型 `usage.prompt_tokens` / `completion_tokens` / `total_tokens`。展开记录可查看 SDK 实际发出的请求、每次模型原始响应、工具结果和原始 usage；请求与响应按同一轮的请求序号对应。缺失用量显示 `—`，仅汇总已知值，不把失败或未知用量当成 0；部分请求有数据时明确显示覆盖次数。真实返回的 0 会正常显示 0。当前不计算费用。

一次查单通常为两次模型请求、一次 getOrder；订单卡片直接使用工具查询结果，渲染卡片无需额外请求模型。

```text
CopilotKit 对话 / useRenderTool
  → /api/copilotkit（自托管 Copilot Runtime）
  → OrderAgent（AG-UI 与教学事件之间的适配）
  → orders_native: runOrderQuestionNative → 原生 fetch + for
  或 orders: runOrderQuestion → LangChain createAgent
  或 orders_graph: runOrderQuestionGraph → LangGraph StateGraph
  → getOrder（完整示例订单）
  → AG-UI 工具结果 / 文字 / 自定义 usage 事件
  → OrderCard + Markdown 回答 + 调用统计
```

代码分工：

```text
src/web/entries/main.jsx                    工作台挂载入口
src/web/pages/chat/ChatPage.jsx              CopilotKit Provider 与会话组装
src/web/pages/chat/ChatWorkspace.jsx         工具卡片注册、状态与组件连接
src/web/state/chat/useChatSession.js         模式、版本、服务配置与会话重置
src/web/state/chat/useChatRun.js             消息提交、事件订阅、并发锁与停止
src/web/components/chat/ConversationPanel.jsx  ChatView 与对话区
src/web/components/chat/OrderCard.jsx        getOrder 结果的业务卡片
src/web/components/chat/TracePanel.jsx       每次请求用量与 JSON 过程
src/web/styles/chat.css            页面与响应式样式
src/agent/common/tools/get-order.mjs        订单查询与列表摘要函数
src/agent/common/demo/orders.demo.json      三种虚构订单数据
src/agent/common/demo/rules.demo.mjs        框架版固定规则演示
src/server/order-agent.mjs      AG-UI 适配、多轮上下文与取消
src/server/copilot-handler.mjs  自托管 Runtime，关闭框架遥测
src/agent/common/order-contract.mjs   LangChain / LangGraph 的工具适配与 Zod Schema
src/agent/langchain/agent.mjs      LangChain 模型配置、限制与事件中间件
src/agent/langgraph/agent.mjs      LangGraph 状态、节点、条件边与图执行
src/agent/common/model-transport.mjs  HTTP 观察、原始用量、协议校验与请求超时
src/server/http-server.mjs   本机 HTTP、静态文件、配置与 Runtime 路由
src/server/main.mjs               读取环境配置并启动 HTTP 服务
```

## 验证

```bash
npm test
npm run build
```

自动化测试仅使用 localhost 模拟模型和假密钥，不读取 `.env`。三版共用 `test/order-agent-contract.mjs`，覆盖订单金额一致性、工具 ID 关联、用量缺失、失败、上下文筛选、版本分发、取消和 Copilot Runtime 标准 HTTP 链路。浏览器验证的本地演示和模拟模型，不能代替外部 DeepSeek 模型的实际效果验证。

参考：[CopilotKit 工具渲染](https://docs.copilotkit.ai/reference/hooks/useRenderTool)、[自托管 Runtime](https://docs.copilotkit.ai/runtime-server-adapter)。本项目使用的 CopilotKit 开源包为 MIT，依赖许可保留于各包 LICENSE 中。


# 第四步：对照三种编排方式

| 负责的工作 | 原生版本 | LangChain 版本 |
| --- | --- | --- |
| 工具定义 | 手写 `tools` JSON Schema | `tool` + Zod Schema |
| 调用模型 | 手写 HTTP 请求体 | `ChatOpenAI` 生成协议并调用兼容接口 |
| 执行、回传、继续调用 | `for` + `executeTool` + `messages.push` | `createAgent` + `agent.invoke` |
| 业务查询 | `getOrder` | 同一个 `getOrder` |
| 调用上限与业务错误 | 循环中的判断 | `createMiddleware` 拦截模型/工具调用 |
| 教学过程和 Token | 原生 fetch 产生事件 | `model-transport` 观察 SDK 实际 HTTP；中间件产生工具事件 |
| 页面展示 | CopilotKit + 订单卡片 | 保留卡片，增加模型原始响应记录 |

核心调用相当于：

```js
const agent = createAgent({
  model: chatModel,
  tools: [orderTool],
  systemPrompt,
  middleware: [middleware],
});
const result = await agent.invoke({ messages: [...history, { role: 'user', content: question }] });
```

运行时未配置持久化会话；每轮问题创建独立 Agent，沿用页面传入且经过服务端筛选的文字历史。
LangChain 与模型 SDK 的自动重试均关闭，每个显示的请求对应一次 HTTP 尝试。
保留 HTTP 观察层是为了准确展示原始请求、供应商 usage（包括缺失值和缓存细节）以及读取响应体的超时；它不负责工具执行或循环。
对于无法解析的工具参数，中间件保留原始响应供页面查看，并以同一调用 ID 返回 `INVALID_ARGUMENTS`，让模型在剩余次数内纠正。

实现细节与验证记录见 `docs/langchain-migration.md`。
参考：[LangChain.js Agents](https://docs.langchain.com/oss/javascript/langchain/agents)、[自定义中间件](https://docs.langchain.com/oss/javascript/langchain/middleware/custom)。
