/**
 * 完整源码只读页：从构建时白名单中取文本，按 URL 指定的行范围高亮。
 * 读取的是已打包字符串，不通过 URL 访问本机任意文件。
 */
import React, { useEffect } from 'react';
import { files } from '../../content/source-files.js';
import { Code } from '../../components/learning/Code.jsx';

export function SourcePage({ lessons, courseName }) {
  const params = new URLSearchParams(window.location.search);
  const file = params.get('source');
  // 只查构建时静态收录的源码；URL 参数不会发起文件读取请求。
  const source = Object.hasOwn(files, file) ? files[file] : null;
  const count = source?.split('\n').length || 1;
  // 将外部行号参数限制为有效正整数及文件行数内，保证高亮范围不会越界。
  const clamp = (value, fallback) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Math.min(Number(value), count) : fallback;
  const line = clamp(params.get('line'), 1);
  const end = Math.max(line, clamp(params.get('end'), line));
  const lesson = lessons.find((item) => item.id === params.get('lesson')) || lessons[0];
  const back = `${window.location.pathname}#${lesson.id}`;
  // 源码页标题显示真实文件名，首次进入或换行号时滚动到定位行。
  useEffect(() => {
    document.title = `${file || '源码'} · Harness`;
    document.getElementById(`source-line-${line}`)?.scrollIntoView({ block: 'center' });
  }, [file, line]);
  return <div className="source-explorer"><header className="source-explorer-header"><a href={back}>← 返回 {courseName} 教程</a><div><span className="eyebrow">FULL SOURCE / READ ONLY</span><h1>{source === null ? '未收录此文件' : file}</h1></div><p>{source === null ? '只提供教学流程用到的白名单源码。' : `已定位 L${line}–${end} · 共 ${count} 行 · 构建时快照`}</p></header>{source === null ? <p className="source-missing">请从教程中的源码链接打开文件。</p> : <Code value={source} highlight={[line, end]} lineIds />}<footer>只读预览 · 修改请在本地编辑器中打开同名文件 · 不包含 .env 内容</footer></div>;
}
