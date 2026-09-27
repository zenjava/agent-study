/**
 * 教程导航与答题进度：按课程存储 key 恢复、保存和重置已通过的章节。
 * 章节导航同步 URL hash；localStorage 不可用时仍允许在当前页面学习。
 */
import { useState } from 'react';

/**
 * 恢复当前课程中仍有效的正确答案，忽略损坏、过期或无法读取的存储记录。
 * @param {Array<object>} lessons 当前课程章节，包含 id 和 quiz.answer。
 * @param {string} storageKey 当前课程的 localStorage 键。
 * @returns {Object<string, number>} 章节 ID 到正确选项索引的映射。
 */
function initialProgress(lessons, storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return Object.fromEntries(lessons.filter(/** 只保留存储答案与当前章节正确答案一致的记录。 */ (lesson) => saved?.[lesson.id] === lesson.quiz.answer).map(/** 生成章节 ID 与正确选项索引的键值对。 */ (lesson) => [lesson.id, lesson.quiz.answer]));
  } catch { return {}; }
}

/**
 * 维护当前章节、完成记录与总结状态，并将导航和答题结果同步到 URL 及本地存储。
 * @param {object} options 课程配置。
 * @param {Array<object>} options.lessons 当前课程的章节。
 * @param {string} options.storageKey 课程专属的 localStorage 键。
 * @returns {object} 章节和进度状态，以及 navigate、complete、resetProgress 操作。
 */
export function useLearningProgress({ lessons, storageKey }) {
  const hashIndex = lessons.findIndex(/** 根据 URL hash 查找初始章节。 */ (lesson) => `#${lesson.id}` === window.location.hash);
  const [active, setActive] = useState(hashIndex < 0 ? 0 : hashIndex);
  const [progress, setProgress] = useState(/** 仅在初始化时恢复当前课程的学习进度。 */ () => initialProgress(lessons, storageKey));
  const [summary, setSummary] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  const completed = Object.keys(progress).length;
  const lesson = lessons[active];
  /**
   * 切换当前章节、同步 URL hash，并在下一帧定位阅读位置及标题焦点。
   * @param {number} index lessons 中有效的章节索引，从 0 开始。
   * @returns {void}
   */
  function navigate(index) {
    setActive(index); setSummary(false);
    window.history.replaceState(null, '', `#${lessons[index].id}`);
    requestAnimationFrame(/** 在章节渲染后聚焦标题并滚动到阅读起点。 */ () => {
      document.getElementById('lesson-title')?.focus({ preventScroll: true });
      document.getElementById('lesson-start')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
  }
  /**
   * 合并并保存当前章节的正确答案，本地存储不可用时仍保留页面内进度。
   * @param {number} answer 已由 Quiz 确认正确的选项索引。
   * @returns {void}
   */
  function complete(answer) {
    const next = { ...progress, [lesson.id]: answer };
    setProgress(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* 隐私模式下仍可继续学习。 */ }
  }
  /**
   * 清空本课程的进度和总结状态，重建题目选择状态并导航至第一节。
   * @returns {void}
   */
  function resetProgress() {
    setProgress({}); setSummary(false); setResetCount(/** 递增重建编号以清除小测的本地选择。 */ (value) => value + 1);
    try { localStorage.removeItem(storageKey); } catch { /* 无法持久化时只重置当前页面。 */ }
    navigate(0);
  }
  return { active, progress, summary, setSummary, resetCount, completed, lesson, navigate, complete, resetProgress };
}
