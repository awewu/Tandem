/**
 * ReportGenerator - AI问诊报告 / 销售推荐方案书 生成器
 * ─────────────────────────────────────────────────────────
 * 输入：ThreeTierEngine.generate() 返回值 + 客户/销售上下文
 * 输出：
 *   • HTML 可打印报告（浏览器 Ctrl+P → PDF）
 *   • 分享链接 /reports/<id>（可通过微信/邮件/短信转发）
 *   • 轻量元数据（标题/摘要/封面图等，供客户端 OG/share meta 使用）
 *
 * 存储：exports/reports/<reportId>.html + exports/reports/<reportId>.json
 * 静态访问：/exports/reports/<reportId>.html
 *
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '../../exports/reports');

class ReportGenerator {
  constructor(options = {}) {
    this.version = '1.0.0';
    this.root = options.root || ROOT;
    if (!fs.existsSync(this.root)) fs.mkdirSync(this.root, { recursive: true });
  }

  /**
   * 生成 AI 问诊报告（客户视角，突出需求分析与三档推荐）
   * @param {Object} params - { result, customer?, salesperson?, brand? }
   * @returns {{ id, url, shareUrl, htmlPath, meta }}
   */
  generateConsultationReport(params = {}) {
    return this._generate('consultation', params);
  }

  /**
   * 生成销售推荐方案书（销售视角，突出价值主张/ROI/成交路径）
   * @param {Object} params - { result, customer?, salesperson?, brand? }
   */
  generateSalesProposal(params = {}) {
    return this._generate('proposal', params);
  }

  /** 读取已存报告元数据（用于分享页再渲染） */
  getReport(reportId) {
    const metaPath = path.join(this.root, reportId + '.json');
    if (!fs.existsSync(metaPath)) return null;
    return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  }

  // ──────────────── 内部实现 ────────────────
  _generate(kind, params) {
    if (!params.result) throw new Error('result（ThreeTier.generate 返回值）必填');
    const result = params.result;
    const customer = params.customer || {};
    const salesperson = params.salesperson || {};
    const brand = params.brand || '瑞诺瓦暖通AI设计平台';

    // 稳定 ID：优先用 customer.phone + 时间戳哈希；否则随机
    const seed = (customer.phone || customer.name || '') + Date.now() + Math.random();
    const id = (kind === 'proposal' ? 'PRP' : 'RPT') + '-' +
      crypto.createHash('sha1').update(seed).digest('hex').slice(0, 10).toUpperCase();

    const html = kind === 'proposal'
      ? this._renderProposal({ id, result, customer, salesperson, brand })
      : this._renderConsultation({ id, result, customer, salesperson, brand });

    const htmlPath = path.join(this.root, id + '.html');
    fs.writeFileSync(htmlPath, html, 'utf8');

    const meta = {
      id,
      kind, // consultation | proposal
      title: kind === 'proposal'
        ? `${customer.name || '客户'} · 暖通方案建议书`
        : `${customer.name || '客户'} · AI暖通问诊报告`,
      summary: this._summarize(result),
      brand,
      customer,
      salesperson,
      recommendedTier: result.recommendation?.recommendedTier,
      area: result.input?.area,
      city: result.input?.city,
      generatedAt: new Date().toISOString(),
      url: `/exports/reports/${id}.html`,
      shareUrl: `/report-view.html?id=${id}`,
      sizeKB: Math.round(Buffer.byteLength(html, 'utf8') / 1024)
    };
    fs.writeFileSync(path.join(this.root, id + '.json'), JSON.stringify(meta, null, 2), 'utf8');

    return {
      id: meta.id,
      url: meta.url,
      shareUrl: meta.shareUrl,
      htmlPath,
      meta
    };
  }

  _summarize(result) {
    const rec = result.recommendation?.recommendedTier || 'comfort';
    const t = result.tiers?.[rec];
    const pkg = result.packagePricing?.[rec];
    return {
      tier: rec,
      tierName: t?.name || rec,
      detailPrice: t?.totalPrice || 0,
      packagePrice: pkg?.subtotal || 0,
      systemsCount: (t?.systems || []).length
    };
  }

  // ─── 统一 HTML 外壳 ───
  _wrap(title, bodyHtml, ctx) {
    const c = ctx.customer || {};
    const s = ctx.salesperson || {};
    return `<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="瑞诺瓦暖通AI定制方案，三档可选，透明报价">
<style>
  * { box-sizing: border-box; margin:0; padding:0; }
  body { font-family: -apple-system, 'Microsoft YaHei', 'PingFang SC', sans-serif; color: #1f2937; background: #f5f7fa; line-height: 1.7; }
  .page { max-width: 880px; margin: 0 auto; background: #fff; padding: 40px 48px; min-height: 100vh; box-shadow: 0 2px 16px rgba(0,0,0,.06); }
  .cover { background: linear-gradient(135deg,#C41230,#7f0e20); color:#fff; padding: 48px 40px; border-radius: 16px; margin-bottom: 32px; position: relative; overflow: hidden; }
  .cover::after { content: ''; position: absolute; right: -60px; top: -60px; width: 260px; height: 260px; background: rgba(255,255,255,.08); border-radius: 50%; }
  .cover h1 { font-size: 30px; margin-bottom: 8px; position: relative; }
  .cover .subtitle { font-size: 14px; opacity: .9; margin-bottom: 20px; position: relative; }
  .cover .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px 24px; font-size: 13px; position: relative; }
  .cover .meta-grid .label { opacity: .75; display: inline-block; width: 70px; }
  h2 { font-size: 20px; margin: 32px 0 14px; padding-left: 12px; border-left: 4px solid #C41230; color: #1f2937; }
  h3 { font-size: 15px; margin: 18px 0 8px; color: #374151; }
  p, li { font-size: 13.5px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12.5px; }
  th, td { border: 1px solid #d1d5db; padding: 7px 10px; text-align: left; }
  th { background: #f9fafb; font-weight: 600; }
  .pain-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
  .pain-chip { padding: 6px 14px; background: #fef2f2; color: #C41230; border-radius: 14px; font-size: 12px; font-weight: 500; }
  .tier-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 16px 0; }
  .tier { border: 2px solid #e5e7eb; border-radius: 12px; padding: 18px; position: relative; }
  .tier.recommended { border-color: #C41230; background: #fef2f2; }
  .tier .badge { position: absolute; top: -10px; right: 12px; background: #C41230; color:#fff; font-size: 11px; padding: 3px 10px; border-radius: 10px; }
  .tier h3 { margin-top: 0; font-size: 16px; color: #C41230; }
  .tier .price { font-size: 22px; font-weight: 700; color: #C41230; margin: 6px 0; }
  .tier .hint { font-size: 11px; color: #9ca3af; }
  .tier ul { padding-left: 18px; margin-top: 8px; }
  .tier ul li { font-size: 12px; color: #374151; }
  .kv-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 10px 20px; font-size: 13px; background: #f9fafb; padding: 14px 18px; border-radius: 10px; }
  .kv-grid .k { color: #6b7280; }
  .kv-grid .v { color: #1f2937; font-weight: 500; }
  .highlight { background: linear-gradient(135deg,#fef3c7,#fde68a); padding: 14px 18px; border-radius: 10px; margin: 14px 0; font-size: 13px; }
  .cta { background: linear-gradient(135deg,#C41230,#7f0e20); color:#fff; padding: 24px 28px; border-radius: 12px; text-align: center; margin: 24px 0; }
  .cta h3 { color: #fff; margin: 0 0 6px; font-size: 18px; }
  .cta p { font-size: 13px; opacity: .9; margin-bottom: 12px; }
  .cta a { display: inline-block; padding: 10px 24px; background: #fff; color: #C41230; font-weight: 700; text-decoration: none; border-radius: 8px; margin: 4px; font-size: 13px; }
  .sig { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 36px; padding-top: 20px; border-top: 1px dashed #9ca3af; }
  .sig-block .label { font-size: 12px; color: #6b7280; }
  .sig-block .line { border-bottom: 1px solid #1f2937; height: 40px; margin-top: 6px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
  .toolbar { position: fixed; right: 24px; top: 24px; display: flex; gap: 8px; z-index: 99; }
  .toolbar button { background: #C41230; color:#fff; padding: 10px 16px; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; box-shadow: 0 4px 12px rgba(196,18,48,.25); font-weight: 600; }
  .toolbar button:hover { background: #9A0E26; }
  .toolbar button.secondary { background: #fff; color: #C41230; border: 1px solid #C41230; }
  @media print { .toolbar { display: none !important; } body { background: #fff; } .page { box-shadow: none; padding: 20mm; max-width: 100%; } .cover { break-inside: avoid; } .tier { break-inside: avoid; } }
</style>
</head><body>
<div class="toolbar">
  <button onclick="window.print()">🖨️ 打印/另存PDF</button>
  <button class="secondary" onclick="copyShare()">🔗 复制分享链接</button>
</div>
<div class="page">
${bodyHtml}
<div class="footer">
  ${esc(ctx.brand || '瑞诺瓦暖通AI设计平台')} · ${esc(ctx.reportId || '')} · 生成于 ${new Date().toLocaleString('zh-CN')}
  ${s.name ? ' · 顾问 ' + esc(s.name) + (s.phone ? ' / ' + esc(s.phone) : '') : ''}
</div>
</div>
<script>
function copyShare() {
  const url = location.origin + location.pathname.replace(/[^/]*$/, '') + '../../report-view.html?id=${esc(ctx.reportId || '')}';
  // 更可靠：直接用当前 URL
  const shareUrl = location.href;
  navigator.clipboard?.writeText(shareUrl).then(
    () => alert('✅ 分享链接已复制：\\n' + shareUrl),
    () => prompt('复制以下链接分享给客户：', shareUrl)
  );
}
</script>
</body></html>`;
  }

  // ─── 渲染：AI问诊报告 ───
  _renderConsultation(ctx) {
    const { id, result, customer, salesperson, brand } = ctx;
    const input = result.input || {};
    const analysis = result.analysis || {};
    const rec = result.recommendation?.recommendedTier || 'comfort';
    const tiers = ['basic', 'comfort', 'premium'];

    const painChips = (input.painPoints || []).map(p => `<span class="pain-chip">${esc(p)}</span>`).join('')
      || '<span class="pain-chip" style="background:#f3f4f6;color:#6b7280;">未特别指定</span>';

    const tierCards = tiers.map(k => {
      const t = result.tiers?.[k]; if (!t) return '';
      const pkg = result.packagePricing?.[k];
      const isRec = k === rec;
      const systems = (t.systems || []).map(s => `<li>${esc(s.name || s)}</li>`).join('');
      const values = (t.valueProposition || []).slice(0, 4).map(v => `<li>${esc(v)}</li>`).join('');
      return `
        <div class="tier ${isRec ? 'recommended' : ''}">
          ${isRec ? '<span class="badge">AI推荐</span>' : ''}
          <h3>${esc(t.icon || '')} ${esc(t.name)}</h3>
          <div class="price">¥${(t.totalPrice || 0).toLocaleString()}</div>
          <div class="hint">明细价（含设备+安装）</div>
          ${pkg ? `<div style="margin-top:6px;font-size:12px;color:#92400e;">套餐价 ¥${pkg.perSqm}/㎡ · ${pkg.area}㎡ 合计 ¥${pkg.subtotal.toLocaleString()}</div>` : ''}
          <h4 style="margin-top:10px;font-size:12px;color:#6b7280;">包含系统</h4>
          <ul>${systems || '<li>—</li>'}</ul>
          <h4 style="margin-top:8px;font-size:12px;color:#6b7280;">核心价值</h4>
          <ul>${values || '<li>—</li>'}</ul>
          ${t.roi?.energySavingsPercent ? `<div style="margin-top:8px;font-size:11px;color:#065f46;background:#ecfdf5;padding:6px 10px;border-radius:6px;">年节能 ${t.roi.energySavingsPercent}% · 回本周期 ${t.roi.paybackYears || 'N/A'}</div>` : ''}
        </div>`;
    }).join('');

    // 对比矩阵
    const matrix = result.comparison?.featureMatrix || {};
    const matrixRows = Object.keys(matrix).map(f => `
      <tr><td>${esc(f)}</td><td>${esc(matrix[f].basic)}</td><td>${esc(matrix[f].comfort)}</td><td>${esc(matrix[f].premium)}</td></tr>
    `).join('');

    const recReasons = (result.recommendation?.reasons || []).map(r => `<li>${esc(r)}</li>`).join('');
    const nextSteps = (result.recommendation?.nextSteps || []).map(r => `<li>${esc(r)}</li>`).join('');

    const body = `
<div class="cover">
  <h1>🤖 AI 智能问诊报告</h1>
  <div class="subtitle">基于您的需求，AI 已生成三档方案建议，您可按套餐直购或与顾问定制调整</div>
  <div class="meta-grid">
    <div><span class="label">报告编号</span>${esc(id)}</div>
    <div><span class="label">生成日期</span>${new Date().toLocaleDateString('zh-CN')}</div>
    <div><span class="label">客户</span>${esc(customer.name || '—')}</div>
    <div><span class="label">联系电话</span>${esc(customer.phone || '—')}</div>
    <div><span class="label">项目地点</span>${esc(input.city || '—')} ${esc(customer.address || '')}</div>
    <div><span class="label">建筑面积</span>${input.area || '—'} ㎡ · ${esc(input.houseType || '自动推断')}</div>
  </div>
</div>

<h2>一、需求分析</h2>
<h3>您选择的困扰</h3>
<div class="pain-chips">${painChips}</div>
<h3>AI 分析摘要</h3>
<div class="kv-grid">
  <div class="k">户型推断</div><div class="v">${esc(analysis.inferredHouseType || input.houseType || '—')}</div>
  <div class="k">痛点优先级</div><div class="v">${esc((analysis.painPriorities || []).join(' · ') || '—')}</div>
  <div class="k">AI 置信度</div><div class="v">${analysis.confidence || 0}%</div>
  <div class="k">预算档位</div><div class="v">${esc(input.budget || '—')}</div>
  <div class="k">家庭成员</div><div class="v">${[input.hasElderly ? '老人' : null, input.hasChildren ? '儿童' : null, input.hasPet ? '宠物' : null].filter(Boolean).join(' · ') || '—'}</div>
</div>

<h2>二、三档方案推荐</h2>
<div class="tier-grid">${tierCards}</div>

${matrixRows ? `
<h2>三、方案对比矩阵</h2>
<table>
  <thead><tr><th>对比维度</th><th>基础</th><th>舒适</th><th>旗舰</th></tr></thead>
  <tbody>${matrixRows}</tbody>
</table>` : ''}

<h2>${matrixRows ? '四' : '三'}、AI 推荐说明</h2>
<div class="highlight">
  <strong>推荐档次：${esc(result.tiers?.[rec]?.name || rec)}</strong>
  <ul style="margin-top:8px;padding-left:20px;">${recReasons || '<li>基于您的需求综合权衡</li>'}</ul>
</div>
${nextSteps ? `<h3>建议下一步</h3><ol style="padding-left:20px;">${nextSteps}</ol>` : ''}

<div class="cta">
  <h3>🎁 感兴趣？两种成交路径任您选</h3>
  <p>套餐购买：按面积一口价，自动匹配促销<br>定制配置：与设计师协同，产品/系统/材料/施工全透明报价</p>
  <a href="/package-purchase.html">🛒 去套餐购买</a>
  <a href="/custom-configurator.html">⚙️ 去定制配置</a>
</div>

<div class="sig">
  <div class="sig-block"><div class="label">客户确认 / 日期</div><div class="line"></div></div>
  <div class="sig-block"><div class="label">顾问 ${esc(salesperson.name || '')} / 日期</div><div class="line"></div></div>
</div>`;

    return this._wrap(`AI问诊报告 · ${customer.name || id}`, body, { ...ctx, reportId: id });
  }

  // ─── 渲染：销售推荐方案书 ───
  _renderProposal(ctx) {
    const { id, result, customer, salesperson, brand } = ctx;
    const input = result.input || {};
    const rec = result.recommendation?.recommendedTier || 'comfort';
    const recTier = result.tiers?.[rec];
    const recPkg = result.packagePricing?.[rec];

    const allTiersHtml = ['basic', 'comfort', 'premium'].map(k => {
      const t = result.tiers?.[k]; if (!t) return '';
      const pkg = result.packagePricing?.[k];
      const isRec = k === rec;
      return `
        <div class="tier ${isRec ? 'recommended' : ''}">
          ${isRec ? '<span class="badge">推荐</span>' : ''}
          <h3>${esc(t.icon || '')} ${esc(t.name)}</h3>
          <div class="price">¥${(t.totalPrice || 0).toLocaleString()}</div>
          <div class="hint">${pkg ? '套餐 ¥' + pkg.perSqm + '/㎡ × ' + pkg.area + '㎡' : '明细价'}</div>
          <ul style="margin-top:10px;">
            ${(t.systems || []).slice(0, 5).map(s => `<li>${esc(s.name || s)}</li>`).join('')}
          </ul>
          ${t.roi?.energySavingsPercent ? `<div style="margin-top:8px;font-size:11px;color:#065f46;background:#ecfdf5;padding:6px 10px;border-radius:6px;">节能 ${t.roi.energySavingsPercent}% · 回本 ${t.roi.paybackYears || '—'}</div>` : ''}
        </div>`;
    }).join('');

    // 系统亮点（推荐档）
    const systemDetails = (recTier?.systems || []).map(s => {
      const cfg = s.config || {};
      const parts = [];
      Object.entries(cfg).forEach(([k, v]) => {
        if (v && typeof v === 'object') {
          parts.push(`${k}: ${v.model || v.type || ''} ${v.capacity || v.power || v.airflow || ''}`.trim());
        }
      });
      return `
        <tr>
          <td><strong>${esc(s.name)}</strong></td>
          <td>${esc(parts.join(' / ') || '—')}</td>
          <td style="text-align:right;">¥${(s.price || 0).toLocaleString()}</td>
        </tr>`;
    }).join('');

    const valueProps = (recTier?.valueProposition || []).map(v => `<li>${esc(v)}</li>`).join('');

    const body = `
<div class="cover">
  <h1>📘 暖通方案建议书</h1>
  <div class="subtitle">${esc(brand)}｜您的专属舒适家居解决方案</div>
  <div class="meta-grid">
    <div><span class="label">方案编号</span>${esc(id)}</div>
    <div><span class="label">日期</span>${new Date().toLocaleDateString('zh-CN')}</div>
    <div><span class="label">客户</span>${esc(customer.name || '—')}</div>
    <div><span class="label">联系电话</span>${esc(customer.phone || '—')}</div>
    <div><span class="label">项目</span>${esc(input.city || '—')} ${esc(customer.address || '')}</div>
    <div><span class="label">面积</span>${input.area || '—'} ㎡</div>
  </div>
</div>

<h2>一、项目理解</h2>
<div class="kv-grid">
  <div class="k">建筑面积</div><div class="v">${input.area || '—'} ㎡（${esc(input.houseType || '—')}）</div>
  <div class="k">所在城市</div><div class="v">${esc(input.city || '—')}</div>
  <div class="k">关键痛点</div><div class="v">${esc((input.painPoints || []).join(' · ') || '—')}</div>
  <div class="k">预算档位</div><div class="v">${esc(input.budget || '—')}</div>
  <div class="k">家庭成员</div><div class="v">${[input.hasElderly ? '老人' : null, input.hasChildren ? '儿童' : null, input.hasPet ? '宠物' : null].filter(Boolean).join(' · ') || '—'}</div>
</div>

<h2>二、三档方案概览</h2>
<div class="tier-grid">${allTiersHtml}</div>

<h2>三、推荐方案详述（${esc(recTier?.name || '')}）</h2>
<div class="highlight">
  <strong>为什么推荐这一档：</strong>
  <ul style="margin-top:6px;padding-left:20px;">${(result.recommendation?.reasons || []).map(r => `<li>${esc(r)}</li>`).join('') || '<li>综合性价比最高</li>'}</ul>
</div>

<h3>3.1 系统配置与价格</h3>
<table>
  <thead><tr><th style="width:22%">系统</th><th>核心设备/关键参数</th><th style="width:16%;text-align:right;">小计</th></tr></thead>
  <tbody>${systemDetails || '<tr><td colspan="3" style="text-align:center;color:#9ca3af;">无</td></tr>'}</tbody>
  <tfoot><tr><th colspan="2" style="text-align:right;">明细合计</th><th style="text-align:right;color:#C41230;">¥${(recTier?.totalPrice || 0).toLocaleString()}</th></tr></tfoot>
</table>
${recPkg ? `<div class="highlight" style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);">💡 若选择套餐购买：¥${recPkg.perSqm}/㎡ × ${recPkg.area}㎡ = <strong>¥${recPkg.subtotal.toLocaleString()}</strong>（价格透明，附带促销联动）</div>` : ''}

