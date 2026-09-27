/**
 * LangChain 命令行入口：读取问题和模型配置，调用 Agent 并把错误转为退出码。
 * 执行编排放在上一层，便于网页与测试复用。
 */
import { pathToFileURL } from 'node:url';
import { runOrderQuestion } from '../langchain.mjs';

// CLI 只负责参数与输出；模型和工具编排位于上一层。
export { runOrderQuestion };

// 直接 node 运行时才启动；导入测试时不会连接任何真实模型。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runOrderQuestion({
      question: process.argv.slice(2).join(' ') || 'A1001 现在到哪一步了，谁在审批？',
      baseURL: process.env.LLM_BASE_URL,
      model: process.env.LLM_MODEL,
      apiKey: process.env.LLM_API_KEY,
    });
  } catch (error) {
    console.error(`运行失败：${error.message}`);
    process.exitCode = 1;
  }
}
