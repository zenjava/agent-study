/**
 * 将 LangGraph runner 与 CLI 入口接入公共行为契约，验证图编排与其余实现保持相同行为。
 */
import { orderAgentContract } from './order-agent-contract.mjs';
import { runOrderQuestionGraph } from '../src/agent/langgraph.mjs';

orderAgentContract(runOrderQuestionGraph, '../src/agent/cli/langgraph.mjs');
