/**
 * 全栈源码地图：按浏览器到服务端再到 Agent 的顺序列出职责与可点击的实际源码。
 */
import React from 'react';
import { SourceLink } from './SourceLink.jsx';

const steps = [
  ['Web：提交问题', 'src/web/state/chat/useChatRun.js', '页面将用户问题加入消息列表，通过 CopilotKit 把消息、threadId 和 runId 发到 /api/copilotkit。'],
  ['服务端：接收请求', 'src/server/http-server.mjs', 'HTTP 服务检查请求并交给 Copilot Runtime，再把响应事件流写回浏览器。src/server/main.mjs 只负责读取环境配置和启动监听。'],
  ['服务端：选择实现', 'src/server/copilot-handler.mjs', 'Runtime 注册三种实现及本地 Demo。LangGraph 真实模型模式使用 orders_graph，对应 runOrderQuestionGraph。'],
  ['服务端：适配协议', 'src/server/order-agent.mjs', 'OrderAgent 提取本轮问题与历史，调用 Agent 编排函数，并将工具、回答和教学记录转换成 AG-UI 事件。'],
  ['Agent：编排模型与工具', 'src/agent/langgraph/agent.mjs', '图从 START 进入 model。模型要求调用工具时进入 tools，执行后带回 ToolMessage 再进入 model；模型给出最终回答时走 END。'],
  ['Agent：执行订单查询', 'src/agent/common/tools/get-order.mjs', 'getOrder 查询虚构订单。工具结果沿事件流返回，Web 的 OrderCard 展示订单，TracePanel 展示调用过程与用量。'],
];

export function FullStackGuide() {
  return <section className="runtime-guide" aria-label="Web、服务端与 Agent 调用链">
    <div className="runtime-map">
      <div><span className="eyebrow">Web · 浏览器</span><strong>输入与展示</strong><code>src/web/</code></div>
      <span className="runtime-arrow" aria-hidden="true">⇄</span>
      <div><span className="eyebrow">服务端 · Node.js</span><strong>HTTP 与协议接入</strong><code>src/server/</code></div>
      <span className="runtime-arrow" aria-hidden="true">⇄</span>
      <div><span className="eyebrow">Agent · Node.js</span><strong>模型与工具编排</strong><code>src/agent/</code></div>
    </div>
    <div className="runtime-identities"><h3>沿着一次查单阅读源码</h3><ol>
      {steps.map(([title, file, description]) => <li key={file}>
        <h4>{title}</h4><SourceLink source={{ file }} /><p>{description}</p>
      </li>)}
    </ol><p>服务端与 Agent 运行在同一个 Node.js 进程中。这里的分层表示代码职责；外部模型 API 才是独立的模型服务。当前没有配置长期记忆或持久化会话。</p></div>
  </section>;
}
