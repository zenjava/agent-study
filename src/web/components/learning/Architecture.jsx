/**
 * LangChain 入门全景组件：展示浏览器、Agent、模型与业务函数的职责及调用方向。
 */
import React from 'react';

/**
 * 展示用户、模型、工具及程序的职责与调用关系。
 * @returns {React.ReactElement} 当前组件的渲染结果。
 */
export function Architecture() {
  const roles = [
    ['01', 'CopilotKit', '接收问题 · 展示界面', 'React / AG-UI'],
    ['02', 'LangChain', '组织消息 · 调度工具', 'Node / createAgent'],
    ['03', '大语言模型', '选择工具 · 组织回答', '外部模型 API'],
    ['04', '业务函数', '读取订单 · 返回事实', 'Node / getOrder'],
  ];
  return <div className="architecture"><div className="role-grid">{roles.map(/** 渲染一个参与者的名称、职责及执行归属。 */ ([number, name, desc, owner]) => <div className="role" key={name}><span className="role-number">{number}</span><h3>{name}</h3><p>{desc}</p><small>{owner}</small></div>)}</div><p className="architecture-path">页面 <span>→</span> 后端 Agent <span>⇄</span> 模型 <span>＋</span> 业务工具 <span>→</span> 卡片与回答</p></div>;
}
