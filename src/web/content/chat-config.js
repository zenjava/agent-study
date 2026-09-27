/**
 * 工作台静态配置：统一维护三版显示名称、真实 agentId、教程路径和聊天文案。
 * 本地演示 agentId 的选择由会话 hook 根据模式处理。
 */
export const implementations = {
  native: { label: '原生 JavaScript', agentId: 'orders_native', course: '/learn/native', detail: 'fetch + messages · 手写循环' },
  langchain: { label: 'LangChain', agentId: 'orders', course: '/learn', detail: 'Runnable · 本地工具循环' },
  langgraph: { label: 'LangGraph', agentId: 'orders_graph', course: '/learn/langgraph', detail: 'StateGraph · 显式节点与边' },
};

export const chatLabels = { chatInputPlaceholder: '问问订单进度、商品明细或物流…', welcomeMessageText: '让订单，自己说清楚。', assistantMessageToolbarCopyMessageLabel: '复制回答', assistantMessageToolbarCopyCodeLabel: '复制代码', assistantMessageToolbarCopyCodeCopiedLabel: '已复制', userMessageToolbarCopyMessageLabel: '复制问题', chatDisclaimerText: '订单均为虚构教学数据。' };
