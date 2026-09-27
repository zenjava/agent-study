/**
 * 原生 Agent 命令行入口：解析问题与 --demo，选择真实模型或离线脚本。
 * 真实配置从进程环境读取；导入该模块不会自动启动一次问答。
 */
import { pathToFileURL } from 'node:url';
import { runOrderQuestionNative } from '../native.mjs';
import { runNativeDemo } from '../native-demo.mjs';

export { runOrderQuestionNative };

// 仅当此文件被直接执行时启动；模块导入不会读取命令行并意外请求模型。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // --demo 占用第一个参数，后续文本才是用户问题；无问题时使用固定教学示例。
  const demo = process.argv[2] === '--demo';
  const question = process.argv.slice(demo ? 3 : 2).join(' ') || 'A1001 现在到哪一步了，谁在审批？';
  try {
    if (demo) console.log('原生循环 Demo：脚本模拟模型，不调用外部 API、不消耗 Token。');
    await (demo ? runNativeDemo : runOrderQuestionNative)({
      question, baseURL: process.env.LLM_BASE_URL, model: process.env.LLM_MODEL, apiKey: process.env.LLM_API_KEY,
    });
  } catch (error) {
    console.error(`运行失败：${error.message}`);
    process.exitCode = 1;
  }
}
