/**
 * 将 LangChain runner 与 CLI 入口接入公共行为契约，验证框架编排和执行边界。
 */
import { orderAgentContract } from './order-agent-contract.mjs';
import { runOrderQuestion } from '../src/agent/langchain/agent.mjs';

orderAgentContract(runOrderQuestion, '../src/agent/langchain/cli.mjs');
