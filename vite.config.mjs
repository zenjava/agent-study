// Web 构建配置：源码位于 src/web，输出到根目录 dist，供 Node 服务静态读取。
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('./src/web', import.meta.url)),
  // 不复制旧 public 资源，只发布显式入口及其依赖。
  publicDir: false,
  // 将浏览器侧遥测开关在构建时替换为字符串常量。
  define: { 'process.env.COPILOTKIT_TELEMETRY_DISABLED': '"true"' },
  build: {
    // 从 src/web 计算相对输出路径；构建前清理旧产物，避免遗留无效资源。
    outDir: '../../dist', emptyOutDir: true,
    target: 'es2022', chunkSizeWarningLimit: 2500,
    // 工作台与教程保留两个 HTML 文件，服务端多个课程路径共用 learn.html。
    rollupOptions: { input: {
      main: fileURLToPath(new URL('./src/web/index.html', import.meta.url)),
      learn: fileURLToPath(new URL('./src/web/learn.html', import.meta.url)),
    } },
  },
});
