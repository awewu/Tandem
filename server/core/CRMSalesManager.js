/**
 * CRM Sales Manager - 统一客户关系与销售管理系统
 * 整合 RoleSystem + QuickLockMode + MarketingEngine + FissionTrackingEngine
 * 提供完整的销售、营销、客户管理功能
 */

const { EventEmitter } = require('events');

class CRMSalesManager extends EventEmitter {
  constructor(db, config = {}) {
    super();
    
    this.name = 'CRMSalesManager';
    this.version = '2.0.0';
    this.db = db; // UnifiedDatabase实例
    
    // 销售阶段定义
    this.salesStages = [
      { id: 'prospecting', name: '线索获取', probability: 0.1 },
      { id: 'qualification', name: '需求确认', probability: 0.2 },
      { id: 'quotation', name: '报价阶段', probability: 0.5 },
      { id: 'negotiation', name: '商务谈判', probability: 0.7 },
      { id: 'contract', name: '合同签署', probability: 0.9 },
      { id: 'won', name: '成交赢单', probability: 1.0 },
      { id: 'lost', name: '输单', probability: 0.0 }
    ];
    
    // 营销活动类型
    this.campaignTypes = [
      { id: 'coupon', name: '优惠券', description: '满减/折扣券' },
      { id: 'group', name: '拼团', description: '阶梯成团优惠' },
      { id: 'seckill', name: '秒杀', description: '限时限量抢购' },
      { id: 'fission', name: '裂变', description: '分享有礼/邀请奖励' },
      { id: 'points', name: '积分', description: '消费积分兑换' },
      { id: 'member', name: '会员', description: '等级权益体系' }
    ];
    
    // 客户标签体系 (RFM模型)
    this.customerTags = {
      r: { // Recency
        recent: { days: 30, label: '近期活跃' },
        moderate: { days: 90, label: '中等活跃' },
        inactive: { days: 180, label: '需唤醒' }
      },
      f: { // Frequency
        high: { count: 5, label: '高频客户' },
        medium: { count: 3, label: '中频客户' },
        low: { count: 1, label: '低频客户' }
      },
      m: { // Monetary
        vip: { amount: 100000, label: 'VIP客户' },
        valuable: { amount: 50000, label: '价值客户' },
        potential: { amount: 10000, label: '潜力客户' }
      }
    };
    
    this.initialize();
  }

  initialize() {
    this.emit('init', { name: this.name, version: this.version });
    console.log('[CRMSalesManager] CRM销售管理系统初始化完成');
  }

  // ===== 客户管理 (360°视图) =====
  
  async createCustomer(customerData) {
    // 自动标签
    const autoTags = this.calculateCustomerTags(customerData);
    
    const customer = await this.db.createCustomer({
      ...customerData,
      tags: [...(customerData.tags || []), ...autoTags],
      score: this.calculateLeadScore(customerData),
      source: customerData.source || 'direct',
      assignedTo: customerData.assignedTo || null
    });
    
    this.emit('customer:created', customer);
    return customer;
  }

  async getCustomer360View(customerId) {
    const customer = await this.db.getCustomerById(customerId);
    if (!customer) return null;
    
    // 关联数据
    const projects = await this.db.getProjectsByCustomer(customerId);
    const interactions = customer.history || [];
    const quotations = [];
    
    for (const project of projects) {
      const quotes = await this.db.getQuotationsByProject(project.id);
      quotations.push(...quotes);
    }
    
    // 计算客户价值
    const totalValue = quotations.reduce((sum, q) => sum + (q.total || 0), 0);
    const projectCount = projects.length;
    const lastInteraction = interactions[interactions.length - 1];
    
    // RFM评分
    const rfm = this.calculateRFM(customer, interactions, totalValue);
    
    return {
      customer,
      summary: {
        totalValue,
        projectCount,
        quotationCount: quotations.length,
        lastInteraction: lastInteraction?.timestamp,
        daysSinceLastContact: lastInteraction ? 
          Math.floor((Date.now() - new Date(lastInteraction.timestamp)) / (1000 * 60 * 60 * 24)) : 
          null
      },
      projects,
      quotations,
      interactions,
      rfm,
      recommendations: this.generateRecommendations(rfm)
    };
  }

