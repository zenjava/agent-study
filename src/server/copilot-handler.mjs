/**
 * Copilot Runtime 组装层：将前端 agentId 映射到三种实现及两种演示模式。
 * 所有实现复用 OrderAgent 的 AG-UI 协议适配，通过 runner 注入不同编排函数。
 */
import { createOrderAgent } from './order-agent.mjs';
import { runOrderQuestionGraph } from '../agent/langgraph/agent.mjs';
import { runOrderQuestionNative } from '../agent/native/agent.mjs';
import { runNativeDemo } from '../agent/native/demo/model.demo.mjs';

/**
 * 注册三种 Agent 实现与两种演示模式，创建 Copilot Runtime 的标准 HTTP 处理器。
 * @param {object} config 服务端模型配置，包含 baseURL、model、apiKey。
 * @returns {Promise<Function>} 以 Web Request 为输入、返回 Response 的 Runtime 处理器。
 */
export async function createCopilotHandler(config) {
  process.env.COPILOTKIT_TELEMETRY_DISABLED = 'true';
  // 先设置遥测开关再动态加载 Runtime；实际初始化推迟到第一次对话接口请求。
  const { CopilotRuntime, createCopilotRuntimeHandler } = await import('@copilotkit/runtime/v2');
  const runtime = new CopilotRuntime({
    // 键名就是前端选择的 agentId；两种 Demo 分别是固定规则演示和实际原生循环演示。
    agents: {
      orders: createOrderAgent(config),
      orders_graph: createOrderAgent(config, { runner: runOrderQuestionGraph }),
      orders_native: createOrderAgent(config, { runner: runOrderQuestionNative }),
      demo: createOrderAgent(config, { demo: true }),
      demo_native: createOrderAgent(config, { demo: true, runner: runNativeDemo }),
    },
  });
  return createCopilotRuntimeHandler({ runtime, basePath: '/api/copilotkit' });
}
