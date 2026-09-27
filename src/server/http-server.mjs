/**
 * HTTP 接入层：提供构建页面、订单摘要、公开配置和 CopilotKit 运行接口。
 * 负责本机同源限制、请求体大小与响应流转发；具体模型和工具循环在 Agent 层。
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { listOrderSummaries } from '../agent/common/tools/get-order.mjs';
import { createCopilotHandler } from './copilot-handler.mjs';

/**
 * 创建尚未监听的本机 HTTP 服务，提供静态页面、公开数据及 CopilotKit 事件流接口。
 * @param {object} config 模型配置，仅服务端持有 apiKey。
 * @param {string} [config.baseURL] 模型接口基础地址。
 * @param {string} [config.model] 模型名称。
 * @param {string} [config.apiKey] 模型密钥。
 * @returns {import("node:http").Server} 由入口或测试负责监听和关闭的服务对象。
 */
export function createHarnessServer(config) {
  // 多条教程 URL 共用一个 HTML 壳，浏览器入口再根据 pathname 选择课程。
  const pages = new Map([
    ['/', 'index.html'], ['/learn', 'learn.html'], ['/learn.html', 'learn.html'],
    ['/learn/langchain', 'learn.html'], ['/learn/langgraph', 'learn.html'], ['/learn/native', 'learn.html'], ['/learn/runtime', 'learn.html'],
  ]);
  let copilotHandler;
  const server = createServer(/** 处理本机 HTTP 请求，分发页面、公开数据和 CopilotKit 接口，并转发响应流。 */ async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'");
    /**
     * 以给定状态码结束当前 HTTP 请求，统一使用 UTF-8 JSON 响应。
     * @param {number} status HTTP 状态码。
     * @param {*} data 可序列化的响应数据。
     * @returns {void}
     */
    const json = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    };
    // 校验实际监听端口和来源，避免其他站点借本机服务触发模型调用。
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
        // 并发首次请求共享初始化 Promise；初始化失败后清空缓存，允许后续请求重试。
        copilotHandler ??= createCopilotHandler(config).catch(/** 清除初始化失败的 Runtime 缓存，将错误交给本次请求处理。 */ (error) => { copilotHandler = undefined; throw error; });
        const handler = await copilotHandler;
        const controller = new AbortController();
        // 浏览器断开时向下游传播取消，避免客户端已离开但后端仍持续工作。
        res.on('close', /** 在浏览器连接关闭时取消下游模型与事件流。 */ () => controller.abort());
        // 将 Node 请求适配为 Web Request；返回的 SSE 流按块转发，不拼成一个完整 JSON。
        const response = await handler(new Request(`http://${req.headers.host}${req.url}`, {
          method: req.method, headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
          body: raw, signal: controller.signal,
        }));
        res.writeHead(response.status, Object.fromEntries(response.headers));
        // 逐块读取 Runtime 输出；连接关闭或读取结束时释放 reader。
        const reader = response.body?.getReader();
        if (reader) {
          try {
            while (!res.destroyed) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
          } finally { await reader.cancel().catch(/** 忽略释放已结束响应流时的取消错误。 */ () => {}); }
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
    if (req.method === 'GET' && (pages.has(path) || /^\/assets\/[\w.-]+$/.test(path))) {
      try {
        const file = pages.get(path) ?? path.slice(1);
        const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf' };
        const type = types[file.split('.').at(-1)];
        if (!type) return json(404, { error: '未找到。' });
        const content = await readFile(new URL(`../../dist/${file}`, import.meta.url));
        res.writeHead(200, { 'Content-Type': type });
        res.end(content); return;
      } catch (error) {
        if (error.code === 'ENOENT' && pages.has(path)) {
          return json(503, { error: '页面尚未构建，请先运行 npm run build。' });
        }
        return json(404, { error: '未找到。' });
      }
    }
    // 仅返回显示所需的模型名；密钥及其配置状态都留在服务端。
    if (req.method === 'GET' && path === '/api/config') {
      return json(200, { model: config.model || '未配置模型' });
    }
    return json(404, { error: '未找到。' });
  });
  return server;
}
