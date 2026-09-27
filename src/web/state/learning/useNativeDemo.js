/**
 * 原生教学回放状态：场景变化时执行一次离线 Agent，收集事件快照供逐步查看。
 * 切换场景或卸载时取消旧运行，避免旧结果覆盖当前演示。
 */
import { useEffect, useState } from 'react';
import { runNativeDemo } from '../../../agent/native-demo.mjs';
import { scenarios, names } from '../../content/native-scenarios.js';

export function useNativeDemo() {
  const [scenario, setScenario] = useState('found');
  const [events, setEvents] = useState([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState('');
  // 每个场景拥有独立取消信号和事件数组；先清空界面，结束后一次性提交快照。
  useEffect(() => {
    const controller = new AbortController();
    const captured = [];
    setEvents([]); setIndex(0); setError('');
    runNativeDemo({
      question: scenarios.find(([id]) => id === scenario)[2], signal: controller.signal, log: () => {},
      onEvent: (event) => { if (names[event.type]) captured.push(event); },
    }).then(() => { if (!controller.signal.aborted) setEvents(captured); })
      .catch((e) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [scenario]);
  const event = events[index];
  // 统计截止当前步骤的事件，避免提前显示尚未回放到的请求或工具执行次数。
  const seen = events.slice(0, index + 1);
  return { scenario, setScenario, events, index, setIndex, error, event, seen };
}
