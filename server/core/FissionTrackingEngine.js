/**
 * 【Phase 1进化】FissionTrackingEngine v1.0
 * 裂变追踪引擎 - 用户增长与推广体系
 * 
 * 功能:
 * - 推广链接生成与追踪
 * - 多级分销佣金体系
 * - 裂变数据分析看板
 * - 社交分享素材管理
 */

class FissionTrackingEngine {
  constructor() {
    this.version = '1.0';
    
    // 裂变层级配置
    this.fissionLevels = {
      level1: { name: '直接推荐', commissionRate: 0.03 },  // 3%
      level2: { name: '间接推荐', commissionRate: 0.01 },  // 1%
      level3: { name: '三级推荐', commissionRate: 0.005 } // 0.5%
    };

    // 推广类型
    this.promotionTypes = {
      link: { name: '推广链接', trackable: true },
      qrcode: { name: '二维码', trackable: true },
      poster: { name: '海报', trackable: true },
      card: { name: '名片', trackable: false }
    };

    // 裂变活动模板
    this.activityTemplates = {
      laodaixin: {
        name: '老带新',
        description: '老客户推荐新客户成交返现',
        rules: {
          trigger: 'new_customer_order',
          rewardType: 'cashback',
          rewardValue: 0.03, // 3%返现
          maxReward: 5000,   // 单笔最高5000
          minOrderValue: 10000 // 最低订单1万
        }
      },
      groupbuy: {
        name: '社群团购',
        description: '同小区满5户享额外折扣',
        rules: {
          trigger: 'group_formed',
          minGroupSize: 5,
          discount: 0.05, // 额外5%折扣
          timeLimit: 48    // 48小时成团
        }
      },
      bargain: {
        name: '好友砍价',
        description: '邀请好友帮忙砍价',
        rules: {
          trigger: 'bargain_complete',
          maxHelpers: 10,
          maxDiscount: 0.10, // 最高砍10%
          timeLimit: 24      // 24小时
        }
      },
      share: {
        name: '转发有奖',
        description: '分享方案/案例到社交平台',
        rules: {
          trigger: 'share_with_click',
          rewardType: 'points',
          rewardValue: 100,  // 100积分
          dailyLimit: 3      // 每日限3次
        }
      }
    };

    // 追踪数据存储 (实际应使用Redis + 数据库)
    this.trackingData = new Map();
    this.commissionRecords = [];
  }

  /**
   * 生成推广链接
   */
  generatePromotionLink(params) {
    const { promoterId, source, campaignId, landingPage = 'index' } = params;
    
    // 生成唯一追踪码
    const trackingCode = this.generateTrackingCode(promoterId, source);
    
    // 构建链接
    const baseUrl = 'https://rheem-design.com';
    const link = `${baseUrl}/${landingPage}?ref=${trackingCode}&utm_source=${source}&utm_campaign=${campaignId || 'default'}`;
    
    // 存储追踪信息
    const trackingInfo = {
      trackingCode,
      promoterId,
      source,
      campaignId,
      landingPage,
      createdAt: new Date(),
      clicks: 0,
      conversions: 0,
      commissions: 0
    };
    
    this.trackingData.set(trackingCode, trackingInfo);
    
    return {
      success: true,
      link,
      trackingCode,
      shortLink: this.generateShortLink(trackingCode),
      qrcode: this.generateQRCode(link)
    };
  }

