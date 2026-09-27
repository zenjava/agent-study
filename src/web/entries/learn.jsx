/**
 * 教程浏览器入口：按路径选择课程，按 source 参数选择教程页或完整源码页。
 * 三种实现与 Runtime 课程共用挂载流程，课程内容与持久化进度使用各自的定义。
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { getCourse } from '../content/courses.js';
import { LearnPage } from '../pages/learning/LearnPage.jsx';
import { SourcePage } from '../pages/learning/SourcePage.jsx';
import '../styles/learn.css';

const course = getCourse(window.location.pathname);
document.title = `${course.courseName} 实作导读 · Harness`;
createRoot(document.getElementById('root')).render(
  new URLSearchParams(window.location.search).has('source')
    ? <SourcePage lessons={course.lessons} courseName={course.courseName} />
    : <LearnPage course={course} />,
);
