/**
 * 源码展示组件：添加行号、轻量词法着色和可选高亮范围。
 * 文本由 React 转义后渲染，不将源码作为 HTML 或 JavaScript 执行。
 */
import React from 'react';

// start 保留原文件行号；只有完整源码页启用行 ID，避免同页多个片段产生重复锚点。
export function Code({ value, start = 1, highlight, lineIds = false }) {
  return <pre className="code"><code>{value.split('\n').map((line, index) => {
    const number = start + index;
    const selected = highlight && number >= highlight[0] && number <= highlight[1];
    return <span className={`code-line${selected ? ' source-highlight' : ''}`} id={lineIds ? `source-line-${number}` : undefined} key={index}><span className="line-number" aria-hidden="true">{number}</span><span>{line.split(/(\/\/.*$|'[^']*'|"[^"]*"|\b(?:const|let|async|await|return|new|if|else|export|function|true|false|null)\b)/g).map((part, i) => <span key={i} className={part.startsWith('//') ? 'syntax-comment' : /^['"]/.test(part) ? 'syntax-string' : /^(const|let|async|await|return|new|if|else|export|function|true|false|null)$/.test(part) ? 'syntax-keyword' : undefined}>{part}</span>)}</span></span>;
  })}</code></pre>;
}
