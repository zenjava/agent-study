/**
 * 教程导航与答题进度：按课程存储 key 恢复、保存和重置已通过的章节。
 * 章节导航同步 URL hash；localStorage 不可用时仍允许在当前页面学习。
 */
import { useState } from 'react';

// 仅恢复仍存在且答案索引匹配当前题目的章节，忽略损坏或过期的本地记录。
function initialProgress(lessons, storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return Object.fromEntries(lessons.filter((lesson) => saved?.[lesson.id] === lesson.quiz.answer).map((lesson) => [lesson.id, lesson.quiz.answer]));
  } catch { return {}; }
}

export function useLearningProgress({ lessons, storageKey }) {
  const hashIndex = lessons.findIndex((lesson) => `#${lesson.id}` === window.location.hash);
  const [active, setActive] = useState(hashIndex < 0 ? 0 : hashIndex);
  const [progress, setProgress] = useState(() => initialProgress(lessons, storageKey));
  const [summary, setSummary] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  const completed = Object.keys(progress).length;
  const lesson = lessons[active];
  // 切换章节后同步 hash，并把阅读位置和键盘焦点移到章节标题。
  function navigate(index) {
    setActive(index); setSummary(false);
    window.history.replaceState(null, '', `#${lessons[index].id}`);
    requestAnimationFrame(() => {
      document.getElementById('lesson-title')?.focus({ preventScroll: true });
      document.getElementById('lesson-start')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
  }
  // 小测组件只在答对时调用；按章节 ID 合并进度，其他章节的结果不受影响。
  function complete(answer) {
    const next = { ...progress, [lesson.id]: answer };
    setProgress(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* 隐私模式下仍可继续学习。 */ }
  }
  // 清除本课程进度并增加重建计数，使 Quiz 的本地选择状态也恢复初始值。
  function resetProgress() {
    setProgress({}); setSummary(false); setResetCount((value) => value + 1);
    try { localStorage.removeItem(storageKey); } catch { /* 无法持久化时只重置当前页面。 */ }
    navigate(0);
  }
  return { active, progress, summary, setSummary, resetCount, completed, lesson, navigate, complete, resetProgress };
}
