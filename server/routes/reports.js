/**
 * 报告与图纸 API 路由（AI问诊报告 / 销售方案书 / 施工图纸 SVG）
 *
 *  POST /api/reports/consultation   生成 AI 问诊报告（返回 url/shareUrl）
 *  POST /api/reports/proposal       生成销售推荐方案书
 *  GET  /api/reports/:id            获取报告元数据
 *  POST /api/reports/:id/share      生成分享包（链接 + 文案 + 二维码数据）
 *
 *  POST /api/drawings/generate      基于三档结果生成 5 张 SVG 图纸
 *  GET  /api/drawings/:id           获取图纸清单
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { renderFileToPdf } = require('../utils/htmlToPdf');
const { errorResponse } = require('../utils/sanitize-error');
const { getRuntimeEngine } = require('../modules/runtimeEngineAccess');

const reportGen = getRuntimeEngine('reportGenerator');
const drawingGen = getRuntimeEngine('drawingSvgRenderer');
const threeTier = getRuntimeEngine('threeTier');

// 若请求未带 result，但带了 ThreeTier 入参（area/city/...），则现场生成
function ensureResult(body) {
  if (body.result && body.result.tiers) return body.result;
  if (body.area) return threeTier.generate(body);
  throw new Error('缺少 result 或 area 入参');
}

// ──────────────── 报告 ────────────────
router.post('/consultation', (req, res) => {
  try {
    const result = ensureResult(req.body);
    const out = reportGen.generateConsultationReport({
      result,
      customer: req.body.customer || {},
      salesperson: req.body.salesperson || {},
      brand: req.body.brand
    });
    res.json({ success: true, data: out });
  } catch (e) {
    if (/必填|必须|缺少/.test(e.message)) return res.status(400).json({ success: false, message: e.message });
    return errorResponse(res, e);
  }
});

router.post('/proposal', (req, res) => {
  try {
    const result = ensureResult(req.body);
    const out = reportGen.generateSalesProposal({
      result,
      customer: req.body.customer || {},
      salesperson: req.body.salesperson || {},
      brand: req.body.brand
    });
    res.json({ success: true, data: out });
  } catch (e) {
    if (/必填|必须|缺少/.test(e.message)) return res.status(400).json({ success: false, message: e.message });
    return errorResponse(res, e);
  }
});

router.get('/:id', (req, res) => {
  const meta = reportGen.getReport(req.params.id);
  if (!meta) return res.status(404).json({ success: false, message: '报告不存在或已过期' });
  res.json({ success: true, data: meta });
});

/**
 * GET /api/reports/:id/pdf
 * 把报告 HTML 渲染为真实 PDF，并以附件（或内联）返回
 * Query: ?inline=1 → 浏览器内预览；否则触发下载
 *        ?format=A4|A3|Letter  ?landscape=1
 */
router.get('/:id/pdf', async (req, res) => {
  try {
    const meta = reportGen.getReport(req.params.id);
    if (!meta) return res.status(404).json({ success: false, message: '报告不存在' });
    const htmlPath = path.join(__dirname, '..', '..', 'exports', 'reports', meta.id + '.html');
    const pdfPath  = path.join(__dirname, '..', '..', 'exports', 'reports', meta.id + '.pdf');

    // 若已生成且 HTML 未更新，直接返回缓存
    const needRender = !fs.existsSync(pdfPath) || fs.statSync(pdfPath).mtimeMs < fs.statSync(htmlPath).mtimeMs;
    if (needRender) {
      await renderFileToPdf(htmlPath, pdfPath, {
        format: (req.query.format || 'A4').toString(),
        landscape: req.query.landscape === '1' || req.query.landscape === 'true'
      });
    }

    const filename = `${meta.kind === 'proposal' ? '方案建议书' : 'AI问诊报告'}-${meta.customer?.name || meta.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      (req.query.inline === '1' ? 'inline' : 'attachment') +
      `; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    fs.createReadStream(pdfPath).pipe(res);
  } catch (e) {
    // 明确暴露 Chromium 缺失提示，便于用户执行 `npx playwright install chromium`
    if (/playwright|Chromium|Executable/i.test(e.message)) {
      return res.status(503).json({
        success: false,
        message: e.message,
        hint: '请在服务器端执行：npx playwright install chromium'
      });
    }
    return errorResponse(res, e);
  }
});

/**
 * POST /api/reports/:id/share
 * 生成分享包（绝对链接 + 微信/短信/邮件 文案 + 二维码内容）
 * Body: { origin? } - 前端可传当前 origin 以确保外发链接可跳转
 */
router.post('/:id/share', (req, res) => {
  const meta = reportGen.getReport(req.params.id);
  if (!meta) return res.status(404).json({ success: false, message: '报告不存在' });
  const origin = (req.body && req.body.origin) || `${req.protocol}://${req.get('host')}`;
  const absUrl = origin + meta.url;
  const viewUrl = origin + meta.shareUrl;
  const customerName = meta.customer?.name || '客户';
  const tierName = meta.summary?.tierName || '';
  const priceText = meta.summary?.packagePrice
    ? `套餐价 ¥${Number(meta.summary.packagePrice).toLocaleString()}`
    : (meta.summary?.detailPrice ? `参考价 ¥${Number(meta.summary.detailPrice).toLocaleString()}` : '');

  const isProposal = meta.kind === 'proposal';
  const title = isProposal
    ? `【${meta.brand || '瑞诺瓦暖通'}】${customerName} 的专属方案建议书`
    : `【${meta.brand || '瑞诺瓦暖通'}】${customerName} 的 AI 智能问诊报告`;

  const body = isProposal
    ? `您好！这是为您准备的暖通方案建议书，AI 推荐 ${tierName}${priceText ? '（' + priceText + '）' : ''}。\n包含三档对比、ROI、签约后交付承诺，点击查看：\n${absUrl}`
    : `您好！AI 已完成您的暖通问诊，共 3 档方案可选，推荐 ${tierName}${priceText ? '（' + priceText + '）' : ''}。\n点击查看完整报告：\n${absUrl}`;

  res.json({
    success: true,
    data: {
      title,
      absoluteUrl: absUrl,
      viewUrl,
      messages: {
        wechat: `${title}\n\n${body}`,
        sms:    `${title.replace(/【.*?】/, '')} ${absUrl}`,
        email:  { subject: title, body },
        copy:   absUrl
      },
      qrPayload: absUrl,
      qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(absUrl)}`
    }
  });
});

module.exports = router;
