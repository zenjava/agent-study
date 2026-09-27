/**
 * LangChain 概念导读：本地选择概念，并列展示说明、精简示例和官方资料链接。
 * 示例只用于阅读，不在浏览器创建 LangChain Agent。
 */
import React, { useState } from 'react';
import { Code } from './Code.jsx';
import { langchainConcepts } from '../../content/learning-content.js';

/**
 * 展示可切换的 LangChain 概念说明、示例及入口分工。
 * @returns {React.ReactElement} 当前组件的渲染结果。
 */
export function LangChainGuide() {
  const [selected, setSelected] = useState(0);
  const concept = langchainConcepts[selected];
  const entryPoints = [
    ['copilotkit.runAgent({ agent })', '浏览器 · CopilotKit', '把本轮消息发给后端，接收执行事件并更新界面。'],
    ['chain.invoke({ messages })', 'Node · LangChain Runnable', '发送一次模型请求并取得 AIMessage；本地循环随后决定是否执行工具或继续。'],
    ['orderTool.invoke(call)', 'Node · LangChain Tool', '校验通过后执行 getOrder，返回带相同调用 ID 的 ToolMessage。'],
  ];
  return <section className="langchain-guide" aria-label="LangChain 核心概念">
    <div className="langchain-map" aria-label="LangChain 组成关系">
      <div className="langchain-inputs"><span>Model 模型</span><span>Tools 工具</span><span>Prompt 指令</span><span>本地循环控制</span></div>
      <div className="langchain-assembly"><code>prompt.pipe(modelWithTools)</code><span>组装</span><b aria-hidden="true">→</b><code>chain.invoke</code><span>一次模型请求</span></div>
      <p>模型回复 <span>→</span> 有工具请求：执行 Tool <span>→</span> 补入 ToolMessage <span>↺</span> 再问模型</p>
      <small>没有新的工具请求时，本地循环读取 AIMessage 的最终文字并返回。</small>
    </div>
    <div className="concept-heading"><h3>点击概念，对照代码理解</h3><span>当前路线使用 Runnable 和本地工具循环</span></div>
    <div className="concept-buttons" aria-label="LangChain 概念选择">{langchainConcepts.map(/** 渲染可切换的 LangChain 概念标签。 */ (item, index) => <button key={item.name} aria-pressed={selected === index} aria-controls="langchain-concept-panel" onClick={/** 选择当前概念说明。 */ () => setSelected(index)}>{item.name}</button>)}</div>
    <div id="langchain-concept-panel" className="concept-panel" aria-live="polite"><div><span className="actor">{concept.place}</span><h4>{concept.title}</h4><p>{concept.description}</p><small>{concept.source}</small><a className="concept-doc" href={concept.doc} target="_blank" rel="noreferrer">阅读官方说明 ↗</a></div><Code value={concept.code} /></div>
    <section className="runtime-identities"><h3>三个入口，分别在运行什么？</h3><div className="learning-table-wrap"><table><thead><tr><th>入口</th><th>所在层</th><th>负责什么</th></tr></thead><tbody>{entryPoints.map(/** 渲染一个框架入口、所属层及其职责。 */ ([name, layer, meaning]) => <tr key={name}><td><code>{name}</code></td><td>{layer}</td><td>{meaning}</td></tr>)}</tbody></table></div><p>常见查单：用户提交 1 次 → 本地循环执行 1 轮 → 模型请求 2 次 → getOrder 执行 1 次。实际次数由模型输出和请求上限决定。</p></section>
    <details className="runtime-details"><summary>State、Context、Memory，为什么不能混为一谈？</summary><ol><li><b>State：这一轮在处理什么</b><p>LangChain 版用 messages 数组保存本轮消息；LangGraph 版用 StateSchema 和 reducer。两版都没有自定义业务状态字段。</p></li><li><b>Context：运行时传入的依赖</b><p>模型 Key 等配置保留在后端；只有任务需要的信息才进入模型消息。本项目没有配置 contextSchema。</p></li><li><b>Memory：下一轮还能记住什么</b><p>当前只由页面传递部分历史，没有接入 checkpointer 或长期记忆存储。</p></li></ol></details>
    <details className="runtime-details"><summary>LangChain、LangGraph、LangSmith 怎么分工？</summary><ol><li><b>LangChain：模型与 Runnable 组件</b><p>本项目使用 ChatOpenAI、ChatPromptTemplate、Tool 和消息组件，用本地循环编排。</p></li><li><b>LangGraph：显式状态图</b><p>另一实现使用 StateGraph、节点、reducer 和条件边。两版共用模型配置与业务工具。</p></li><li><b>LangSmith：观察和评估运行</b><p>本项目显示的 Token 与调用记录来自自己的 transport 和 TracePanel，未接入 LangSmith。</p></li></ol><p><a href="https://docs.langchain.com/oss/javascript/langchain/overview" target="_blank" rel="noreferrer">官方框架说明 ↗</a> · 本教程以仓库当前锁定的依赖和源码为准。</p></details>
    <details className="runtime-details"><summary>RAG、Embedding、Retriever，现在需要学吗？</summary><p>当问题需要查询大量文档时，再了解这些概念：Embedding 把文本转成向量，Vector Store 支持存储与相似检索，Retriever 按问题找相关片段，RAG 把检索内容提供给模型作答。检索也可以使用关键词或其他方式。</p><p>当前订单助手按 orderId 精确调用业务函数，没有向量库或 RAG 流程。先掌握 Model → Tool → Agent 的主线，再根据知识库需求扩展。<a href="https://docs.langchain.com/oss/javascript/langchain/retrieval" target="_blank" rel="noreferrer">检索官方说明 ↗</a></p></details>
  </section>;
}
