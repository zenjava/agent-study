/**
 * 教学源码注册表：显式导入允许阅读的文件文本，供源码页和课程节选共用。
 * 文件以 ?raw 作为字符串打包，不执行这些导入内容，也不收录本机密钥。
 */
import nativeSource from '../../agent/native/agent.mjs?raw';
import nativeDemoSource from '../../agent/native/demo/model.demo.mjs?raw';
import definitionSource from '../../agent/common/order-definition.mjs?raw';
import nativeEntrySource from '../../agent/native/cli.mjs?raw';
// 只导入明确列出的教学源码；不读取 .env 或提供任意文件访问接口。
import agentSource from '../../agent/langchain/agent.mjs?raw';
import graphSource from '../../agent/langgraph/agent.mjs?raw';
import contractSource from '../../agent/common/order-contract.mjs?raw';
import orderDataSource from '../../agent/common/demo/orders.demo.json?raw';
import orderSource from '../../agent/common/tools/get-order.mjs?raw';
import bridgeSource from '../../server/order-agent.mjs?raw';
import transportSource from '../../agent/common/model-transport.mjs?raw';
import runtimeSource from '../../server/copilot-handler.mjs?raw';
import pageSource from '../pages/chat/ChatPage.jsx?raw';
import workspaceSource from '../pages/chat/ChatWorkspace.jsx?raw';
import runSource from '../state/chat/useChatRun.js?raw';
import sessionSource from '../state/chat/useChatSession.js?raw';
import assistantSource from '../components/chat/AssistantMessage.jsx?raw';
import entrySource from '../entries/main.jsx?raw';
import cardSource from '../components/chat/OrderCard.jsx?raw';
import serverSource from '../../server/http-server.mjs?raw';
import traceSource from '../components/chat/TracePanel.jsx?raw';
import serverEntrySource from '../../server/main.mjs?raw';
import langchainEntrySource from '../../agent/langchain/cli.mjs?raw';
import langgraphEntrySource from '../../agent/langgraph/cli.mjs?raw';

export const files = {
  'src/agent/native/agent.mjs': nativeSource,
  'src/agent/native/demo/model.demo.mjs': nativeDemoSource,
  'src/agent/common/order-definition.mjs': definitionSource,
  'src/agent/native/cli.mjs': nativeEntrySource,
  'src/agent/langchain/agent.mjs': agentSource,
  'src/agent/langgraph/agent.mjs': graphSource,
  'src/agent/common/order-contract.mjs': contractSource,
  'src/agent/common/demo/orders.demo.json': orderDataSource,
  'src/agent/common/tools/get-order.mjs': orderSource,
  'src/server/order-agent.mjs': bridgeSource,
  'src/agent/common/model-transport.mjs': transportSource,
  'src/server/copilot-handler.mjs': runtimeSource,
  'src/web/pages/chat/ChatPage.jsx': pageSource,
  'src/web/pages/chat/ChatWorkspace.jsx': workspaceSource,
  'src/web/state/chat/useChatRun.js': runSource,
  'src/web/state/chat/useChatSession.js': sessionSource,
  'src/web/components/chat/AssistantMessage.jsx': assistantSource,
  'src/web/entries/main.jsx': entrySource,
  'src/web/components/chat/OrderCard.jsx': cardSource,
  'src/server/http-server.mjs': serverSource,
  'src/web/components/chat/TracePanel.jsx': traceSource,
  'src/server/main.mjs': serverEntrySource,
  'src/agent/langchain/cli.mjs': langchainEntrySource,
  'src/agent/langgraph/cli.mjs': langgraphEntrySource,
};

// 行号从本次构建的实际源码推导，避免代码移动后仍指向旧位置。
export function excerpt(file, start, end) {
  const lines = files[file].split('\n');
  // 起止锚点都从同一份源码寻找；缺失时直接报错，避免教程静默展示错误片段。
  const first = lines.findIndex((line) => line.includes(start));
  const last = lines.findIndex((line, index) => index >= first && line.includes(end));
  if (first < 0 || last < first) throw new Error(`教学代码定位失败：${file}`);
  return { file, line: first + 1, code: lines.slice(first, last + 1).join('\n') };
}
