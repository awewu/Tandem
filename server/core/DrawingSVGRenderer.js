/**
 * DrawingSVGRenderer - 基于三档方案生成真实 SVG 图纸
 * ──────────────────────────────────────────────────────
 * 输入：ThreeTier 三档结果 + 选档 + 项目参数
 * 输出：3~5 张 SVG 图纸（系统原理图/设备平面布置图/管路走向示意图/电气接线/节点大样）
 *
 * 存储：exports/drawings/<drawingId>/<type>.svg + manifest.json
 * 静态访问：/exports/drawings/<drawingId>/<type>.svg
 *
 * 设计理念：
 *   - 纯 JS 字符串拼接 SVG（无第三方依赖），浏览器可直接打开/另存/打印
 *   - 与商业侧 DrawingExportEngine.ts 保持视觉一致
 *   - 每张图含标题块、图例、尺寸、边界，达到"方案级示意图"品质
 *
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '../../exports/drawings');

const DRAWING_TYPES = [
  { key: 'schematic',    name: '系统原理图',      icon: '⚡' },
  { key: 'layout',       name: '设备平面布置图',  icon: '📐' },
  { key: 'piping',       name: '管路走向示意图',  icon: '🚰' },
  { key: 'electrical',   name: '电气接线示意图',  icon: '🔌' },
  { key: 'detail',       name: '节点安装大样',    icon: '🔧' }
];

class DrawingSVGRenderer {
  constructor(options = {}) {
    this.version = '1.0.0';
    this.root = options.root || ROOT;
    if (!fs.existsSync(this.root)) fs.mkdirSync(this.root, { recursive: true });
  }

  /**
   * 生成 5 张 SVG 图纸
   * @param {Object} params - { result, tier, project? }
   *   - result: ThreeTierEngine.generate() 返回
   *   - tier:   basic | comfort | premium
   *   - project: { name?, customer?, address? } 可选
   * @returns {{ id, drawings: [{type, name, url, sizeKB}], manifest }}
   */
  generate(params = {}) {
    if (!params.result) throw new Error('result 必填');
    const tier = params.tier || params.result.recommendation?.recommendedTier || 'comfort';
    const tierObj = params.result.tiers?.[tier];
    if (!tierObj) throw new Error(`未找到 tier "${tier}" 的配置`);

    const id = 'DWG-' + crypto.randomBytes(5).toString('hex').toUpperCase();
    const dir = path.join(this.root, id);
    fs.mkdirSync(dir, { recursive: true });

    const ctx = {
      id,
      tier,
      tierObj,
      input: params.result.input || {},
      project: params.project || {},
      systems: tierObj.systems || [],
      generatedAt: new Date().toISOString()
    };

    const drawings = DRAWING_TYPES.map(d => {
      const svg = this._render(d.key, ctx);
      const filePath = path.join(dir, d.key + '.svg');
      fs.writeFileSync(filePath, svg, 'utf8');
      return {
        type: d.key,
        name: d.name,
        icon: d.icon,
        url: `/exports/drawings/${id}/${d.key}.svg`,
        filePath,
        sizeKB: Math.round(Buffer.byteLength(svg, 'utf8') / 1024)
      };
    });

    const manifest = { id, tier, ...ctx, drawings };
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    return { id, drawings, manifest };
  }

  getManifest(id) {
    const p = path.join(this.root, id, 'manifest.json');
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
  }

  // ──────────────── 渲染分派 ────────────────
  _render(type, ctx) {
    switch (type) {
      case 'schematic':  return this._schematic(ctx);
      case 'layout':     return this._layout(ctx);
      case 'piping':     return this._piping(ctx);
      case 'electrical': return this._electrical(ctx);
      case 'detail':     return this._detail(ctx);
      default:           return this._frame(800, 600, '未知图纸', '', ctx);
    }
  }

  // 通用图框（A3 比例 1180×840）
  _frame(w, h, title, bodySvg, ctx) {
    const p = ctx.project || {};
    const subtitle = `${ctx.input.area || '-'}㎡ · ${esc(ctx.input.city || '')} · ${tierZh(ctx.tier)}`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Microsoft YaHei, sans-serif">
  <rect width="${w}" height="${h}" fill="#ffffff"/>
  <!-- 外图框 -->
  <rect x="10" y="10" width="${w-20}" height="${h-20}" fill="none" stroke="#1f2937" stroke-width="2"/>
  <rect x="25" y="25" width="${w-50}" height="${h-50}" fill="none" stroke="#1f2937" stroke-width="1"/>
  <!-- 标题块 -->
  <g transform="translate(${w - 310}, ${h - 120})">
    <rect width="290" height="95" fill="#f9fafb" stroke="#1f2937" stroke-width="1.5"/>
    <line x1="0" y1="30" x2="290" y2="30" stroke="#1f2937" stroke-width="1"/>
    <line x1="0" y1="60" x2="290" y2="60" stroke="#1f2937" stroke-width="1"/>
    <line x1="145" y1="0" x2="145" y2="95" stroke="#1f2937" stroke-width="1"/>
    <text x="8" y="20" font-size="13" font-weight="bold">${esc(p.name || '瑞诺瓦暖通方案')}</text>
    <text x="153" y="20" font-size="11">图号 ${esc(ctx.id)}</text>
    <text x="8" y="50" font-size="11">${esc(title)}</text>
    <text x="153" y="50" font-size="10">比例 1:100</text>
    <text x="8" y="80" font-size="10">设计 AI</text>
    <text x="153" y="80" font-size="10">日期 ${new Date().toLocaleDateString('zh-CN')}</text>
  </g>
  <!-- 标题 -->
  <text x="${w/2}" y="55" font-size="22" font-weight="bold" text-anchor="middle">${esc(title)}</text>
  <text x="${w/2}" y="80" font-size="13" fill="#6b7280" text-anchor="middle">${esc(subtitle)}</text>
  ${bodySvg}
</svg>`;
  }

  // ─── ① 系统原理图 ───
  _schematic(ctx) {
    const W = 1180, H = 840;
    const sys = ctx.systems;
    const maxRows = Math.max(sys.length, 1);
    const rowH = Math.min(100, Math.floor((H - 250) / maxRows));
    const startY = 130;

    const boxColor = {
      water: '#dbeafe', ac: '#fef3c7', heating: '#fee2e2', fresh_air: '#d1fae5', freshAir: '#d1fae5', purification: '#e0e7ff', softener: '#cffafe'
    };

    let body = '';
    // 左侧系统源 -> 中间控制 -> 右侧末端
    sys.forEach((s, i) => {
      const y = startY + i * rowH;
      const fill = boxColor[s.type] || '#f3f4f6';
      const cfg = s.config || {};
      const main = Object.values(cfg).find(v => v && typeof v === 'object');
      const model = (main && (main.model || main.type)) || '—';
      const spec = (main && (main.capacity || main.power || main.airflow)) || '';

      // 源设备
      body += `
        <g>
          <rect x="80" y="${y}" width="180" height="${rowH - 20}" fill="${fill}" stroke="#1f2937" stroke-width="1.5" rx="4"/>
          <text x="170" y="${y + 22}" font-size="13" font-weight="bold" text-anchor="middle">${esc(s.name)}</text>
          <text x="170" y="${y + 42}" font-size="11" text-anchor="middle">${esc(model)}</text>
          <text x="170" y="${y + 58}" font-size="10" fill="#6b7280" text-anchor="middle">${esc(spec)}</text>
        </g>
        <!-- 连接线 -->
        <line x1="260" y1="${y + rowH/2 - 10}" x2="480" y2="${y + rowH/2 - 10}" stroke="#C41230" stroke-width="2"/>
        <polygon points="480,${y+rowH/2-14} 492,${y+rowH/2-10} 480,${y+rowH/2-6}" fill="#C41230"/>
        <text x="370" y="${y + rowH/2 - 16}" font-size="10" fill="#6b7280" text-anchor="middle">供</text>
        <line x1="260" y1="${y + rowH/2}" x2="480" y2="${y + rowH/2}" stroke="#1e40af" stroke-width="1.5" stroke-dasharray="6,4"/>
        <text x="370" y="${y + rowH/2 + 13}" font-size="10" fill="#6b7280" text-anchor="middle">回</text>

        <!-- 控制/过滤中间件 -->
        <g>
          <rect x="490" y="${y + 4}" width="120" height="${rowH - 28}" fill="#fff" stroke="#1f2937" stroke-width="1" rx="4"/>
          <text x="550" y="${y + 28}" font-size="11" font-weight="bold" text-anchor="middle">智能控制</text>
          <text x="550" y="${y + 44}" font-size="10" text-anchor="middle">阀 / 泵 / 传感</text>
        </g>
        <line x1="610" y1="${y + rowH/2 - 10}" x2="820" y2="${y + rowH/2 - 10}" stroke="#C41230" stroke-width="2"/>
        <line x1="610" y1="${y + rowH/2}" x2="820" y2="${y + rowH/2}" stroke="#1e40af" stroke-width="1.5" stroke-dasharray="6,4"/>

        <!-- 末端 -->
        <g>
          <rect x="820" y="${y}" width="200" height="${rowH - 20}" fill="#f9fafb" stroke="#1f2937" stroke-width="1.5" rx="4"/>
          <text x="920" y="${y + 22}" font-size="12" font-weight="bold" text-anchor="middle">${esc(s.name)}末端</text>
          <text x="920" y="${y + 42}" font-size="10" text-anchor="middle">${esc(this._endpointFor(s))}</text>
        </g>
      `;
    });

    // 图例
    body += `
      <g transform="translate(60, ${H - 180})">
        <rect width="260" height="120" fill="#f9fafb" stroke="#d1d5db" stroke-width="1"/>
        <text x="10" y="20" font-size="13" font-weight="bold">图 例</text>
        <line x1="10" y1="40" x2="50" y2="40" stroke="#C41230" stroke-width="2"/>
        <text x="60" y="44" font-size="11">供水/供气/供液</text>
        <line x1="10" y1="62" x2="50" y2="62" stroke="#1e40af" stroke-width="1.5" stroke-dasharray="6,4"/>
        <text x="60" y="66" font-size="11">回水/回气</text>
        <rect x="10" y="78" width="40" height="16" fill="#fef3c7" stroke="#1f2937"/>
        <text x="60" y="90" font-size="11">设备</text>
      </g>`;

    return this._frame(W, H, '系统原理图', body, ctx);
  }

  _endpointFor(s) {
    const t = (s.type || '').toLowerCase();
    if (t.includes('heat') || /采暖|暖/.test(s.name)) return '地暖盘管/散热器';
    if (t.includes('ac') || /空调/.test(s.name)) return '室内机/风盘';
    if (t.includes('fresh') || /新风/.test(s.name)) return '送/排风口';
    if (/净水/.test(s.name)) return '末端用水点';
    if (/软水/.test(s.name)) return '全屋软水输出';
    return '末端输出';
  }

  // ─── ② 设备平面布置图 ───
  _layout(ctx) {
    const W = 1180, H = 840;
    const area = ctx.input.area || 120;
    // 按面积推算矩形长宽（黄金比例简化）
    const ratio = 1.4;
    const drawH = 420, drawW = Math.round(drawH * ratio);
    const ox = (W - drawW) / 2, oy = 160;

    // 按面积分房间：简化为 4 房间布局
    const rooms = this._inferRooms(area);

    let body = `
      <!-- 建筑外轮廓 -->
      <rect x="${ox}" y="${oy}" width="${drawW}" height="${drawH}" fill="#fafafa" stroke="#1f2937" stroke-width="3"/>
      <text x="${W/2}" y="${oy - 10}" font-size="12" fill="#6b7280" text-anchor="middle">建筑面积 ${area} ㎡（比例示意）</text>
    `;

    // 绘制房间分区
    const cols = 2, rows = Math.ceil(rooms.length / cols);
    const rw = drawW / cols, rh = drawH / rows;
    rooms.forEach((r, i) => {
      const cx = ox + (i % cols) * rw;
      const cy = oy + Math.floor(i / cols) * rh;
      body += `
        <rect x="${cx}" y="${cy}" width="${rw}" height="${rh}" fill="none" stroke="#6b7280" stroke-width="1" stroke-dasharray="4,3"/>
        <text x="${cx + rw/2}" y="${cy + 20}" font-size="12" font-weight="bold" text-anchor="middle">${esc(r.name)}</text>
        <text x="${cx + rw/2}" y="${cy + 36}" font-size="10" fill="#9ca3af" text-anchor="middle">${r.size}㎡</text>
      `;
    });

    // 放置设备图标
    const devices = this._devicesFromSystems(ctx.systems);
    devices.forEach((d, i) => {
      const px = ox + 40 + (i % 5) * 130;
      const py = oy + drawH - 80;
      body += `
        <g>
          <rect x="${px}" y="${py}" width="100" height="50" fill="${d.color}" stroke="#1f2937" stroke-width="1.5" rx="4"/>
          <text x="${px + 50}" y="${py + 20}" font-size="16" text-anchor="middle">${d.icon}</text>
          <text x="${px + 50}" y="${py + 40}" font-size="10" font-weight="bold" text-anchor="middle">${esc(d.label)}</text>
        </g>`;
    });

    // 尺寸线
    body += `
      <line x1="${ox}" y1="${oy + drawH + 30}" x2="${ox + drawW}" y2="${oy + drawH + 30}" stroke="#1f2937" stroke-width="1"/>
      <line x1="${ox}" y1="${oy + drawH + 25}" x2="${ox}" y2="${oy + drawH + 35}" stroke="#1f2937" stroke-width="1"/>
      <line x1="${ox + drawW}" y1="${oy + drawH + 25}" x2="${ox + drawW}" y2="${oy + drawH + 35}" stroke="#1f2937" stroke-width="1"/>
      <text x="${ox + drawW/2}" y="${oy + drawH + 50}" font-size="11" text-anchor="middle">${Math.round(Math.sqrt(area * ratio) * 1000)} mm</text>
    `;

    return this._frame(W, H, '设备平面布置图', body, ctx);
  }

  _inferRooms(area) {
    if (area < 60) return [{ name: '客厅/餐厅', size: Math.round(area * 0.5) }, { name: '主卧', size: Math.round(area * 0.3) }, { name: '卫浴', size: Math.round(area * 0.1) }, { name: '厨房', size: Math.round(area * 0.1) }];
    if (area < 120) return [{ name: '客厅', size: Math.round(area * 0.3) }, { name: '餐厅/厨房', size: Math.round(area * 0.2) }, { name: '主卧', size: Math.round(area * 0.2) }, { name: '次卧', size: Math.round(area * 0.15) }, { name: '卫浴', size: Math.round(area * 0.1) }, { name: '阳台', size: Math.round(area * 0.05) }];
    return [{ name: '客厅', size: Math.round(area * 0.22) }, { name: '餐厅/厨房', size: Math.round(area * 0.18) }, { name: '主卧套房', size: Math.round(area * 0.20) }, { name: '次卧1', size: Math.round(area * 0.12) }, { name: '次卧2', size: Math.round(area * 0.12) }, { name: '卫浴+阳台', size: Math.round(area * 0.16) }];
  }

  _devicesFromSystems(systems) {
    const map = {
      water: { icon: '💧', label: '热水主机', color: '#dbeafe' },
      heating: { icon: '🔥', label: '壁挂炉', color: '#fee2e2' },
      ac: { icon: '❄️', label: '外机', color: '#fef3c7' },
      fresh_air: { icon: '🌿', label: '新风主机', color: '#d1fae5' },
      freshAir: { icon: '🌿', label: '新风主机', color: '#d1fae5' },
      purification: { icon: '🧊', label: '净水主机', color: '#e0e7ff' },
      softener: { icon: '💎', label: '软水机', color: '#cffafe' }
    };
    return (systems || []).map(s => map[s.type] || { icon: '⚙️', label: s.name.slice(0, 4), color: '#f3f4f6' });
  }

  // ─── ③ 管路走向示意图 ───
  _piping(ctx) {
    const W = 1180, H = 840;
    const sys = ctx.systems;
    let body = '';

    // 纵向管井 + 横向分支
    const stackX = 200;
    const startY = 150;
    const endY = H - 200;
    body += `
      <!-- 主立管 -->
      <rect x="${stackX - 20}" y="${startY}" width="40" height="${endY - startY}" fill="#e5e7eb" stroke="#1f2937" stroke-width="1.5"/>
      <text x="${stackX}" y="${startY - 8}" font-size="12" font-weight="bold" text-anchor="middle">主立管井</text>

      <line x1="${stackX}" y1="${startY + 20}" x2="${stackX}" y2="${endY - 20}" stroke="#C41230" stroke-width="2.5"/>
      <line x1="${stackX + 12}" y1="${startY + 20}" x2="${stackX + 12}" y2="${endY - 20}" stroke="#1e40af" stroke-width="2" stroke-dasharray="6,4"/>
    `;

    // 楼层分支
    const branchSpacing = Math.floor((endY - startY - 40) / Math.max(sys.length, 1));
    sys.forEach((s, i) => {
      const y = startY + 30 + i * branchSpacing;
      const label = s.name;
      body += `
        <line x1="${stackX}" y1="${y}" x2="${W - 120}" y2="${y}" stroke="#C41230" stroke-width="2"/>
        <line x1="${stackX + 12}" y1="${y + 12}" x2="${W - 120}" y2="${y + 12}" stroke="#1e40af" stroke-width="1.5" stroke-dasharray="6,4"/>

        <circle cx="${stackX + 100}" cy="${y}" r="6" fill="#fff" stroke="#1f2937" stroke-width="1.5"/>
        <text x="${stackX + 100}" y="${y - 12}" font-size="10" fill="#6b7280" text-anchor="middle">阀</text>

        <rect x="${W - 120}" y="${y - 18}" width="80" height="36" fill="#f3f4f6" stroke="#1f2937" stroke-width="1.5" rx="4"/>
        <text x="${W - 80}" y="${y + 5}" font-size="11" font-weight="bold" text-anchor="middle">${esc(label)}</text>

        <text x="${stackX + 220}" y="${y - 6}" font-size="10" fill="#C41230">DN${this._pipeSizeFor(s)}</text>
      `;
    });

    // 图例
    body += `
      <g transform="translate(60, ${H - 170})">
        <rect width="320" height="120" fill="#f9fafb" stroke="#d1d5db" stroke-width="1"/>
        <text x="10" y="20" font-size="13" font-weight="bold">管路图例</text>
        <line x1="10" y1="40" x2="60" y2="40" stroke="#C41230" stroke-width="2.5"/>
        <text x="70" y="44" font-size="11">供水/供气主管</text>
        <line x1="10" y1="62" x2="60" y2="62" stroke="#1e40af" stroke-width="2" stroke-dasharray="6,4"/>
        <text x="70" y="66" font-size="11">回水/回气主管</text>
        <circle cx="30" cy="84" r="6" fill="#fff" stroke="#1f2937" stroke-width="1.5"/>
        <text x="70" y="88" font-size="11">截止阀 / 止回阀</text>
      </g>`;

    return this._frame(W, H, '管路走向示意图', body, ctx);
  }

  _pipeSizeFor(s) {
    const t = (s.type || '').toLowerCase();
    if (t.includes('water') || /热水|净水/.test(s.name)) return '25';
    if (t.includes('heat')) return '20';
    if (t.includes('fresh')) return '150'; // 风管
    if (t.includes('ac')) return '9.52/6.35'; // 冷媒
    return '20';
  }

  // ─── ④ 电气接线示意图 ───
  _electrical(ctx) {
    const W = 1180, H = 840;
    const sys = ctx.systems;
    let body = '';

    // 配电箱
    body += `
      <g transform="translate(80, 160)">
        <rect width="180" height="280" fill="#fef3c7" stroke="#1f2937" stroke-width="2" rx="6"/>
        <text x="90" y="24" font-size="14" font-weight="bold" text-anchor="middle">户内配电箱</text>
        <text x="90" y="42" font-size="10" fill="#6b7280" text-anchor="middle">总进线 3×10mm²</text>
        <line x1="10" y1="56" x2="170" y2="56" stroke="#1f2937"/>
    `;
    // 空开排列
    sys.slice(0, 8).forEach((s, i) => {
      const y = 70 + i * 26;
      body += `
        <rect x="16" y="${y}" width="28" height="20" fill="#fff" stroke="#1f2937" stroke-width="1" rx="2"/>
        <text x="50" y="${y + 14}" font-size="10">${esc(s.name.slice(0, 8))}</text>
        <text x="160" y="${y + 14}" font-size="10" fill="#C41230" text-anchor="end">${this._breakerFor(s)}A</text>`;
    });
    body += `</g>`;

    // 设备负载
    sys.forEach((s, i) => {
      const py = 180 + i * 80;
      body += `
        <line x1="260" y1="${py}" x2="520" y2="${py}" stroke="#1f2937" stroke-width="1.5"/>
        <circle cx="420" cy="${py}" r="4" fill="#C41230"/>

        <rect x="540" y="${py - 30}" width="180" height="60" fill="#f9fafb" stroke="#1f2937" stroke-width="1.5" rx="4"/>
        <text x="630" y="${py - 10}" font-size="12" font-weight="bold" text-anchor="middle">${esc(s.name)}</text>
        <text x="630" y="${py + 8}" font-size="10" text-anchor="middle">额定功率 ${this._powerFor(s)}kW</text>
        <text x="630" y="${py + 22}" font-size="10" fill="#6b7280" text-anchor="middle">线规 YJV 3×${this._wireFor(s)}</text>
      `;
    });

    // 接地
    body += `
      <g transform="translate(80, ${H - 140})">
        <rect width="200" height="80" fill="#ecfdf5" stroke="#10b981" stroke-width="1.5" rx="4"/>
        <text x="100" y="22" font-size="12" font-weight="bold" text-anchor="middle">接地 PE</text>
        <text x="100" y="40" font-size="10" text-anchor="middle">接地电阻 ≤ 4Ω</text>
        <line x1="90" y1="55" x2="110" y2="55" stroke="#10b981" stroke-width="2"/>
        <line x1="94" y1="60" x2="106" y2="60" stroke="#10b981" stroke-width="2"/>
        <line x1="98" y1="65" x2="102" y2="65" stroke="#10b981" stroke-width="2"/>
      </g>`;

    return this._frame(W, H, '电气接线示意图', body, ctx);
  }

  _breakerFor(s) {
    const t = (s.type || '').toLowerCase();
    if (t.includes('heat')) return '32';
    if (t.includes('ac')) return '25';
    if (t.includes('water') && s.name.includes('热水')) return '20';
    return '16';
  }
  _powerFor(s) {
    const t = (s.type || '').toLowerCase();
    if (t.includes('heat')) return '24';
    if (t.includes('ac')) return '6.5';
    if (t.includes('fresh')) return '0.35';
    return '2.5';
  }
  _wireFor(s) {
    const kw = this._powerFor(s);
    return kw >= 10 ? '6' : kw >= 4 ? '4' : '2.5';
  }

  // ─── ⑤ 节点安装大样 ───
  _detail(ctx) {
    const W = 1180, H = 840;
    const body = `
      <!-- 节点1: 主机吊装 -->
      <g transform="translate(80, 140)">
        <text font-size="14" font-weight="bold" x="0" y="0">节点1 · 主机吊装</text>
        <rect x="0" y="20" width="220" height="160" fill="none" stroke="#9ca3af" stroke-dasharray="3,3"/>
        <rect x="40" y="40" width="140" height="60" fill="#fef3c7" stroke="#1f2937" stroke-width="1.5"/>
        <text x="110" y="75" font-size="11" text-anchor="middle">主机 XXX kg</text>
        <line x1="60" y1="40" x2="60" y2="20" stroke="#1f2937"/>
        <line x1="160" y1="40" x2="160" y2="20" stroke="#1f2937"/>
        <rect x="54" y="14" width="12" height="8" fill="#6b7280"/>
        <rect x="154" y="14" width="12" height="8" fill="#6b7280"/>
        <text x="110" y="18" font-size="10" text-anchor="middle" fill="#6b7280">M10 膨胀螺栓</text>
        <line x1="40" y1="100" x2="180" y2="100" stroke="#1f2937" stroke-dasharray="4,2"/>
        <text x="110" y="118" font-size="10" text-anchor="middle">减震垫 + 橡胶脚垫</text>
      </g>

      <!-- 节点2: 管道穿墙 -->
      <g transform="translate(340, 140)">
        <text font-size="14" font-weight="bold" x="0" y="0">节点2 · 管道穿墙</text>
        <rect x="0" y="20" width="220" height="160" fill="none" stroke="#9ca3af" stroke-dasharray="3,3"/>
        <rect x="30" y="70" width="160" height="60" fill="#e5e7eb" stroke="#1f2937" stroke-width="1.5"/>
        <text x="110" y="65" font-size="10" text-anchor="middle" fill="#6b7280">墙体</text>
        <circle cx="110" cy="100" r="18" fill="#fff" stroke="#1f2937" stroke-width="1.5"/>
        <text x="110" y="104" font-size="10" text-anchor="middle">φ75</text>
        <line x1="20" y1="100" x2="92" y2="100" stroke="#C41230" stroke-width="3"/>
        <line x1="128" y1="100" x2="200" y2="100" stroke="#C41230" stroke-width="3"/>
        <text x="110" y="150" font-size="10" text-anchor="middle">钢套管 + 橡胶密封圈</text>
      </g>

      <!-- 节点3: 冷凝水排放 -->
      <g transform="translate(600, 140)">
        <text font-size="14" font-weight="bold" x="0" y="0">节点3 · 冷凝水排放</text>
        <rect x="0" y="20" width="220" height="160" fill="none" stroke="#9ca3af" stroke-dasharray="3,3"/>
        <line x1="10" y1="50" x2="210" y2="80" stroke="#1e40af" stroke-width="2.5"/>
        <text x="110" y="45" font-size="10" text-anchor="middle">坡度 ≥ 1%</text>
        <circle cx="30" cy="50" r="8" fill="#fff" stroke="#1f2937"/>
        <text x="30" y="54" font-size="9" text-anchor="middle">源</text>
        <rect x="190" y="80" width="20" height="50" fill="#e5e7eb" stroke="#1f2937"/>
        <text x="200" y="145" font-size="10" text-anchor="middle">地漏</text>
      </g>

      <!-- 节点4: 地暖回填 -->
      <g transform="translate(80, 380)">
        <text font-size="14" font-weight="bold" x="0" y="0">节点4 · 地暖盘管回填</text>
        <rect x="0" y="20" width="480" height="180" fill="none" stroke="#9ca3af" stroke-dasharray="3,3"/>
        <!-- 结构从下到上 -->
        <rect x="20" y="150" width="440" height="30" fill="#e5e7eb" stroke="#1f2937"/>
        <text x="240" y="170" font-size="10" text-anchor="middle">楼板</text>
        <rect x="20" y="120" width="440" height="30" fill="#fef3c7" stroke="#1f2937"/>
        <text x="240" y="140" font-size="10" text-anchor="middle">保温板 20mm</text>
        <rect x="20" y="90" width="440" height="30" fill="#f3f4f6" stroke="#1f2937"/>
        <text x="60" y="110" font-size="10">反射膜</text>
        ${Array.from({ length: 9 }).map((_, i) => `<circle cx="${50 + i * 50}" cy="75" r="6" fill="#C41230"/>`).join('')}
        <text x="460" y="80" font-size="10" text-anchor="end">PE-RT φ16 @150mm</text>
        <rect x="20" y="40" width="440" height="30" fill="#d1d5db" stroke="#1f2937"/>
        <text x="240" y="60" font-size="10" text-anchor="middle">细石混凝土回填 40mm</text>
        <rect x="20" y="20" width="440" height="20" fill="#b45309" stroke="#1f2937"/>
        <text x="240" y="34" font-size="9" fill="#fff" text-anchor="middle">地板面层</text>
      </g>

      <!-- 技术说明 -->
      <g transform="translate(600, 380)">
        <text font-size="14" font-weight="bold" x="0" y="0">技术说明</text>
        <rect x="0" y="20" width="480" height="220" fill="#fef9c3" stroke="#ca8a04" stroke-width="1" rx="4"/>
        <text x="12" y="45" font-size="11" font-weight="bold">1. 设备安装</text>
        <text x="12" y="65" font-size="10">• 基础水平度 ≤ 2mm/m，承重 ≥ 设备重量 2 倍</text>
        <text x="12" y="85" font-size="10">• M10 以上膨胀螺栓，减震垫 + 橡胶脚垫双级减振</text>
        <text x="12" y="110" font-size="11" font-weight="bold">2. 管道施工</text>
        <text x="12" y="130" font-size="10">• 保温全覆盖（B1级橡塑 20mm）</text>
        <text x="12" y="150" font-size="10">• 打压 0.8MPa/30min，压降 ≤ 0.05MPa</text>
        <text x="12" y="175" font-size="11" font-weight="bold">3. 电气接线</text>
        <text x="12" y="195" font-size="10">• 空调/热水独立回路 + 30mA 漏保</text>
        <text x="12" y="215" font-size="10">• 接地电阻 ≤ 4Ω，控制面板离地 1.3m</text>
      </g>
    `;
    return this._frame(W, H, '节点安装大样', body, ctx);
  }
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function tierZh(t) { return { basic: '基础档', comfort: '舒适档', premium: '旗舰档' }[t] || t; }

module.exports = DrawingSVGRenderer;
module.exports.DRAWING_TYPES = DRAWING_TYPES;
