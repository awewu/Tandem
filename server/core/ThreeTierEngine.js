/**
 * ThreeTierEngine - 统一三档方案引擎
 * ─────────────────────────────────────────────────────────────
 * 单一真相源：所有入口（AI问诊 / 销售工作台 / 模板库 / 设计师）
 * 都应通过本引擎产出三档方案，保证同户型同痛点输出一致。
 *
 * 架构策略：
 *   - 复用 AIConsultantEngine 作为核心推荐逻辑（已含Rheem/Ruud具体型号+定价+ROI）
 *   - 叠加 PackagePricing（按㎡套餐定价，对接 P2 套餐购买流程）
 *   - 输出稳定的 ThreeTierResult 契约（见 docs/THREE-TIER-CONTRACT.md）
 *
 * @version 1.0.0
 * @since   2026-04-24
 */

const AIConsultantEngine = require('./AIConsultantEngine');

class ThreeTierEngine {
  constructor(options = {}) {
    this.version = '1.0.0';
    this.name = 'ThreeTierEngine';

    // 核心推荐引擎（复用已有能力）
    this.consultant = options.consultant || new AIConsultantEngine();

    // 套餐按㎡定价矩阵（对标土巴兔等套餐模式）
    // 注：此处单价代表"标准套餐一口价"，含产品+系统+常规材料+基础施工+管理费
    this.PACKAGE_PRICING = options.packagePricing || {
      basic:   { perSqm: 899,  name: '基础套餐', tag: '经济实用' },
      comfort: { perSqm: 1299, name: '舒适套餐', tag: '品质之选', recommended: true },
      premium: { perSqm: 1899, name: '旗舰套餐', tag: '尊享定制' }
    };

    // 城市系数（套餐价可按城市浮动；默认全国统一，如需启用见 applyCityFactor）
    this.CITY_FACTORS = options.cityFactors || {
      tier1: { factor: 1.10, cities: ['北京', '上海', '广州', '深圳'] },
      tier2: { factor: 1.05, cities: ['杭州', '南京', '成都', '武汉', '西安', '重庆', '苏州', '天津'] },
      tier3: { factor: 1.00, cities: [] } // 其他
    };
  }

  /**
   * 统一入口：生成三档方案
   * @param {Object} params - 见 docs/THREE-TIER-CONTRACT.md §2.1 input
   * @returns {Object} ThreeTierResult
   */
  generate(params = {}) {
    // 1. 参数校验与补齐
    const normalized = this._normalizeInput(params);

    // 2. 调用 AIConsultantEngine 产出核心三档
    const consultation = this.consultant.generateConsultation(normalized);

    // 3. 计算套餐按㎡定价（P2 套餐购买的核心输入）
    const packagePricing = this._calculatePackagePricing(normalized.area, normalized.city);

    // 4. 组装标准化输出
    return {
      version: this.version,
      generatedAt: new Date().toISOString(),
      input: normalized,
      analysis: consultation.analysis,
      tiers: {
        basic:   this._normalizeTier(consultation.solutions.basic, 'basic'),
        comfort: this._normalizeTier(consultation.solutions.comfort, 'comfort'),
        premium: this._normalizeTier(consultation.solutions.premium, 'premium')
      },
      comparison: consultation.comparison,
      recommendation: consultation.recommendation,
      packagePricing,
      consultationSummary: consultation.consultationSummary
    };
  }

  /**
   * 简化入口：仅需面积，返回套餐价预估（用于销售快速报价场景）
   * @param {Object} params - { area, city? }
   */
  quickQuote({ area, city = '上海' } = {}) {
    if (!area || area <= 0) {
      throw new Error('面积必填且必须>0');
    }
    return {
      version: this.version,
      generatedAt: new Date().toISOString(),
      area,
      city,
      packagePricing: this._calculatePackagePricing(area, city)
    };
  }

  // ─────────────────────── 内部方法 ───────────────────────

  /**
   * 参数规范化：补默认值 + 类型转换
   */
  _normalizeInput(params) {
    const area = parseFloat(params.area);
    if (!area || area <= 0) {
      throw new Error('ThreeTierEngine.generate: area 必填且必须>0');
    }
    return {
      area,
      houseType: params.houseType || this._inferHouseType(area),
      city: params.city || '上海',
      budget: params.budget || this._inferBudget(area),
      painPoints: Array.isArray(params.painPoints) ? params.painPoints : [],
      priorities: Array.isArray(params.priorities) ? params.priorities : ['舒适', '性价比'],
      residents: params.residents || 3,
      hasElderly: !!params.hasElderly,
      hasChildren: !!params.hasChildren,
      hasPet: !!params.hasPet
    };
  }

  /**
   * 根据面积推断户型
   */
  _inferHouseType(area) {
    if (area < 60) return '一居';
    if (area < 90) return '二居';
    if (area < 130) return '三居';
    if (area < 200) return '四居+';
    return '别墅';
  }

  /**
   * 根据面积推断预算等级（客户未填时的默认）
   */
  _inferBudget(area) {
    if (area < 80) return '经济型';
    if (area < 120) return '标准型';
    if (area < 200) return '舒适型';
    return '豪华型';
  }

  /**
   * 规范化单档方案输出（确保契约字段齐全）
   */
  _normalizeTier(solution, tierKey) {
    if (!solution) {
      // 防御：若 AIConsultantEngine 因痛点/面积极端未返回此档，返回占位
      return {
        tier: tierKey,
        name: this.PACKAGE_PRICING[tierKey]?.name || tierKey,
        systems: [],
        totalPrice: 0,
        valueProposition: [],
        roi: { energySavingsPercent: 0, annualSaveEstimate: 0, comfortScore: 0, paybackYears: 'N/A' },
        recommended: tierKey === 'comfort',
        unavailable: true
      };
    }
    return {
      tier: tierKey,
      name: solution.name,
      tag: solution.tag,
      icon: solution.icon,
      description: solution.description,
      targetUser: solution.targetUser,
      systems: solution.systems || [],
      totalPrice: Math.round(solution.totalPrice || 0),
      budgetFit: solution.budgetFit,
      valueProposition: solution.valueProposition || [],
      roi: solution.roi || {},
      recommended: !!solution.recommended || tierKey === 'comfort'
    };
  }

  /**
   * 计算按㎡套餐定价（P2 套餐购买的输入）
   */
  _calculatePackagePricing(area, city) {
    const cityFactor = this._getCityFactor(city);
    const result = {};
    for (const [tier, config] of Object.entries(this.PACKAGE_PRICING)) {
      const perSqm = Math.round(config.perSqm * cityFactor);
      result[tier] = {
        name: config.name,
        tag: config.tag,
        perSqm,
        area,
        subtotal: Math.round(perSqm * area),
        cityFactor,
        recommended: !!config.recommended
      };
    }
    return result;
  }

  /**
   * 获取城市系数
   */
  _getCityFactor(city) {
    for (const tier of Object.values(this.CITY_FACTORS)) {
      if (tier.cities && tier.cities.includes(city)) return tier.factor;
    }
    return this.CITY_FACTORS.tier3.factor;
  }
}

module.exports = ThreeTierEngine;
