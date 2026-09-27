/**
 * 将共享业务定义适配为 LangChain / LangGraph 可用的 Zod Schema 与 tool。
 * 工具结果序列化为 JSON 文本，框架将它封装成带调用 ID 的 ToolMessage。
 */
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getOrder } from './tools/get-order.mjs';
import { orderDescription, orderParameters } from './order-definition.mjs';
export { systemPrompt } from './order-definition.mjs';

// 同一份 Schema 既生成模型看到的工具参数定义，也在 Node 执行前校验输入。
export const orderSchema = z.object({
  orderId: z.string().refine((value) => value.trim().length > 0).describe(orderParameters.properties.orderId.description),
}).strict();
// 框架调用这个包装函数时才执行 getOrder；JSON 字符串便于作为工具消息回传模型。
export const orderTool = tool(({ orderId }) => JSON.stringify(getOrder({ orderId })), {
  name: 'getOrder',
  description: orderDescription,
  schema: orderSchema,
});
