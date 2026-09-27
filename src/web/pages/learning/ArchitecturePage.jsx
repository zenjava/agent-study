/**
 * 独立的全栈架构教程页面：共用课程导航，主内容是一张可逐步播放的流程图。
 */
import React from 'react';
import { ArchitectureFlow } from '../../components/learning/ArchitectureFlow.jsx';
import { CourseNavigation } from '../../components/learning/CourseNavigation.jsx';

/**
 * 组合学习入口、架构图和页面说明。
 * @returns {React.ReactElement} 全栈架构教程页。
 */
export function ArchitecturePage() {
  return <div className="learning-app architecture-page" data-course="architecture">
    <header className="site-header"><a className="wordmark" href="/learn/architecture"><span aria-hidden="true">h.</span> HARNESS <i>FIELD NOTES / 00</i></a><a className="workspace-link" href="/" target="_blank" rel="noreferrer">打开订单实验台 <span>↗</span></a></header>
    <CourseNavigation active="/learn/architecture" />
    <main className="architecture-main"><header className="architecture-intro"><span className="eyebrow"><span className="live-dot" /> FULL STACK / ARCHITECTURE</span><h1>从浏览器发问，<br /><em>沿着代码走回来。</em></h1><p>一次订单查询经过 Web、Node 接入层、Agent、模型与业务工具，再沿事件流回到页面。整条路径都留在下面这张图里。</p></header><ArchitectureFlow /></main>
    <footer className="site-footer"><span>HARNESS FIELD NOTES</span><span>架构动画是教学路径 · 源码链接来自当前构建快照 · 不请求大模型</span><a href="/learn/runtime">继续阅读 Runtime 教程 →</a></footer>
  </div>;
}
