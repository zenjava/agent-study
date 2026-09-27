# Web 目录说明

`src/web/` 按职责分层，聊天与教学在各层内继续分组。测试仍在根目录 `test/`，构建配置仍是根目录 `vite.config.mjs`。

```text
src/web/
├── index.html / learn.html
├── entries/
│   ├── main.jsx
│   └── learn.jsx
├── pages/
│   ├── chat/                 # ChatPage、ChatWorkspace
│   └── learning/             # LearnPage、SourcePage
├── components/
│   ├── chat/                 # 输入、对话、侧栏、订单卡片、调用统计
│   └── learning/             # 概念导读、交互演示、小测、代码阅读
├── state/
│   ├── chat/                 # useChatSession、useChatRun
│   └── learning/             # useLearningProgress、useNativeDemo
├── content/                  # 课程、版本配置、源码白名单
│   └── demo/                 # 演示场景、快捷提问、卡片预览与场景选项
└── styles/                   # chat.css、learn.css、learning-tokens.css
```

## 各层边界

| 层 | 负责 | 常见修改位置 |
| --- | --- | --- |
| `entries` | 加载样式、选择页面、调用 createRoot；HTML 保留为 Vite 的两个入口壳 | 修改页面启动方式 |
| `pages` | 组装布局、Provider、状态和组件；ChatWorkspace 注册 getOrder 的卡片渲染器 | 增减页面区域、调整页面依赖 |
| `components` | 展示数据、响应点击；聊天与教学组件分组 | 修改卡片、输入框、侧栏、概念说明和小测 |
| `state` | 请求与订阅、副作用、跨组件共享的业务状态、持久化 | 修改发送、取消、会话重置、学习进度或 Demo 执行 |
| `content` | 四条课程定义、三版聊天配置、离线演示场景、显式源码白名单与节选定位 | 新增课程、场景或源码导读 |
| `styles` | 聊天与教学样式、教学设计变量 | 修改视觉与响应式布局 |

依赖从入口进入页面，由页面连接组件与状态。状态 hooks 不导入页面或组件，也不生成 JSX。组件可以使用自身需要的 hook，例如原生演示组件使用 `useNativeDemo`。课程内容不依赖组件；`source-files.js` 的 `?raw` 只是构建时文本快照，不执行被收录的模块。

组件内部的标签选择、步骤切换、小测选项等局部 UI 状态继续使用本地 `useState`；需要请求、清理订阅或持久化的状态放在 `state/`。没有新增全局状态库。

## 聊天状态的生命周期

- `useChatSession` 读取服务配置与示例订单，管理实现版本、运行模式、错误提示和会话编号。
- `ChatPage` 用版本、模式与会话编号作为 Provider 的 key。切换版本、模式或点击新对话时，内部运行状态重新创建。
- `useChatRun` 在 Provider 内读取前端 Agent，管理输入、事件订阅、提交锁和取消请求。消息本身仍由 CopilotKit Agent 管理。
- `ChatWorkspace` 将这些状态与回调传给展示组件，注册 `getOrder → OrderCard`。

读取配置与订阅事件都保留卸载清理。模型 Key 与真实 Agent 执行仍在服务端；浏览器里的原生 Demo 使用脚本模型，不请求外部 API。

## 学习页与源码导航

`entries/learn.jsx` 根据路径调用 `getCourse`，选择原生 JavaScript、LangChain、LangGraph 或共用的 Copilot Runtime 课程；带 `source` 查询参数时挂载 `SourcePage`，否则挂载 `LearnPage`。学习导航、答题进度、重置与本地存储由 `useLearningProgress` 管理。原有三版的存储 key 不变，Runtime 使用 `harness-learning-runtime-v1`。Runtime 正文位于 `content/runtime-learning-content.js`，可从其余三条路线跳转。

课程定义集中在 `content/*learning-content.js`。`source-files.js` 显式收录可展示源码，`excerpt` 从当前文件文本推导节选行号。移动代码时需要同时修改源码收录路径、课程节选和文件地图，再重新构建；URL 参数只能选择白名单中的源码。

页面演示数据集中在 `content/demo/`，采用 `*.demo.json` 或 `*.demo.js` 命名；组件只负责渲染和交互。三版共用的订单样本位于 `src/agent/common/demo/orders.demo.json`，页面场景按需通过查询函数读取，避免重复维护完整订单。课程正文与源码导航仍在 `content/`。

新增页面从 `pages` 开始；新增业务请求从 `state` 开始；仅调整显示时从 `components` 开始。无需再到一个入口文件里同时修改状态、布局和教学内容。
