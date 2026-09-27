/**
 * 将原生 runner 与 CLI 入口接入公共行为契约，验证手写循环符合统一输入输出约定。
 */
import { orderAgentContract } from './order-agent-contract.mjs';
import { runOrderQuestionNative } from '../src/agent/native/agent.mjs';

orderAgentContract(runOrderQuestionNative, '../src/agent/native/cli.mjs');
