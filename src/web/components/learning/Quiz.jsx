/**
 * 章节小测：本地保留当前选项，只有答对时才通知上层保存完成进度。
 * 题目变化由父组件的 key 触发重建，避免上一题选项残留。
 */
import React, { useState } from 'react';

export function Quiz({ lesson, saved, onComplete, last, onNext }) {
  // 初始化时恢复已保存答案；之后的错误选项只留在组件中，不写入学习进度。
  const [selected, setSelected] = useState(saved ?? null);
  const correct = selected === lesson.quiz.answer;
  return <section className="quiz" aria-label="本节小测"><div className="quiz-heading"><span className="eyebrow">CHECK YOUR UNDERSTANDING</span><span>一个问题，确认理解</span></div><h3>{lesson.quiz.question}</h3><div className="quiz-options">{lesson.quiz.options.map((option, index) => <button key={option} aria-pressed={selected === index} className={selected === index ? correct ? 'correct' : 'incorrect' : ''} onClick={() => { setSelected(index); if (index === lesson.quiz.answer) onComplete(index); }}><span>{String.fromCharCode(65 + index)}</span>{option}{selected === index && <b aria-hidden="true">{correct ? '✓' : '↺'}</b>}</button>)}</div>{selected !== null && <p className={`quiz-feedback ${correct ? 'is-correct' : ''}`} role="status"><b>{correct ? '理解正确。' : '再想一下。'}</b>{lesson.quiz.explanation}</p>}<div className="quiz-bottom"><small>答对后点亮本节，进度保存在当前浏览器。</small><button className="primary-button" disabled={!correct} onClick={onNext}>{last ? '查看我的学习进度 →' : '理解了，下一节 →'}</button></div></section>;
}
