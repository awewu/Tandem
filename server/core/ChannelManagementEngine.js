/**
 * 【Phase 1进化】ChannelManagementEngine v1.0
 * 渠道管理引擎 - 经销商赋能体系核心
 * 
 * 功能:
 * - 多级经销商权限体系 (总部→区域→门店→导购)
 * - 业绩仪表盘与数据分析
 * - 培训体系与能力认证
 * - 佣金结算与财务管理
 */

const RoleSystemV2 = require('./RoleSystemV2');

class ChannelManagementEngine {
  constructor() {
    this.version = '1.0';
    this.roleSystem = new RoleSystemV2();
    
    // 经销商层级定义
    this.dealerHierarchy = {
      headquarter: {
        level: 1,
        name: '总部',
        roles: ['rheem_super', 'rheem_admin'],
        permissions: ['all']
      },
      region: {
        level: 2,
        name: '区域中心',
        roles: ['region_manager'],
        permissions: [
          'dealer.manage',      // 管理下属经销商
          'performance.view',   // 查看区域业绩
          'resource.allocate',  // 资源分配
          'training.manage',    // 培训管理
          'campaign.coordinate' // 活动协调
        ]
      },
      store: {
        level: 3,
        name: '门店',
        roles: ['store_admin', 'designer', 'sales'],
        permissions: [
          'customer.manage',    // 客户管理
          'project.manage',     // 方案管理
          'quote.generate',     // 报价生成
          'order.track',        // 订单跟踪
          'staff.manage'        // 店员管理
        ]
      },
      guide: {
        level: 4,
        name: '导购',
        roles: ['sales'],
        permissions: [
          'customer.follow',    // 客户跟进
          'quick.quote',        // 快速报价
          'case.show',          // 案例展示
          'promotion.share'     // 促销分享
        ]
      }
    };

    // 业绩指标定义
    this.kpiMetrics = {
      sales: {
        gmv: { name: 'GMV', unit: '元', weight: 0.4 },
        orderCount: { name: '订单数', unit: '单', weight: 0.2 },
        averageOrderValue: { name: '客单价', unit: '元', weight: 0.15 },
        conversionRate: { name: '转化率', unit: '%', weight: 0.15 },
        customerCount: { name: '客户数', unit: '人', weight: 0.1 }
      },
      activity: {
        loginFrequency: { name: '登录频次', unit: '次/周', weight: 0.3 },
        projectCount: { name: '方案数', unit: '个', weight: 0.3 },
        quoteCount: { name: '报价数', unit: '个', weight: 0.2 },
        followupCount: { name: '跟进数', unit: '次', weight: 0.2 }
      },
      service: {
        responseTime: { name: '响应时长', unit: '分钟', weight: 0.3 },
        satisfaction: { name: '满意度', unit: '分', weight: 0.4 },
        complaintRate: { name: '投诉率', unit: '%', weight: 0.3 }
      }
    };

    // 培训体系
    this.trainingSystem = {
      courses: [
        { id: 'basic-001', name: '产品基础知识', category: 'product', level: 1, duration: 120 },
        { id: 'basic-002', name: '销售话术与技巧', category: 'sales', level: 1, duration: 90 },
        { id: 'intermediate-001', name: '方案设计入门', category: 'design', level: 2, duration: 180 },
        { id: 'intermediate-002', name: '负荷计算精讲', category: 'technical', level: 2, duration: 150 },
        { id: 'advanced-001', name: '五恒系统大师课', category: 'product', level: 3, duration: 240 },
        { id: 'advanced-002', name: '复杂户型解决方案', category: 'design', level: 3, duration: 200 }
      ],
      certifications: [
        { id: 'cert-001', name: '瑞美认证销售顾问', level: 1, requiredCourses: ['basic-001', 'basic-002'] },
        { id: 'cert-002', name: '瑞美认证设计师', level: 2, requiredCourses: ['intermediate-001', 'intermediate-002'] },
        { id: 'cert-003', name: '瑞美认证方案专家', level: 3, requiredCourses: ['advanced-001', 'advanced-002'] }
      ]
    };
  }

  /**
   * 注册经销商
   */
  registerDealer(dealerInfo) {
    const { name, level, parentId, region, contact, businessLicense } = dealerInfo;
    
    // 验证层级关系
    if (parentId) {
      const parent = this.getDealerById(parentId);
      if (!parent) {
        return { success: false, error: '上级经销商不存在' };
      }
      if (this.dealerHierarchy[parent.level].level >= this.dealerHierarchy[level].level) {
        return { success: false, error: '层级关系错误' };
      }
    }

    const dealer = {
      id: `DL${Date.now()}`,
      name,
      level,
      parentId,
      region,
      contact,
      businessLicense,
      status: 'pending', // pending/active/suspended
      createdAt: new Date(),
      kpi: this.initializeKPI(),
      staff: [],
      performance: {
        monthlyGMV: 0,
        quarterlyGMV: 0,
        yearlyGMV: 0,
        totalOrders: 0,
        activeCustomers: 0
      }
    };

    return { success: true, dealer };
  }

