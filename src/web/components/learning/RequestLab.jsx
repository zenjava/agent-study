/**
 * 请求流程实验室：在固定教学场景中选择步骤，展示消息报文与模拟调用次数。
 * 场景数据来自 content；改变场景时重置步骤，避免沿用旧场景的索引。
 */
import scenarioOptions from '../../content/demo/scenario-options.demo.json';
import React, { useState } from 'react';
import { Code } from './Code.jsx';
import { scenarioSteps } from '../../content/demo/request-scenarios.demo.js';

/**
 * 将演示报文格式化为缩进两格的 JSON，供页面阅读。
 * @param {*} value 可序列化的演示数据。
 * @returns {string} 格式化后的 JSON 文本。
 */
const json = (value) => JSON.stringify(value, null, 2);
/**
 * 将章节或步骤编号补齐为至少两位。
 * @param {number|string} value 待展示的编号。
 * @returns {string} 左侧补零后的编号。
 */
const pad = (value) => String(value).padStart(2, '0');

/**
 * 展示固定场景的模型请求和工具回传报文，支持逐步切换。
 * @returns {React.ReactElement} 当前组件的渲染结果。
 */
export function RequestLab() {
  const [scenario, setScenario] = useState('found');
  const [step, setStep] = useState(0);
  const steps = scenarioSteps(scenario);
  const current = steps[step];
  return <section className="request-lab" aria-label="请求流程实验室">
    <div className="lab-top"><div><span className="eyebrow">REQUEST LAB</span><h3>让一次请求，慢下来。</h3></div><span className="lab-label">本地脚本 · 0 API Token</span></div>
    <div className="scenarios" aria-label="选择演示场景">{scenarioOptions.map(/** 渲染请求实验室的可选场景。 */ ([id, label]) => <button key={id} aria-pressed={scenario === id} onClick={/** 切换演示场景并回到第一步请求。 */ () => { setScenario(id); setStep(0); }}>{label}</button>)}</div>
    <div className="lab-steps" aria-label="请求步骤">{steps.map(/** 渲染协议演示的步骤导航按钮。 */ (item, i) => <button className={step === i ? 'active' : step > i ? 'past' : ''} key={item.label} aria-current={step === i ? 'step' : undefined} onClick={/** 定位到选中的协议步骤。 */ () => setStep(i)}><span>{pad(i + 1)}</span>{item.label}</button>)}</div>
    <div className="lab-body"><div className="lab-explanation" aria-live="polite"><span className="actor">{current.actor}</span><h4>{current.title}</h4><p>{current.desc}</p><div className="lab-counts"><div><strong>{current.requests}</strong><span>模拟模型请求</span></div><div><strong>{current.executions}</strong><span>模拟工具执行</span></div></div>{current.answer && <div className="answer-preview"><small>示例最终回答</small><p>{current.answer.replaceAll('**', '')}</p></div>}<div className="lab-controls"><button className="quiet-button" disabled={step === 0} onClick={/** 回到上一个协议步骤。 */ () => setStep(step - 1)}>← 上一步</button><button className="primary-button" onClick={/** 进入下一协议步骤，结束后从头回放。 */ () => setStep(step === steps.length - 1 ? 0 : step + 1)}>{step === steps.length - 1 ? '重新演示 ↺' : '下一步 →'}</button></div></div><div className="lab-payload"><div className="code-caption"><span>教学报文 · JSON</span><span>{pad(step + 1)} / {pad(steps.length)}</span></div><Code value={json(current.payload)} /></div></div>
    <p className="lab-note">固定脚本用于解释流程，不代表模型必然这样回答。系统提示词、Schema 和订单字段有节选；协议细节以实验台的真实请求记录为准。</p>
  </section>;
}