<h3>3.2 价值主张</h3>
<ul style="padding-left:20px;">${valueProps || '<li>—</li>'}</ul>

${recTier?.roi ? `
<h3>3.3 投资回报</h3>
<div class="kv-grid">
  <div class="k">年节能率</div><div class="v">${recTier.roi.energySavingsPercent || '—'}%</div>
  <div class="k">年省电费估算</div><div class="v">¥${(recTier.roi.annualSavings || 0).toLocaleString()}</div>
  <div class="k">回本周期</div><div class="v">${recTier.roi.paybackYears || '—'}</div>
  <div class="k">10年累计收益</div><div class="v">¥${((recTier.roi.annualSavings || 0) * 10).toLocaleString()}</div>
</div>` : ''}

<h2>四、成交方式</h2>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:10px;">
  <div style="padding:16px;background:#fef3c7;border-radius:10px;">
    <h3 style="color:#92400e;margin-top:0;">🛒 方式一：套餐直购</h3>
    <p style="font-size:12.5px;color:#78350f;">按面积一口价，自动应用适配促销，1 日内出订单。</p>
  </div>
  <div style="padding:16px;background:#dbeafe;border-radius:10px;">
    <h3 style="color:#1e40af;margin-top:0;">⚙️ 方式二：定制配置</h3>
    <p style="font-size:12.5px;color:#1e3a8a;">与设计师协同调整产品/系统/材料/施工，形成全维度明细报价。</p>
  </div>
