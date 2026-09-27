/**
 * 五条学习路线共用的导航，架构总图放在具体实现之前。
 */
import React from 'react';

const routes = [
  ['/learn/architecture', '全栈架构', 'Web → Agent'],
  ['/learn/runtime', 'Copilot Runtime', '共用接入层'],
  ['/learn/native', '原生 JavaScript', 'fetch + messages'],
  ['/learn', 'LangChain', 'createAgent'],
  ['/learn/langgraph', 'LangGraph', 'StateGraph'],
];

/**
 * 渲染架构总图与四门原有课程的路由入口。
 * @param {object} props 组件输入。
 * @param {string} props.active 当前课程的规范路径。
 * @returns {React.ReactElement} 课程导航。
 */
export function CourseNavigation({ active }) {
  return (
    <nav className="course-switch" aria-label="教程版本">
      <span>同一订单助手 · 五条学习路线</span>
      {routes.map(/** 为每条课程渲染带当前页状态的链接。 */ ([path, title, note]) => (
        <a key={path} href={path} aria-current={active === path ? 'page' : undefined}>
          {title} <small>{note}</small>
        </a>
      ))}
      <p>各教程可独立阅读</p>
    </nav>
  );
}
