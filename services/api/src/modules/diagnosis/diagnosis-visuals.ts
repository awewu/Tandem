/**
 * 原理示意图（模板级 · 第 4 步）—— 纯函数。
 * 事实源：docs/RYSNOVA-DIAGNOSIS-LIGHT-INTAKE-ALIGNMENT-2026-07-05.md §2 G（问诊用「示意图」，逐户 CAD 下沉设计）。
 *
 * 诚实红线：
 *  - 只画「系统如何连接、各自解决什么」的原理示意，**不含任何性能数字/节能率/效果承诺**。
 *  - 标注「原理示意图，非工程图纸」；逐户精确布局与选型由设计/BIM 阶段出。
 *  - 智能控制存在时作为联动中枢；否则以「家」为中心。连接关系为通用原理，不代表实际管路。
 */

import { SYSTEM_LABELS } from './diagnosis-engine';

export type SystemCode = keyof typeof SYSTEM_LABELS;

/** 各系统在原理图中的角色说明（描述功能，非效果承诺）。 */
const SYSTEM_ROLE: Record<string, string> = {
  hot_water: '全屋热水循环供应',
  heating: '冬季地暖/末端采暖',
  water_treatment: '入户水质处理',
  fresh_air: '室内换气与净化',
  air: '夏季制冷 / 全空气调节',
  smart_control: '各系统统一联动调度',
};

export interface DiagramNode { code: string; label: string; role: string; hub: boolean; x: number; y: number; }
export interface DiagramEdge { from: string; to: string; }
export interface PrincipleDiagram {
  systems: { code: string; label: string; role: string }[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  svg: string;
  note: string;
}

const NOTE = '原理示意图，说明各系统如何协同工作，非工程图纸；实际管路、点位与选型以现场勘测和设计阶段为准。';

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 由选中系统装配原理示意图（含内联 SVG）。
 * 有智能控制 → 智控为中枢；否则以「家」为中枢。中枢连接每个外围系统。
 */
export function buildPrincipleDiagram(systemCodesRaw: string[] = []): PrincipleDiagram {
  const codes = [...new Set(systemCodesRaw.filter((c) => SYSTEM_LABELS[c]))];
  const systems = codes.map((code) => ({ code, label: SYSTEM_LABELS[code], role: SYSTEM_ROLE[code] || '' }));

  const hasSmart = codes.includes('smart_control');
  const hubCode = hasSmart ? 'smart_control' : '__home__';
  const hubLabel = hasSmart ? SYSTEM_LABELS['smart_control'] : '家';
  const hubRole = hasSmart ? SYSTEM_ROLE['smart_control'] : '舒适家整体';
  const peripherals = codes.filter((c) => c !== 'smart_control');

  // 画布与布局（径向）。
  const W = 760;
  const cx = W / 2;
  const R = 210;
  const N = Math.max(peripherals.length, 1);
  const cy = 60 + R + 40;
  const H = cy + R + 90;

  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];
  nodes.push({ code: hubCode, label: hubLabel, role: hubRole, hub: true, x: cx, y: cy });

  peripherals.forEach((code, i) => {
    const angle = (-90 + (360 / N) * i) * (Math.PI / 180);
    const x = Math.round(cx + R * Math.cos(angle));
    const y = Math.round(cy + R * Math.sin(angle));
    nodes.push({ code, label: SYSTEM_LABELS[code], role: SYSTEM_ROLE[code] || '', hub: false, x, y });
    edges.push({ from: hubCode, to: code });
  });

  return { systems, nodes, edges, svg: renderSvg(nodes, edges, W, H, hasSmart), note: NOTE };
}

function renderSvg(nodes: DiagramNode[], edges: DiagramEdge[], W: number, H: number, hasSmart: boolean): string {
  const byCode = new Map(nodes.map((n) => [n.code, n]));
  const NODE_W = 132;
  const NODE_H = 52;

  const lines = edges.map((e) => {
    const a = byCode.get(e.from)!; const b = byCode.get(e.to)!;
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#c9d6e5" stroke-width="2" />`;
  }).join('');

  const boxes = nodes.map((n) => {
    const x = n.x - NODE_W / 2; const y = n.y - NODE_H / 2;
    const fill = n.hub ? '#1f5fa8' : '#ffffff';
    const stroke = n.hub ? '#1f5fa8' : '#c9d6e5';
    const nameColor = n.hub ? '#ffffff' : '#22303f';
    const roleColor = n.hub ? '#dbe7f5' : '#6b7c8d';
    return [
      `<g>`,
      `<rect x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />`,
      `<text x="${n.x}" y="${n.y - 4}" text-anchor="middle" font-family="-apple-system,Segoe UI,Microsoft YaHei,sans-serif" font-size="14" font-weight="600" fill="${nameColor}">${esc(n.label)}</text>`,
      `<text x="${n.x}" y="${n.y + 14}" text-anchor="middle" font-family="-apple-system,Segoe UI,Microsoft YaHei,sans-serif" font-size="10" fill="${roleColor}">${esc(n.role)}</text>`,
      `</g>`,
    ].join('');
  }).join('');

  const title = hasSmart ? '舒适系统原理示意（智能联动）' : '舒适系统原理示意';
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)}">`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="#f6f9fc" />`,
    `<text x="${W / 2}" y="34" text-anchor="middle" font-family="-apple-system,Segoe UI,Microsoft YaHei,sans-serif" font-size="16" font-weight="700" fill="#22303f">${esc(title)}</text>`,
    lines,
    boxes,
    `<text x="${W / 2}" y="${H - 16}" text-anchor="middle" font-family="-apple-system,Segoe UI,Microsoft YaHei,sans-serif" font-size="11" fill="#8a99a8">原理示意图 · 非工程图纸</text>`,
    `</svg>`,
  ].join('');
}
