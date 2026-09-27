/**
 * 原生循环回放界面：消费 hook 收集的实际事件，选择场景并逐步查看当时的报文。
 * 计数只统计已经回放到的事件；模型响应来自脚本，工具执行使用真实业务函数。
 */
import React from 'react';
import { Code } from './Code.jsx';
import { scenarios, names } from '../../content/demo/native-scenarios.demo.js';
import { useNativeDemo } from '../../state/learning/useNativeDemo.js';

/**
 * 运行离线原生循环并逐步展示实际事件、消息与工具调用次数。
 * @returns {React.ReactElement} 当前组件的渲染结果。
 */
export function NativeWalkthrough() {
  const { scenario, setScenario, events, index, setIndex, error, event, seen } = useNativeDemo();
  return <section className="graph-walkthrough" aria-label="原生 Agent 事件回放">
    <div className="lab-top"><div><span className="eyebrow">RUN THE NATIVE LOOP</span><h3>实际执行，再逐步读事件。</h3></div><span className="lab-label">脚本模型 · 0 API Token</span></div>
    <div className="scenarios" aria-label="原生演示场景">{scenarios.map(/** 渲染原生循环的可选演示场景。 */ ([id, title]) => <button key={id} aria-pressed={scenario === id} onClick={/** 回到第一步并切换原生演示场景。 */ () => { setIndex(0); setScenario(id); }}>{title}</button>)}</div>
    {error && <p role="alert">{error}</p>}
    {event ? <>
      <div className="graph-step-buttons" aria-label="原生运行事件">{events.map(/** 为实际捕获的原生事件渲染步骤按钮。 */ (item, i) => <button key={i} aria-current={index === i ? 'step' : undefined} onClick={/** 定位到所选原生执行事件。 */ () => setIndex(i)}><small>{String(i + 1).padStart(2, '0')}</small>{names[item.type]}</button>)}</div>
      <div className="graph-step-detail" aria-live="polite"><div><span className="actor">第 {event.step} 次循环</span><h4>{names[event.type]}</h4><p>这是 native/agent.mjs 本次运行产生的事件快照。请求中的 messages 展示当时模型可以看见的上下文。</p><div className="graph-counts"><span><b>{seen.filter(/** 筛选已经回放的模拟模型请求。 */ (e) => e.type === 'request').length}</b>次模拟模型请求</span><span><b>{seen.filter(/** 筛选已经回放的工具查询结果。 */ (e) => e.type === 'tool_result').length}</b>次实际工具执行</span></div><div className="lab-controls"><button className="quiet-button" disabled={index === 0} onClick={/** 回到上一个原生执行事件。 */ () => setIndex(index - 1)}>← 上一步</button><button className="primary-button" onClick={/** 进入下一事件，最后一个事件之后从头回放。 */ () => setIndex(index === events.length - 1 ? 0 : index + 1)}>{index === events.length - 1 ? '从头回放 ↺' : '下一步 →'}</button></div></div><div><div className="code-caption"><span>{event.type} · 本次运行快照</span></div><Code value={JSON.stringify(event.data, null, 2)} /></div></div>
    </> : !error && <p role="status">正在运行原生循环…</p>}
    <p className="lab-note">只有模型响应由脚本模拟；参数校验、消息追加、订单查询和循环执行都使用实际 Agent 代码。本页不访问外部网络。</p>
  </section>;
}