  /**
   * 计算经销商健康度评分
   */
  calculateHealthScore(dealerId) {
    const dealer = this.getDealerById(dealerId);
    if (!dealer) return null;

    const scores = {
      performance: this.calculatePerformanceScore(dealer),
      activity: this.calculateActivityScore(dealer),
      service: this.calculateServiceScore(dealer),
      growth: this.calculateGrowthScore(dealer)
    };

    const weights = {
      performance: 0.4,
      activity: 0.25,
      service: 0.2,
      growth: 0.15
    };

    const totalScore = Object.entries(scores).reduce((sum, [key, score]) => {
      return sum + score * weights[key];
    }, 0);

    return {
      total: Math.round(totalScore),
      breakdown: scores,
      level: this.getHealthLevel(totalScore),
      suggestions: this.generateSuggestions(scores)
    };
  }

  calculatePerformanceScore(dealer) {
    const { gmv, conversionRate, averageOrderValue } = this.kpiMetrics.sales;
    const metrics = dealer.performance;
    
    // GMV评分 (目标: 50万/月)
    const gmvScore = Math.min((metrics.monthlyGMV / 500000) * 100, 100);
    
    // 转化率评分 (行业平均15%, 优秀25%)
    const conversionScore = Math.min((metrics.conversionRate / 25) * 100, 100);
    
    // 客单价评分 (目标: 3万)
    const aovScore = Math.min((metrics.averageOrderValue / 30000) * 100, 100);

    return (gmvScore * gmv.weight + conversionScore * conversionRate.weight + aovScore * averageOrderValue.weight);
  }

  calculateActivityScore(dealer) {
    const activity = dealer.activity || {};
    const { loginFrequency, projectCount, quoteCount } = this.kpiMetrics.activity;
    
    // 登录频次评分 (目标: 5次/周)
    const loginScore = Math.min((activity.weeklyLogins / 5) * 100, 100);
    
    // 方案数评分 (目标: 10个/周)
    const projectScore = Math.min((activity.weeklyProjects / 10) * 100, 100);
    
    // 报价数评分 (目标: 5个/周)
    const quoteScore = Math.min((activity.weeklyQuotes / 5) * 100, 100);

    return (loginScore * loginFrequency.weight + projectScore * projectCount.weight + quoteScore * quoteCount.weight);
  }

  calculateServiceScore(dealer) {
    const service = dealer.service || {};
    const { responseTime, satisfaction, complaintRate } = this.kpiMetrics.service;
    
    // 响应时长评分 (目标: <30分钟)
    const responseScore = Math.max(0, 100 - (service.avgResponseTime / 30) * 100);
    
    // 满意度评分
    const satisfactionScore = service.satisfactionScore || 0;
    
    // 投诉率评分 (目标: <2%)
    const complaintScore = Math.max(0, 100 - (service.complaintRate / 2) * 100);

    return (responseScore * responseTime.weight + satisfactionScore * satisfaction.weight + complaintScore * complaintRate.weight);
  }

  calculateGrowthScore(dealer) {
    const current = dealer.performance.monthlyGMV;
    const previous = dealer.performance.lastMonthGMV || current;
    
    if (previous === 0) return 50; // 默认值
    
    const growthRate = (current - previous) / previous;
    
    // 增长率评分
    if (growthRate > 0.5) return 100;      // 增长50%以上
    if (growthRate > 0.2) return 80;       // 增长20-50%
    if (growthRate > 0) return 60;         // 正增长
    if (growthRate > -0.1) return 40;    // 轻微下滑
    return 20;                            // 大幅下滑
  }

  getHealthLevel(score) {
    if (score >= 90) return '优秀';
    if (score >= 80) return '良好';
    if (score >= 60) return '一般';
    if (score >= 40) return '需关注';
    return '高风险';
  }

  generateSuggestions(scores) {
    const suggestions = [];
    
    if (scores.performance < 60) {
      suggestions.push('建议加强销售培训，提升转化率和客单价');
    }
    if (scores.activity < 60) {
      suggestions.push('系统使用活跃度偏低，建议制定日常使用规范');
    }
    if (scores.service < 60) {
      suggestions.push('客户服务质量待提升，建议优化响应速度');
    }
    if (scores.growth < 60) {
      suggestions.push('业绩增长放缓，建议开展促销活动激活市场');
    }
    
    return suggestions.length > 0 ? suggestions : ['整体表现良好，继续保持！'];
  }

