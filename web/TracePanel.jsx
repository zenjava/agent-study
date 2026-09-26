import React from 'react';

const fields = ['prompt_tokens', 'completion_tokens', 'total_tokens'];
const valid = (value) => Number.isSafeInteger(value) && value >= 0;
export const number = (value) => valid(value) ? value.toLocaleString('zh-CN') : '—';

export function requestUsages(events) {
  return events.filter((event) => event.type === 'request').map((event) => {
    const response = events.find((item) => item.runId === event.runId && item.step === event.step && item.type === 'usage');
    return { ...event, usage: response?.data ?? null };
  });
}

export function TracePanel({ events, mode, running }) {
  const requests = requestUsages(events);
  const totals = Object.fromEntries(fields.map((key) => {
    const values = requests.map((request) => request.usage?.[key]).filter(valid);
    return [key, values.length ? values.reduce((sum, value) => sum + value, 0) : null];
  }));
  const complete = requests.filter((request) => fields.every((key) => valid(request.usage?.[key]))).length;
  const runIds = [...new Set(events.filter((event) => event.type === 'start').map((event) => event.runId))];
  const labels = { request: '请求模型', tool_call: '请求查单', tool_result: '查询结果', tool_return: '回传模型', answer: '生成回答', error: '运行失败' };
  const traces = events.filter((event) => labels[event.type]);
  return <details className="trace-disclosure">
    <summary className="trace-summary"><span><span className="trace-symbol" aria-hidden="true">⌁</span>Token <b>{mode === 'demo' ? '0' : number(totals.total_tokens)}</b><span className="trace-summary-note">{mode === 'demo' ? '本地演示' : `${requests.length} 次模型请求`}</span></span><span className="trace-toggle"><span className="trace-closed-label">查看调用详情</span><span className="trace-open-label">收起调用详情</span><span className="trace-chevron" aria-hidden="true">⌄</span></span></summary>
    <aside className="trace-panel" aria-label="调用与 Token 用量">
    <div className="panel-eyebrow">OBSERVABILITY</div><h2>每一步，都看得见</h2><p className="panel-caption">调用过程与本次会话用量</p>
    <div className="token-summary"><span>会话 Token 总量</span><strong>{mode === 'demo' ? '0' : number(totals.total_tokens)}</strong><div className="token-split"><span>输入 <b>{mode === 'demo' ? '0' : number(totals.prompt_tokens)}</b></span><span>输出 <b>{mode === 'demo' ? '0' : number(totals.completion_tokens)}</b></span></div><small>{mode === 'demo' ? '本地演示 · 不调用模型、不消耗 Token' : requests.length ? `${complete} / ${requests.length} 次请求用量完整，仅汇总已知值` : '发送问题后，显示接口报告的实际用量'}</small></div>
    <div className="run-stats"><div><b>{runIds.length}</b><span>对话轮次</span></div><div><b>{requests.length}</b><span>模型请求</span></div><div><b>{events.filter((e) => e.type === 'tool_call').length}</b><span>工具调用</span></div></div>
    <div className="trace-heading"><h3>执行记录</h3><span className={running ? 'is-running' : ''}>{running ? '运行中' : traces.length ? '已结束' : '等待提问'}</span></div>
    {!traces.length && <div className="trace-empty"><span>⌁</span><p>发送一个问题<br />这里会逐步展开调用过程</p><div>理解问题 → 查询订单 → 展示结果</div></div>}
    <div className="trace-events">{traces.map((event, index) => {
      const request = event.type === 'request' ? requests.find((item) => item.runId === event.runId && item.step === event.step) : null;
      return <details className={`trace-event ${event.type}`} key={`${event.runId}-${index}`}><summary><span className="trace-event-dot"/><div><strong>{labels[event.type]}{event.type === 'tool_call' ? ` · ${event.data.function?.name}` : ''}</strong><small>第 {runIds.indexOf(event.runId) + 1} 轮{event.type === 'request' ? ` · 第 ${event.step} 次模型请求` : ''}</small>{request && <small className="request-inline">输入 {number(request.usage?.prompt_tokens)} · 输出 {number(request.usage?.completion_tokens)} · 合计 {number(request.usage?.total_tokens)}</small>}</div><span className="trace-chevron">⌄</span></summary>{request && <div className="request-tokens"><span>输入 <b>{number(request.usage?.prompt_tokens)}</b></span><span>输出 <b>{number(request.usage?.completion_tokens)}</b></span><span>合计 <b>{number(request.usage?.total_tokens)}</b></span><small>{request.usage ? '接口返回值' : running ? '等待用量' : '未获取用量'}</small></div>}<pre>{JSON.stringify(request ? { request: event.data, usage: request.usage } : event.data, null, 2)}</pre></details>;
    })}</div>
    <p className="trace-footnote">一次查单通常包含 2 次模型请求、1 次工具调用。订单卡片直接使用工具结果。</p>
  </aside></details>;
}
