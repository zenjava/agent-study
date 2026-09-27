/**
 * Copilot Runtime 概念导读：说明前端代理、服务端 Agent、标识符和事件流之间的关系。
 * 当前选中的概念只影响说明区域，不会发起 Agent 运行。
 */
import React, { useState } from 'react';
import { Code } from './Code.jsx';
import { runtimeConcepts } from '../../content/runtime-learning-content.js';

/**
 * 展示 CopilotKit 各层职责、运行标识及可切换的基础概念。
 * @returns {React.ReactElement} 当前组件的渲染结果。
 */
export function RuntimeGuide() {
  const [selected, setSelected] = useState(0);
  const concept = runtimeConcepts[selected];
  const ids = [
    ['agentId', 'orders', '选择 Runtime 注册的哪一个后端 Agent'],
    ['工具 name', 'getOrder', '选择业务函数；前端用同名注册卡片'],
    ['threadId', 'chat_1', '标识一次会话，其中可以包含多轮提问'],
    ['runId', 'run_1', '标识一次运行；通常对应一次用户提交'],
    ['tool_call_id', 'call_1', '模型工具调用与 ToolMessage 的关联 ID'],
    ['toolCallId', 'run_1:call_1', '本项目发给前端的工具调用 ID，附加 runId 避免冲突'],
  ];
  return <section className="runtime-guide" aria-label="Copilot Runtime 基础概念">
    <div className="runtime-map"><div><span className="eyebrow">浏览器</span><strong>Provider + 前端 Agent</strong><code>copilotkit.runAgent()</code></div><span className="runtime-arrow" aria-hidden="true">⇄</span><div><span className="eyebrow">你的 Node 服务</span><strong>Runtime → OrderAgent</strong><code>→ 选中的问答实现</code></div><span className="runtime-arrow" aria-hidden="true">⇄</span><div><span className="eyebrow">模型服务 / 本地演示</span><strong>选择工具 · 生成回答</strong><code>业务工具仍在 Node 执行</code></div></div>
    <div className="concept-heading"><h3>先认识这七个名称</h3><span>点击一个概念，看它的位置和代码</span></div>
    <div className="concept-buttons" aria-label="基础概念选择">{runtimeConcepts.map(/** 渲染可切换的 Runtime 基础概念。 */ (item, index) => <button key={item.name} aria-pressed={selected === index} onClick={/** 选择当前 Runtime 概念说明。 */ () => setSelected(index)}>{item.name}</button>)}</div>
    <div className="concept-panel" aria-live="polite"><div><span className="actor">{concept.place}</span><h4>{concept.title}</h4><p>{concept.description}</p><small>{concept.source}</small></div><Code value={concept.code} /></div>
    <section className="runtime-identities"><h3>名称和 ID，各管一件事</h3><div className="learning-table-wrap"><table><thead><tr><th>字段</th><th>示例值</th><th>解决什么问题</th></tr></thead><tbody>{ids.map(/** 渲染一个运行标识的示例值与用途。 */ ([name, sample, meaning]) => <tr key={name}><td><code>{name}</code></td><td><code>{sample}</code></td><td>{meaning}</td></tr>)}</tbody></table></div><p>前端 Agent、后端 OrderAgent 与选中的问答实现是不同层次的对象。一次运行只进入对应的实现，并不会因此多出几个大模型。</p></section>
    <details className="runtime-details"><summary>一次请求实际经过哪些接口？</summary><ol><li><code>GET /api/copilotkit/info</code><p>页面连接时发现可用 Agent 和运行协议，不查询订单。Provider 据此建立前端代理。</p></li><li><code>POST /api/copilotkit/agent/orders/run</code><p>提交 messages、threadId、runId 等上下文。Runtime 按 orders 找到后端 Agent，执行后以事件流响应。</p></li><li><code>POST /api/copilotkit/agent/orders/stop/:threadId</code><p>用户点停止时使用；后端 OrderAgent.abortRun 将取消信号继续传给模型请求。</p></li></ol><p>以上是本项目当前 v2 handler 的主要路由。runAgent 替你处理请求与事件订阅，页面不需要自己手写这套 fetch 循环。</p></details>
    <details className="runtime-details"><summary>返回的事件怎样变成界面？</summary><ol><li><code>RUN_STARTED</code><p>标识运行开始，界面进入运行状态。</p></li><li><code>TOOL_CALL_START → ARGS → END</code><p>携带 getOrder、调用 ID 和参数。这里的 END 表示工具调用参数结束，不表示订单已查完。</p></li><li><code>TOOL_CALL_RESULT</code><p>带回订单 JSON，按 toolCallId 关联调用，交给 useRenderTool 注册的 OrderCard。</p></li><li><code>TEXT_MESSAGE_START → CONTENT → END</code><p>传递模型回答，交给 Markdown 渲染。当前模型不逐 Token 流式输出，所以 CONTENT 是完整回答。</p></li><li><code>RUN_FINISHED / RUN_ERROR</code><p>成功结束或报告失败。CUSTOM/harness 事件同时提供请求详情与 Token 用量。</p></li></ol></details>
    <p className="runtime-references">概念参考：<a href="https://docs.copilotkit.ai/langgraph-python/copilot-runtime" target="_blank" rel="noreferrer">Copilot Runtime 官方文档 ↗</a><a href="https://docs.copilotkit.ai/langgraph-python/ag-ui" target="_blank" rel="noreferrer">AG-UI 官方说明 ↗</a>。下方示例以本仓库实际安装的 v2 API 为准。</p>
  </section>;
}
