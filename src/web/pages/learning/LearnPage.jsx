/**
 * 教程页面壳：组合课程导航、章节内容、交互示例、源码节选和小测。
 * 课程数据来自 content，导航与进度由 useLearningProgress 维护。
 */
import React from 'react';
import { fileMap } from '../../content/learning-content.js';
import { SourceReader } from '../../components/learning/SourceReader.jsx';
import { SourceLink } from '../../components/learning/SourceLink.jsx';
import { Quiz } from '../../components/learning/Quiz.jsx';
import { LessonVisual } from '../../components/learning/LessonVisual.jsx';
import { useLearningProgress } from '../../state/learning/useLearningProgress.js';

const pad = (value) => String(value).padStart(2, '0');

export function LearnPage({ course }) {
  const { isGraphCourse, isNativeCourse, courseName, lessons } = course;
  // 页面只消费当前章节与操作回调；持久化、导航和重置逻辑由状态层维护。
  const { active, progress, summary, setSummary, resetCount, completed, lesson,
    navigate, complete, resetProgress } = useLearningProgress(course);
  return <div className="learning-app" data-course={isNativeCourse ? 'native' : isGraphCourse ? 'langgraph' : 'langchain'}>
    <header className="site-header"><a className="wordmark" href="/learn"><span aria-hidden="true">h.</span> HARNESS <i>FIELD NOTES / 01</i></a><a className="workspace-link" href="/" target="_blank" rel="noreferrer">打开订单实验台 <span>↗</span></a></header>
    <nav className="course-switch" aria-label="教程版本"><span>同一订单助手 · 三条学习路线</span><a href="/learn/native" aria-current={isNativeCourse ? 'page' : undefined}>原生 JavaScript <small>fetch + messages</small></a><a href="/learn" aria-current={!isGraphCourse && !isNativeCourse ? 'page' : undefined}>LangChain <small>createAgent</small></a><a href="/learn/langgraph" aria-current={isGraphCourse ? 'page' : undefined}>LangGraph <small>StateGraph</small></a><p>三版教程与学习进度独立保存</p></nav>
    <section className="hero"><div><div className="eyebrow"><span className="live-dot" /> {courseName.toUpperCase()} · 从源码到原理</div><h1>从一个问题，<br />读懂一个 <em>{isGraphCourse ? 'Graph.' : 'Agent.'}</em></h1><p>以你正在运行的订单助手为例。<br />看调用，读代码，动手验证，把抽象的流程走一遍。</p><button className="hero-link" onClick={() => navigate(lessons.findIndex((item) => item.id === (isNativeCourse ? 'native-loop' : isGraphCourse ? 'graph-loop' : 'loop')))}>先看一次完整请求 <span>↗</span></button></div><div className="hero-note"><span className="note-index">LEARNING ROUTE</span><strong>{lessons.length} <small>节实作导读</small></strong><p>每节一个核心概念<br />源码节选 + 交互演示 + 理解检查</p><div><span>NODE + REACT</span><span>{isGraphCourse ? '约 35–40 分钟' : '约 30–40 分钟'}</span></div></div></section>
    <div className="learning-layout" id="lesson-start"><aside className="lesson-sidebar"><div className="sidebar-title"><span>学习路线</span><b>{pad(completed)} / {pad(lessons.length)}</b></div><div className="progress-track" role="progressbar" aria-label="已完成章节" aria-valuemin={0} aria-valuemax={lessons.length} aria-valuenow={completed}><span style={{ width: `${completed / lessons.length * 100}%` }} /></div><nav aria-label="学习章节">{lessons.map((item, index) => <button key={item.id} className={index === active ? 'selected' : ''} aria-current={index === active ? 'step' : undefined} onClick={() => navigate(index)}><span className={progress[item.id] !== undefined ? 'lesson-number done' : 'lesson-number'}>{progress[item.id] !== undefined ? '✓' : pad(index + 1)}</span><span><strong>{item.name}</strong><small>{item.subtitle}</small></span><span className="nav-arrow">↗</span></button>)}</nav><div className="sidebar-tip"><span>你的阅读顺序</span><p>先读业务函数，<br />再看 Agent 编排，<br />最后连接到页面。</p><code>{isNativeCourse ? 'fetch → tool → messages' : isGraphCourse ? 'State → Node → Edge' : 'getOrder → createAgent'}<br />{isNativeCourse ? '→ answer → render' : '→ invoke → render'}</code></div></aside>
      <main className="lesson-content" key={`${lesson.id}:${resetCount}`}><div className="lesson-meta"><span>CHAPTER {pad(active + 1)}</span><span>{lesson.minutes} / 概念 · 代码 · 小测</span></div><h2 id="lesson-title" tabIndex={-1}>{lesson.title}</h2><p className="lesson-intro">{lesson.intro}</p>
        <LessonVisual lesson={lesson} />
        {lesson.id === 'map' && <div className="entry-source"><SourceReader snippets={lesson.snippets} title="入口示例：runAgent 从这里开始" /></div>}
        <div className="reading-points">{lesson.points.map(([title, content], index) => <section key={title}><span className="point-number">{pad(index + 1)}</span><div><h3>{title}</h3><p>{content}</p></div></section>)}</div>
        <div className="takeaway"><span>记住这一句</span><p>{lesson.takeaway}</p></div>
        {lesson.id !== 'map' && <SourceReader key={lesson.id} snippets={lesson.snippets} />}
        {lesson.id === 'map' && <details className="file-map"><summary>展开整个项目的文件地图 <span>＋</span></summary><div>{fileMap.map(([file, role, purpose]) => <div className="file-row" key={file}><SourceLink source={{ file }} /><b>{role}</b><span>{purpose}</span></div>)}</div><p>src/agent/cli/query.mjs 是不经过模型的最小命令行示例；React 页面通过 /api/copilotkit 连接服务端。src/web/styles/chat.css 管视觉，test/ 覆盖数据、Agent 与服务协议。</p></details>}
        {lesson.id === 'practice' && <div className="practice-checklist"><h3>下一次开发，照这个顺序走</h3><ol><li>写清工具输入、返回字段与业务含义。</li><li>单独调用业务函数，验证成功与失败返回值。</li><li>用 tool 注册，接入模型和执行边界。</li><li>用 invoke 运行，检查 tool_call_id 与第二次 messages。</li><li>按工具名称绑定 UI，再补业务场景验证。</li></ol><div className="command-line"><code>npm test</code><span>→</span><code>npm run build</code><span>→</span><code>npm start</code></div></div>}
        <Quiz key={lesson.id} lesson={lesson} saved={progress[lesson.id]} onComplete={complete} last={active === lessons.length - 1} onNext={() => active === lessons.length - 1 ? setSummary(true) : navigate(active + 1)} />
        {summary && <section className="completion" role="status"><span className="eyebrow">KEEP BUILDING</span><h3>{completed === lessons.length ? '全部章节导读完成。现在，动手写一个工具。' : `已经完成 ${completed} / ${lessons.length} 节，按自己的节奏继续。`}</h3><p>{completed === lessons.length ? '你已经检查过工具定义、模型约束、调用循环、UI 映射和执行边界。接下来用上面的练习，把概念变成自己的代码。' : '左侧带勾的是已通过小测的章节，可以回到其他章节继续学习。'}</p><a href="/" target="_blank" rel="noreferrer">去订单实验台观察一次真实流程 ↗</a></section>}
        <footer className="lesson-footer"><button className="quiet-button" disabled={active === 0} onClick={() => navigate(active - 1)}>← 上一节</button><span>HARNESS / LEARN BY READING & DOING</span>{active < lessons.length - 1 ? <button className="quiet-button" onClick={() => navigate(active + 1)}>先浏览下一节 →</button> : <button className="quiet-button" onClick={() => navigate(0)}>回到第一节 ↺</button>}</footer>
      </main></div><footer className="site-footer"><span>HARNESS FIELD NOTES</span><span>基于当前仓库 · 学习页不请求大模型 · 订单为虚构数据</span><button className="quiet-button" onClick={resetProgress}>重置学习进度 ↺</button></footer>
  </div>;
}
