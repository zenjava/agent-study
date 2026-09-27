/**
 * Node 服务启动入口：读取环境变量、创建 HTTP 服务并监听本机端口。
 * 环境文件由 npm start 的 --env-file 加载；npm run demo 不主动读取 .env。
 */
import { pathToFileURL } from 'node:url';
import { createHarnessServer } from './http-server.mjs';

// 服务启动入口：读取配置并监听端口。
export { createHarnessServer };

// 导入只暴露工厂；直接启动时才读取运行环境并监听端口。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createHarnessServer({
    baseURL: process.env.LLM_BASE_URL, model: process.env.LLM_MODEL, apiKey: process.env.LLM_API_KEY,
  });
  server.on('error', (error) => {
    console.error(error.code === 'EADDRINUSE' ? '端口已占用，请使用 PORT=3211 更换端口。' : '本地服务启动失败。');
    process.exitCode = 1;
  });
  // 绑定环回地址，默认只供本机浏览器访问；PORT 可用于并行预览或避开端口冲突。
  server.listen(Number(process.env.PORT || 3210), '127.0.0.1', () => {
    console.log(`工具调用实验台：http://127.0.0.1:${server.address().port}`);
  });
}
