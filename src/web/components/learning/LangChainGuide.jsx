/**
 * LangChain 概念导读：本地选择概念，并列展示说明、精简示例和官方资料链接。
 * 示例只用于阅读，不在浏览器创建 LangChain Agent。
 */
import React, { useState } from 'react';
import { Code } from './Code.jsx';
import { langchainConcepts } from '../../content/learning-content.js';

export function LangChainGuide() {
  const [selected, setSelected] = useState(0);
  const concept = langchainConcepts[selected];
  const entryPoints = [
    ['copilotkit.runAgent({ agent })', '浏览器 · CopilotKit', '把本轮消息发给后端，接收执行事件并更新界面。'],
    ['agent.invoke({ messages })', 'Node · LangChain Agent', '执行模型与工具循环，返回包含 messages 的状态；可能多次请求模型。'],
    ['chatModel.invoke(messages)', 'Node · 模型适配器', '取得一次模型回复 AIMessage；即使回复要求调用工具，也不会替你执行工具。当前由 Agent 调用模型。'],
  ];
  return <section className="langchain-guide" aria-label="LangChain 核心概念">
    <div className="langchain-map" aria-label="LangChain 组成关系">
      <div className="langchain-inputs"><span>Model 模型</span><span>Tools 工具</span><span>Prompt 指令</span><span>Middleware 控制</span></div>
      <div className="langchain-assembly"><code>createAgent</code><span>组装</span><b aria-hidden="true">→</b><code>agent.invoke</code><span>运行</span></div>
      <p>模型回复 <span>→</span> 有工具请求：执行 Tool <span>→</span> 补入 ToolMessage <span>↺</span> 再问模型</p>
      <small>没有新的工具请求时，返回结果状态；本项目再从 messages 取最终回答。</small>
    </div>
    <div className="concept-heading"><h3>点击概念，对照代码理解</h3><span>前七项是主线，后两项帮助理解扩展</span></div>
    <div className="concept-buttons" aria-label="LangChain 概念选择">{langchainConcepts.map((item, index) => <button key={item.name} aria-pressed={selected === index} aria-controls="langchain-concept-panel" onClick={() => setSelected(index)}>{item.name}</button>)}</div>
    <div id="langchain-concept-panel" className="concept-panel" aria-live="polite"><div><span className="actor">{concept.place}</span><h4>{concept.title}</h4><p>{concept.description}</p><small>{concept.source}</small><a className="concept-doc" href={concept.doc} target="_blank" rel="noreferrer">阅读官方说明 ↗</a></div><Code value={concept.code} /></div>
    <section className="runtime-identities"><h3>三个入口，分别在运行什么？</h3><div className="learning-table-wrap"><table><thead><tr><th>入口</th><th>所在层</th><th>负责什么</th></tr></thead><tbody>{entryPoints.map(([name, layer, meaning]) => <tr key={name}><td><code>{name}</code></td><td>{layer}</td><td>{meaning}</td></tr>)}</tbody></table></div><p>本项目常见的订单查询：用户提交 1 次 → Agent 运行 1 轮 → 模型请求 2 次 → getOrder 执行 1 次。实际次数由运行过程决定，不是 invoke 固定规定的。</p></section>
    <details className="runtime-details"><summary>State、Context、Memory，为什么不能混为一谈？</summary><ol><li><b>State：这一轮在处理什么</b><p>运行中的 messages 等数据，随着模型和工具执行而更新。我们目前没有增加自定义业务状态字段。</p></li><li><b>Context：运行时传入的依赖</b><p>例如服务端确认的用户身份、数据库连接配置，可通过运行时 context 给工具或中间件使用。它与“发送给模型的上下文”不是一回事，不会仅因放入 context 就自动变成提示词。本项目没有配置 contextSchema。</p></li><li><b>Memory：下一轮还能记住什么</b><p>短期记忆通常按会话保存状态，需要 checkpointer 和会话标识；长期记忆可使用 Store 跨会话读写。当前只是手动转发部分历史，没有接入这些存储能力。</p></li></ol><p><a href="https://docs.langchain.com/oss/javascript/langchain/runtime" target="_blank" rel="noreferrer">运行时上下文官方说明 ↗</a> · Key 与权限数据应留在后端，只有任务需要的信息才进入模型消息。</p></details>
    <details className="runtime-details"><summary>LangChain、LangGraph、LangSmith 怎么分工？</summary><ol><li><b>LangChain：快速组装 Agent</b><p>本项目直接使用 createAgent、tool 和 createMiddleware。</p></li><li><b>LangGraph：更底层的状态图编排</b><p>当前 createAgent 底层基于 LangGraph。新增的 LangGraph 教程展示显式 StateGraph；两版目前都没有实现持久化或人工审批恢复。</p></li><li><b>LangSmith：观察和评估运行</b><p>用于追踪调用、调试和评估，需要另行配置。本项目显示的 Token 与调用记录来自自己的 transport 和 TracePanel，没有接入 LangSmith 追踪。</p></li></ol><p><a href="https://docs.langchain.com/oss/javascript/langchain/overview" target="_blank" rel="noreferrer">官方框架关系说明 ↗</a> · 本教程对照仓库中的 LangChain JS 1.5.12。旧教程中的 LLMChain、AgentExecutor 与这里的 createAgent API 不同，复制示例前先核对版本。</p></details>
    <details className="runtime-details"><summary>RAG、Embedding、Retriever，现在需要学吗？</summary><p>当问题需要查询大量文档时，再了解这些概念：Embedding 把文本转成向量，Vector Store 支持存储与相似检索，Retriever 按问题找相关片段，RAG 把检索内容提供给模型作答。检索也可以使用关键词或其他方式。</p><p>当前订单助手按 orderId 精确调用业务函数，没有向量库或 RAG 流程。先掌握 Model → Tool → Agent 的主线，再根据知识库需求扩展。<a href="https://docs.langchain.com/oss/javascript/langchain/retrieval" target="_blank" rel="noreferrer">检索官方说明 ↗</a></p></details>
  </section>;
}
