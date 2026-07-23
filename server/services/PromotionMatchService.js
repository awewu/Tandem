/**
 * PromotionMatchService - 智能促销匹配服务
 *
 * 定位：销售报价体系 ↔ 促销引擎之间的"智能中台"
 * 职责：
 *   1. 根据订单上下文（客户画像/方案/痛点/时间/地域）筛选 eligible 促销
 *   2. 组合求解 —— 贪心+互斥约束，找出"为客户节省最多"且"不破毛利红线"的组合
 *   3. 话术生成 —— 把枯燥折扣包装成情绪化故事
 *   4. 场景触发 —— 痛点/户型/时间 driven 的定向推荐
 */

class PromotionMatchService {
  /**
   * @param {PromotionEngine} promotionEngine - 既有促销引擎实例
   */
  constructor(promotionEngine) {
    this.engine = promotionEngine;

    // 促销类别互斥组：同组内最多选 1 个（价格档位不能叠加）
    this.exclusiveGroups = [
      ['full_reduction', 'gradient_discount', 'limited_time', 'holiday', 'package_deal'],
      ['silver_member', 'gold_member', 'diamond_member', 'birthday_privilege'],
      ['combo', 'combo_water', 'seasonal', 'seasonal_winter', 'clearance', 'hot_product', 'new_product']
    ];

    // 毛利保护：总折扣率不超过订单金额的 25%
    this.maxDiscountRate = 0.25;

    // 场景触发规则 —— 痛点关键词 / 户型 → 推荐的促销ID
    this.scenarioTriggers = [
      { when: ctx => ctx.painPoints?.some(p => /潮|湿|霉|地下室/.test(p)), recommend: 'combo_water', reason: '针对您的潮湿困扰，水系统套餐最对症' },
      { when: ctx => ctx.painPoints?.some(p => /噪|吵|静音/.test(p)), recommend: 'new_product', reason: '静音新品正是您需要的' },
      { when: ctx => ctx.houseType && /别墅|独栋|大平层/.test(ctx.houseType), recommend: 'package_deal', reason: '大户型首选套餐方案，最划算' },
      { when: ctx => ctx.hasElderly || ctx.hasInfant, recommend: 'buy_gift', reason: '家有老人小孩，赠品礼包贴心守护' },
      { when: ctx => ctx.season === 'summer', recommend: 'seasonal', reason: '夏季旺季限定优惠' },
      { when: ctx => ctx.season === 'winter', recommend: 'seasonal_winter', reason: '冬季暖心特价' }
    ];
  }

  /**
   * 核心方法：智能匹配最优促销组合
   * @param {Object} payload - { order, customer, context }
   * @returns {Object} { bestCombo, allCombos, triggers, story }
   */
  match(payload = {}) {
    const order = payload.order || {};
    const customer = payload.customer || {};
    const context = { ...payload.context, painPoints: order.painPoints, houseType: order.houseType };

    // 推断季节
    if (!context.season) {
      const m = new Date().getMonth() + 1;
      context.season = m >= 6 && m <= 8 ? 'summer' : (m === 12 || m <= 2 ? 'winter' : 'normal');
    }

    // 1. 收集所有 eligible 促销候选（每条带预计折扣值）
    const candidates = this._collectCandidates(order, customer, context);

    // 2. 场景触发 —— 标注"推荐理由"
    const triggers = this._runScenarioTriggers(context);
    candidates.forEach(c => {
      const t = triggers.find(tr => tr.id === c.id);
      if (t) { c.triggered = true; c.triggerReason = t.reason; }
    });

    // 3. 组合求解 —— 生成 Top 3 可行组合
    const combos = this._solveCombos(candidates, order.totalPrice || 0);

    // 4. 包装话术
    const bestCombo = combos[0] || null;
    const story = bestCombo ? this._buildStory(bestCombo, order) : null;

    return {
      success: true,
      bestCombo,
      allCombos: combos,
      triggers,
      story,
      context
    };
  }

  // ---- 内部实现 ----