  async updateCustomerTags(customerId, newTags) {
    const customer = await this.db.getCustomerById(customerId);
    if (!customer) return null;
    
    const updated = await this.db.updateCustomer(customerId, {
      tags: [...new Set([...customer.tags, ...newTags])]
    });
    
    this.emit('customer:tags:update', { customerId, tags: newTags });
    return updated;
  }

  async addCustomerInteraction(customerId, interaction) {
    const enrichedInteraction = {
      ...interaction,
      id: `INT-${Date.now()}`,
      timestamp: new Date().toISOString()
    };
    
    await this.db.addCustomerInteraction(customerId, enrichedInteraction);
    
    // 触发智能提醒
    if (interaction.type === 'inquiry') {
      this.scheduleFollowUp(customerId, 1); // 1天后跟进
    }
    
    this.emit('interaction:added', { customerId, interaction: enrichedInteraction });
    return enrichedInteraction;
  }

  // ===== 商机管理 (漏斗分析) =====
  
  async createOpportunity(customerId, opportunityData) {
    const opportunity = {
      id: `OPP-${Date.now()}`,
      customerId,
      stage: 'prospecting',
      probability: 0.1,
      expectedValue: opportunityData.expectedValue || 0,
      expectedCloseDate: opportunityData.expectedCloseDate,
      products: opportunityData.products || [],
      painPoints: opportunityData.painPoints || [],
      competitors: opportunityData.competitors || [],
      notes: opportunityData.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // 保存到数据库
    if (!this.db.memoryStore.opportunities) {
      this.db.memoryStore.opportunities = new Map();
    }
    this.db.memoryStore.opportunities.set(opportunity.id, opportunity);
    
    this.emit('opportunity:created', opportunity);
    return opportunity;
  }

  async moveOpportunityStage(opportunityId, newStage) {
    const opportunity = this.db.memoryStore.opportunities?.get(opportunityId);
    if (!opportunity) return null;
    
    const stageConfig = this.salesStages.find(s => s.id === newStage);
    if (!stageConfig) return null;
    
    const oldStage = opportunity.stage;
    opportunity.stage = newStage;
    opportunity.probability = stageConfig.probability;
    opportunity.updatedAt = new Date().toISOString();
    
    // 记录阶段历史
    if (!opportunity.stageHistory) opportunity.stageHistory = [];
    opportunity.stageHistory.push({
      from: oldStage,
      to: newStage,
      timestamp: new Date().toISOString()
    });
    
    this.emit('opportunity:stage:change', { 
      opportunityId, 
      from: oldStage, 
      to: newStage 
    });
    
    return opportunity;
  }

  async getSalesFunnel() {
    const opportunities = Array.from(this.db.memoryStore.opportunities?.values() || []);
    
    const funnel = this.salesStages.map(stage => {
      const stageOpps = opportunities.filter(o => o.stage === stage.id);
      const value = stageOpps.reduce((sum, o) => sum + o.expectedValue, 0);
      
      return {
        stage: stage.id,
        name: stage.name,
        count: stageOpps.length,
        value,
        probability: stage.probability,
        weightedValue: value * stage.probability
      };
    });
    
    const totalWeightedValue = funnel.reduce((sum, s) => sum + s.weightedValue, 0);
    
    return {
      stages: funnel,
      totalOpportunities: opportunities.length,
      totalValue: opportunities.reduce((sum, o) => sum + o.expectedValue, 0),
      totalWeightedValue,
      conversionRates: this.calculateConversionRates(funnel)
    };
  }

  // ===== 营销活动管理 =====
  
  async createCampaign(campaignData) {
    const campaign = {
      id: `CAMP-${Date.now()}`,
      name: campaignData.name,
      type: campaignData.type,
      status: 'draft', // draft, active, paused, ended
      budget: campaignData.budget || 0,
      startDate: campaignData.startDate,
      endDate: campaignData.endDate,
      rules: campaignData.rules || {},
      target: campaignData.target || {},
      metrics: {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
        revenue: 0
      },
      participants: [],
      createdAt: new Date().toISOString()
    };
    
    if (!this.db.memoryStore.campaigns) {
      this.db.memoryStore.campaigns = new Map();
    }
    this.db.memoryStore.campaigns.set(campaign.id, campaign);
    
    this.emit('campaign:created', campaign);
    return campaign;
  }

  async activateCampaign(campaignId) {
    const campaign = this.db.memoryStore.campaigns?.get(campaignId);
    if (!campaign) return null;
    
    campaign.status = 'active';
    campaign.activatedAt = new Date().toISOString();
    
    this.emit('campaign:activated', campaign);
    return campaign;
  }

  async createCoupon(campaignId, couponData) {
    const coupon = {
      id: `CP-${Date.now()}`,
      campaignId,
      code: this.generateCouponCode(),
      type: couponData.type, // fixed, percent, random
      value: couponData.value,
      minOrder: couponData.minOrder || 0,
      totalCount: couponData.totalCount,
      usedCount: 0,
      userLimit: couponData.userLimit || 1,
      applicableProducts: couponData.applicableProducts || [],
      startDate: couponData.startDate,
      endDate: couponData.endDate,
      status: 'active'
    };
    
    if (!this.db.memoryStore.coupons) {
      this.db.memoryStore.coupons = new Map();
    }
    this.db.memoryStore.coupons.set(coupon.id, coupon);
    
    this.emit('coupon:created', coupon);
    return coupon;
  }

  async validateCoupon(code, orderValue, products = []) {
    const coupon = Array.from(this.db.memoryStore.coupons?.values() || [])
      .find(c => c.code === code && c.status === 'active');
    
    if (!coupon) return { valid: false, reason: '优惠券不存在或已失效' };
    
    // 检查有效期
    const now = new Date();
    if (new Date(coupon.startDate) > now) {
      return { valid: false, reason: '优惠券尚未生效' };
    }
    if (new Date(coupon.endDate) < now) {
      return { valid: false, reason: '优惠券已过期' };
    }
    
    // 检查最低消费
    if (orderValue < coupon.minOrder) {
      return { valid: false, reason: `订单金额未达到最低消费${coupon.minOrder}元` };
    }
    
    // 检查适用产品
    if (coupon.applicableProducts.length > 0) {
      const hasApplicable = products.some(p => 
        coupon.applicableProducts.includes(p.id) || 
        coupon.applicableProducts.includes(p.category)
      );
      if (!hasApplicable) {
        return { valid: false, reason: '订单中没有可适用该券的产品' };
      }
    }
    
    // 计算优惠金额
    let discount = 0;
    if (coupon.type === 'fixed') {
      discount = coupon.value;
    } else if (coupon.type === 'percent') {
      discount = orderValue * (coupon.value / 100);
    } else if (coupon.type === 'random') {
      discount = Math.random() * (coupon.value.max - coupon.value.min) + coupon.value.min;
    }
    
    return {
      valid: true,
      coupon,
      discount: Math.round(discount),
      finalPrice: orderValue - Math.round(discount)
    };
  }

  // ===== 分销裂变管理 =====
  
  async createFissionCampaign(campaignData) {
    const fission = {
      id: `FISS-${Date.now()}`,
      name: campaignData.name,
      type: campaignData.type || 'referral', // referral, group, share
      rules: {
        levels: campaignData.levels || 3, // 分销层级
        commission: campaignData.commission || [0.1, 0.05, 0.03], // 各级佣金比例
        rewardType: campaignData.rewardType || 'cash', // cash, points, coupon
        minPurchase: campaignData.minPurchase || 0
      },
      participants: new Map(), // userId -> { referrals, earnings, level }
      statistics: {
        totalParticipants: 0,
        totalReferrals: 0,
        totalSpend: 0,
        totalRevenue: 0
      },
      status: 'active',
      createdAt: new Date().toISOString()
    };
    
    if (!this.db.memoryStore.fissions) {
      this.db.memoryStore.fissions = new Map();
    }
    this.db.memoryStore.fissions.set(fission.id, fission);
    
    this.emit('fission:created', fission);
    return fission;
  }

  async trackReferral(fissionId, referrerId, referredId, orderValue) {
    const fission = this.db.memoryStore.fissions?.get(fissionId);
    if (!fission) return null;
    
    // 记录推荐关系
    if (!fission.participants.has(referrerId)) {
      fission.participants.set(referrerId, {
        id: referrerId,
        referrals: [],
        earnings: 0,
        level: 1
      });
    }
    
    const referrer = fission.participants.get(referrerId);
    referrer.referrals.push({
      id: referredId,
      orderValue,
      commission: orderValue * fission.rules.commission[0],
      timestamp: new Date().toISOString()
    });
    
    referrer.earnings += orderValue * fission.rules.commission[0];
    
    // 多级佣金计算
    await this.calculateMultiLevelCommission(fission, referrerId, orderValue, 1);
    
    fission.statistics.totalReferrals++;
    fission.statistics.totalRevenue += orderValue;
    
    this.emit('referral:tracked', { fissionId, referrerId, referredId, orderValue });
    return fission;
  }

  async calculateMultiLevelCommission(fission, referrerId, orderValue, level) {
    if (level >= fission.rules.commission.length) return;
    
    // 查找上级推荐人
    const parentReferrer = Array.from(fission.participants.values())
      .find(p => p.referrals.some(r => r.id === referrerId));
    
    if (parentReferrer) {
      const commission = orderValue * fission.rules.commission[level];
      parentReferrer.earnings += commission;
      
      // 递归计算更上级
      await this.calculateMultiLevelCommission(fission, parentReferrer.id, orderValue, level + 1);
    }
  }

  // ===== 智能分析与预测 =====
  
  async getSalesForecast(days = 30) {
    const opportunities = Array.from(this.db.memoryStore.opportunities?.values() || []);
    
    // 按预期成交日期分组
    const forecast = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayOpps = opportunities.filter(o => {
        if (!o.expectedCloseDate) return false;
        return o.expectedCloseDate.startsWith(dateStr) && o.stage !== 'lost';
      });
      
      const value = dayOpps.reduce((sum, o) => sum + o.expectedValue * o.probability, 0);
      
      forecast.push({
        date: dateStr,
        expectedDeals: dayOpps.length,
        expectedValue: Math.round(value)
      });
    }
    
    return {
      daily: forecast,
      totalExpectedValue: forecast.reduce((sum, d) => sum + d.expectedValue, 0),
      totalExpectedDeals: forecast.reduce((sum, d) => sum + d.expectedDeals, 0)
    };
  }