  generateTrackingCode(promoterId, source) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 4);
    return `${source.substr(0, 2).toUpperCase()}${promoterId.substr(-4)}${timestamp.substr(-6)}${random}`.toUpperCase();
  }

  generateShortLink(trackingCode) {
    // 实际应使用短链接服务
    return `https://rhm.design/${trackingCode.substr(0, 8)}`;
  }

  generateQRCode(link) {
    // 实际应调用二维码生成服务
    return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(link)}&size=200x200`;
  }

  /**
   * 追踪链接点击
   */
  trackClick(trackingCode, visitorInfo) {
    const tracking = this.trackingData.get(trackingCode);
    if (!tracking) return { success: false, error: '无效追踪码' };
    
    // 记录点击
    tracking.clicks++;
    tracking.lastClickAt = new Date();
    
    // 存储访客信息 (用于后续归因)
    const clickRecord = {
      trackingCode,
      visitorId: this.generateVisitorId(visitorInfo),
      ip: visitorInfo.ip,
      userAgent: visitorInfo.userAgent,
      timestamp: new Date(),
      referrer: visitorInfo.referrer,
      device: this.parseDevice(visitorInfo.userAgent)
    };
    
    // 设置追踪Cookie/LocalStorage
    return {
      success: true,
      visitorId: clickRecord.visitorId,
      promoterId: tracking.promoterId,
      // 追踪有效期7天
      attributionWindow: 7 * 24 * 60 * 60 * 1000
    };
  }

  /**
   * 追踪转化 (注册/下单)
   */
  trackConversion(visitorId, conversionData) {
    const { type, value, orderId, customerInfo } = conversionData;
    
    // 查找归因
    const attribution = this.findAttribution(visitorId);
    if (!attribution) {
      return { success: false, error: '无法归因' };
    }
    
    const tracking = this.trackingData.get(attribution.trackingCode);
    if (!tracking) {
      return { success: false, error: '追踪信息不存在' };
    }
    
    // 记录转化
    tracking.conversions++;
    
    // 计算佣金
    const commission = this.calculateCommission(tracking.promoterId, type, value);
    
    // 存储转化记录
    const conversionRecord = {
      id: `CV${Date.now()}`,
      visitorId,
      trackingCode: attribution.trackingCode,
      promoterId: tracking.promoterId,
      type,
      value,
      orderId,
      commission,
      status: 'pending', // pending/confirmed/paid/cancelled
      createdAt: new Date()
    };
    
    this.commissionRecords.push(conversionRecord);
    
    return {
      success: true,
      conversionId: conversionRecord.id,
      commission,
      promoterId: tracking.promoterId
    };
  }

  /**
   * 计算佣金
   */
  calculateCommission(promoterId, type, value) {
    // 获取推广者的上级链
    const promoterChain = this.getPromoterChain(promoterId);
    
    const commissions = [];
    
    // 按层级分配佣金
    promoterChain.forEach((promoter, index) => {
      const level = index + 1;
      const levelConfig = this.fissionLevels[`level${level}`];
      
      if (levelConfig) {
        const amount = value * levelConfig.commissionRate;
        commissions.push({
          promoterId: promoter.id,
          level,
          levelName: levelConfig.name,
          rate: levelConfig.commissionRate,
          amount: Math.round(amount * 100) / 100,
          status: 'pending'
        });
      }
    });
    
    return {
      total: commissions.reduce((sum, c) => sum + c.amount, 0),
      breakdown: commissions
    };
  }

  getPromoterChain(promoterId) {
    // 实际应查询数据库获取上级链
    // 模拟3级链
    return [
      { id: promoterId, name: '直接推广者' },
      { id: 'PARENT1', name: '上级推广者' },
      { id: 'PARENT2', name: '上上级推广者' }
    ];
  }

  /**
   * 确认佣金 (订单完成后)
   */
  confirmCommission(conversionId) {
    const record = this.commissionRecords.find(r => r.id === conversionId);
    if (!record) return { success: false, error: '记录不存在' };
    
    record.status = 'confirmed';
    record.confirmedAt = new Date();
    
    // 更新推广者佣金余额
    record.commission.breakdown.forEach(c => {
      this.updatePromoterBalance(c.promoterId, c.amount);
    });
    
    return { success: true, confirmedCommission: record.commission };
  }

  updatePromoterBalance(promoterId, amount) {
    // 实际应更新数据库
    console.log(`更新推广者 ${promoterId} 余额: +${amount}`);
  }

  /**
   * 获取推广者数据中心
   */
  getPromoterDashboard(promoterId, period = '30d') {
    const startDate = this.getPeriodStart(period);
    
    // 汇总数据
    const records = this.commissionRecords.filter(r => 
      r.promoterId === promoterId && r.createdAt >= startDate
    );
    
    const trackingCodes = Array.from(this.trackingData.values())
      .filter(t => t.promoterId === promoterId && t.createdAt >= startDate);
    
    return {
      overview: {
        totalClicks: trackingCodes.reduce((sum, t) => sum + t.clicks, 0),
        totalConversions: records.filter(r => r.status === 'confirmed').length,
        pendingConversions: records.filter(r => r.status === 'pending').length,
        confirmedCommission: records
          .filter(r => r.status === 'confirmed')
          .reduce((sum, r) => sum + r.commission.total, 0),
        pendingCommission: records
          .filter(r => r.status === 'pending')
          .reduce((sum, r) => sum + r.commission.total, 0),
        withdrawableBalance: this.getWithdrawableBalance(promoterId)
      },
      
      trends: {
        dailyClicks: this.aggregateDaily(trackingCodes, 'clicks', period),
        dailyConversions: this.aggregateDaily(records.filter(r => r.status === 'confirmed'), null, period),
        dailyCommission: this.aggregateDailyCommission(records, period)
      },
      
      topLinks: trackingCodes
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5)
        .map(t => ({
          trackingCode: t.trackingCode,
          clicks: t.clicks,
          conversions: t.conversions,
          ctr: t.clicks > 0 ? (t.conversions / t.clicks * 100).toFixed(2) + '%' : '0%'
        })),
      
      fissionNetwork: this.getFissionNetwork(promoterId),
      
      recentConversions: records
        .filter(r => r.status === 'confirmed')
        .slice(-10)
        .map(r => ({
          id: r.id,
          value: r.value,
          commission: r.commission.total,
          date: r.createdAt
        }))
    };
  }

  getFissionNetwork(promoterId) {
    // 获取下级推广者
    const subPromoters = this.getSubPromoters(promoterId);
    
    return {
      level1: subPromoters.filter(p => p.level === 1).length,
      level2: subPromoters.filter(p => p.level === 2).length,
      level3: subPromoters.filter(p => p.level === 3).length,
      total: subPromoters.length,
      activeSubPromoters: subPromoters.filter(p => p.active).length,
      subPromoters: subPromoters.slice(0, 10) // 显示前10个
    };
  }

  getSubPromoters(promoterId) {
    // 实际应查询数据库
    return [];
  }

  getWithdrawableBalance(promoterId) {
    // 实际应查询数据库
    return 0;
  }

  /**
   * 裂变数据分析 (总部视角)
   */
  getFissionAnalytics(period = '30d') {
    const startDate = this.getPeriodStart(period);
    
    const allRecords = this.commissionRecords.filter(r => r.createdAt >= startDate);
    const allTracking = Array.from(this.trackingData.values())
      .filter(t => t.createdAt >= startDate);
    
    return {
      overall: {
        totalPromoters: new Set(allRecords.map(r => r.promoterId)).size,
        totalClicks: allTracking.reduce((sum, t) => sum + t.clicks, 0),
        totalConversions: allRecords.filter(r => r.status === 'confirmed').length,
        totalCommission: allRecords
          .filter(r => r.status === 'confirmed')
          .reduce((sum, r) => sum + r.commission.total, 0),
        avgConversionRate: allTracking.length > 0 
          ? allRecords.filter(r => r.status === 'confirmed').length / allTracking.reduce((sum, t) => sum + t.clicks, 0)
          : 0
      },
      
      activityEffectiveness: Object.entries(this.activityTemplates).map(([key, template]) => {
        const activityRecords = allRecords.filter(r => r.campaignId === key);
        return {
          name: template.name,
          conversions: activityRecords.filter(r => r.status === 'confirmed').length,
          commission: activityRecords
            .filter(r => r.status === 'confirmed')
            .reduce((sum, r) => sum + r.commission.total, 0),
          avgOrderValue: activityRecords.length > 0
            ? activityRecords.reduce((sum, r) => sum + r.value, 0) / activityRecords.length
            : 0
        };
      }),
      
      topPerformers: this.getTopPerformers(allRecords, 10),
      
      growthTrend: this.calculateGrowthTrend(allRecords, period)
    };
  }

  getTopPerformers(records, limit) {
    const promoterStats = {};
    
    records.forEach(r => {
      if (!promoterStats[r.promoterId]) {
        promoterStats[r.promoterId] = {
          promoterId: r.promoterId,
          conversions: 0,
          commission: 0
        };
      }
      
      if (r.status === 'confirmed') {
        promoterStats[r.promoterId].conversions++;
        promoterStats[r.promoterId].commission += r.commission.total;
      }
    });
    
    return Object.values(promoterStats)
      .sort((a, b) => b.commission - a.commission)
      .slice(0, limit);
  }

  calculateGrowthTrend(records, period) {
    // 计算环比增长
    const currentPeriod = records.filter(r => r.createdAt >= this.getPeriodStart(period));
    const previousPeriod = records.filter(r => 
      r.createdAt >= this.getPreviousPeriodStart(period) &&
      r.createdAt < this.getPeriodStart(period)
    );
    
    const currentCommission = currentPeriod
      .filter(r => r.status === 'confirmed')
      .reduce((sum, r) => sum + r.commission.total, 0);
    
    const previousCommission = previousPeriod
      .filter(r => r.status === 'confirmed')
      .reduce((sum, r) => sum + r.commission.total, 0);
    
    return {
      current: currentCommission,
      previous: previousCommission,
      growth: previousCommission > 0 
        ? ((currentCommission - previousCommission) / previousCommission * 100).toFixed(2) + '%'
        : 'N/A'
    };
  }

  /**
   * 生成社交分享素材
   */
  generateShareMaterial(type, content) {
    const templates = {
      case: {
        title: '看看这个${户型}的舒适家居方案',
        description: '解决${痛点}，投资${预算}，享受五恒舒适生活',
        image: '${caseImage}',
        callToAction: '免费获取专属方案'
      },
      promotion: {
        title: '限时优惠！瑞美舒适家居${折扣}折',
        description: '${活动时间}内下单享专属优惠，还能参与裂变奖励',
        image: '${promoImage}',
        callToAction: '立即咨询'
      },
      knowledge: {
        title: '暖通知识：${topic}',
        description: '专业解读，助您选对舒适家居系统',
        image: '${knowledgeImage}',
        callToAction: '了解更多'
      }
    };
    
    return templates[type] || templates.case;
  }

  // ==================== 辅助方法 ====================

  generateVisitorId(visitorInfo) {
    const str = `${visitorInfo.ip}-${visitorInfo.userAgent}-${Date.now()}`;
    return require('crypto').createHash('md5').update(str).digest('hex').substr(0, 16);
  }

  parseDevice(userAgent) {
    if (/mobile|android|iphone/i.test(userAgent)) return 'mobile';
    if (/tablet|ipad/i.test(userAgent)) return 'tablet';
    return 'desktop';
  }

  findAttribution(visitorId) {
    // 实际应从数据库/Redis查询
    return null;
  }

  getPeriodStart(period) {
    const now = new Date();
    const match = period.match(/(\d+)([dmy])/);
    if (!match) return new Date(now - 30 * 24 * 60 * 60 * 1000);
    
    const [_, num, unit] = match;
    const multipliers = { d: 1, m: 30, y: 365 };
    return new Date(now - num * multipliers[unit] * 24 * 60 * 60 * 1000);
  }

  getPreviousPeriodStart(period) {
    const currentStart = this.getPeriodStart(period);
    const duration = new Date() - currentStart;
    return new Date(currentStart - duration);
  }

  aggregateDaily(items, field, period) {
    // 实际应聚合每日数据
    return [];
  }

  aggregateDailyCommission(records, period) {
    // 实际应聚合每日佣金
    return [];
  }
}

module.exports = FissionTrackingEngine;
