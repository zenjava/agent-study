/**
 * 教程浏览器入口：按路径选择课程，按 source 参数选择教程页或完整源码页。
 * 架构图与四门课程共用 HTML 壳；源码页沿用当前路径与白名单。
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { getCourse } from '../content/courses.js';
import { LearnPage } from '../pages/learning/LearnPage.jsx';
import { SourcePage } from '../pages/learning/SourcePage.jsx';
import { ArchitecturePage } from '../pages/learning/ArchitecturePage.jsx';
import '../styles/learn.css';
import '../styles/architecture.css';

const course = getCourse(window.location.pathname);
document.title = `${course.courseName} 实作导读 · Harness`;
createRoot(document.getElementById('root')).render(
  new URLSearchParams(window.location.search).has('source')
    ? <SourcePage lessons={course.lessons} courseName={course.courseName} />
    : course.isArchitectureCourse ? <ArchitecturePage /> : <LearnPage course={course} />,
);