  async getCustomerInsights() {
    const customers = Array.from(this.db.memoryStore.customers?.values() || []);
    
    // 客户分布
    const typeDistribution = {};
    const tagDistribution = {};
    const sourceDistribution = {};
    
    customers.forEach(c => {
      // 类型分布
      typeDistribution[c.type] = (typeDistribution[c.type] || 0) + 1;
      
      // 标签分布
      c.tags?.forEach(tag => {
        tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
      });
      
      // 来源分布
      sourceDistribution[c.source] = (sourceDistribution[c.source] || 0) + 1;
    });
    
    // 客户活跃度
    const active30Days = customers.filter(c => {
      if (!c.history?.length) return false;
      const last = new Date(c.history[c.history.length - 1].timestamp);
      return (Date.now() - last) / (1000 * 60 * 60 * 24) <= 30;
    }).length;
    
    return {
      totalCustomers: customers.length,
      active30Days,
      activationRate: customers.length > 0 ? (active30Days / customers.length * 100).toFixed(1) : 0,
      distributions: {
        type: typeDistribution,
        tags: tagDistribution,
        source: sourceDistribution
      },
      trends: this.calculateCustomerTrends(customers)
    };
  }

  // ===== 辅助方法 =====
  
  calculateCustomerTags(customerData) {
    const tags = [];
    
    // 根据属性自动打标签
    if (customerData.area > 150) tags.push('大户型');
    if (customerData.budget > 100000) tags.push('高预算');
    if (customerData.urgency === 'high') tags.push('急单');
    if (customerData.source === 'referral') tags.push('转介绍');
    
    return tags;
  }

