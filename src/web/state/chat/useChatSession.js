/**
 * 页面级会话状态：加载公开配置和订单摘要，管理版本、模式、错误及会话编号。
 * 返回的切换操作交给页面，页面据此重建 Provider。
 */
import { useEffect, useState } from 'react';
import { implementations } from '../../content/chat-config.js';

/**
 * 加载公开配置及订单摘要，维护实现版本、模式、错误和 Provider 会话标识。
 * @returns {object} 页面级状态及切换实现、模式、重置会话的操作。
 */
export function useChatSession() {
  const [mode, setMode] = useState('demo');
  const [framework, setFramework] = useState(/** 从 URL 恢复原生实现选择，其余情况默认使用 LangChain。 */ () => new URLSearchParams(window.location.search).get('version') === 'native' ? 'native' : 'langchain');
  // 模式与实现是两个维度：原生 Demo 执行原生循环，其余 Demo 共用固定规则。
  const agentId = mode === 'demo' ? (framework === 'native' ? 'demo_native' : 'demo') : implementations[framework].agentId;
  const [session, setSession] = useState(0);
  const [config, setConfig] = useState(null);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  // 并行读取公开配置与摘要；页面卸载时取消请求，忽略主动取消带来的错误。
  useEffect(/** 加载公开配置和订单摘要，并在卸载时取消未完成请求。 */ () => {
    const controller = new AbortController();
    Promise.all(['/api/config', '/api/orders'].map(/** 获取一个公开接口，校验 HTTP 状态后解析 JSON。 */ async (url) => {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('读取配置失败，请刷新页面。');
      return response.json();
    })).then(/** 将已加载的模型配置和订单摘要写入页面状态。 */ ([nextConfig, data]) => { setConfig(nextConfig); setOrders(data.orders); }).catch(/** 仅展示仍有效请求的错误，忽略主动取消。 */ (e) => { if (!controller.signal.aborted) setError(e.message); });
    return /** 取消页面初始化的未完成请求。 */ () => controller.abort();
  }, []);
  /**
   * 切换 Agent 实现并清除旧错误，由 Provider 的 key 变化重建对话。
   * @param {string} next implementations 中的实现标识。
   * @returns {void}
   */
  function changeFramework(next) { setError(''); setFramework(next); }
  /**
   * 切换演示或真实模型模式并清除旧错误，使不同模式使用独立会话。
   * @param {string} next demo 或 live。
   * @returns {void}
   */
  function changeMode(next) { setError(''); setMode(next); }
  /**
   * 递增会话编号并清除错误，触发 Provider 重建且保留页面级配置。
   * @returns {void}
   */
  function resetSession() { setError(''); setSession(/** 递增会话编号以重建 Provider。 */ (value) => value + 1); }
  return { mode, framework, agentId, session, config, orders, error, setError,
    changeFramework, changeMode, resetSession };
}
