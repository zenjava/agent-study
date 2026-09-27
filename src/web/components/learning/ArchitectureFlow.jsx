/**
 * 全栈架构交互图：在同一张泳道图中播放请求与返回路径。
 * 节点内容来自课程数据；连线按实际卡片位置测量，缩放时仍能对齐。
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getArchitectureSteps } from '../../content/architecture-content.js';
import { Code } from './Code.jsx';
import { SourceLink } from './SourceLink.jsx';

const lanes = [
  ['web', '01', 'Web 浏览器', '输入 · 会话 · 展示'],
  ['server', '02', 'Node 服务端', 'HTTP · Runtime · 协议'],
  ['agent', '03', 'Agent 编排', '模型循环 · 工具边界'],
  ['external', '04', '外部与数据', '模型 API · 虚构订单'],
];
const modes = [
  ['langchain', 'LangChain'], ['native', '原生 JavaScript'], ['langgraph', 'LangGraph'],
];

/**
 * 根据两个节点相对位置生成一段带缓动控制点的 SVG 连线。
 * @param {DOMRect} from 当前节点的浏览器矩形。
 * @param {DOMRect} to 下一节点的浏览器矩形。
 * @param {DOMRect} board 整张图的浏览器矩形。
 * @param {boolean} sameLane 两节点是否在同一泳道。
 * @returns {string} 以架构图左上角为原点的 SVG path。
 */
function connectorPath(from, to, board, sameLane) {
  if (sameLane) {
    const x1 = from.left + from.width / 2 - board.left;
    const y1 = from.bottom - board.top;
    const x2 = to.left + to.width / 2 - board.left;
    const y2 = to.top - board.top;
    const mid = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
  }
  const forward = to.left > from.left;
  const x1 = (forward ? from.right : from.left) - board.left;
  const y1 = from.top + from.height / 2 - board.top;
  const x2 = (forward ? to.left : to.right) - board.left;
  const y2 = to.top + to.height / 2 - board.top;
  const mid = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
}

/**
 * 展示可播放的全栈泳道图、节点悬停说明和对应源码跳转。
 * @returns {React.ReactElement} 交互式架构流程图。
 */
