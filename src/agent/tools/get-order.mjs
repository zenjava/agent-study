/**
 * 订单业务层：维护三种虚构订单，提供完整查询与侧栏摘要。
 * 不依赖模型、HTTP 或界面；数据只保存在当前进程内存中，查询没有写入副作用。
 */
// 全部为虚构教学数据。金额以人民币元计，行金额含税，不额外叠加税费。
const orders = [
  {
    // 场景一：待审批，展示当前审批人、未发货和未付款状态。
    orderId: 'A1001',
    title: '设计团队 · 工作站采购',
    status: '等待审批',
    statusCode: 'pending',
    currentApprover: '采购负责人',
    approverName: '陈予安（示例）',
    supplier: '青禾数码（虚构供应商）',
    applicant: '林溪（示例）', department: '产品设计部',
    createdAt: '2026-09-24', expectedAt: '2026-10-08',
    currency: 'CNY', totalAmount: 48600, isDemo: true,
    items: [
      { sku: 'MON-27', name: '27 英寸 4K 显示器', specification: 'IPS / USB-C / 65W', quantity: 10, unit: '台', unitPrice: 3299 },
      { sku: 'DOCK-12', name: '桌面扩展坞', specification: '12 合 1 / 双屏输出', quantity: 10, unit: '个', unitPrice: 899 },
      { sku: 'ARM-D', name: '双屏显示器支架', specification: '铝合金 / 桌夹式', quantity: 10, unit: '套', unitPrice: 662 },
    ],
    delivery: { status: '审批通过后安排发货', address: '上海 · 示例园区 A 栋 6 层', recipient: '林溪（示例）', carrier: null, trackingNumber: null },
    payment: { status: '未付款', terms: '验收后 30 天付款', paidAmount: 0 },
    invoice: { status: '待开票', type: '增值税专用发票' },
    timeline: [
      { title: '提交申请', owner: '林溪', date: '09-24 09:30', state: 'done' },
      { title: '部门审批', owner: '部门负责人', date: '09-24 14:20', state: 'done' },
      { title: '采购审批', owner: '采购负责人 · 陈予安', date: '等待处理', state: 'active' },
      { title: '下单与收货', owner: '采购执行', date: '待开始', state: 'pending' },
    ],
    note: '新品设计项目设备补充，需统一到货后验收。当前尚未发货，交付日期为计划日期。',
  },
  {
    // 场景二：配送中，展示订金、承运信息和后续签收流程。
    orderId: 'A1002', title: '研发团队 · 便携办公设备', status: '配送中', statusCode: 'shipping',
    currentApprover: null, approverName: null,
    supplier: '远山办公（虚构供应商）', applicant: '周予（示例）', department: '研发部',
    createdAt: '2026-09-20', expectedAt: '2026-09-28', currency: 'CNY', totalAmount: 27900, isDemo: true,
    items: [
      { sku: 'PC-14', name: '14 英寸轻薄笔记本', specification: '32GB / 1TB / 银色', quantity: 3, unit: '台', unitPrice: 8900 },
      { sku: 'BAG-14', name: '便携电脑包', specification: '14 英寸 / 防水织物', quantity: 3, unit: '个', unitPrice: 400 },
    ],
    delivery: { status: '运输中 · 已离开发货仓', address: '杭州 · 示例研发中心 3 层', recipient: '周予（示例）', carrier: '示例速运', trackingNumber: 'DEMO-SF-20260925002' },
    payment: { status: '已付订金', terms: '订金 30%，验收后付尾款', paidAmount: 8370 },
    invoice: { status: '待开票', type: '增值税专用发票' },
    timeline: [
      { title: '提交申请', owner: '周予', date: '09-20 10:00', state: 'done' },
      { title: '审批通过', owner: '采购负责人', date: '09-21 16:00', state: 'done' },
      { title: '供应商发货', owner: '远山办公', date: '09-25 15:30', state: 'done' },
      { title: '运输与签收', owner: '示例速运', date: '预计 09-28', state: 'active' },
    ],
    note: '示例物流单号无法在真实快递平台查询，预计到货日期以模拟记录为准。',
  },
  {
    // 场景三：已完成，展示验收、结算和开票均结束的订单。
    orderId: 'A1003', title: '公共空间 · 会议室升级', status: '已完成', statusCode: 'completed',
    currentApprover: null, approverName: null,
    supplier: '木川空间（虚构供应商）', applicant: '许知（示例）', department: '行政部',
    createdAt: '2026-09-10', expectedAt: '2026-09-22', currency: 'CNY', totalAmount: 12800, isDemo: true,
    items: [
      { sku: 'VC-4K', name: '4K 会议摄像头', specification: '广角 / 自动取景', quantity: 2, unit: '台', unitPrice: 4800 },
      { sku: 'MIC-360', name: '全向会议麦克风', specification: '360° 收音 / USB', quantity: 2, unit: '台', unitPrice: 1600 },
    ],
    delivery: { status: '已签收 · 2026-09-22', address: '上海 · 示例园区 B 栋会议室', recipient: '许知（示例）', carrier: '示例物流', trackingNumber: 'DEMO-WC-20260922003' },
    payment: { status: '已付清', terms: '验收后一次性付款', paidAmount: 12800 },
    invoice: { status: '已开票', type: '增值税专用发票' },
    timeline: [
      { title: '提交申请', owner: '许知', date: '09-10 09:00', state: 'done' },
      { title: '审批通过', owner: '采购负责人', date: '09-12 11:00', state: 'done' },
      { title: '签收验收', owner: '行政部', date: '09-22 15:00', state: 'done' },
      { title: '付款完成', owner: '财务部', date: '09-24 17:00', state: 'done' },
    ],
    note: '两间会议室设备均已验收，付款和发票流程已完成。',
  },
];

// 普通 JavaScript 函数：接收订单号，返回查询结果。
export function getOrder({ orderId }) {
  const order = orders.find((item) => item.orderId === orderId);

  if (!order) {
    return { found: false, orderId };
  }

  // 返回深拷贝，调用方修改明细、配送或流程数组时不会污染后续查询。
  return { found: true, order: structuredClone(order) };
}

// 侧栏只需要摘要字段；完整订单留给工具查询返回，减少初始页面数据体积。
export function listOrderSummaries() {
  return orders.map(({ orderId, title, status, statusCode, totalAmount, department }) =>
    ({ orderId, title, status, statusCode, totalAmount, department }));
}
