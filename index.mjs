import { getOrder } from './src/get-order.mjs';

// 输入：从命令行读取订单号；未提供时使用 A1001。
const orderId = process.argv[2] ?? 'A1001';

// 查询：由 Node.js 执行普通函数。
const result = getOrder({ orderId });

// 输出：把函数返回的对象打印成 JSON。
console.log(JSON.stringify(result, null, 2));
