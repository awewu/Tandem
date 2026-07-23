/**
 * P2 · 暖通系统图/原理图自动生成（确定性 SVG，非缩放平面图）。
 *
 * 原理图表达：机房/冷热源 → 各系统立管(riser) → 楼层/房间末端(terminal)，
 * 并标注每系统的主设备与末端数。结构化、可复现，供方案册 / 前端预览 / 打印。
 * 精确管线综合图仍需 BIM 深化（本图为示意/原理级）。
 */

export interface SystemDiagramInput {
  projectName?: string;
  city?: string;
  area?: number;
  systems: Array<{ key: string; label: string; sourceLabel: string; terminals: number; terminalLabel: string }>;
}

const PALETTE: Record<string, string> = {
  hotWater: '#e8590c', water: '#1c7ed6', heating: '#e03131', airConditioning: '#1098ad',
  freshAir: '#2f9e44', humidity: '#7048e8', control: '#495057',
};

function esc(s: string | number | null | undefined): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/** 生成系统原理图 SVG 字符串。每个系统一行：机房 → 立管 → 末端阵列。 */
export function buildSystemSchematicSvg(input: SystemDiagramInput): { svg: string; width: number; height: number } {
  const systems = Array.isArray(input.systems) ? input.systems : [];
  const W = 960;
  const marginX = 40;
  const headerH = 96;
  const rowH = 110;
  const H = headerH + Math.max(1, systems.length) * rowH + 40;

  const sourceX = marginX;
  const sourceW = 150;
  const manifoldX = sourceX + sourceW + 90;
  const manifoldW = 120;
  const termStartX = manifoldX + manifoldW + 70;
  const termW = 92;
  const termGap = 16;
  const maxTermsPerRow = Math.max(1, Math.floor((W - marginX - termStartX) / (termW + termGap)));

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Helvetica,Arial,sans-serif">`);
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`);

  // 标题栏
  parts.push(`<text x="${marginX}" y="34" font-size="20" font-weight="700" fill="#1864ab">RysNova 暖通系统原理图</text>`);
  const meta = [input.projectName, input.city, input.area ? `${input.area}㎡` : ''].filter(Boolean).map(esc).join(' · ');
  parts.push(`<text x="${marginX}" y="58" font-size="12" fill="#495057">${meta || '未命名项目'}</text>`);
  parts.push(`<text x="${marginX}" y="76" font-size="10" fill="#868e96">示意/原理级图，精确管线综合以 BIM 深化图为准 · ${esc(new Date().toISOString().slice(0, 10))}</text>`);
  parts.push(`<line x1="${marginX}" y1="${headerH - 8}" x2="${W - marginX}" y2="${headerH - 8}" stroke="#dee2e6" stroke-width="1"/>`);

  systems.forEach((sys, i) => {
    const cy = headerH + i * rowH + rowH / 2;
    const color = PALETTE[sys.key] || '#495057';
    const box = (x: number, w: number, y: number, h: number, title: string, sub: string, fill: string) => {
      parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="${color}" stroke-width="1.5"/>`);
      parts.push(`<text x="${x + w / 2}" y="${y + h / 2 - 2}" font-size="12" font-weight="600" fill="#212529" text-anchor="middle">${esc(title)}</text>`);
      if (sub) parts.push(`<text x="${x + w / 2}" y="${y + h / 2 + 14}" font-size="10" fill="#495057" text-anchor="middle">${esc(sub)}</text>`);
    };

    // 机房/冷热源
    box(sourceX, sourceW, cy - 26, 52, sys.sourceLabel, sys.label, '#f8f9fa');
    // 供水/回水立管（双线示意）
    parts.push(`<line x1="${sourceX + sourceW}" y1="${cy - 6}" x2="${manifoldX}" y2="${cy - 6}" stroke="${color}" stroke-width="2"/>`);
    parts.push(`<line x1="${sourceX + sourceW}" y1="${cy + 6}" x2="${manifoldX}" y2="${cy + 6}" stroke="${color}" stroke-width="2" stroke-dasharray="4 3"/>`);
    parts.push(`<text x="${(sourceX + sourceW + manifoldX) / 2}" y="${cy - 12}" font-size="9" fill="${color}" text-anchor="middle">供/回</text>`);
    // 分集水器/分配器
    box(manifoldX, manifoldW, cy - 24, 48, '分/集水器', `${sys.terminals} 路`, '#ffffff');

    // 末端阵列（超出一行则省略号）
    const shown = Math.min(sys.terminals, maxTermsPerRow);
    for (let t = 0; t < shown; t++) {
      const tx = termStartX + t * (termW + termGap);
      parts.push(`<line x1="${manifoldX + manifoldW}" y1="${cy}" x2="${tx}" y2="${cy}" stroke="${color}" stroke-width="1.2"/>`);
      box(tx, termW, cy - 18, 36, `${sys.terminalLabel}${t + 1}`, '', '#f1f3f5');
    }
    if (sys.terminals > shown) {
      parts.push(`<text x="${termStartX + shown * (termW + termGap)}" y="${cy + 4}" font-size="12" fill="#868e96">… 共 ${sys.terminals}</text>`);
    }
  });

  parts.push('</svg>');
  const svg = parts.join('');
  return { svg, width: W, height: H };
}
