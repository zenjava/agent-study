/**
 * 源码节选阅读器：用本地标签状态切换当前章节的片段，并提供完整文件跳转。
 * 片段及行号由 content 在加载时从构建快照推导，组件只负责展示。
 */
import React, { useState } from 'react';
import { Code } from './Code.jsx';
import { SourceLink } from './SourceLink.jsx';

export function SourceReader({ snippets, title = '回到这份项目的代码' }) {
  // 每个章节维护自己的片段标签；父页面更换章节时通过 key 重建阅读器。
  const [index, setIndex] = useState(0);
  const current = snippets[index];
  return <section className="source-reader" aria-label="项目源码导读">
    <div className="section-heading"><div><span className="eyebrow">READ THE SOURCE</span><h3>{title}</h3></div><span className="source-badge">构建时源码</span></div>
    <div className="source-tabs" role="tablist" aria-label="代码片段">{snippets.map((snippet, i) => <button key={snippet.label} id={`source-tab-${i}`} role="tab" aria-selected={index === i} aria-controls="source-code-panel" onClick={() => setIndex(i)}>{snippet.label}</button>)}</div>
    <div id="source-code-panel" role="tabpanel" aria-labelledby={`source-tab-${index}`}>
      {current.note && <p className="source-explanation">{current.note}</p>}
      <div className="code-caption"><SourceLink source={current} /><span>L{current.line}–{current.line + current.code.split('\n').length - 1} · 节选</span></div>
      <Code value={current.code} start={current.line} />
    </div>
    <p className="source-note">点击文件名，在新标签页查看完整源码并定位高亮行；此处保留阅读位置。源码随 npm run build 更新。</p>
  </section>;
}