  /**
   * 获取总部仪表盘数据
   */
  getHeadquarterDashboard() {
    return {
      overview: {
        totalGMV: this.calculateTotalGMV(),
        totalDealers: this.getTotalDealerCount(),
        totalOrders: this.getTotalOrderCount(),
        averageHealthScore: this.getAverageHealthScore()
      },
      trends: {
        gmvTrend: this.getGMVTrend('monthly', 12), // 近12个月
        dealerGrowth: this.getDealerGrowthTrend(),
        topProducts: this.getTopProducts(),
        regionalDistribution: this.getRegionalDistribution()
      },
      alerts: this.getSystemAlerts(),
      rankings: {
        topDealers: this.getTopDealers(10),
        fastestGrowing: this.getFastestGrowingDealers(10),
        bestService: this.getBestServiceDealers(10)
      }
    };
  }

  /**
   * 获取区域仪表盘数据
   */
  getRegionDashboard(regionId) {
    const region = this.getDealerById(regionId);
    const subDealers = this.getSubDealers(regionId);
    
    return {
      overview: {
        regionName: region.name,
        gmv: region.performance.monthlyGMV,
        dealerCount: subDealers.length,
        targetAchievement: (region.performance.monthlyGMV / region.target) * 100
      },
      dealerList: subDealers.map(d => ({
        id: d.id,
        name: d.name,
        healthScore: this.calculateHealthScore(d.id).total,
        monthlyGMV: d.performance.monthlyGMV,
        status: d.status
      })),
      resourceAllocation: {
        samples: region.resources?.samples || 0,
        marketingBudget: region.resources?.marketingBudget || 0,
        trainingHours: region.resources?.trainingHours || 0
      }
    };
  }

  /**
   * 获取门店仪表盘数据
   */
  getStoreDashboard(storeId) {
    const store = this.getDealerById(storeId);
    
    return {
      overview: {
        storeName: store.name,
        todayVisits: store.activity?.todayVisits || 0,
        pendingFollowups: store.pendingFollowups || 0,
        monthlyGMV: store.performance.monthlyGMV,
        targetProgress: (store.performance.monthlyGMV / store.target) * 100
      },
      staff: store.staff.map(s => ({
        id: s.id,
        name: s.name,
        role: s.role,
        performance: s.performance,
        activeProjects: s.activeProjects || 0
      })),
      customers: {
        newToday: store.customers?.newToday || 0,
        followupNeeded: store.customers?.followupNeeded || 0,
        quoted: store.customers?.quoted || 0,
        converted: store.customers?.converted || 0
      },
      recentProjects: store.projects?.slice(0, 5) || []
    };
  }

  /**
   * 培训系统接口
   */
  getTrainingProgress(dealerId) {
    const dealer = this.getDealerById(dealerId);
    const completed = dealer.training?.completed || [];
    
    return {
      completed: completed,
      inProgress: dealer.training?.inProgress || [],
      certifications: this.getCertifications(dealerId),
      recommended: this.getRecommendedCourses(dealerId),
      stats: {
        totalHours: completed.reduce((sum, c) => sum + c.duration, 0),
        completionRate: (completed.length / this.trainingSystem.courses.length) * 100,
        certificationLevel: this.getHighestCertification(dealerId)
      }
    };
  }

  getRecommendedCourses(dealerId) {
    const dealer = this.getDealerById(dealerId);
    const completed = dealer.training?.completed || [];
    const completedIds = completed.map(c => c.id);
    
    // 根据当前等级推荐下一级课程
    const currentLevel = this.getHighestCertification(dealerId);
    const targetLevel = currentLevel + 1;
    
    return this.trainingSystem.courses
      .filter(c => c.level === targetLevel && !completedIds.includes(c.id))
      .slice(0, 3);
  }

  // 辅助方法 (简化实现，实际应连接数据库)
  initializeKPI() {
    return {
      monthlyGMV: 0,
      quarterlyGMV: 0,
      yearlyGMV: 0,
      totalOrders: 0,
      activeCustomers: 0,
      conversionRate: 0,
      averageOrderValue: 0
    };
  }

  getDealerById(id) {
    // 实际应从数据库查询
    return null;
  }

  getSubDealers(parentId) {
    // 实际应查询所有parentId匹配的经销商
    return [];
  }

  calculateTotalGMV() {
    return 0; // 实际应汇总所有经销商GMV
  }

  getTotalDealerCount() {
    return 0;
  }

  getTotalOrderCount() {
    return 0;
  }

  getAverageHealthScore() {
    return 0;
  }

  getGMVTrend(period, count) {
    return [];
  }

  getDealerGrowthTrend() {
    return [];
  }

  getTopProducts() {
    return [];
  }

  getRegionalDistribution() {
    return [];
  }

  getSystemAlerts() {
    return [];
  }

  getTopDealers(limit) {
    return [];
  }

  getFastestGrowingDealers(limit) {
    return [];
  }

  getBestServiceDealers(limit) {
    return [];
  }

  getCertifications(dealerId) {
    return [];
  }

  getHighestCertification(dealerId) {
    return 0;
  }
}

module.exports = ChannelManagementEngine;
