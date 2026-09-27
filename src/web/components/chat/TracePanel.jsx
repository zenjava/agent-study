/**
 * 会话观察面板：按运行与请求关联事件，汇总已知 Token 用量并展示原始报文。
 * 演示用量与真实供应商用量分开说明，缺失 usage 不按零消耗处理。
 */
import React from 'react';

const fields = ['prompt_tokens', 'completion_tokens', 'total_tokens'];
/**
 * 判断 Token 用量是否为非负安全整数，缺失或非法值均视为未知。
 * @param {*} value 供应商报告的用量。
 * @returns {boolean} 用量是否可以参与展示和汇总。
 */
const valid = (value) => Number.isSafeInteger(value) && value >= 0;
/**
 * 格式化已知 Token 用量，无法确认的用量以破折号展示。
 * @param {*} value 待展示的用量。
 * @returns {string} 本地化整数文本或未知占位符。
 */
export const number = (value) => valid(value) ? value.toLocaleString('zh-CN') : '—';

/**
 * 按 runId 与 step 将请求和用量事件配对，避免跨轮次关联同序号请求。
 * @param {Array<object>} events 会话内累计的领域事件。
 * @returns {Array<object>} 附有 usage 的请求事件；未获取用量时 usage 为 null。
 */
export function requestUsages(events) {
  return events.filter(/** 筛选模型请求事件。 */ (event) => event.type === 'request').map(/** 为当前请求补充同轮次、同序号的原始用量。 */ (event) => {
    const response = events.find(/** 匹配当前请求对应的用量事件。 */ (item) => item.runId === event.runId && item.step === event.step && item.type === 'usage');
    return { ...event, usage: response?.data ?? null };
  });
}

/**
 * 汇总当前会话的已知用量，并按轮次展示原始请求、工具结果和图事件。
 * @param {object} props 组件输入。
 * @param {Array<object>} props.events 当前会话或回放的执行事件。
 * @param {string} props.mode demo 或 live。
 * @param {string} [props.framework="LangChain"] 当前 Agent 实现的展示名称。
 * @param {boolean} props.running 当前会话是否仍在运行。
 * @returns {React.ReactElement} 当前组件的渲染结果。
 */
