/**
 * LangGraph 命令行入口：读取参数和环境变量，再交给显式图编排。
 * 模块导入与命令行执行分开，测试可以安全导入 runner。
 */
import examples from '../common/demo/inputs.demo.json' with { type: 'json' };
import { pathToFileURL } from 'node:url';
import { runOrderQuestionGraph } from './agent.mjs';

// CLI 只负责参数与输出；模型和工具编排位于同目录的 agent.mjs。
export { runOrderQuestionGraph };

// 仅当此文件被直接执行时启动；模块导入不会读取命令行并意外请求模型。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runOrderQuestionGraph({
    question: process.argv.slice(2).join(' ') || examples.defaultQuestion,
    baseURL: process.env.LLM_BASE_URL, model: process.env.LLM_MODEL, apiKey: process.env.LLM_API_KEY,
  }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