export function ArchitectureFlow() {
  const [framework, setFramework] = useState('langchain');
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(null);
  const [playing, setPlaying] = useState(true);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [paths, setPaths] = useState([]);
  const steps = useMemo(/** 切换实现时复用同一条全栈路线，仅替换 Agent 节点与源码。 */ () => getArchitectureSteps(framework), [framework]);
  const boardRef = useRef(null);
  const nodeRefs = useRef([]);
  const inspected = hovered ?? active;
  const detail = steps[inspected];
  const selectedSource = detail.sources[sourceIndex] ?? detail.sources[0];

  useEffect(/** 尊重系统减少动态效果的偏好，不自动播放逐节点动画。 */ () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPlaying(false);
  }, []);
  useEffect(/** 自动播放当前节点到下一节点的流转，最后一步停止。 */ () => {
    if (!playing) return undefined;
    if (active === steps.length - 1) { setPlaying(false); return undefined; }
    const timer = window.setTimeout(/** 推进到下一处理节点。 */ () => setActive((index) => index + 1), 2100);
    return /** 清除上一步计时器，避免暂停或切换时继续推进。 */ () => window.clearTimeout(timer);
  }, [active, playing, steps.length]);
  useEffect(/** 节点变化时回到对应说明中的第一段源码。 */ () => setSourceIndex(0), [inspected]);
  useLayoutEffect(/** 测量每个卡片的实际边界，为全图生成随布局变化的连接路径。 */ () => {
    const board = boardRef.current;
    if (!board) return undefined;
    /**
     * 从当前布局计算相邻节点之间的路径。
     * @returns {void}
     */
    const measure = () => {
      const rect = board.getBoundingClientRect();
      const next = steps.slice(0, -1).map(/** 连接本节点与下一节点。 */ (step, index) => {
        const from = nodeRefs.current[index]?.getBoundingClientRect();
        const to = nodeRefs.current[index + 1]?.getBoundingClientRect();
        return from && to ? connectorPath(from, to, rect, step.lane === steps[index + 1].lane) : '';
      });
      setPaths(next);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(board);
    nodeRefs.current.forEach(/** 节点文本或尺寸变化时重新对齐连线。 */ (node) => { if (node) observer?.observe(node); });
    window.addEventListener('resize', measure);
    return /** 释放节点尺寸观察与窗口监听。 */ () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [framework, steps]);

  /**
   * 手动定位步骤并暂停自动播放，让用户有时间阅读对应逻辑。
   * @param {number} index 目标节点序号。
   * @returns {void}
   */
  function selectStep(index) {
    setActive(index);
    setHovered(null);
    setPlaying(false);
  }

  /**
   * 从当前节点继续，结束时从第一个节点重新播放。
   * @returns {void}
   */
  function togglePlayback() {
    if (active === steps.length - 1) {
      setActive(0);
      setPlaying(true);
      return;
    }
    setPlaying((value) => !value);
  }

  return (
    <section className="flow-tutorial" aria-label="Web 到 Agent 的完整架构流程图">
      <div className="flow-toolbar">
        <div>
          <span className="flow-kicker">ONE QUESTION / FULL STACK</span>
          <h2>一张图，看完一次订单查询。</h2>
          <p>图中演示真实模型查询 A1001 的典型成功路径。逐步播放连接线；将鼠标移到节点或点选节点，查看处理逻辑与真实源码。</p>
        </div>
        <div className="flow-mode">
          <span>切换 Agent 实现</span>
          <div role="group" aria-label="Agent 实现">
            {modes.map(/** 渲染三种真实模型实现切换按钮。 */ ([id, label]) => (
              <button
                key={id}
                aria-pressed={framework === id}
                onClick={/** 在同一流程中切换 Agent 的源码实现。 */ () => {
                  setFramework(id);
                  setActive(0);
                  setPlaying(false);
                  setHovered(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flow-playbar">
        <div>
          <span className="flow-live-dot" data-playing={playing} />
          <strong>{String(active + 1).padStart(2, '0')} / {steps.length}</strong>
          <span>当前：{steps[active].title}</span>
        </div>
        <div className="flow-controls">
          <button onClick={/** 返回上一节点并暂停播放。 */ () => selectStep(Math.max(0, active - 1))} disabled={active === 0}>← 上一步</button>
          <button className="flow-play" onClick={togglePlayback}>
            {playing ? '暂停动画 Ⅱ' : active === steps.length - 1 ? '重新播放 ↺' : '继续播放 ▶'}
          </button>
          <button onClick={/** 前往下一节点并暂停播放。 */ () => selectStep(Math.min(steps.length - 1, active + 1))} disabled={active === steps.length - 1}>下一步 →</button>
        </div>
      </div>

      <div className="flow-study">
        <div className="flow-board-scroll">
          <div className="flow-board">
            <div className="flow-lanes">
              {lanes.map(/** 渲染 Web、服务端、Agent 与外部依赖四个泳道标题。 */ ([id, number, title, subtitle]) => (
                <div key={id} data-lane={id}>
                  <small>{number} / LAYER</small>
                  <strong>{title}</strong>
                  <span>{subtitle}</span>
                </div>
              ))}
            </div>
            <div className="flow-canvas" ref={boardRef} role="list" aria-label="一次订单查询的处理顺序">
              <svg className="flow-connections" aria-hidden="true" width="100%" height="100%">
                <defs>
                  <marker id="flow-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                    <path d="M 0 0 L 7 3.5 L 0 7" />
                  </marker>
                </defs>
                {paths.map(/** 用高亮和传输动画展示当前节点到下一节点的交接。 */ (path, index) => (
                  <path
                    key={index}
                    d={path}
                    className={index < active ? 'visited' : index === active ? 'transmitting' : ''}
                    markerEnd="url(#flow-arrow)"
                  />
                ))}
              </svg>
              {steps.map(/** 渲染一个可悬停、可聚焦并可直接查看源码的处理节点。 */ (step, index) => (
                <article
                  key={step.id}
                  className={`flow-node ${index === active ? 'active' : ''} ${index < active ? 'passed' : ''} ${index === inspected ? 'inspected' : ''}`}
                  data-lane={step.lane}
                  style={{ gridColumn: step.col, gridRow: step.row }}
                  ref={/** 保存节点引用以计算 SVG 连线。 */ (node) => { nodeRefs.current[index] = node; }}
                  role="listitem"
                  onMouseEnter={/** 悬停时选中说明，移向代码栏后仍保留此节点。 */ () => setHovered(index)}
                  onFocusCapture={/** 键盘进入节点时同步显示说明。 */ () => setHovered(index)}
                >
                  <button
                    className="flow-node-main"
                    onClick={/** 点选节点并暂停播放。 */ () => selectStep(index)}
                    aria-label={`第 ${index + 1} 步：${step.title}，查看处理逻辑`}
                  >
                    <small>{String(index + 1).padStart(2, '0')} <span>{step.meta}</span></small>
                    <strong>{step.title}</strong>
                    <span>{step.summary}</span>
                  </button>
                  <SourceLink source={step.sources[0]}>看源码</SourceLink>
                </article>
              ))}
            </div>
          </div>
        </div>

        <aside className="flow-detail" aria-label="所选节点的处理逻辑与关键代码">
          <div className="flow-detail-top">
            <span>STEP {String(inspected + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}</span>
            <span>{detail.meta}</span>
          </div>
          <h3>{detail.title}</h3>
          <p>{detail.detail}</p>
          <div className="flow-handoff">
            <small>下一步怎样流转</small>
            <strong>{detail.handoff}</strong>
          </div>
          <div className="flow-code-heading">
            <span>关键代码 · 当前仓库</span>
            <SourceLink source={selectedSource}>跳转到源码</SourceLink>
          </div>
          {detail.sources.length > 1 && (
            <div className="flow-source-tabs" role="group" aria-label="选择关键代码">
              {detail.sources.map(/** 展示当前节点可切换的源码片段。 */ (item, index) => (
                <button
                  key={`${item.file}:${item.line}`}
                  aria-pressed={sourceIndex === index}
                  onClick={/** 查看当前用途对应的源码节选。 */ () => setSourceIndex(index)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
          <div className="flow-source-file">{selectedSource.file}:L{selectedSource.line}</div>
          <Code value={selectedSource.code} start={selectedSource.line} />
        </aside>
      </div>

      <div className="flow-footnotes">
        <p><b>分层边界</b> Web 在浏览器中运行；服务端和 Agent 是同一个 Node 进程里的不同代码职责；模型 API 在项目外，订单样本在项目内。</p>
        <p><b>路径边界</b> 未配置 Key 时，OrderAgent 返回 RUN_ERROR；模型不调用工具时会跳过查单分支。本地演示模式使用固定规则或脚本模型。当前没有持久化会话或长期记忆。</p>
      </div>
    </section>
  );
}
