/**
 * 页面级会话状态：加载公开配置和订单摘要，管理版本、模式、错误及会话编号。
 * 返回的切换操作交给页面，页面据此重建 Provider。
 */
import { useEffect, useState } from 'react';
import { implementations } from '../../content/chat-config.js';

// 随页面存在的状态：配置和当前会话标识。
export function useChatSession() {
  const [mode, setMode] = useState('demo');
  const [framework, setFramework] = useState(() => new URLSearchParams(window.location.search).get('version') === 'native' ? 'native' : 'langchain');
  // 模式与实现是两个维度：原生 Demo 执行原生循环，其余 Demo 共用固定规则。
  const agentId = mode === 'demo' ? (framework === 'native' ? 'demo_native' : 'demo') : implementations[framework].agentId;
  const [session, setSession] = useState(0);
  const [config, setConfig] = useState(null);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  // 并行读取公开配置与摘要；页面卸载时取消请求，忽略主动取消带来的错误。
  useEffect(() => {
    const controller = new AbortController();
    Promise.all(['/api/config', '/api/orders'].map(async (url) => {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('读取配置失败，请刷新页面。');
      return response.json();
    })).then(([nextConfig, data]) => { setConfig(nextConfig); setOrders(data.orders); }).catch((e) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, []);
  // 切换实现时清除旧错误；Provider key 随 framework 变化，内部消息自动重建。
  function changeFramework(next) { setError(''); setFramework(next); }
  // 切换演示或真实模型模式同样开始新会话，避免不同运行来源的记录混在一起。
  function changeMode(next) { setError(''); setMode(next); }
  // 递增会话编号触发 Provider 重建，页面级配置与示例订单仍可复用。
  function resetSession() { setError(''); setSession((value) => value + 1); }
  return { mode, framework, agentId, session, config, orders, error, setError,
    changeFramework, changeMode, resetSession };
}
