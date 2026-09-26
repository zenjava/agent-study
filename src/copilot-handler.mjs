import { createOrderAgent } from './order-agent.mjs';

export async function createCopilotHandler(config) {
  process.env.COPILOTKIT_TELEMETRY_DISABLED = 'true';
  const { CopilotRuntime, createCopilotRuntimeHandler } = await import('@copilotkit/runtime/v2');
  const runtime = new CopilotRuntime({
    agents: {
      orders: createOrderAgent(config),
      demo: createOrderAgent(config, { demo: true }),
    },
  });
  return createCopilotRuntimeHandler({ runtime, basePath: '/api/copilotkit' });
}