export function TracePanel({ events, mode, framework = 'LangChain', running }) {
  const requests = requestUsages(events);
  const nativeDemo = mode === 'demo' && framework === '原生 JavaScript';
  // 逐字段累加已知值；若某字段完全未知则保持 null，并另行显示用量完整的请求数。
  const totals = Object.fromEntries(fields.map(/** 汇总某个用量字段的已知数值；全部缺失时保留 null。 */ (key) => {
    const values = requests.map(/** 读取当前请求中指定的用量字段。 */ (request) => request.usage?.[key]).filter(valid);
    return [key, values.length ? values.reduce(/** 累加已确认有效的用量。 */ (sum, value) => sum + value, 0) : null];
  }));
  const complete = requests.filter(/** 判断请求是否具备全部用量字段。 */ (request) =>
    fields.every(/** 检查当前用量字段是否有效。 */ (key) => valid(request.usage?.[key]))
  ).length;
  const runIds = [...new Set(events
    .filter(/** 筛选每轮运行的开始事件。 */ (event) => event.type === 'start')
    .map(/** 提取运行 ID 以统计会话轮次。 */ (event) => event.runId))];
  const labels = {
    request: nativeDemo ? '请求模拟模型' : '请求模型',
    response: nativeDemo ? '脚本模型响应' : '模型原始响应',
    tool_call: '请求查单',
    tool_result: '查询结果',
    tool_return: '回传模型',
    answer: '生成回答',
    error: '运行失败',
    graph_node: '进入图节点',
    graph_edge: '选择下一步',
  };
  const traces = events.filter(/** 仅保留观察面板支持展示的事件。 */ (event) => labels[event.type]);
  return (
    <details className="trace-disclosure">
      <summary className="trace-summary">
        <span>
          <span className="trace-symbol" aria-hidden="true">⌁</span>
          Token <b>{mode === 'demo' ? '0' : number(totals.total_tokens)}</b>
          <span className="trace-summary-note">
            {mode === 'demo' ? '本地演示' : `${requests.length} 次模型请求`}
          </span>
        </span>
        <span className="trace-toggle">
          <span className="trace-closed-label">查看调用详情</span>
          <span className="trace-open-label">收起调用详情</span>
          <span className="trace-chevron" aria-hidden="true">⌄</span>
        </span>
      </summary>
      <aside className="trace-panel" aria-label="调用与 Token 用量">
        <div className="panel-eyebrow">OBSERVABILITY</div>
        <h2>每一步，都看得见</h2>
        <p className="panel-caption">
          {mode === 'demo' ? '本地演示调用过程' : `${framework} 调用过程与本次会话用量`}
        </p>
        <div className="token-summary">
          <span>会话 Token 总量</span>
          <strong>{mode === 'demo' ? '0' : number(totals.total_tokens)}</strong>
          <div className="token-split">
            <span>输入 <b>{mode === 'demo' ? '0' : number(totals.prompt_tokens)}</b></span>
            <span>输出 <b>{mode === 'demo' ? '0' : number(totals.completion_tokens)}</b></span>
          </div>
          <small>
            {mode === 'demo'
              ? (nativeDemo ? '执行原生循环 · 脚本模拟响应 · 无外部 API 用量' : '本地演示 · 不调用模型、不消耗 Token')
              : requests.length
                ? `${complete} / ${requests.length} 次请求用量完整，仅汇总已知值`
                : '发送问题后，显示接口报告的实际用量'}
          </small>
        </div>
        <div className="run-stats">
          <div><b>{runIds.length}</b><span>对话轮次</span></div>
          <div><b>{requests.length}</b><span>{nativeDemo ? '模拟模型请求' : '模型请求'}</span></div>
          <div>
            <b>{events.filter(/** 筛选工具调用事件以统计调用次数。 */ (e) => e.type === 'tool_call').length}</b>
            <span>工具调用</span>
          </div>
        </div>
        <div className="trace-heading">
          <h3>执行记录</h3>
          <span className={running ? 'is-running' : ''}>
            {running ? '运行中' : traces.length ? '已结束' : '等待提问'}
          </span>
        </div>
        {!traces.length && (
          <div className="trace-empty">
            <span>⌁</span>
            <p>发送一个问题<br />这里会逐步展开调用过程</p>
            <div>理解问题 → 查询订单 → 展示结果</div>
          </div>
        )}
        <div className="trace-events">
          {traces.map(/** 渲染单条执行记录、原始数据以及关联的请求用量。 */ (event, index) => {
            const request = event.type === 'request'
              ? requests.find(/** 匹配当前执行记录所属的模型请求。 */ (item) => item.runId === event.runId && item.step === event.step)
              : null;
            return (
              <details className={`trace-event ${event.type}`} key={`${event.runId}-${index}`}>
                <summary>
                  <span className="trace-event-dot" />
                  <div>
                    <strong>
                      {labels[event.type]}
                      {event.type === 'tool_call' ? ` · ${event.data.function?.name}`
                        : event.type === 'graph_node' ? ` · ${event.data.node}`
                          : event.type === 'graph_edge' ? ` · ${event.data.from} → ${event.data.to}` : ''}
                    </strong>
                    <small>
                      第 {runIds.indexOf(event.runId) + 1} 轮
                      {event.step ? ` · 第 ${event.step} 次模型请求` : ''}
                    </small>
                    {request && (
                      <small className="request-inline">
                        输入 {number(request.usage?.prompt_tokens)} · 输出 {number(request.usage?.completion_tokens)} · 合计 {number(request.usage?.total_tokens)}
                      </small>
                    )}
                  </div>
                  <span className="trace-chevron">⌄</span>
                </summary>
                {request && (
                  <div className="request-tokens">
                    <span>输入 <b>{number(request.usage?.prompt_tokens)}</b></span>
                    <span>输出 <b>{number(request.usage?.completion_tokens)}</b></span>
                    <span>合计 <b>{number(request.usage?.total_tokens)}</b></span>
                    <small>{request.usage ? '接口返回值' : running ? '等待用量' : '未获取用量'}</small>
                  </div>
                )}
                <pre>{JSON.stringify(request ? { request: event.data, usage: request.usage } : event.data, null, 2)}</pre>
              </details>
            );
          })}
        </div>
        <p className="trace-footnote">一次查单通常包含 2 次模型请求、1 次工具调用。订单卡片直接使用工具结果。</p>
      </aside>
    </details>
  );
}
