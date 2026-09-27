/**
 * 构造源码阅读链接：携带文件、节选范围和当前章节，便于新标签页定位并返回教程。
 * 链接的文件参数最终由 SourcePage 的构建时白名单校验。
 */
import React from 'react';

// 范围长度由节选行数推导，lesson 保存当前章节，返回教程时可回到原阅读位置。
export function sourceHref({ file, line = 1, code = '' }) {
  const params = new URLSearchParams({
    source: file, line: String(line), end: String(line + code.split('\n').length - 1),
    lesson: window.location.hash.slice(1),
  });
  return `${window.location.pathname}?${params}#source-line-${line}`;
}

export function SourceLink({ source, children }) {
  return <a className="source-jump" href={sourceHref(source)} target="_blank" rel="noreferrer">{children || `${source.file}:L${source.line || 1}`} ↗</a>;
}
