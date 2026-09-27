/**
 * 按页面路径选择课程、显示名称和独立进度存储 key。
 * 只返回课程配置，不访问 DOM 或本地存储，入口与页面可直接复用。
 */
import { lessons as chainLessons } from './learning-content.js';
import { graphLessons } from './graph-learning-content.js';
import { nativeLessons } from './native-learning-content.js';
import { runtimeLessons } from './runtime-learning-content.js';
import { architectureLessons } from './architecture-content.js';

/**
 * 按页面路径选择全栈架构图、三种实现或独立 Runtime 课程及进度键。
 * @param {string} pathname 当前 URL 的路径部分。
 * @returns {object} 包含版本标记、课程名称、lessons 和 storageKey 的课程配置。
 */
export function getCourse(pathname) {
  const isGraphCourse = pathname === '/learn/langgraph';
  const isNativeCourse = pathname === '/learn/native';
  const isRuntimeCourse = pathname === '/learn/runtime';
  const isArchitectureCourse = pathname === '/learn/architecture';
  return {
    isGraphCourse, isNativeCourse, isRuntimeCourse, isArchitectureCourse,
    courseName: isArchitectureCourse ? '全栈架构' : isRuntimeCourse ? 'Copilot Runtime' : isNativeCourse ? '原生 JavaScript' : isGraphCourse ? 'LangGraph' : 'LangChain',
    lessons: isArchitectureCourse ? architectureLessons : isRuntimeCourse ? runtimeLessons : isNativeCourse ? nativeLessons : isGraphCourse ? graphLessons : chainLessons,
    storageKey: isArchitectureCourse ? null : isRuntimeCourse ? 'harness-learning-runtime-v1' : isNativeCourse ? 'harness-learning-native-v1' : isGraphCourse ? 'harness-learning-langgraph-v1' : 'harness-learning-v1',
  };
}
