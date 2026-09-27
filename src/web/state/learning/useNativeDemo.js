/**
 * 原生教学回放状态：场景变化时执行一次离线 Agent，收集事件快照供逐步查看。
 * 切换场景或卸载时取消旧运行，避免旧结果覆盖当前演示。
 */
import { useEffect, useState } from 'react';
import { runNativeDemo } from '../../../agent/native/demo/model.demo.mjs';
import { scenarios, names } from '../../content/demo/native-scenarios.demo.js';

/**
 * 随场景变化运行离线原生 Agent，保存完整事件快照并提供逐步回放状态。
 * @returns {object} 场景、事件、当前步骤、错误及相应的状态更新函数。
 */
export function useNativeDemo() {
  const [scenario, setScenario] = useState('found');
  const [events, setEvents] = useState([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState('');
  // 每个场景拥有独立取消信号和事件数组；先清空界面，结束后一次性提交快照。
  useEffect(/** 运行当前场景并收集完整事件，场景变化或卸载时取消旧运行。 */ () => {
    const controller = new AbortController();
    const captured = [];
    setEvents([]); setIndex(0); setError('');
    runNativeDemo({
      question: scenarios.find(/** 查找当前场景对应的演示问题。 */ ([id]) => id === scenario)[2], signal: controller.signal,
      /**
       * 忽略控制台日志，由事件流或测试断言记录运行结果。
       * @returns {void}
       */
      log: () => {},
      /**
       * 收集当前场景支持展示的事件，供运行完成后生成回放快照。
       * @param {object} event 原生 Agent 领域事件。
       * @returns {void}
       */
      onEvent: (event) => { if (names[event.type]) captured.push(event); },
    }).then(/** 只在当前运行仍有效时保存捕获的事件。 */ () => { if (!controller.signal.aborted) setEvents(captured); })
      .catch(/** 只展示当前有效演示运行的错误。 */ (e) => { if (!controller.signal.aborted) setError(e.message); });
    return /** 取消已失效场景的原生演示运行。 */ () => controller.abort();
  }, [scenario]);
  const event = events[index];
  // 统计截止当前步骤的事件，避免提前显示尚未回放到的请求或工具执行次数。
  const seen = events.slice(0, index + 1);
  return { scenario, setScenario, events, index, setIndex, error, event, seen };
}
