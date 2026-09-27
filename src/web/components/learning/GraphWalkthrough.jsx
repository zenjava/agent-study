/**
 * LangGraph 教学动画：用固定消息快照说明节点、条件边和状态追加。
 * 直接查询虚构订单填充示例，不运行真实图或模型；步数统计仅描述脚本场景。
 */
import React, { useState } from 'react';
import { getOrder } from '../../../agent/tools/get-order.mjs';

// 固定脚本展示图的状态变化，不调用模型，也不冒充真实图的执行记录。
export function GraphWalkthrough() {
  const [scenario, setScenario] = useState('found');
  const [index, setIndex] = useState(0);
  const missing = scenario === 'missing';
  const orderId = scenario === 'absent' ? 'A9999' : 'A1001';
  const order = getOrder({ orderId });
  const question = missing ? '请查一下订单进度。' : `${orderId} 谁在审批？`;
  const answer = missing ? '请提供订单号。' : order.found ? `${orderId} 正在等待${order.order.currentApprover}审批。` : `没有找到 ${orderId}。`;
  const result = order.found ? { found: true, order: { orderId, status: order.order.status, currentApprover: order.order.currentApprover } } : order;
  const user = { role: 'user', content: question };
  const aiCall = { role: 'assistant', tool_calls: [{ id: 'call_graph_1', name: 'getOrder', args: { orderId } }] };
  const tool = { role: 'tool', tool_call_id: 'call_graph_1', content: JSON.stringify(result) };
  const final = { role: 'assistant', content: answer };
  // 缺少订单号时跳过工具节点；其余场景依次展示请求工具、回传结果和再次生成回答。
  const steps = [
    { label: 'START', node: 'START', desc: 'invoke 传入初始状态。当前只有用户问题，尚未请求模型。', messages: [user], requests: 0, tools: 0 },
    { label: '模型节点', node: 'model', desc: missing ? '模型没有足够信息，直接生成追问；不要求调用工具。' : '模型读入问题与工具说明，返回 getOrder 调用请求。', messages: [user, missing ? final : aiCall], requests: 1, tools: 0 },
    { label: '条件分支', node: 'route', desc: missing ? '没有 tool_calls，routeAfterModel 返回 END。' : '存在 tool_calls，routeAfterModel 返回 tools；这个判断不请求模型。', messages: [user, missing ? final : aiCall], requests: 1, tools: 0 },
    ...missing ? [] : [
      { label: '工具节点', node: 'tools', desc: '校验参数后查询一次订单，返回 ToolMessage。reducer 把新消息加入状态。', messages: [user, aiCall, tool], requests: 1, tools: 1 },
      { label: '再问模型', node: 'model', desc: '沿 tools → model 返回；模型读到查询结果，生成最终文字。这里没有再查订单。', messages: [user, aiCall, tool, final], requests: 2, tools: 1 },
    ],
    { label: 'END', node: 'END', desc: '最后的模型消息没有新的 tool_calls，图结束，调用方从 result.messages 读取回答。', messages: missing ? [user, final] : [user, aiCall, tool, final], requests: missing ? 1 : 2, tools: missing ? 0 : 1 },
  ];
  const step = steps[index];
  return <section className="graph-walkthrough" aria-label="LangGraph 逐步演示">
    <div className="lab-top"><div><span className="eyebrow">FOLLOW THE GRAPH</span><h3>点一步，看一次状态更新。</h3></div><span className="lab-label">固定脚本 · 0 API Token</span></div>
    <div className="scenarios" aria-label="图演示场景">{[['found', '查到订单'], ['absent', '订单不存在'], ['missing', '缺少订单号']].map(([id, label]) => <button key={id} aria-pressed={scenario === id} onClick={() => { setScenario(id); setIndex(0); }}>{label}</button>)}</div>
    <div className="graph-topology" aria-label="图的连接关系"><span className={step.node === 'START' ? 'active' : ''}>START</span><b>→</b><span className={step.node === 'model' ? 'active' : ''}>model</span><b>⇄</b><span className={step.node === 'tools' ? 'active' : ''}>tools</span><p className={step.node === 'route' ? 'active-route' : ''}>model 后由条件边分流：有工具调用 → tools；没有 → <strong className={step.node === 'END' ? 'active-end' : ''}>END</strong></p></div>
    <div className="graph-step-buttons" aria-label="图运行步骤">{steps.map((item, i) => <button key={`${scenario}-${i}`} aria-current={index === i ? 'step' : undefined} onClick={() => setIndex(i)}><small>{String(i + 1).padStart(2, '0')}</small>{item.label}</button>)}</div>
    <div className="graph-step-detail" aria-live="polite"><div><span className="actor">当前：{step.node}</span><h4>{step.label}</h4><p>{step.desc}</p><div className="graph-counts"><span><b>{step.messages.length}</b>条状态消息</span><span><b>{step.requests}</b>次模拟模型请求</span><span><b>{step.tools}</b>次模拟工具执行</span></div><div className="lab-controls"><button className="quiet-button" disabled={index === 0} onClick={() => setIndex(index - 1)}>← 上一步</button><button className="primary-button" onClick={() => setIndex(index === steps.length - 1 ? 0 : index + 1)}>{index === steps.length - 1 ? '重新演示 ↺' : '下一步 →'}</button></div></div><div><div className="code-caption"><span>state.messages · 教学节选</span></div><pre className="graph-state-code"><code>{JSON.stringify({ messages: step.messages }, null, 2)}</code></pre></div></div>
    <p className="lab-note">订单来自项目的虚构数据；模型回复与分支由固定脚本演示。只展示部分订单字段，系统消息在模型节点中加入请求，不计入这里的状态消息数。</p>
  </section>;
}
