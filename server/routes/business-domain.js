/**
 * Business Domain Router
 * 一次性补齐 4 象限所需 API（基于 PRODUCT-SCOPE.md）
 *
 * 覆盖域:
 *   象限 3 · Rysnova 施工闭环: /api/contracts/:id/* (使用 db.contracts 内存版，不与 /api/construction MongoDB 版冲突)
 *   象限 4 · 员工经营管理:       /api/crm/* /api/products/* /api/promotion/* /api/pricing/* /api/dashboard/*
 *   象限 4 · 运维:               /api/operation/*
 *   象限 2 · 设计师:             /api/quote/with-promotion (报价+促销聚合)
 *
 * 设计原则:
 *   - 工厂函数模式 (db) => router，与 server-production.js 共用同一份内存 db
 *   - 不引入新依赖，不破坏既有路由
 *   - 全部 API 返回 { success, data | error } 统一格式
 *   - 错误处理走 errorResponse 统一脱敏
 *
 * 创建: 2026-04-26 · I2.1 + I2.3 + I2.5 合并迁移
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

let errorResponse = (res, err) => res.status(500).json({ success: false, error: err && err.message ? err.message : String(err) });
try {
  ({ errorResponse } = require('../utils/sanitize-error'));
} catch (_) { /* fallback to local */ }

// 引擎按需加载（兼容缺失场景）
function tryRequire(p) {
  try { return require(p); } catch (e) { return null; }
}
function canLoad(p) {
  try { require.resolve(p); return true; } catch (e) { return false; }
}
function lazyOptionalEngine(p) {
  let loaded = false;
  let instance = null;
  return {
    available: canLoad(p),
    get() {
      if (!this.available) return null;
      if (!loaded) {
        const Engine = tryRequire(p);
        instance = Engine ? new Engine() : null;
        loaded = true;
      }
      return instance;
    }
  };
}
const promotionEngineAvailability = canLoad('../core/PromotionEngine');
const quotationEngineAvailability = canLoad('../core/QuotationEngine');
const analyticsEngineAvailability = canLoad('../core/AnalyticsEngine');
const predictiveMaintenanceEngine = lazyOptionalEngine('../engines/PredictiveMaintenanceEngine');
const llmServiceEngine = lazyOptionalEngine('../engines/LLMServiceEngine');
const floorPlanRecognitionEngine = lazyOptionalEngine('../engines/FloorPlanRecognitionEngine');

