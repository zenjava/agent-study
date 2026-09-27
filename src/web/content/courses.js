/**
 * 按页面路径选择课程、显示名称和独立进度存储 key。
 * 只返回课程配置，不访问 DOM 或本地存储，入口与页面可直接复用。
 */
import { lessons as chainLessons } from './learning-content.js';
import { graphLessons } from './graph-learning-content.js';
import { nativeLessons } from './native-learning-content.js';

// 原生与图版本使用专用路径，其余学习入口默认 LangChain，兼容 /learn 与 /learn.html。
export function getCourse(pathname) {
  const isGraphCourse = pathname === '/learn/langgraph';
  const isNativeCourse = pathname === '/learn/native';
  return {
    isGraphCourse, isNativeCourse,
    courseName: isNativeCourse ? '原生 JavaScript' : isGraphCourse ? 'LangGraph' : 'LangChain',
    lessons: isNativeCourse ? nativeLessons : isGraphCourse ? graphLessons : chainLessons,
    storageKey: isNativeCourse ? 'harness-learning-native-v1' : isGraphCourse ? 'harness-learning-langgraph-v1' : 'harness-learning-v1',
  };
}
