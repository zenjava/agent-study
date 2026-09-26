const $ = (id) => document.getElementById(id);
const form = $('question-form');
const question = $('question');
const runButton = $('run');
const clearButton = $('clear');
const timeline = $('timeline');
const examples = [...document.querySelectorAll('[data-question]')];
let busy = false;
let configured = false;
let requests = 0;
let calls = 0;
let startedAt = 0;
const usageByStep = new Map();
const tokenFields = ['prompt_tokens', 'completion_tokens', 'total_tokens'];
const tokenNumber = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
const formatTokens = (value) => value === null ? '—' : value.toLocaleString('zh-CN');

function updateTokenSummary() {
  const entries = [...usageByStep.values()];
  // 缺失项不冒充 0；部分响应的合计明确标记为“仅含已知用量”。
  const sums = tokenFields.map((field) => {
    const values = entries.map(({ usage }) => tokenNumber(usage?.[field])).filter((value) => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  });
  const complete = entries.filter(({ usage }) => tokenFields.every((field) => tokenNumber(usage?.[field]) !== null)).length;
  $('token-total').textContent = formatTokens(sums[2]);
  $('token-breakdown').textContent = `输入 ${formatTokens(sums[0])} · 输出 ${formatTokens(sums[1])}`;
  $('token-coverage').textContent = !entries.length ? '等待请求'
    : complete === entries.length ? `已统计 ${complete} 次请求`
      : `${complete} / ${entries.length} 次用量完整 · 汇总仅含已知用量`;
}

function addRequestUsage(item, step) {
  const panel = document.createElement('div');
  panel.className = 'request-usage';
  const label = document.createElement('p');
  label.textContent = 'Token：等待模型返回…';
  const details = document.createElement('details');
  details.hidden = true;
  const summary = document.createElement('summary');
  summary.textContent = '查看 Token 明细';
  const payload = document.createElement('pre');
  details.append(summary, payload);
  panel.append(label, details);
  item.append(panel);
  usageByStep.set(step, { label, details, payload, usage: null, pending: true });
  updateTokenSummary();
}

function updateRequestUsage({ step, data }) {
  const entry = usageByStep.get(step);
  if (!entry) return;
  entry.usage = data;
  entry.pending = false;
  const values = tokenFields.map((field) => tokenNumber(data?.[field]));
  entry.label.textContent = values.every((value) => value === null) ? 'Token：接口未提供用量'
    : `输入 ${formatTokens(values[0])} · 输出 ${formatTokens(values[1])} · 合计 ${formatTokens(values[2])} Token${values.includes(null) ? '（部分用量未提供）' : ''}`;
  entry.payload.textContent = JSON.stringify(data, null, 2);
  entry.details.hidden = false;
  updateTokenSummary();
}

function finishTokenUsage() {
  for (const entry of usageByStep.values()) {
    if (!entry.pending) continue;
    entry.pending = false;
    entry.label.textContent = 'Token：未获取用量（请求未完成或接口未提供）';
  }
  updateTokenSummary();
}

function setStatus(text, state = '') {
  $('status').textContent = text;
  $('status').className = `status ${state}`;
}

function setBusy(value) {
  busy = value;
  runButton.disabled = value || !configured;
  question.disabled = value;
  clearButton.disabled = value || timeline.children.length === 0;
  examples.forEach((button) => { button.disabled = value; });
  $('run-label').textContent = value ? '正在运行…' : '开始测试';
  form.setAttribute('aria-busy', String(value));
}

function reset() {
  timeline.replaceChildren();
  $('empty').hidden = false;
  $('answer-panel').hidden = true;
  $('error-panel').hidden = true;
  $('answer').textContent = '';
  requests = calls = 0;
  usageByStep.clear();
  updateTokenSummary();
  $('request-count').textContent = '0';
  $('tool-count').textContent = '0';
  $('elapsed').textContent = '—';
  clearButton.disabled = true;
  setStatus('等待开始');
}

function showError(message) {
  finishTokenUsage();
  $('error-panel').hidden = false;
  $('error-panel').textContent = message;
  setStatus('运行失败', 'error');
}

function describe(event) {
  const { data, step } = event;
  switch (event.type) {
    case 'request':
      return [`第 ${step} 次请求模型`, 'NODE → 模型', step === 1
        ? '发送你的问题与 getOrder 工具说明。此时还没有查询订单。'
        : '发送已有对话、工具调用记录和对应结果，请模型继续。', 'node'];
    case 'tool_call':
      return [`模型请求调用 ${data.function.name}`, '模型 → NODE', `参数：${data.function.arguments}。模型提出了请求，接下来由 Node 校验并执行。`, 'model'];
    case 'tool_result': {
      const result = data.result;
      return result.error
        ? ['Node 拒绝执行', 'NODE 校验', result.error.message, 'node']
        : ['Node 执行 getOrder', 'NODE 执行', result.found
          ? `${result.order.orderId} · ${result.order.status} · 当前审批人：${result.order.currentApprover}`
          : `没有找到订单 ${result.orderId}。函数正常返回 found: false。`, 'node'];
    }
    case 'tool_return':
      return ['准备回传工具结果', 'NODE → 模型', `用 tool_call_id=${data.tool_call_id} 关联这次调用，下一次请求发送。`, 'node'];
    case 'answer':
      return ['模型给出回答', '模型 → 你', calls ? '模型已收到工具结果，返回本轮回答。' : '模型直接返回文本。本轮没有执行工具，回答也可能是追问。', 'model'];
    default: return null;
  }
}

function addEvent(event) {
  if (event.type === 'usage') { updateRequestUsage(event); return; }
  if (event.type === 'error') { showError(event.data.message); return; }
  if (event.type === 'complete') { finishTokenUsage(); setStatus('本轮已完成', 'success'); return; }
  const description = describe(event);
  if (!description) return;
  $('empty').hidden = true;
  if (event.type === 'request') $('request-count').textContent = String(++requests);
  if (event.type === 'tool_call') $('tool-count').textContent = String(++calls);

  // 外部文本统一使用 textContent；模型返回内容不会作为 HTML 执行。
  const [title, role, text, actor] = description;
  const item = document.createElement('li');
  item.className = `event ${actor}`;
  const index = document.createElement('span');
  index.className = 'event-index';
  index.textContent = String(timeline.children.length + 1);
  const head = document.createElement('div');
  head.className = 'event-head';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const badge = document.createElement('span');
  badge.className = 'event-role';
  badge.textContent = role;
  head.append(heading, badge);
  const content = document.createElement('p');
  content.textContent = text;
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = '查看 JSON';
  const payload = document.createElement('pre');
  payload.textContent = JSON.stringify(event.data, null, 2);
  details.append(summary, payload);
  item.append(index, head, content);
  if (event.type === 'request') addRequestUsage(item, event.step);
  item.append(details);
  timeline.append(item);

  if (event.type === 'answer') {
    $('answer-panel').hidden = false;
    $('answer').textContent = event.data.content;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || !question.value.trim() || !configured) return;
  reset();
  setBusy(true);
  setStatus('正在运行', 'running');
  $('empty').hidden = true;
  startedAt = Date.now();
  const updateTime = () => { $('elapsed').textContent = `${((Date.now() - startedAt) / 1000).toFixed(1)} s`; };
  updateTime();
  const timer = setInterval(updateTime, 100);
  let terminal = false;
  try {
    const response = await fetch('/api/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question.value.trim() }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `请求失败：HTTP ${response.status}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let newline;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!line.trim()) continue;
        const trace = JSON.parse(line);
        addEvent(trace);
        if (trace.type === 'complete' || trace.type === 'error') terminal = true;
      }
      if (done) break;
    }
    if (!terminal) throw new Error('连接提前结束，请确认本地服务仍在运行后重试。');
  } catch (error) {
    showError(error.message || '请求失败，请检查本地服务。');
  } finally {
    finishTokenUsage();
    clearInterval(timer);
    updateTime();
    setBusy(false);
  }
});

examples.forEach((button) => button.addEventListener('click', () => {
  question.value = button.dataset.question;
  question.focus();
}));
clearButton.addEventListener('click', reset);

try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('无法读取本机配置，请检查本地服务。');
  const config = await response.json();
  $('model').textContent = config.model;
  configured = config.keyConfigured;
  $('connection').textContent = configured ? '本机密钥已配置 · 实时模型' : '本机密钥尚未配置';
  if (!configured) showError('请在本机 .env 配置 LLM_API_KEY，重启服务后刷新页面。');
  setBusy(false);
} catch (error) { showError(error.message); }