// ======================== 工厂函数 ========================
module.exports = function createBusinessDomainRouter(db) {
  const router = express.Router();

  // -------------------- 共享辅助 --------------------
  const now = () => new Date().toISOString();
  const genId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  // 兜底初始化字段，避免老 db 缺字段崩溃
  db.crm = db.crm || { opportunities: [], interactions: [], campaigns: [], coupons: [] };
  db.operation = db.operation || { devices: [], readings: [], predictions: {} };
  db.acceptance = db.acceptance || []; // 验收调试记录
  db.settlements = db.settlements || []; // 施工结算
  db.materialMovements = db.materialMovements || []; // 材料领用/退库
  // P0 修复 2026-04-27：补全业务核心集合的兼底初始化（防 undefined）
  db.customers = db.customers || [];
  db.contracts = db.contracts || [];
  db.products = db.products || [];
  db.quotes = db.quotes || [];
  db.pricing = db.pricing || { baseDiscount: 1, categoryDiscounts: {}, specialOffers: [] };
  db.pricing.specialOffers = db.pricing.specialOffers || [];
  db.promotions = db.promotions || db.pricing.specialOffers;

  // ====================================================================
  // 象限 3 · Rysnova 施工管理闭环 5 件套
  // ====================================================================

  // [1] 进度管理 - 甘特图 / 阶段流转 / 延期预警 (基于 db.contracts 内存版)
  router.get('/api/contracts/:id/gantt', (req, res) => {
    try {
      const c = db.contracts.find(c => c.id === req.params.id || c.contractNumber === req.params.id);
      if (!c) return res.status(404).json({ success: false, error: '合同不存在' });
      const logs = (c.constructionLogs || []).map((l, idx) => ({
        phaseId: `P${idx + 1}`,
        phase: l.phase,
        date: l.date,
        description: l.description,
        status: l.status,
        delayed: l.status === 'in_progress' && c.expectedCompletion && new Date(l.date) > new Date(c.expectedCompletion)
      }));
      res.json({
        success: true,
        data: {
          contractId: c.id,
          totalPhases: logs.length,
          completedPhases: logs.filter(l => l.status === 'completed').length,
          inProgressPhases: logs.filter(l => l.status === 'in_progress').length,
          phases: logs,
          expectedCompletion: c.expectedCompletion,
          actualCompletion: c.actualCompletion || null,
          status: c.status
        }
      });
    } catch (e) { return errorResponse(res, e); }
  });

  router.put('/api/contracts/:id/phase/:phaseId/start', (req, res) => {
    try {
      const c = db.contracts.find(c => c.id === req.params.id);
      if (!c) return res.status(404).json({ success: false, error: '合同不存在' });
      const idx = parseInt(req.params.phaseId.replace('P', '')) - 1;
      if (!c.constructionLogs || !c.constructionLogs[idx]) return res.status(404).json({ success: false, error: '阶段不存在' });
      c.constructionLogs[idx].status = 'in_progress';
      c.constructionLogs[idx].startedAt = now();
      res.json({ success: true, data: c.constructionLogs[idx] });
    } catch (e) { return errorResponse(res, e); }
  });

  router.put('/api/contracts/:id/phase/:phaseId/complete', (req, res) => {
    try {
      const c = db.contracts.find(c => c.id === req.params.id);
      if (!c) return res.status(404).json({ success: false, error: '合同不存在' });
      const idx = parseInt(req.params.phaseId.replace('P', '')) - 1;
      if (!c.constructionLogs || !c.constructionLogs[idx]) return res.status(404).json({ success: false, error: '阶段不存在' });
      c.constructionLogs[idx].status = 'completed';
      c.constructionLogs[idx].completedAt = now();
      res.json({ success: true, data: c.constructionLogs[idx] });
    } catch (e) { return errorResponse(res, e); }
  });

  router.get('/api/contracts/:id/report', (req, res) => {
    try {
      const c = db.contracts.find(c => c.id === req.params.id);
      if (!c) return res.status(404).json({ success: false, error: '合同不存在' });
      const totalMaterialCost = (c.materials || []).reduce(
        (sum, cat) => sum + (cat.items || []).reduce((s, it) => s + (it.totalPrice || 0), 0), 0
      );
      const completedPhases = (c.constructionLogs || []).filter(l => l.status === 'completed').length;
      const totalPhases = (c.constructionLogs || []).length || 1;
      res.json({
        success: true,
        data: {
          contractId: c.id,
          customer: c.customerName,
          progress: Math.round(completedPhases / totalPhases * 100),
          totalMaterialCost,
          contractPrice: c.totalPrice,
          status: c.status,
          drawings: c.drawings || [],
          constructionLogs: c.constructionLogs || [],
          materialsCategories: (c.materials || []).length,
          generatedAt: now()
        }
      });
    } catch (e) { return errorResponse(res, e); }
  });

  // [2] 材料管理 - 领料/退库/库存查询
  router.get('/api/material/:contractId', (req, res) => {
    try {
      const c = db.contracts.find(c => c.id === req.params.contractId);
      if (!c) return res.status(404).json({ success: false, error: '合同不存在' });
      const movements = db.materialMovements.filter(m => m.contractId === c.id);
      res.json({ success: true, data: { categories: c.materials || [], movements } });
    } catch (e) { return errorResponse(res, e); }
  });

  router.post('/api/material/:contractId/movement', (req, res) => {
    try {
      const { type, itemName, quantity, operator, note } = req.body || {};
      if (!type || !itemName || quantity == null) {
        return res.status(400).json({ success: false, error: 'type/itemName/quantity 必填' });
      }
      const movement = {
        id: genId('MOV'),
        contractId: req.params.contractId,
        type, // 'issue' (领料) / 'return' (退库) / 'loss' (报损) / 'inbound' (进场)
        itemName,
        quantity,
        operator: operator || 'unknown',
        note: note || '',
        createdAt: now()
      };
      db.materialMovements.push(movement);
      res.json({ success: true, data: movement });
    } catch (e) { return errorResponse(res, e); }
  });

  // [3] 工期管理 / 标准工序库（来自 db.contracts.constructionLogs 抽象）
  router.get('/api/contracts/standard-phases', (req, res) => {
    res.json({
      success: true,
      data: [
        { id: 'P1', phase: '进场准备', estimatedDays: 1, dependencies: [] },
        { id: 'P2', phase: '隐蔽工程', estimatedDays: 3, dependencies: ['P1'] },
        { id: 'P3', phase: '设备安装', estimatedDays: 4, dependencies: ['P2'] },
        { id: 'P4', phase: '系统调试', estimatedDays: 2, dependencies: ['P3'] },
        { id: 'P5', phase: '验收交付', estimatedDays: 1, dependencies: ['P4'] }
      ]
    });
  });

  // [4] 验收调试 - 照片上传 + 调试报告
  router.post('/api/acceptance/:contractId', (req, res) => {
    try {
      const { items, photos, debugReport, inspector, customerSignature } = req.body || {};
      const record = {
        id: genId('ACC'),
        contractId: req.params.contractId,
        items: items || [], // [{ name, expected, actual, status: 'pass'|'fail' }]
        photos: photos || [], // [{ url, caption, takenAt }]
        debugReport: debugReport || { temperature: null, pressure: null, noise: null, airflow: null, notes: '' },
        inspector: inspector || 'unknown',
        customerSignature: customerSignature || null,
        passRate: items && items.length ? items.filter(i => i.status === 'pass').length / items.length : 0,
        createdAt: now()
      };
      db.acceptance.push(record);
      res.json({ success: true, data: record });
    } catch (e) { return errorResponse(res, e); }
  });

  router.get('/api/acceptance/:contractId', (req, res) => {
    const records = db.acceptance.filter(a => a.contractId === req.params.contractId);
    res.json({ success: true, data: records });
  });

  // [5] 施工结算 - 合同价 vs 实际成本 + 变更
  router.post('/api/settlement/:contractId', (req, res) => {
    try {
      const c = db.contracts.find(c => c.id === req.params.contractId);
      if (!c) return res.status(404).json({ success: false, error: '合同不存在' });
      const { changes, additionalCosts, refund, payerNote } = req.body || {};
      const materialCost = (c.materials || []).reduce(
        (sum, cat) => sum + (cat.items || []).reduce((s, it) => s + (it.totalPrice || 0), 0), 0
      );
      const totalChanges = (changes || []).reduce((s, ch) => s + (ch.amount || 0), 0);
      const additional = (additionalCosts || []).reduce((s, ad) => s + (ad.amount || 0), 0);
      const actualCost = materialCost + additional;
      const settlement = {
        id: genId('STL'),
        contractId: c.id,
        contractPrice: c.totalPrice,
        materialCost,
        changes: changes || [],
        additionalCosts: additionalCosts || [],
        refund: refund || 0,
        actualCost,
        profit: c.totalPrice - actualCost - (refund || 0),
        profitMargin: c.totalPrice ? ((c.totalPrice - actualCost) / c.totalPrice * 100).toFixed(2) + '%' : '0%',
        payerNote: payerNote || '',
        status: 'pending',
        createdAt: now()
      };
      db.settlements.push(settlement);
      res.json({ success: true, data: settlement });
    } catch (e) { return errorResponse(res, e); }
  });

  router.get('/api/settlement/:contractId', (req, res) => {
    const records = db.settlements.filter(s => s.contractId === req.params.contractId);
    res.json({ success: true, data: records });
  });

  // ====================================================================
  // 象限 4 · CRM 客户经营（迁移自 server-integrated.js）
  // ====================================================================

  router.get('/api/crm/customers', (req, res) => {
    res.json({ success: true, data: db.customers || [] });
  });

  router.get('/api/crm/customers/:id/360', (req, res) => {
    try {
      const customer = (db.customers || []).find(c => c.id === req.params.id || c.phone === req.params.id);
      if (!customer) return res.status(404).json({ success: false, error: '客户不存在' });
      const quotes = (db.quotes || []).filter(q => q.customerId === customer.id);
      const contracts = (db.contracts || []).filter(c => c.customerId === customer.id || c.customerPhone === customer.phone);
      const interactions = db.crm.interactions.filter(i => i.customerId === customer.id);
      const opportunities = db.crm.opportunities.filter(o => o.customerId === customer.id);
      res.json({
        success: true,
        data: {
          profile: customer,
          quotes, contracts, interactions, opportunities,
          totalRevenue: contracts.reduce((s, c) => s + (c.totalPrice || 0), 0),
          quoteCount: quotes.length,
          contractCount: contracts.length,
          interactionCount: interactions.length,
          stage: opportunities.length ? opportunities[opportunities.length - 1].stage : 'lead'
        }
      });
    } catch (e) { return errorResponse(res, e); }
  });

  router.post('/api/crm/customers/:id/interactions', (req, res) => {
    try {
      const interaction = {
        id: genId('INT'),
        customerId: req.params.id,
        type: req.body.type || 'call', // call | meeting | wechat | email | onsite
        content: req.body.content || '',
        operator: req.body.operator || 'unknown',
        nextAction: req.body.nextAction || null,
        createdAt: now()
      };
      db.crm.interactions.push(interaction);
      res.json({ success: true, data: interaction });
    } catch (e) { return errorResponse(res, e); }
  });

  router.get('/api/crm/funnel', (req, res) => {
    const stages = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
    const funnel = stages.map(stage => ({
      stage,
      count: db.crm.opportunities.filter(o => o.stage === stage).length,
      value: db.crm.opportunities.filter(o => o.stage === stage).reduce((s, o) => s + (o.estimatedValue || 0), 0)
    }));
    const total = funnel[0].count || 1;
    funnel.forEach(f => { f.conversionFromLead = ((f.count / total) * 100).toFixed(1) + '%'; });
    res.json({ success: true, data: funnel });
  });

  // P0 补漏：商机列表查询（支持 stage / customerId / minAmount 过滤）
  router.get('/api/crm/opportunities', (req, res) => {
    try {
      const { stage, customerId, minAmount } = req.query || {};
      let list = (db.crm.opportunities || []).slice();
      if (stage) list = list.filter(o => o.stage === stage);
      if (customerId) list = list.filter(o => o.customerId === customerId);
      if (minAmount) list = list.filter(o => (o.estimatedValue || 0) >= Number(minAmount));
      // 商机与客户信息联表
      const enriched = list.map(o => {
        const customer = db.customers.find(c => c.id === o.customerId);
        return { ...o, customerName: customer ? customer.name : null, customerPhone: customer ? customer.phone : null };
      });
      res.json({ success: true, data: enriched, total: enriched.length });
    } catch (e) { return errorResponse(res, e); }
  });

  router.post('/api/crm/opportunities', (req, res) => {
    try {
      const opp = {
        id: genId('OPP'),
        customerId: req.body.customerId,
        title: req.body.title || '新商机',
        estimatedValue: req.body.estimatedValue || 0,
        stage: req.body.stage || 'lead',
        ownerId: req.body.ownerId || null,
        expectedCloseDate: req.body.expectedCloseDate || null,
        createdAt: now()
      };
      db.crm.opportunities.push(opp);
      res.json({ success: true, data: opp });
    } catch (e) { return errorResponse(res, e); }
  });

  router.put('/api/crm/opportunities/:id/stage', (req, res) => {
    try {
      const opp = db.crm.opportunities.find(o => o.id === req.params.id);
      if (!opp) return res.status(404).json({ success: false, error: '商机不存在' });
      opp.stage = req.body.stage;
      opp.stageUpdatedAt = now();
      res.json({ success: true, data: opp });
    } catch (e) { return errorResponse(res, e); }
  });

  router.get('/api/crm/campaigns', (req, res) => {
    res.json({ success: true, data: db.crm.campaigns || [] });
  });

  router.post('/api/crm/campaigns', (req, res) => {
    try {
      const camp = {
        id: genId('CAM'),
        name: req.body.name || '新活动',
        type: req.body.type || 'discount',
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        targetAudience: req.body.targetAudience || 'all',
        rules: req.body.rules || {},
        createdAt: now()
      };
      db.crm.campaigns.push(camp);
      res.json({ success: true, data: camp });
    } catch (e) { return errorResponse(res, e); }
  });

  router.post('/api/crm/coupons/validate', (req, res) => {
    try {
      const { code, orderValue } = req.body || {};
      const coupon = db.crm.coupons.find(c => c.code === code);
      if (!coupon) return res.json({ success: false, error: '优惠券不存在' });
      if (new Date(coupon.expiresAt) < new Date()) return res.json({ success: false, error: '优惠券已过期' });
      if (orderValue < (coupon.minOrderValue || 0)) {
        return res.json({ success: false, error: `订单需满 ¥${coupon.minOrderValue}` });
      }
      const discount = coupon.type === 'percent'
        ? Math.round(orderValue * coupon.value / 100)
        : coupon.value;
      res.json({ success: true, data: { discount, finalPrice: orderValue - discount, coupon } });
    } catch (e) { return errorResponse(res, e); }
  });

  // ====================================================================
  // 象限 4 · 产品上下架管理
  // ====================================================================

  router.get('/api/products', (req, res) => {
    const { system, scenario, brand } = req.query || {};
    let list = (db.products || []).slice();
    if (system) list = list.filter(p => p.system === system);
    if (scenario) list = list.filter(p => p.scenario === scenario);
    if (brand) list = list.filter(p => p.brand === brand);
    res.json({ success: true, data: list, total: list.length });
  });

  router.post('/api/products', (req, res) => {
    try {
      const p = {
        id: genId('PROD'),
        model: req.body.model,
        specs: req.body.specs,
        scenario: req.body.scenario || '通用',
        system: req.body.system || '其他',
        brand: req.body.brand || 'rheem',
        price: req.body.price || 0,
        image: req.body.image || '/images/products/default.png',
        status: 'active', // active | offshelf
        updatedAt: now()
      };
      db.products.push(p);
      res.json({ success: true, data: p });
    } catch (e) { return errorResponse(res, e); }
  });

  router.put('/api/products/:id', (req, res) => {
    try {
      const p = db.products.find(p => p.id === req.params.id);
      if (!p) return res.status(404).json({ success: false, error: '产品不存在' });
      Object.assign(p, req.body, { updatedAt: now() });
      res.json({ success: true, data: p });
    } catch (e) { return errorResponse(res, e); }
  });

  router.put('/api/products/:id/shelf', (req, res) => {
    try {
      const p = db.products.find(p => p.id === req.params.id);
      if (!p) return res.status(404).json({ success: false, error: '产品不存在' });
      p.status = req.body.action === 'on' ? 'active' : 'offshelf';
      p.updatedAt = now();
      res.json({ success: true, data: p });
    } catch (e) { return errorResponse(res, e); }
  });

  // ====================================================================
  // 象限 4 · 促销 / 价格管理
  // ====================================================================

  router.get('/api/promotion', (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const list = (db.promotions || []).map(p => ({
      ...p,
      isActive: p.startDate <= today && p.endDate >= today
    }));
    res.json({ success: true, data: list });
  });

  router.post('/api/promotion', (req, res) => {
    try {
      const p = {
        id: genId('OFFER'),
        name: req.body.name,
        discount: req.body.discount || 0.95,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        applicableSystems: req.body.applicableSystems || [],
        createdAt: now()
      };
      db.promotions.push(p);
      // 同步到 db.pricing.specialOffers
      if (db.pricing && Array.isArray(db.pricing.specialOffers)) db.pricing.specialOffers.push(p);
      res.json({ success: true, data: p });
    } catch (e) { return errorResponse(res, e); }
  });

  router.delete('/api/promotion/:id', (req, res) => {
    db.promotions = db.promotions.filter(p => p.id !== req.params.id);
    if (db.pricing && Array.isArray(db.pricing.specialOffers)) {
      db.pricing.specialOffers = db.pricing.specialOffers.filter(p => p.id !== req.params.id);
    }
    res.json({ success: true });
  });

  router.get('/api/pricing', (req, res) => {
    res.json({ success: true, data: db.pricing || {} });
  });

  router.put('/api/pricing', (req, res) => {
    try {
      const { baseDiscount, categoryDiscounts } = req.body || {};
      if (typeof baseDiscount === 'number') db.pricing.baseDiscount = baseDiscount;
      if (categoryDiscounts && typeof categoryDiscounts === 'object') {
        Object.assign(db.pricing.categoryDiscounts, categoryDiscounts);
      }
      db.pricing.lastUpdated = now();
      res.json({ success: true, data: db.pricing });
    } catch (e) { return errorResponse(res, e); }
  });

  // ====================================================================
  // 象限 2 · 设计师端 报价+促销 一键聚合 API
  // ====================================================================

  router.post('/api/quote/with-promotion', (req, res) => {
    try {
      const { customerId, area, systems, painPoints } = req.body || {};
      const baseUnitPrice = 800;
      const subtotal = (area || 100) * baseUnitPrice * ((systems && systems.length) || 1);

      // 应用基础折扣
      const baseDiscount = (db.pricing && db.pricing.baseDiscount) || 1;
      let afterBase = subtotal * baseDiscount;

      // 应用品类折扣（取最低）
      const catDiscounts = db.pricing && db.pricing.categoryDiscounts ? db.pricing.categoryDiscounts : {};
      const minCatDiscount = Math.min(...(systems || []).map(s => catDiscounts[s] || 1), 1);
      let afterCat = afterBase * minCatDiscount;

      // 应用当前生效的促销活动
      const today = new Date().toISOString().slice(0, 10);
      const activeOffers = (db.promotions || []).filter(p =>
        p.startDate <= today && p.endDate >= today &&
        (!p.applicableSystems || p.applicableSystems.length === 0 ||
         (systems || []).some(s => p.applicableSystems.includes(s)))
      );
      const promoDiscount = activeOffers.length ? Math.min(...activeOffers.map(p => p.discount || 1)) : 1;
      const final = afterCat * promoDiscount;

      const breakdown = {
        subtotal: Math.round(subtotal),
        baseDiscount: { rate: baseDiscount, after: Math.round(afterBase) },
        categoryDiscount: { rate: minCatDiscount, after: Math.round(afterCat) },
        activePromotions: activeOffers.map(p => ({ id: p.id, name: p.name, discount: p.discount })),
        promotionDiscount: { rate: promoDiscount, after: Math.round(final) },
        finalPrice: Math.round(final),
        savedAmount: Math.round(subtotal - final),
        savedPercent: subtotal ? ((subtotal - final) / subtotal * 100).toFixed(1) + '%' : '0%'
      };

      const quote = {
        id: genId('Q'),
        customerId: customerId || null,
        area, systems, painPoints,
        breakdown,
        items: [
          { name: '设备费', amount: Math.round(final * 0.6) },
          { name: '材料费', amount: Math.round(final * 0.2) },
          { name: '施工费', amount: Math.round(final * 0.2) }
        ],
        createdAt: now(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };
      db.quotes.push(quote);
      res.json({ success: true, data: quote });
    } catch (e) { return errorResponse(res, e); }
  });

  // P0 补漏：报价列表查询（设计师/销售查看自己创建过的报价）
  router.get('/api/quotes', (req, res) => {
    try {
      const { customerId, status, designerId } = req.query || {};
      let list = (db.quotes || []).slice();
      if (customerId) list = list.filter(q => q.customerId === customerId);
      if (status) list = list.filter(q => q.status === status);
      if (designerId) list = list.filter(q => String(q.designerId) === String(designerId));
      res.json({ success: true, data: list, total: list.length });
    } catch (e) { return errorResponse(res, e); }
  });

  router.get('/api/quotes/:id', (req, res) => {
    const q = (db.quotes || []).find(q => q.id === req.params.id || q.quoteNumber === req.params.id);
    if (!q) return res.status(404).json({ success: false, error: '报价不存在' });
    res.json({ success: true, data: q });
  });

  // ====================================================================
  // 象限 4 · 运维管理（迁移自 server-integrated.js）
  // ====================================================================

  router.get('/api/operation/devices', (req, res) => {
    res.json({ success: true, data: db.operation.devices });
  });

  router.post('/api/operation/devices', (req, res) => {
    try {
      const d = {
        id: genId('DEV'),
        projectId: req.body.projectId,
        deviceType: req.body.deviceType,
        model: req.body.model,
        installedAt: req.body.installedAt || now(),
        status: 'normal',
        runningHours: 0,
        lastMaintenance: null
      };
      db.operation.devices.push(d);
      res.json({ success: true, data: d });
    } catch (e) { return errorResponse(res, e); }
  });

  router.get('/api/operation/projects/:id/dashboard', (req, res) => {
    const devices = db.operation.devices.filter(d => d.projectId === req.params.id);
    const readings = db.operation.readings.filter(r => r.projectId === req.params.id).slice(-100);
    res.json({
      success: true,
      data: {
        deviceCount: devices.length,
        normalCount: devices.filter(d => d.status === 'normal').length,
        warningCount: devices.filter(d => d.status === 'warning').length,
        faultCount: devices.filter(d => d.status === 'fault').length,
        recentReadings: readings,
        avgRuntime: devices.length ? devices.reduce((s, d) => s + (d.runningHours || 0), 0) / devices.length : 0
      }
    });
  });

  router.post('/api/operation/projects/:id/predictions', (req, res) => {
    try {
      const devices = db.operation.devices.filter(d => d.projectId === req.params.id);
      if (devices.length === 0) {
        return res.json({ success: true, data: { predictions: [], summary: { total: 0, byRisk: {}, recommendedAction: '项目未注册设备' } } });
      }

      // 优先使用专业引擎，降级走内联简化版
      const readings = (db.operation.readings || []).filter(r => r.projectId === req.params.id);
      let predictions, summary;
      const pmEngine = predictiveMaintenanceEngine.get();
      if (pmEngine) {
        predictions = pmEngine.predict(devices, readings);
        summary = pmEngine.summarize(predictions);
      } else {
        predictions = devices.map(d => {
          const runHours = d.runningHours || 0;
          const daysSinceMaintenance = d.lastMaintenance
            ? Math.floor((Date.now() - new Date(d.lastMaintenance).getTime()) / 86400000)
            : 999;
          let riskLevel = 'low', recommendation = '继续监控';
          if (runHours > 5000 || daysSinceMaintenance > 365) { riskLevel = 'high'; recommendation = '建议立即保养'; }
          else if (runHours > 3000 || daysSinceMaintenance > 180) { riskLevel = 'medium'; recommendation = '建议 30 天内保养'; }
          return { deviceId: d.id, model: d.model, riskLevel, runHours, daysSinceMaintenance, recommendation };
        });
        summary = { total: predictions.length, byRisk: {}, recommendedAction: 'engine fallback' };
      }
      db.operation.predictions[req.params.id] = { predictions, summary, generatedAt: now() };
      res.json({ success: true, data: { predictions, summary } });
    } catch (e) { return errorResponse(res, e); }
  });

  // 专业引擎 - 获取历史预测结果
  router.get('/api/operation/projects/:id/predictions', (req, res) => {
    const cached = db.operation.predictions[req.params.id];
    if (!cached) return res.status(404).json({ success: false, error: '暂无预测记录，请先 POST 生成' });
    res.json({ success: true, data: cached });
  });

  // 专业引擎 - 单设备 RUL 查询
  router.get('/api/operation/devices/:deviceId/rul', (req, res) => {
    try {
      const d = db.operation.devices.find(x => x.id === req.params.deviceId);
      if (!d) return res.status(404).json({ success: false, error: '设备不存在' });
      const pmEngine = predictiveMaintenanceEngine.get();
      if (!pmEngine) return res.status(503).json({ success: false, error: '预测引擎未加载' });
      const readings = (db.operation.readings || []).filter(r => r.deviceId === d.id);
      const result = pmEngine.predictOne(d, readings);
      res.json({ success: true, data: result });
    } catch (e) { return errorResponse(res, e); }
  });

  router.get('/api/operation/projects/:id/energy', (req, res) => {
    const days = parseInt(req.query.days) || 30;
    // 简化能耗数据（生产环境从 IoT 数据聚合）
    const dailyData = Array.from({ length: days }, (_, i) => ({
      date: new Date(Date.now() - (days - i - 1) * 86400000).toISOString().slice(0, 10),
      kwh: Math.round(15 + Math.random() * 10),
      cost: Math.round((15 + Math.random() * 10) * 0.6)
    }));
    res.json({
      success: true,
      data: {
        days,
        totalKwh: dailyData.reduce((s, d) => s + d.kwh, 0),
        totalCost: dailyData.reduce((s, d) => s + d.cost, 0),
        avgDailyKwh: (dailyData.reduce((s, d) => s + d.kwh, 0) / days).toFixed(1),
        dailyData
      }
    });
  });

  // ====================================================================
  // 象限 4 · 经营分析 Dashboard
  // ====================================================================

  router.get('/api/dashboard/stats', (req, res) => {
    try {
      const totalCustomers = (db.customers || []).length;
      const totalQuotes = (db.quotes || []).length;
      const totalContracts = (db.contracts || []).length;
      const totalRevenue = (db.contracts || []).reduce((s, c) => s + (c.totalPrice || 0), 0);
      const wonOpps = db.crm.opportunities.filter(o => o.stage === 'won');
      const lostOpps = db.crm.opportunities.filter(o => o.stage === 'lost');
      const completedContracts = (db.contracts || []).filter(c => c.status === 'completed');
      const inProgressContracts = (db.contracts || []).filter(c => c.status === 'in_progress');

      res.json({
        success: true,
        data: {
          customers: { total: totalCustomers },
          quotes: { total: totalQuotes, conversionRate: totalCustomers ? (totalQuotes / totalCustomers * 100).toFixed(1) + '%' : '0%' },
          contracts: { total: totalContracts, completed: completedContracts.length, inProgress: inProgressContracts.length },
          revenue: {
            total: totalRevenue,
            avgOrderValue: totalContracts ? Math.round(totalRevenue / totalContracts) : 0,
            wonValue: wonOpps.reduce((s, o) => s + (o.estimatedValue || 0), 0),
            lostValue: lostOpps.reduce((s, o) => s + (o.estimatedValue || 0), 0)
          },
          funnel: {
            leads: db.crm.opportunities.filter(o => o.stage === 'lead').length,
            qualified: db.crm.opportunities.filter(o => o.stage === 'qualified').length,
            proposal: db.crm.opportunities.filter(o => o.stage === 'proposal').length,
            won: wonOpps.length,
            winRate: db.crm.opportunities.length ? (wonOpps.length / db.crm.opportunities.length * 100).toFixed(1) + '%' : '0%'
          },
          products: {
            total: (db.products || []).length,
            active: (db.products || []).filter(p => p.status !== 'offshelf').length
          },
          generatedAt: now()
        }
      });
    } catch (e) { return errorResponse(res, e); }
  });

  router.get('/api/dashboard/sales-trend', (req, res) => {
    const months = 12;
    const trend = Array.from({ length: months }, (_, i) => {
      const monthDate = new Date();
      monthDate.setMonth(monthDate.getMonth() - (months - i - 1));
      const monthKey = monthDate.toISOString().slice(0, 7);
      const monthContracts = (db.contracts || []).filter(c => (c.signedAt || '').startsWith(monthKey));
      return {
        month: monthKey,
        revenue: monthContracts.reduce((s, c) => s + (c.totalPrice || 0), 0),
        contractCount: monthContracts.length
      };
    });
    res.json({ success: true, data: trend });
  });

  // ====================================================================
  // 象限 3 · Rysnova legacy 4 件套入口（已退役）
  // ====================================================================

  router.post('/api/rysnova-bim/generate-deliverables', (req, res) => {
    const { contractId } = req.body || {};
    return res.status(410).json({
      success: false,
      error: 'Rysnova legacy deliverable generator retired. Use the tenant-scoped v2 artifact contract.',
      code: 'RYSNOVA_LEGACY_DELIVERABLES_RETIRED',
      migration: {
        method: 'POST',
        path: '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts',
        projectIdHint: contractId || 'CNT-20260401-001',
        requiredEvidence: [
          'tenant bearer token',
          'audit log',
          'object storage evidence',
          'quoteCostSummary',
          'quantityTakeoffSummary',
          'standardsSummary',
          'customerReportSummary'
        ]
      }
    });
  });

  router.get('/rysnova-bim-deliverables/:contractId/:fileName', (req, res) => {
    return res.status(410).json({
      success: false,
      error: 'Rysnova legacy deliverable download retired. Use the v2 customer package or artifact objectKey with storage evidence.',
      code: 'RYSNOVA_LEGACY_DOWNLOAD_RETIRED',
      migration: {
        contractId: req.params.contractId,
        legacyFileName: req.params.fileName,
        customerPackage: '/api/v2/rysnova-bim/projects/{projectId}/customer-package',
        deliverableArtifacts: '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts',
        requiredEvidence: [
          'tenant bearer token',
          'customer-visible approved/shared artifact',
          'object storage evidence',
          'integrity passed',
          'no internal fields leaked'
        ]
      }
    });
  });

  // ====================================================================
  // 象限 1+2 · AI 服务（LLM + 户型图识别）
  // ====================================================================

  router.get('/api/ai/health', async (req, res) => {
    const llmEngine = llmServiceEngine.get();
    const fprEngine = floorPlanRecognitionEngine.get();
    if (!llmEngine) return res.status(503).json({ success: false, error: 'LLM 引擎未加载' });
    const llm = await llmEngine.health();
    res.json({ success: true, data: { llm, floorPlanRecognition: !!fprEngine } });
  });

  router.post('/api/ai/chat', async (req, res) => {
    const llmEngine = llmServiceEngine.get();
    if (!llmEngine) return res.status(503).json({ success: false, error: 'LLM 引擎未加载' });
    try {
      const { prompt, role, history } = req.body || {};
      if (!prompt) return res.status(400).json({ success: false, error: 'prompt 必填' });
      const reply = await llmEngine.chat({ prompt, role, history });
      res.json({ success: true, data: { reply, mode: llmEngine.mode } });
    } catch (e) { return errorResponse(res, e); }
  });

  router.post('/api/ai/diagnose', async (req, res) => {
    const llmEngine = llmServiceEngine.get();
    if (!llmEngine) return res.status(503).json({ success: false, error: 'LLM 引擎未加载' });
    try {
      const { symptoms = [], profile = {} } = req.body || {};
      const result = await llmEngine.diagnosePainPoint({ symptoms, profile });
      res.json({ success: true, data: result });
    } catch (e) { return errorResponse(res, e); }
  });

  router.post('/api/ai/explain', async (req, res) => {
    const llmEngine = llmServiceEngine.get();
    if (!llmEngine) return res.status(503).json({ success: false, error: 'LLM 引擎未加载' });
    try {
      const { system, customer = {} } = req.body || {};
      const text = await llmEngine.explainSolution({ system, customer });
      res.json({ success: true, data: { text, mode: llmEngine.mode } });
    } catch (e) { return errorResponse(res, e); }
  });

  router.post('/api/ai/quote-summary', async (req, res) => {
    const llmEngine = llmServiceEngine.get();
    if (!llmEngine) return res.status(503).json({ success: false, error: 'LLM 引擎未加载' });
    try {
      const { items = [], total = 0, savings = 0 } = req.body || {};
      const text = await llmEngine.generateQuoteSummary({ items, total, savings });
      res.json({ success: true, data: { text, mode: llmEngine.mode } });
    } catch (e) { return errorResponse(res, e); }
  });

  // P0 修复 2026-04-27：删除重复的 /api/floorplan/recognize
  // server-production.js:2315 已定义（带 authenticateToken 鉴权）为唯一权威版本

  // ====================================================================
  // 健康检查 / 域内自检
  // ====================================================================

  router.get('/api/business-domain/health', (req, res) => {
    res.json({
      success: true,
      data: {
        module: 'business-domain',
        version: '1.0.0',
        domains: ['contracts (gantt/phase/report)', 'material', 'acceptance', 'settlement', 'crm (customers/360/funnel/opp/campaigns/opportunities-list)', 'products (CRUD/shelf)', 'promotion', 'pricing', 'operation (devices/dashboard/predictions+RUL/energy)', 'dashboard (stats/sales-trend)', 'rysnova-bim-legacy-retired-boundary', 'quote-with-promotion', 'quotes-list', 'ai (chat/diagnose/explain/quote-summary)'],
        endpoints: 36,
        engines: {
          predictiveMaintenance: predictiveMaintenanceEngine.available,
          promotion: promotionEngineAvailability,
          quotation: quotationEngineAvailability,
          analytics: analyticsEngineAvailability,
          llm: llmServiceEngine.available,
          floorPlanRecognition: floorPlanRecognitionEngine.available
        },
        llmMode: llmServiceEngine.available ? (llmServiceEngine.get()?.mode || 'available') : 'unavailable',
        timestamp: now()
      }
    });
  });

  return router;
};