</div>

<h2>五、签约后交付承诺</h2>
<ol style="padding-left:22px;">
  <li>✅ 全套施工图纸（平面/系统/电气/节点）</li>
  <li>✅ 设备与材料清单（品牌/型号/参数可追溯）</li>
  <li>✅ 施工工艺规范与验收标准</li>
  <li>✅ ${({basic:2, comfort:3, premium:5}[rec]) || 3} 年整机质保 + 6 年核心部件</li>
  <li>✅ 年度免费保养（舒适/旗舰档含多次）</li>
</ol>

<div class="cta">
  <h3>🎯 锁定优势，尽早开工</h3>
  <p>方案报价自生成之日起 30 天内有效，越早锁定越早享受季节性促销</p>
  <a href="/package-purchase.html">立即下单</a>
  <a href="/custom-configurator.html">继续定制</a>
</div>

<div class="sig">
  <div class="sig-block"><div class="label">客户签字 / 日期</div><div class="line"></div></div>
  <div class="sig-block"><div class="label">销售顾问 ${esc(salesperson.name || '')} / 日期</div><div class="line"></div></div>
</div>`;

    return this._wrap(`暖通方案建议书 · ${customer.name || id}`, body, { ...ctx, reportId: id });
  }
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

module.exports = ReportGenerator;
