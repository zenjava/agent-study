/**
 * 源码展示组件：添加行号、轻量词法着色和可选高亮范围。
 * 文本由 React 转义后渲染，不将源码作为 HTML 或 JavaScript 执行。
 */
import React from 'react';

/**
 * 将源码按行转义展示，附上原文件行号、轻量着色及可选高亮。
 * @param {object} props 组件输入。
 * @param {string} props.value 待展示的源码文本。
 * @param {number} [props.start=1] 源码首行在原文件中的行号。
 * @param {number[]} [props.highlight] 包含起止行号的高亮范围。
 * @param {boolean} [props.lineIds=false] 是否为完整源码页生成行号锚点。
 * @returns {React.ReactElement} 当前组件的渲染结果。
 */
export function Code({ value, start = 1, highlight, lineIds = false }) {
  return <pre className="code"><code>{value.split('\n').map(/** 渲染一行源码及其原始行号、定位 ID 和高亮状态。 */ (line, index) => {
    const number = start + index;
    const selected = highlight && number >= highlight[0] && number <= highlight[1];
    return <span className={`code-line${selected ? ' source-highlight' : ''}`} id={lineIds ? `source-line-${number}` : undefined} key={index}><span className="line-number" aria-hidden="true">{number}</span><span>{line.split(/(\/\/.*$|'[^']*'|"[^"]*"|\b(?:const|let|async|await|return|new|if|else|export|function|true|false|null)\b)/g).map(/** 为注释、字符串和关键字片段选择轻量语法样式。 */ (part, i) => <span key={i} className={part.startsWith('//') ? 'syntax-comment' : /^['"]/.test(part) ? 'syntax-string' : /^(const|let|async|await|return|new|if|else|export|function|true|false|null)$/.test(part) ? 'syntax-keyword' : undefined}>{part}</span>)}</span></span>;
  })}</code></pre>;
}
