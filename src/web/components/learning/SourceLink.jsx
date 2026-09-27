/**
 * 构造源码阅读链接：携带文件、节选范围和当前章节，便于新标签页定位并返回教程。
 * 链接的文件参数最终由 SourcePage 的构建时白名单校验。
 */
import React from 'react';

/**
 * 生成当前课程的源码页链接，带上文件、节选范围及返回时使用的章节标识。
 * @param {object} source 源码定位信息。
 * @param {string} source.file 构建时白名单中的文件路径。
 * @param {number} [source.line=1] 起始行号，从 1 开始。
 * @param {string} [source.code=""] 用于计算结束行号的代码节选。
 * @returns {string} 带查询参数及行号锚点的站内地址。
 */
export function sourceHref({ file, line = 1, code = '' }) {
  const params = new URLSearchParams({
    source: file, line: String(line), end: String(line + code.split('\n').length - 1),
    lesson: window.location.hash.slice(1),
  });
  return `${window.location.pathname}?${params}#source-line-${line}`;
}

/**
 * 渲染指向当前课程源码页的链接，在新标签中保留行号定位。
 * @param {object} props 组件输入。
 * @param {object} props.source 包含 file 及可选 line、code 的源码定位信息。
 * @param {React.ReactNode} [props.children] 自定义链接文字，默认显示文件和行号。
 * @returns {React.ReactElement} 当前组件的渲染结果。
 */
export function SourceLink({ source, children }) {
  return <a className="source-jump" href={sourceHref(source)} target="_blank" rel="noreferrer">{children || `${source.file}:L${source.line || 1}`} ↗</a>;
}
