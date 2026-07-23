/**
 * TechnicalDeliveryGenerator - 签单后技术交付文档生成器
 * ────────────────────────────────────────────────────────────
 * 输入：订单对象（含 customer / tier / systems / address / signedAt 等）
 * 输出：5 类可打印 HTML 文档（用户浏览器 Ctrl+P 即可导出 PDF）
 *   ① 施工图纸包总览     construction-drawing.html
 *   ② 设备材料清单       equipment-material-list.html
 *   ③ 施工工艺规范       construction-spec.html
 *   ④ 验收标准           acceptance-standard.html
 *   ⑤ 质保与售后手册     warranty-manual.html
 *
 * 文档输出到 exports/delivery/<orderNo>/*.html，由下载中心 UI 呈现。
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

const EXPORT_ROOT = path.join(__dirname, '../../exports/delivery');

const DOC_TYPES = [
  { key: 'construction-drawing',    title: '施工图纸包',     icon: '📐' },
  { key: 'equipment-material-list', title: '设备材料清单',   icon: '📦' },
  { key: 'construction-spec',       title: '施工工艺规范',   icon: '🔧' },
  { key: 'acceptance-standard',     title: '验收标准',       icon: '✅' },
  { key: 'warranty-manual',         title: '质保与售后手册', icon: '🛡️' }
];

class TechnicalDeliveryGenerator {
  constructor(options = {}) {
    this.version = '1.0.0';
    this.exportRoot = options.exportRoot || EXPORT_ROOT;
    if (!fs.existsSync(this.exportRoot)) {
      fs.mkdirSync(this.exportRoot, { recursive: true });
    }
  }

  /**
   * 生成全部 5 份文档
   * @param {Object} order - 订单对象
   * @returns {Array} documents - 每项含 type/title/filePath/url
   */
  generate(order) {
    if (!order || !order.orderNo) {
      throw new Error('order.orderNo 必填');
    }
    const outDir = path.join(this.exportRoot, order.orderNo);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const documents = DOC_TYPES.map(d => {
      const html = this._renderDoc(d.key, order);
      const filePath = path.join(outDir, `${d.key}.html`);
      fs.writeFileSync(filePath, html, 'utf8');
      return {
        type: d.key,
        title: d.title,
        icon: d.icon,
        filePath,
        url: `/exports/delivery/${order.orderNo}/${d.key}.html`,
        format: 'html',
        sizeKB: Math.round(Buffer.byteLength(html, 'utf8') / 1024)
      };
    });

    // 元数据索引
    const manifest = {
      orderNo: order.orderNo,
      generatedAt: new Date().toISOString(),
      customer: order.customer || {},
      tier: order.tier,
      area: order.area,
      city: order.city,
      documents
    };
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    return { manifest, documents };
  }

  /**
   * 读取已生成的清单
   */
  getManifest(orderNo) {
    const mPath = path.join(this.exportRoot, orderNo, 'manifest.json');
    if (!fs.existsSync(mPath)) return null;
    return JSON.parse(fs.readFileSync(mPath, 'utf8'));
  }

  /**
   * 渲染单个文档（router）
   */
  _renderDoc(key, order) {
    switch (key) {
      case 'construction-drawing':    return this._tmplConstructionDrawing(order);
      case 'equipment-material-list': return this._tmplEquipmentList(order);
      case 'construction-spec':       return this._tmplConstructionSpec(order);
      case 'acceptance-standard':     return this._tmplAcceptanceStandard(order);
      case 'warranty-manual':         return this._tmplWarrantyManual(order);
      default: return this._wrap('未知文档类型', '<p>unknown doc</p>', order);
    }
  }

  // ───────── 统一HTML外壳（含打印样式） ─────────
  _wrap(title, bodyHtml, order) {
    const c = order.customer || {};
    return `<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="UTF-8">
<title>${escapeHtml(title)} - ${escapeHtml(order.orderNo)}</title>
<style>
  * { box-sizing: border-box; margin:0; padding:0; }
  body { font-family: -apple-system, 'Microsoft YaHei', 'SimHei', sans-serif; color:#1f2937; padding: 40px 48px; background: #fff; line-height: 1.7; }
  .doc-head { border-bottom: 3px solid #C41230; padding-bottom: 16px; margin-bottom: 24px; }
  .doc-head h1 { font-size: 26px; color: #C41230; }
  .doc-head .meta { font-size: 13px; color: #6b7280; margin-top: 6px; display: flex; gap: 24px; flex-wrap: wrap; }
  h2 { font-size: 18px; margin: 24px 0 12px; padding-left: 10px; border-left: 4px solid #C41230; }
  h3 { font-size: 15px; margin: 16px 0 8px; color: #374151; }
  p, li { font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
  table th, table td { border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; }
  table th { background: #f3f4f6; font-weight: 600; }
  ul, ol { padding-left: 22px; }
  .note { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px 14px; margin: 12px 0; font-size: 12px; border-radius: 4px; }
  .ok { background: #ecfdf5; border-left: 4px solid #10b981; padding: 10px 14px; margin: 12px 0; font-size: 12px; border-radius: 4px; }
  .print-btn { position: fixed; right: 24px; top: 24px; background: #C41230; color: #fff; padding: 10px 18px; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; box-shadow: 0 4px 12px rgba(196,18,48,.3); }
  .sig { margin-top: 48px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; padding-top: 18px; border-top: 1px dashed #9ca3af; }
  .sig-block .line { border-bottom: 1px solid #1f2937; height: 48px; margin-top: 8px; }
  .sig-block .label { font-size: 12px; color: #6b7280; }
  .footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
  @media print { .print-btn { display: none !important; } body { padding: 20mm; } }
</style>
</head><body>
<button class="print-btn" onclick="window.print()">🖨️ 打印 / 另存为 PDF</button>
<div class="doc-head">
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    <span>订单号：${escapeHtml(order.orderNo)}</span>
    <span>客户：${escapeHtml(c.name || '待填')}</span>
    <span>地址：${escapeHtml(c.address || '待填')}</span>
    <span>签单日：${escapeHtml(order.signedAt || new Date().toISOString().slice(0,10))}</span>
    <span>档次：${escapeHtml(tierName(order.tier))}</span>
    <span>面积：${order.area || '-'}㎡</span>
  </div>
</div>
${bodyHtml}
<div class="footer">瑞诺瓦暖通AI设计平台 · ${escapeHtml(order.orderNo)} · 生成于 ${new Date().toLocaleString('zh-CN')}</div>
</body></html>`;
  }

  // ───────── ① 施工图纸包 ─────────
  _tmplConstructionDrawing(order) {
    const systems = order.systems || [];
    const body = `
<h2>一、工程概况</h2>
<ul>
  <li>工程地点：${escapeHtml(order.customer?.address || '-')}</li>
  <li>建筑面积：${order.area || '-'} ㎡</li>
  <li>所在城市：${escapeHtml(order.city || '-')}</li>
  <li>系统配置档次：${escapeHtml(tierName(order.tier))}</li>
</ul>

<h2>二、图纸清单</h2>
<table>
  <thead><tr><th>图号</th><th>图纸名称</th><th>内容摘要</th><th>备注</th></tr></thead>
  <tbody>
    <tr><td>NT-01</td><td>平面布置总图</td><td>户型分区、设备位置、主要管线走向</td><td>必备</td></tr>
    <tr><td>NT-02</td><td>水系统图</td><td>热水/冷热水/软水/净水管路走向</td><td>${systems.some(s=>/水/.test(s.name))?'涉及':'—'}</td></tr>
    <tr><td>NT-03</td><td>采暖系统图</td><td>地暖盘管/散热器分区、混水中心位置</td><td>${systems.some(s=>/暖|heating/i.test(s.name||s.type))?'涉及':'—'}</td></tr>
    <tr><td>NT-04</td><td>空调系统图</td><td>室内外机位置、冷媒管走向、冷凝水</td><td>${systems.some(s=>/空调|ac/i.test(s.name||s.type))?'涉及':'—'}</td></tr>
    <tr><td>NT-05</td><td>新风系统图</td><td>送回风口、主管布置、CO2/PM传感器位</td><td>${systems.some(s=>/新风|fresh/i.test(s.name||s.type))?'涉及':'—'}</td></tr>
    <tr><td>NT-06</td><td>电气配电图</td><td>各系统配电、空气开关、线径、接地</td><td>必备</td></tr>
    <tr><td>NT-07</td><td>弱电/智能控制图</td><td>面板、传感器、网关、联动逻辑</td><td>按档次</td></tr>
    <tr><td>NT-08</td><td>节点详图</td><td>吊顶穿墙/下沉地面/墙面开孔大样</td><td>必备</td></tr>
  </tbody>
</table>

<div class="note">📌 图纸交付方式：正式DXF/PDF在项目开工前由设计师出图，本页仅为交付清单备案。可通过平台 /api/dxf/parse 导入DXF实物图。</div>

<h2>三、关键尺寸与注意事项</h2>
<ul>
  <li>设备机房预留尺寸：主机 800×600×1500mm（含维修空间）</li>
  <li>吊顶高度：预留 300mm 以上安装风管与冷媒管</li>
  <li>卫浴地漏位置与热水回水管走向必须提前定位</li>
  <li>外立面开孔需征得物业同意，孔径 75–110mm 视系统定</li>
</ul>

<div class="sig">
  <div class="sig-block"><div class="label">设计师签字 / 日期</div><div class="line"></div></div>
  <div class="sig-block"><div class="label">客户确认 / 日期</div><div class="line"></div></div>
</div>
`;
    return this._wrap('施工图纸包', body, order);
  }

  // ───────── ② 设备材料清单 ─────────
  _tmplEquipmentList(order) {
    const systems = order.systems || [];
    const rows = systems.map((s, i) => {
      const cfg = s.config || {};
      const parts = [];
      Object.entries(cfg).forEach(([k, v]) => {
        if (typeof v === 'object' && v) {
          const name = v.model || v.type || '';
          parts.push(`<tr><td>${i+1}.${parts.length+1}</td><td>${escapeHtml(s.name)}/${escapeHtml(k)}</td><td>${escapeHtml(name)}</td><td>1</td><td>套</td><td>${escapeHtml(v.capacity||v.power||v.airflow||'-')}</td></tr>`);
        }
      });
      if (parts.length === 0) {
        parts.push(`<tr><td>${i+1}</td><td>${escapeHtml(s.name)}</td><td>-</td><td>1</td><td>套</td><td>-</td></tr>`);
      }
      return parts.join('');
    }).join('') || '<tr><td colspan="6" style="text-align:center;color:#9ca3af;">订单未含系统清单</td></tr>';

    const body = `
<h2>一、设备清单</h2>
<table>
  <thead><tr><th style="width:8%">序号</th><th>类别/部件</th><th>型号/品牌</th><th style="width:8%">数量</th><th style="width:8%">单位</th><th>关键参数</th></tr></thead>
  <tbody>${rows}</tbody>
</table>

<h2>二、主要辅材清单（按档次与面积推算）</h2>
<table>
  <thead><tr><th>类别</th><th>材料名称</th><th>品牌参考</th><th>规格</th><th>预估用量</th></tr></thead>
  <tbody>
    <tr><td>保温</td><td>橡塑保温棉</td><td>阿乐斯 B1级</td><td>厚 20mm</td><td>${Math.round((order.area||100)*0.6)} m²</td></tr>
    <tr><td>水管</td><td>PE-RT地暖盘管</td><td>德国瑞好/伟星</td><td>DN16-20</td><td>${Math.round((order.area||100)*6)} m</td></tr>
    <tr><td>水管</td><td>PPR热水管</td><td>日丰/金德</td><td>DN20-25</td><td>${Math.round((order.area||100)*0.8)} m</td></tr>
    <tr><td>冷媒</td><td>紫铜管（R410A）</td><td>金龙/海亮</td><td>Φ6.35/9.52</td><td>${Math.round((order.area||100)*0.5)} m</td></tr>
    <tr><td>风管</td><td>PE镀铝复合风管</td><td>爱美信/绿岛风</td><td>Φ150</td><td>${Math.round((order.area||100)*0.4)} m</td></tr>
    <tr><td>支吊架</td><td>U型/吊杆+减震垫</td><td>通用</td><td>M8-M10</td><td>${Math.ceil((order.area||100)/10)} 套</td></tr>
    <tr><td>电气</td><td>BV/ZR-BV铜芯线</td><td>上上/远东</td><td>2.5/4/6 mm²</td><td>${Math.round((order.area||100)*5)} m</td></tr>
    <tr><td>调试</td><td>分集水器/温控面板</td><td>Rheem/Ruud</td><td>按系统分区</td><td>${Math.ceil((order.area||100)/30)} 套</td></tr>
  </tbody>
</table>

<div class="ok">✅ 所有设备与辅材均由瑞美原厂或授权渠道供应，随箱附带检测报告、合格证、发票。</div>
`;
    return this._wrap('设备材料清单', body, order);
  }

  // ───────── ③ 施工工艺规范 ─────────
  _tmplConstructionSpec(order) {
    const body = `
<h2>一、施工准备阶段</h2>
<ol>
  <li><strong>现场复测</strong>：到场核对图纸与现场偏差；确认墙体承重、吊顶高度、外机位。</li>
  <li><strong>材料进场</strong>：按清单核对数量、品牌、规格；拍照留档；垃圾清运点与堆放区划分。</li>
  <li><strong>开工交底</strong>：向客户与物业递交施工交底单，确认工期与施工时段。</li>
  <li><strong>成品保护</strong>：已装修区域铺设保护膜/泡沫，地板覆盖 3mm 以上保护板。</li>
</ol>

<h2>二、水系统施工要点</h2>
<ul>
  <li>PPR管热熔 260℃±5℃，插入深度与停留时间严格对照厂家表</li>
  <li>地暖盘管间距：卫浴 100mm，卧室 150mm，客厅 200mm；回填砂浆前打压试验（保压 30 分钟 0.8MPa）</li>
  <li>热水回水管必须保温全覆盖，避免冷凝/热损</li>
  <li>分集水器位置预留检修口 300×300mm</li>
</ul>

<h2>三、空调/冷媒系统施工要点</h2>
<ul>
  <li>紫铜管焊接全程氮气保护（0.05MPa），防止内壁氧化</li>
  <li>冷媒管真空维持压力 –0.1MPa 保持 30 分钟不变压</li>
  <li>冷凝水坡度 ≥ 1%，主管 ≥ 0.5%，不得反坡；设检修口</li>
  <li>室外机减震垫 +橡胶脚垫双级减振；固定螺栓 M10 以上</li>
</ul>

<h2>四、新风系统施工要点</h2>
<ul>
  <li>主机吊装水平度误差 ≤ 2mm/m；减震吊杆</li>
  <li>送回风管用阻燃胶带三层封胶，接口处缠 PVC 带</li>
  <li>风口与吊顶接缝做 Sealant 封闭；新风不与卫浴排气合用</li>
  <li>外墙穿墙套管向外微倾 1%，防雨倒灌</li>
</ul>

<h2>五、电气与智能控制</h2>
<ul>
  <li>空调回路独立漏保 30mA；主机专用回路 10mm² 以上</li>
  <li>控制面板离地 1.3m；避开阳光直射与空调出风口</li>
  <li>弱电信号线穿 PVC 管，与强电线保持 30cm 以上距离</li>
  <li>所有联动逻辑在调试阶段演示通过后由客户签字确认</li>
</ul>

<div class="note">⚠️ 严禁湿作业与吊顶、墙面涂装同时进行；严禁非持证电工进行强电施工。</div>
`;
    return this._wrap('施工工艺规范', body, order);
  }

  // ───────── ④ 验收标准 ─────────
  _tmplAcceptanceStandard(order) {
    const body = `
<h2>一、水系统验收</h2>
<table>
  <thead><tr><th>项目</th><th>标准</th><th>检测方法</th><th>结论</th></tr></thead>
  <tbody>
    <tr><td>水管压力测试</td><td>0.8MPa / 30min 压降 ≤ 0.05MPa</td><td>手压泵+压力表</td><td>□合格 □不合格</td></tr>
    <tr><td>地暖盘管打压</td><td>1.0MPa / 24h 压降 ≤ 0.05MPa</td><td>连续监测</td><td>□合格 □不合格</td></tr>
    <tr><td>热水到达时间</td><td>末端开启 ≤ 8 秒出热水（含零冷水系统）</td><td>秒表计时</td><td>□合格 □不合格</td></tr>
    <tr><td>水质指标</td><td>TDS ≤ 50 ppm（RO水）</td><td>TDS笔</td><td>□合格 □不合格</td></tr>
  </tbody>
</table>

<h2>二、空调系统验收</h2>
<table>
  <thead><tr><th>项目</th><th>标准</th><th>检测方法</th><th>结论</th></tr></thead>
  <tbody>
    <tr><td>冷媒保压</td><td>–0.1MPa / 30min 无变化</td><td>真空表</td><td>□合格 □不合格</td></tr>
    <tr><td>制冷出风温度</td><td>≤ 15℃（环境 32℃ 内循环下）</td><td>温度计</td><td>□合格 □不合格</td></tr>
    <tr><td>制热出风温度</td><td>≥ 35℃（环境 15℃ 内循环下）</td><td>温度计</td><td>□合格 □不合格</td></tr>
    <tr><td>运行噪音</td><td>卧室内机 ≤ 38 dB(A)</td><td>声级计 1m 距离</td><td>□合格 □不合格</td></tr>
    <tr><td>冷凝水排放</td><td>排水管坡度达标、无漏水</td><td>持续灌水 5 分钟</td><td>□合格 □不合格</td></tr>
  </tbody>
</table>

<h2>三、新风系统验收</h2>
<table>
  <thead><tr><th>项目</th><th>标准</th><th>检测方法</th><th>结论</th></tr></thead>
  <tbody>
    <tr><td>各房间换气量</td><td>人均 ≥ 30 m³/h</td><td>风量罩测试</td><td>□合格 □不合格</td></tr>
    <tr><td>PM2.5 过滤效率</td><td>≥ 95% （测试烟尘源）</td><td>激光粒子计数</td><td>□合格 □不合格</td></tr>
    <tr><td>能量回收效率</td><td>≥ 65%（全热交换）</td><td>冬夏温差比</td><td>□合格 □不合格</td></tr>
    <tr><td>噪音</td><td>≤ 32 dB(A)</td><td>声级计</td><td>□合格 □不合格</td></tr>
  </tbody>
</table>

<h2>四、智能联动演示</h2>
<ul>
  <li>手机 App 远程开关机、温度调整测试</li>
  <li>传感器触发 → 新风自动提升演示（CO₂ / PM2.5）</li>
  <li>一键离家 / 回家场景联动</li>
  <li>语音助手指令测试（如已配置）</li>
</ul>

<div class="sig">
  <div class="sig-block"><div class="label">施工方签字 / 日期</div><div class="line"></div></div>
  <div class="sig-block"><div class="label">业主签字 / 日期</div><div class="line"></div></div>
</div>
`;
    return this._wrap('验收标准', body, order);
  }

  // ───────── ⑤ 质保与售后手册 ─────────
  _tmplWarrantyManual(order) {
    const tier = order.tier || 'comfort';
    const warranty = { basic: 2, comfort: 3, premium: 5 }[tier] || 3;
    const body = `
<h2>一、质保政策</h2>
<table>
  <thead><tr><th>部件类别</th><th>质保年限</th><th>说明</th></tr></thead>
  <tbody>
    <tr><td>主机设备（压缩机/热交换器）</td><td>${warranty} 年整机 + 6 年核心部件</td><td>瑞美/Ruud 原厂保</td></tr>
    <tr><td>系统集成与控制</td><td>${warranty} 年</td><td>包含传感器、面板、网关</td></tr>
    <tr><td>管材/保温</td><td>5–10 年（按材质）</td><td>PE-RT/PPR 见厂商质保承诺</td></tr>
    <tr><td>施工工艺</td><td>${warranty} 年</td><td>人工安装质量问题免费返修</td></tr>
  </tbody>
</table>

<h2>二、免费上门保养</h2>
<ul>
  <li><strong>第一年</strong>：两次（夏初 + 冬初）保养，主机清洗、滤网更换、参数校准</li>
  <li><strong>第二年起</strong>：每年一次免费巡检；超出范围的耗材按成本价</li>
  <li>${tier === 'premium' ? '尊享档：终身 VIP 保养，含每年 2 次主动清洗' : '舒适档：前 3 年每年 1 次，之后按需预约'}</li>
</ul>

<h2>三、响应时效</h2>
<table>
  <tbody>
    <tr><th>紧急故障（停水/漏电/无法制热）</th><td>2 小时内响应，24 小时内到场</td></tr>
    <tr><th>一般故障（个别房间/某单项异常）</th><td>12 小时内响应，72 小时内到场</td></tr>
    <tr><th>保养与咨询</th><td>48 小时内预约确认</td></tr>
  </tbody>
</table>

<h2>四、日常使用与保养建议</h2>
<ul>
  <li>主机滤网每 3 个月清洗一次；外机周围 1m 内保持通风无遮挡</li>
  <li>软水机盐罐每月检查盐位，每 3 个月补盐</li>
  <li>新风主滤芯每 12 个月更换，HEPA 每 6 个月更换（雾霾地区缩短至 4 个月）</li>
  <li>长期离家（> 7 天）请关闭主机并排空冷凝水</li>
</ul>

<h2>五、联系方式</h2>
<div class="ok">
  <p>🔧 客服热线：400-XXX-XXXX（7x24）</p>
  <p>📱 微信小程序：瑞诺瓦暖通管家 → "我的订单 / 售后报修"</p>
  <p>🧑‍🔧 专属工程师：${escapeHtml(order.customer?.engineer || '开工前由服务中心指派')}</p>
  <p>📍 本单归属分支机构：${escapeHtml(order.city || '-')}服务中心</p>
</div>

<h2>六、签单承诺</h2>
<p>瑞诺瓦暖通AI设计平台承诺：本订单所列全部设备为原厂正品，全部施工符合《住宅装饰装修工程施工规范 GB 50327》与厂商安装标准。若发现假货或工艺不达标，<strong>按订单金额 3 倍先行赔付</strong>。</p>

<div class="sig">
  <div class="sig-block"><div class="label">服务商盖章 / 日期</div><div class="line"></div></div>
  <div class="sig-block"><div class="label">客户确认 / 日期</div><div class="line"></div></div>
</div>
`;
    return this._wrap('质保与售后手册', body, order);
  }
}

// ───── 工具函数 ─────
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function tierName(t) {
  return { basic: '基础', comfort: '舒适', premium: '旗舰' }[t] || (t || '-');
}

module.exports = TechnicalDeliveryGenerator;
module.exports.DOC_TYPES = DOC_TYPES;