  calculateLeadScore(customerData) {
    let score = 0;
    
    // 预算权重
    if (customerData.budget > 100000) score += 30;
    else if (customerData.budget > 50000) score += 20;
    else if (customerData.budget > 20000) score += 10;
    
    // 紧迫性权重
    if (customerData.urgency === 'high') score += 25;
    else if (customerData.urgency === 'medium') score += 15;
    
    // 决策周期权重
    if (customerData.decisionCycle === 'short') score += 20;
    
    // 来源权重
    if (customerData.source === 'referral') score += 15;
    else if (customerData.source === 'online') score += 10;
    
    return Math.min(score, 100);
  }

  calculateRFM(customer, interactions, totalValue) {
    const now = Date.now();
    
    // Recency (最近交互)
    let recency = 0;
    if (interactions.length > 0) {
      const lastInteraction = new Date(interactions[interactions.length - 1].timestamp);
      recency = Math.max(0, 5 - Math.floor((now - lastInteraction) / (1000 * 60 * 60 * 24 * 30)));
    }
    
    // Frequency (交互频率)
    const frequency = Math.min(interactions.length / 10, 5);
    
    // Monetary (消费金额)
    const monetary = Math.min(totalValue / 50000, 5);
    
    return { recency: Math.round(recency), frequency: Math.round(frequency), monetary: Math.round(monetary) };
  }

