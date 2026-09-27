/**
 * 章节小测：本地保留当前选项，只有答对时才通知上层保存完成进度。
 * 题目变化由父组件的 key 触发重建，避免上一题选项残留。
 */
import React, { useState } from 'react';

/**
 * 恢复小测选择，展示答题反馈，仅在答对时通知上层保存进度。
 * @param {object} props 组件输入。
 * @param {object} props.lesson 当前章节，包含标识、正文和小测配置。
 * @param {number} [props.saved] 已保存的正确选项索引。
 * @param {function(number): void} props.onComplete 答对后保存选项的回调。
 * @param {boolean} props.last 是否为当前课程最后一节。
 * @param {function(): void} props.onNext 前往下一节或显示总结的操作。
 * @returns {React.ReactElement} 当前组件的渲染结果。
 */
export function Quiz({ lesson, saved, onComplete, last, onNext }) {
  // 初始化时恢复已保存答案；之后的错误选项只留在组件中，不写入学习进度。
  const [selected, setSelected] = useState(saved ?? null);
  const correct = selected === lesson.quiz.answer;
  return <section className="quiz" aria-label="本节小测"><div className="quiz-heading"><span className="eyebrow">CHECK YOUR UNDERSTANDING</span><span>一个问题，确认理解</span></div><h3>{lesson.quiz.question}</h3><div className="quiz-options">{lesson.quiz.options.map(/** 渲染选项、选中状态及正确性反馈。 */ (option, index) => <button key={option} aria-pressed={selected === index} className={selected === index ? correct ? 'correct' : 'incorrect' : ''} onClick={/** 更新所选答案，仅在答对时通知上层保存章节进度。 */ () => { setSelected(index); if (index === lesson.quiz.answer) onComplete(index); }}><span>{String.fromCharCode(65 + index)}</span>{option}{selected === index && <b aria-hidden="true">{correct ? '✓' : '↺'}</b>}</button>)}</div>{selected !== null && <p className={`quiz-feedback ${correct ? 'is-correct' : ''}`} role="status"><b>{correct ? '理解正确。' : '再想一下。'}</b>{lesson.quiz.explanation}</p>}<div className="quiz-bottom"><small>答对后点亮本节，进度保存在当前浏览器。</small><button className="primary-button" disabled={!correct} onClick={onNext}>{last ? '查看我的学习进度 →' : '理解了，下一节 →'}</button></div></section>;
}
