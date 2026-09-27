# Source Layout and Native Agent Implementation Plan

**Goal:** 将源码集中到 src，保留 test 和配置的独立边界，增加可以独立运行的原生 Agent、演示和教程。

**Architecture:** src/web 负责 React 页面与 HTML 入口；src/server 负责服务启动、HTTP 和 AG-UI；src/agent 负责三种编排实现、工具、模型通信及 CLI。原生 Agent 只依赖原生 JavaScript 和本地无框架模块，显式维护 messages、fetch 请求、工具白名单和调用循环。网页共用协议与卡片。

**Tech Stack:** Node.js ESM/fetch、React/Vite/CopilotKit；现有 LangChain 和 LangGraph 实现并存。

## 执行与验证

- [x] 迁移 web、server、agent 至 src；HTML 进入 src/web，服务入口进入 src/server/main.mjs，CLI 进入 src/agent/cli。更新 Vite root/outDir、静态资源 URL、测试引用、源码导读与文档。
- [x] 为原生实现运行现有 orderAgentContract：完整工具循环、多工具、错误参数、HTTP 错误、超时、取消、原始 usage、上下文、CLI。先确认缺少实现的失败，再实现。
- [x] 新增 src/agent/native.mjs；普通 JSON Schema 和系统提示词放入无第三方依赖的 order-definition.mjs，框架工具适配继续放 order-contract.mjs。
- [x] 新增原生 CLI 和无密钥 Demo。Demo 使用本机脚本模型执行真正的原生循环，明确标注模拟模型及零真实 API 用量。
- [x] 注册 orders_native，工作台增加原生 JavaScript 选项和教程入口；保留共用本地卡片演示，提供专门运行原生循环的演示。
- [x] 添加 /learn/native 教程，包括消息数组、HTTP 请求、工具调用、结果回传、执行边界及三版对照；源码来自实际文件，学习进度独立保存。
- [x] 运行全部测试、构建、CLI Demo、HTTP 集成和浏览器验证；检查源码链接、课程切换、原生模式演示及错误场景。

不提交或推送。真实外部模型效果与本地模拟验证分别说明。

## 验证结果

- 113 项测试通过，包括三版行为契约、Runtime 原生分发/取消、Demo 和无 node_modules 的独立 CLI。
- Web 构建通过；五个页面路由与静态资源检查通过，旧资源与任意源码 URL 返回 404。
- 浏览器检查三版切换、原生 Demo 的 A1001 卡片与 48600 元金额、教程多场景回放及源码 L34-44 跳转；控制台无 warning/error。
- 本地预览端口 3217；未读取 .env、未调用外部模型。