  _collectCandidates(order, customer, context) {
    const list = [];
    const total = order.totalPrice || 0;
    const products = (order.products || order.systems || []).map(p => p.name || p);

    // --- 价格促销 ---
    if (!customer.hasOrdered) {
      list.push({ id: 'first_order', group: 'welcome', name: '🎁 首单红包', discount: 500, type: 'fixed', desc: '新客户首单立减500' });
    }
    if (total >= 50000) {
      list.push({ id: 'full_reduction', group: 0, name: '💰 满5万减5000', discount: 5000, type: 'fixed', desc: '满减优惠' });
    }
    if (total >= 20000) {
      const rate = total >= 50000 ? 0.1 : 0.05;
      list.push({ id: 'gradient_discount', group: 0, name: `📉 梯度折扣${total >= 50000 ? '9折' : '95折'}`, discount: Math.round(total * rate), type: 'rate', desc: '梯度折扣' });
    }
    if (total >= 30000) {
      list.push({ id: 'buy_gift', group: 'gift', name: '🎀 满3万送净水滤芯', discount: 500, type: 'gift', desc: '买赠礼包', gift: '净水器滤芯' });
    }
    if ((order.systemCount || products.length) >= 6) {
      list.push({ id: 'package_deal', group: 0, name: '📦 六系统套餐', discount: 10000, type: 'fixed', desc: '套餐整体让利1万' });
    }

    // 限时/节日
    const now = new Date();
    const limited = this.engine?.promotionRules?.pricePromotions?.find(p => p.id === 'limited_time');
    if (limited && now >= new Date(limited.startDate) && now <= new Date(limited.endDate)) {
      list.push({ id: 'limited_time', group: 0, name: '⏰ 限时9折', discount: Math.round(total * (1 - limited.discount)), type: 'rate', desc: limited.description });
    }

    // --- 会员促销 ---
    if (customer.memberLevel) {
      const rule = this.engine?.promotionRules?.memberPromotions?.find(r => r.level === customer.memberLevel);
      if (rule) {
        list.push({ id: rule.id, group: 1, name: `👑 ${customer.memberLevel.toUpperCase()}会员${Math.round(rule.discount * 100)}折`, discount: Math.round(total * (1 - rule.discount)), type: 'rate', desc: rule.description });
      }
    }
    if (customer.isBirthday) {
      list.push({ id: 'birthday_privilege', group: 1, name: '🎂 生日9折特权', discount: Math.round(total * 0.1), type: 'rate', desc: '生日当天专属9折' });
    }

    // --- 产品促销 ---
    if (products.some(p => /中央空调|空调/.test(p)) && products.some(p => /新风/.test(p))) {
      list.push({ id: 'combo', group: 2, name: '❄️ 空调+新风套餐85折', discount: Math.round(total * 0.15), type: 'rate', desc: '组合套餐优惠' });
    }
    if (products.some(p => /热水/.test(p)) && products.some(p => /净水/.test(p))) {
      list.push({ id: 'combo_water', group: 2, name: '💧 热水+净水套餐85折', discount: Math.round(total * 0.15), type: 'rate', desc: '水系统套餐' });
    }
    if (context.season === 'summer' && products.some(p => /空调/.test(p))) {
      list.push({ id: 'seasonal', group: 2, name: '☀️ 夏季空调88折', discount: Math.round(total * 0.12), type: 'rate', desc: '夏季旺季特惠' });
    }
    if (context.season === 'winter' && products.some(p => /热水|采暖|暖气/.test(p))) {
      list.push({ id: 'seasonal_winter', group: 2, name: '❄️ 冬季暖气88折', discount: Math.round(total * 0.12), type: 'rate', desc: '冬季取暖特惠' });
    }

    // --- 裂变促销 ---
    if (customer.referrerId) {
      list.push({ id: 'old_referral', group: 'referral', name: '🤝 老带新返现', discount: 1000, type: 'fixed', desc: '推荐人返现5%，新客得¥1000券' });
    }

    return list.sort((a, b) => b.discount - a.discount);
  }

  _runScenarioTriggers(context) {
    const triggered = [];
    this.scenarioTriggers.forEach(t => {
      try {
        if (t.when(context)) triggered.push({ id: t.recommend, reason: t.reason });
      } catch (_) { /* ignore */ }
    });
    return triggered;
  }

  /** 组合求解：贪心 + 互斥约束，生成 Top 3 */
  _solveCombos(candidates, total) {
    if (!candidates.length) return [];

    const groupOf = (item) => {
      for (let i = 0; i < this.exclusiveGroups.length; i++) {
        if (this.exclusiveGroups[i].includes(item.id)) return `g${i}`;
      }
      return item.group != null ? String(item.group) : item.id;
    };

    const maxDiscount = Math.floor(total * this.maxDiscountRate);

    // 策略1: 纯贪心（最省钱优先）
    const strategy = (items, label, storyHook) => {
      const seen = new Set();
      const picked = [];
      let saving = 0;
      for (const it of items) {
        const g = groupOf(it);
        if (seen.has(g)) continue;
        if (saving + it.discount > maxDiscount) continue;
        seen.add(g);
        picked.push(it);
        saving += it.discount;
      }
      return {
        label,
        storyHook,
        items: picked,
        savings: saving,
        finalPrice: Math.max(0, total - saving),
        savingRate: total > 0 ? (saving / total) : 0
      };
    };

    const combos = [];
    combos.push(strategy([...candidates], '🌟 最省钱组合', 'save_max'));

    // 策略2: 仅触发场景的促销优先
    const triggeredFirst = [...candidates].sort((a, b) => (b.triggered ? 1 : 0) - (a.triggered ? 1 : 0));
    const c2 = strategy(triggeredFirst, '🎯 场景精准组合', 'scenario');
    if (JSON.stringify(c2.items.map(i => i.id)) !== JSON.stringify(combos[0].items.map(i => i.id))) combos.push(c2);

    // 策略3: 保守组合（只选1-2个核心）
    const c3 = strategy(candidates.slice(0, 2), '🛡️ 稳妥快速组合', 'conservative');
    if (c3.items.length && !combos.some(c => JSON.stringify(c.items.map(i => i.id)) === JSON.stringify(c3.items.map(i => i.id)))) {
      combos.push(c3);
    }

    return combos.filter(c => c.items.length > 0).slice(0, 3);
  }

  /** 情绪化话术 —— 把折扣翻译成生活场景 */
  _buildStory(combo, order) {
    const s = combo.savings;
    const bucket =
      s >= 20000 ? '相当于一次全家境外游 ✈️' :
      s >= 10000 ? '够换一台最新iPhone 📱' :
      s >= 5000 ? '可以给孩子报一期兴趣班 🎨' :
      s >= 2000 ? '够全家一顿米其林大餐 🍽️' :
      '相当于一张高铁商务座车票 🚄';

    const head = combo.items.length === 1
      ? `已为您锁定专属优惠「${combo.items[0].name}」`
      : `已为您智能组合 ${combo.items.length} 重优惠`;

    return {
      headline: `${head}，立省 ¥${s.toLocaleString()}`,
      subline: `省下的这 ¥${s.toLocaleString()}，${bucket}`,
      finalPrice: combo.finalPrice,
      badges: combo.items.map(i => i.name)
    };
  }
}

module.exports = PromotionMatchService;
