/**
 * 定制报价 API 路由
 * ──────────────────────────────────────────────────
 * 场景：客户基于 AI 三档方案进行"换设备/加系统/调材料"定制
 * 输出：全维度明细报价 + 综合单价分析 + 痛点解决度
 *
 * POST /api/quotation/custom/baseline   - 从某档载入为定制基线
 * POST /api/quotation/custom            - 提交定制配置，返回明细报价
 */

const express = require('express');
const router = express.Router();
const { errorResponse } = require('../utils/sanitize-error');
const { getRuntimeEngine } = require('../modules/runtimeEngineAccess');

const threeTier = getRuntimeEngine('threeTier');

/**
 * POST /api/quotation/custom/baseline
 * Body: { tier: 'basic'|'comfort'|'premium', area, city?, painPoints?, ... }
 * 返回该档完整配置作为定制起点
 */
router.post('/custom/baseline', async (req, res) => {
  try {
    const { tier = 'comfort', ...input } = req.body || {};
    if (!['basic', 'comfort', 'premium'].includes(tier)) {
      return res.status(400).json({ success: false, message: 'tier 必须是 basic|comfort|premium' });
    }
    const full = threeTier.generate(input);
    const baseline = full.tiers[tier];
    res.json({
      success: true,
      data: {
        baselineTier: tier,
        systems: baseline.systems,
        totalPrice: baseline.totalPrice,
        valueProposition: baseline.valueProposition,
        roi: baseline.roi,
        input: full.input,
        analysis: full.analysis,
        packagePricing: full.packagePricing
      }
    });
  } catch (error) {
    if (/必填/.test(error.message)) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return errorResponse(res, error);
  }
});

/**
 * POST /api/quotation/custom
 * Body: {
 *   baselineTier,
 *   area, city,
 *   painPoints?,
 *   customizations: {
 *     products: [{ sku, name, qty, unitPrice }],       // 产品替换/新增
 *     systems:  [{ name, type, config, price }],       // 系统增减
 *     materials:[{ name, brand, spec, qty, unit, unitPrice }],  // 材料
 *     construction: [{ item, qty, unitPrice }],        // 施工
 *     management: { design, project, warranty }        // 管理费/设计费/质保
 *   }
 * }
 */
router.post('/custom', async (req, res) => {
  try {
    const body = req.body || {};
    const { area, city = '上海', painPoints = [], customizations = {} } = body;
    if (!area || area <= 0) {
      return res.status(400).json({ success: false, message: 'area 必填且必须>0' });
    }

    // 各维度小计
    const sum = (arr, fn) => (arr || []).reduce((s, it) => s + (fn(it) || 0), 0);

    const productsSubtotal = sum(customizations.products, p => (p.qty || 1) * (p.unitPrice || 0));
    const systemsSubtotal = sum(customizations.systems, s => s.price || 0);
    const materialsSubtotal = sum(customizations.materials, m => (m.qty || 1) * (m.unitPrice || 0));
    const constructionSubtotal = sum(customizations.construction, c => (c.qty || 1) * (c.unitPrice || 0));
    const mgmt = customizations.management || {};
    const managementSubtotal = (mgmt.design || 0) + (mgmt.project || 0) + (mgmt.warranty || 0);

    const subtotal = productsSubtotal + systemsSubtotal + materialsSubtotal + constructionSubtotal + managementSubtotal;

    // 综合单价分析（暖通行业标准 6 维度，基于总价分配）
    const unitPriceAnalysis = {
      laborCost:     { amount: Math.round(subtotal * 0.20), percentage: 20, description: '人工费：专业安装师傅施工' },
      materialCost:  { amount: Math.round(subtotal * 0.50), percentage: 50, description: '材料费：设备、管材、配件等' },
      machineryCost: { amount: Math.round(subtotal * 0.10), percentage: 10, description: '机械使用费：施工机械、工具' },
      managementCost:{ amount: Math.round(subtotal * 0.10), percentage: 10, description: '管理费：项目管理、质量控制' },
      profit:        { amount: Math.round(subtotal * 0.08), percentage: 8,  description: '合理利润' },
      riskFactor:    { amount: Math.round(subtotal * 0.02), percentage: 2,  description: '风险储备：价格波动、施工风险' }
    };

    // 痛点解决度：每个配置元素看能否对应到痛点
    const allItems = [
      ...(customizations.products || []),
      ...(customizations.systems || []),
      ...(customizations.materials || [])
    ];
    const itemText = allItems.map(i => (i.name || '') + ' ' + (i.desc || '') + ' ' + (i.type || '')).join(' ');
    const painMapping = {
      '水质差': /净水|软水|过滤|RO|WPF/,
      '水温不稳': /热水|壁挂炉|恒温|零冷水|RGS|WH/,
      '空气差': /新风|净化|PM|H11|H13|ERV|FV/,
      '冬天冷': /地暖|采暖|暖气|壁挂炉|热水/,
      '夏天热': /空调|制冷|VRF|多联机|Ruud/,
      '能耗高': /变频|冷凝|节能|高效|SEER/,
      '噪音大': /静音|低噪|dB/,
      '湿度大': /除湿|湿度|dehumid/i
    };
    const details = painPoints.map(pp => {
      const re = painMapping[pp];
      const resolved = re ? re.test(itemText) : false;
      return { painPoint: pp, resolved, resolvedBy: resolved ? '配置中的对应系统/产品' : null, confidence: resolved ? 0.85 : 0 };
    });
    const resolvedCount = details.filter(d => d.resolved).length;
    const painPointResolution = {
      total: painPoints.length,
      resolved: resolvedCount,
      resolutionRate: painPoints.length ? resolvedCount / painPoints.length : 1,
      details
    };

    res.json({
      success: true,
      data: {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        baselineTier: body.baselineTier || null,
        input: { area, city, painPoints },
        customizations,
        subtotals: {
          products: productsSubtotal,
          systems: systemsSubtotal,
          materials: materialsSubtotal,
          construction: constructionSubtotal,
          management: managementSubtotal
        },
        subtotal,
        unitPriceAnalysis,
        painPointResolution,
        finalPrice: subtotal
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

module.exports = router;
