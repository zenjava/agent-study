/**
 * 最小命令行入口：直接查订单并打印 JSON，用来先理解业务函数的输入与输出。
 * 不经过 Agent、模型或 Web 服务，也不需要模型 Key。
 */
import examples from '../common/demo/inputs.demo.json' with { type: 'json' };
import { getOrder } from '../common/tools/get-order.mjs';

// 输入：从命令行读取订单号；未提供时使用 A1001。
const orderId = process.argv[2] ?? examples.defaultOrderId;

// 查询：由 Node.js 执行普通函数。
const result = getOrder({ orderId });

// 输出：把函数返回的对象打印成 JSON。
console.log(JSON.stringify(result, null, 2));
