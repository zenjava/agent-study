/**
 * LangGraph 教学动画：用固定消息快照说明节点、条件边和状态追加。
 * 直接查询虚构订单填充示例，不运行真实图或模型；步数统计仅描述脚本场景。
 */
import scenarioOptions from '../../content/demo/scenario-options.demo.json';
import React, { useState } from 'react';
import { graphSteps } from '../../content/demo/graph-scenarios.demo.js';

// 固定脚本展示图的状态变化，不调用模型，也不冒充真实图的执行记录。
export function GraphWalkthrough() {
  const [scenario, setScenario] = useState('found');
  const [index, setIndex] = useState(0);
  const steps = graphSteps(scenario);
  const step = steps[index];
  return <section className="graph-walkthrough" aria-label="LangGraph 逐步演示">
    <div className="lab-top"><div><span className="eyebrow">FOLLOW THE GRAPH</span><h3>点一步，看一次状态更新。</h3></div><span className="lab-label">固定脚本 · 0 API Token</span></div>
    <div className="scenarios" aria-label="图演示场景">{scenarioOptions.map(([id, label]) => <button key={id} aria-pressed={scenario === id} onClick={() => { setScenario(id); setIndex(0); }}>{label}</button>)}</div>
    <div className="graph-topology" aria-label="图的连接关系"><span className={step.node === 'START' ? 'active' : ''}>START</span><b>→</b><span className={step.node === 'model' ? 'active' : ''}>model</span><b>⇄</b><span className={step.node === 'tools' ? 'active' : ''}>tools</span><p className={step.node === 'route' ? 'active-route' : ''}>model 后由条件边分流：有工具调用 → tools；没有 → <strong className={step.node === 'END' ? 'active-end' : ''}>END</strong></p></div>
    <div className="graph-step-buttons" aria-label="图运行步骤">{steps.map((item, i) => <button key={`${scenario}-${i}`} aria-current={index === i ? 'step' : undefined} onClick={() => setIndex(i)}><small>{String(i + 1).padStart(2, '0')}</small>{item.label}</button>)}</div>
    <div className="graph-step-detail" aria-live="polite"><div><span className="actor">当前：{step.node}</span><h4>{step.label}</h4><p>{step.desc}</p><div className="graph-counts"><span><b>{step.messages.length}</b>条状态消息</span><span><b>{step.requests}</b>次模拟模型请求</span><span><b>{step.tools}</b>次模拟工具执行</span></div><div className="lab-controls"><button className="quiet-button" disabled={index === 0} onClick={() => setIndex(index - 1)}>← 上一步</button><button className="primary-button" onClick={() => setIndex(index === steps.length - 1 ? 0 : index + 1)}>{index === steps.length - 1 ? '重新演示 ↺' : '下一步 →'}</button></div></div><div><div className="code-caption"><span>state.messages · 教学节选</span></div><pre className="graph-state-code"><code>{JSON.stringify({ messages: step.messages }, null, 2)}</code></pre></div></div>
    <p className="lab-note">订单来自项目的虚构数据；模型回复与分支由固定脚本演示。只展示部分订单字段，系统消息在模型节点中加入请求，不计入这里的状态消息数。</p>
  </section>;
}
