/**
 * 工作台浏览器入口：先加载 CopilotKit 基础样式，再加载业务样式并挂载聊天页。
 * 只处理页面启动，配置读取、会话状态和 UI 组装由下层模块负责。
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@copilotkit/react-core/v2/styles.css';
import '../styles/chat.css';
import { ChatPage } from '../pages/chat/ChatPage.jsx';

createRoot(document.getElementById('root')).render(<ChatPage />);
