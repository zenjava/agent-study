# LangChain.js 迁移记录

迁移前基线：`1b2fb28`（原生模型工具调用循环，40 项测试通过）。

## 目标与分工

将 `src/agent/cli/langchain.mjs` 中手写的模型/工具循环替换为 LangChain.js `createAgent`。
目录整理后，该实现位于 `src/agent/langchain.mjs`，`src/agent/cli/langchain.mjs` 只保留 CLI 启动逻辑；HTTP 和 AG-UI 接入位于 `src/server/`。
`ChatOpenAI` 连接现有 OpenAI 兼容接口；`tool` 和 Zod 定义订单查询；中间件保留调用边界与教学事件。
订单数据、系统提示词、CopilotKit 卡片和 AG-UI 协议保持现有业务语义。

## 执行步骤

- [x] 提交迁移前代码，检查密钥忽略规则，运行全部基线测试。
- [x] 锁定 LangChain、Core、OpenAI 适配器依赖版本。
- [x] 补充连续追问、模型原始响应展示、失败不重试、取消和循环边界的回归测试；先确认新增行为测试失败。
- [x] 用 `createAgent` / `tool` 替换手写循环；通过中间件处理工具错误和调用上限。
- [x] 保留真实 HTTP 请求与原始 usage 的脱敏快照，新增模型响应事件，让完整调用链可检查。
- [x] 更新 README 的阅读顺序、运行方式、前后职责对照。
- [x] 运行全部测试和构建，用本机模拟模型验证页面实际链路。
- [x] 检查 Git 差异，把迁移改动保留为相对基线的未提交变更。

## 验收边界

自动化与页面模拟使用本机 HTTP 服务和假密钥。它们验证 LangChain、真实 getOrder、协议、错误处理和渲染，不代表外部模型的分析正确性。
不改动 `.env`。外部调用和本地模拟的证据分别记录。

## 查看前后变化

```bash
git show 1b2fb28:step2.mjs
git diff 1b2fb28 -- src/agent/cli/langchain.mjs src agent server web README.md package.json
```


## 验证结果（2026-09-27）

- 迁移前：40 项测试通过，提交 `1b2fb28`。
- 迁移后：44 项测试通过；新增的原始响应展示测试先失败、迁移后通过。
- `npm run build` 成功；`git diff --check` 无格式错误。
- 浏览器使用独立 localhost 模拟模型，实际经过 CopilotKit → AG-UI → LangChain → ChatOpenAI → getOrder。
- 查 A1001：2 次模型请求、1 次工具执行；两次模拟 usage 为 135 / 205，页面合计 340；卡片金额 48600 元。
- 两条「模型原始响应」可展开为 JSON，包含 `tool_calls`、调用 ID 和 `finish_reason`；浏览器无控制台错误或警告。
- 原地址 127.0.0.1:3210 已重启加载新实现，`.env` 未修改；此次未请求外部模型。

框架兼容处理：工具结果增加 SDK 生成的 `name` 字段；错误参数由中间件回传结构化错误。
非法 JSON 的故障注入测试会触发 LangChain Core 自身的工具调用兼容警告，该用例仍成功回传错误并继续纠正；正常调用与浏览器验证没有该警告。
