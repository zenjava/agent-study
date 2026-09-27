/**
 * 章节插图分发：按稳定的 lesson.id 选择对应导读、演示或对照表。
 * 通用章节正文、小测和源码阅读仍由学习页面统一组装。
 */
import React from 'react';
import { NativeWalkthrough } from './NativeWalkthrough.jsx';
import { FullStackGuide } from './FullStackGuide.jsx';
import { GraphWalkthrough } from './GraphWalkthrough.jsx';
import { RuntimeGuide } from './RuntimeGuide.jsx';
import { Architecture } from './Architecture.jsx';
import { LangChainGuide } from './LangChainGuide.jsx';
import { ToolAnatomy } from './ToolAnatomy.jsx';
import { RequestLab } from './RequestLab.jsx';
import { RenderPaths } from './RenderPaths.jsx';
import { TokenGuide } from './TokenGuide.jsx';

/**
 * 按章节标识选择原生回放、框架导读或实现对照视图。
 * @param {object} props 组件输入。
 * @param {object} props.lesson 当前章节，包含标识、正文和小测配置。
 * @returns {React.ReactElement} 当前组件的渲染结果。
 */
export function LessonVisual({ lesson }) {
  return <>
        {lesson.id === 'native-map' && <div className="practice-checklist"><h3>先跑一次无需 Key 的 Demo</h3><div className="command-line"><code>npm run demo:native</code></div><p>也可在工作台选择原生 JavaScript + 本地演示，观察实际循环与卡片。</p><a href="/?version=native" target="_blank" rel="noreferrer">打开原生 Demo ↗</a></div>}{lesson.id === 'native-loop' && <NativeWalkthrough />}{lesson.id === 'graph-map' && <FullStackGuide />}{lesson.id === 'graph-loop' && <GraphWalkthrough />}{lesson.id === 'runtime-map' && <RuntimeGuide />}{lesson.id === 'map' && <Architecture />}{lesson.id === 'langchain' && <LangChainGuide />}{lesson.id === 'tool' && <ToolAnatomy />}{lesson.id === 'loop' && <RequestLab />}{lesson.id === 'render' && <RenderPaths />}{lesson.id === 'practice' && <TokenGuide />}
        {lesson.id === 'graph-compare' && <div className="runtime-identities"><h3>同一条调用链，控制点在哪里？</h3><div className="learning-table-wrap"><table><thead><tr><th>职责</th><th>LangChain 版</th><th>LangGraph 版</th></tr></thead><tbody>{[['组装', 'createAgent', 'StateGraph + compile'], ['模型调用', 'Agent 内置模型节点', 'modelNode'], ['工具执行', '框架工具循环', 'toolsNode'], ['控制点', 'createMiddleware', '节点内校验 + 条件边'], ['继续或结束', '框架的循环规则', 'routeAfterModel'], ['返回结果', 'result.messages', 'result.messages']].map(/** 渲染同一职责在 LangChain 与 LangGraph 中的实现方式。 */ ([role, chain, graph]) => <tr key={role}><td>{role}</td><td>{chain}</td><td>{graph}</td></tr>)}</tbody></table></div><p>官方参考：<a href="https://docs.langchain.com/oss/javascript/langgraph/quickstart" target="_blank" rel="noreferrer">Graph API 快速入门 ↗</a> · <a href="https://docs.langchain.com/oss/javascript/langgraph/graph-api" target="_blank" rel="noreferrer">状态、节点与边 ↗</a></p></div>}
  </>;
}
