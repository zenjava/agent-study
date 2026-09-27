/**
 * 工具结构教学图：区分模型看见的名称、描述与 Schema，以及程序实际执行的业务函数。
 */
import React from 'react';

export function ToolAnatomy() {
  return <div className="anatomy"><div><span className="eyebrow">模型看到的</span><h3>工具说明书</h3><dl><dt>name</dt><dd>getOrder</dd><dt>description</dt><dd>按订单号查询完整订单</dd><dt>schema</dt><dd>orderId: string</dd></dl></div><span className="anatomy-arrow" aria-hidden="true">↔</span><div><span className="eyebrow">程序执行的</span><h3>业务函数</h3><code>getOrder({'{ orderId }'})</code><p>输入订单号，查询数据，<br />返回 found 与 order。</p></div></div>;
}