  generateRecommendations(rfm) {
    const recommendations = [];
    
    if (rfm.recency <= 2) {
      recommendations.push({ type: 'action', content: '该客户近期不活跃，建议主动跟进唤醒' });
    }
    
    if (rfm.monetary >= 4) {
      recommendations.push({ type: 'vip', content: '高价值客户，建议提供VIP专属服务' });
    }
    
    if (rfm.frequency >= 4 && rfm.monetary >= 3) {
      recommendations.push({ type: 'loyalty', content: '忠诚客户，可邀请参与推荐返利活动' });
    }
    
    return recommendations;
  }

  calculateConversionRates(funnel) {
    const rates = [];
    for (let i = 1; i < funnel.length; i++) {
      const prev = funnel[i - 1].count;
      const curr = funnel[i].count;
      if (prev > 0) {
        rates.push({
          from: funnel[i - 1].stage,
          to: funnel[i].stage,
          rate: (curr / prev * 100).toFixed(1)
        });
      }
    }
    return rates;
  }

  calculateCustomerTrends(customers) {
    // 简化实现，返回最近6个月的新增客户趋势
    const trends = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = month.toISOString().slice(0, 7);
      
      const count = customers.filter(c => c.createdAt?.startsWith(monthStr)).length;
      
      trends.push({
        month: monthStr,
        newCustomers: count
      });
    }
    
    return trends;
  }

  generateCouponCode() {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
    let code = 'RH-';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  scheduleFollowUp(customerId, days) {
    // 简化实现，实际应该使用任务调度系统
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + days);
    
    this.emit('followup:scheduled', { customerId, date: followUpDate.toISOString() });
  }

  // ===== 健康检查 =====
  
  async healthCheck() {
    return {
      name: this.name,
      version: this.version,
      status: 'healthy',
      stats: {
        customers: this.db.memoryStore.customers?.size || 0,
        opportunities: this.db.memoryStore.opportunities?.size || 0,
        campaigns: this.db.memoryStore.campaigns?.size || 0,
        coupons: this.db.memoryStore.coupons?.size || 0
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = CRMSalesManager;
