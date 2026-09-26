import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { runOrderQuestion } from './step2.mjs';
import { listOrderSummaries } from './src/get-order.mjs';
import { createCopilotHandler } from './src/copilot-handler.mjs';

// 只开放这三个静态文件，不能通过 URL 读取 .env 或项目源码。
const assets = new Map([
  ['/', ['index.html', 'text/html']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/style.css', ['style.css', 'text/css']],
]);

export function createHarnessServer(config) {
  let busy = false;
  let copilotHandler;
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'");
    const json = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    };
    const allowedHosts = [`127.0.0.1:${server.address().port}`, `localhost:${server.address().port}`];
    if (!allowedHosts.includes(req.headers.host)) return json(403, { error: '仅允许本机访问。' });
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) {
      return json(403, { error: '仅允许当前页面发起请求。' });
    }

    const path = new URL(req.url, `http://${req.headers.host}`).pathname;
    if (path.startsWith('/api/copilotkit')) {
      // 只接受有限大小的同源输入；模型密钥不会经过浏览器或此请求体。
      try {
        let raw;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: '需要 JSON 请求。' });
          const chunks = []; let bytes = 0;
          for await (const chunk of req) {
            bytes += chunk.length;
            if (bytes > 262144) return json(413, { error: '会话过长，请开启新对话。' });
            chunks.push(chunk);
          }
          raw = Buffer.concat(chunks);
        }
        copilotHandler ??= createCopilotHandler(config).catch((error) => { copilotHandler = undefined; throw error; });
        const handler = await copilotHandler;
        const controller = new AbortController();
        res.on('close', () => controller.abort());
        const response = await handler(new Request(`http://${req.headers.host}${req.url}`, {
          method: req.method, headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
          body: raw, signal: controller.signal,
        }));
        res.writeHead(response.status, Object.fromEntries(response.headers));
        const reader = response.body?.getReader();
        if (reader) {
          try {
            while (!res.destroyed) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
          } finally { await reader.cancel().catch(() => {}); }
        }
        res.end();
      } catch {
        if (!res.headersSent && !res.destroyed) json(500, { error: '对话服务连接失败，请重试。' });
        else res.end();
      }
      return;
    }
    if (req.method === 'GET' && path === '/api/orders') return json(200, { orders: listOrderSummaries() });
    // Vite 产物仅允许 assets 下的单个文件名，禁止目录穿越与任意源码读取。
    if (req.method === 'GET' && (path === '/' || /^\/assets\/[\w.-]+$/.test(path))) {
      try {
        const file = path === '/' ? 'index.html' : path.slice(1);
        const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf' };
        const type = types[file.split('.').at(-1)];
        if (!type) return json(404, { error: '未找到。' });
        const content = await readFile(new URL(`./dist/${file}`, import.meta.url));
        res.writeHead(200, { 'Content-Type': type });
        res.end(content); return;
      } catch {
        if (path !== '/') return json(404, { error: '未找到。' });
        // 尚未构建时保留原教学页面入口。
      }
    }
    if (req.method === 'GET' && assets.has(path)) {
      try {
        const [file, type] = assets.get(path);
        const content = await readFile(new URL(`./public/${file}`, import.meta.url));
        res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
        res.end(content);
      } catch { json(500, { error: '页面文件读取失败。' }); }
      return;
    }
    if (req.method === 'GET' && path === '/api/config') {
      return json(200, {
        model: config.model || '未配置模型',
        keyConfigured: Boolean(config.apiKey?.trim()) && !config.apiKey.trim().startsWith('replace-with-'),
      });
    }
    if (req.method !== 'POST' || path !== '/api/run') return json(404, { error: '未找到。' });
    if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: '需要 JSON 请求。' });

    let question;
    try {
      let bytes = 0;
      const chunks = [];
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 16_384) { json(413, { error: '问题过长。' }); return; }
        chunks.push(chunk);
      }
      ({ question } = JSON.parse(Buffer.concat(chunks).toString('utf8')));
      if (typeof question !== 'string' || !question.trim() || question.length > 2000) throw new Error();
    } catch { return json(400, { error: '请输入 1–2000 个字符的问题。' }); }
    if (busy) return json(429, { error: '上一轮还在运行，请稍后再试。' });
    busy = true;

    // 一行 JSON 是一个事件；浏览器能边接收边展示，不必等待最终答案。
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8' });
    res.flushHeaders();
    const controller = new AbortController();
    res.on('close', () => controller.abort());
    const send = (event) => {
      if (!res.destroyed && !res.writableEnded) res.write(`${JSON.stringify(event)}\n`);
    };
    try {
      await runOrderQuestion({
        ...config, question: question.trim(), log: () => {},
        signal: controller.signal, onEvent: send,
      });
      send({ type: 'complete' });
    } catch (error) {
      const message = config.apiKey ? error.message.replaceAll(config.apiKey, '[REDACTED]') : error.message;
      send({ type: 'error', data: { message } });
    } finally {
      busy = false;
      res.end();
    }
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createHarnessServer({
    baseURL: process.env.LLM_BASE_URL, model: process.env.LLM_MODEL, apiKey: process.env.LLM_API_KEY,
  });
  server.on('error', (error) => {
    console.error(error.code === 'EADDRINUSE' ? '端口已占用，请使用 PORT=3211 更换端口。' : '本地服务启动失败。');
    process.exitCode = 1;
  });
  server.listen(Number(process.env.PORT || 3210), '127.0.0.1', () => {
    console.log(`工具调用实验台：http://127.0.0.1:${server.address().port}`);
  });
}
