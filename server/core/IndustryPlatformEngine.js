/**
 * 【Phase 3进化】IndustryPlatformEngine v1.0
 * 产业互联网平台引擎 - 连接设计-产品-服务全链条
 * 
 * 功能:
 * - 设计师平台 (认证/评级/派单)
 * - 安装商网络 (资质/调度/评价)
 * - 供应商协同 (库存/价格/交付)
 * - 数据智能服务 (趋势分析/需求洞察)
 */

class IndustryPlatformEngine {
  constructor() {
    this.version = '1.0';
    
    // 平台角色定义
    this.platformRoles = {
      designer: {
        name: '设计师',
        certifications: ['初级', '中级', '高级', '专家'],
        services: ['方案设计', '图纸深化', '现场交底', '调试验收'],
        commissionRate: 0.05 // 5%设计费
      },
      installer: {
        name: '安装商',
        qualifications: ['普通', '铜牌', '银牌', '金牌', '钻石'],
        serviceTypes: ['水系统', '电系统', '风系统', '全系统'],
        warrantyPeriod: [1, 2, 3, 5, 8] // 年
      },
      supplier: {
        name: '供应商',
        categories: ['主机', '管材', '风阀', '控制', '辅材'],
        cooperationModes: ['直供', '代销', '联营']
      }
    };

    // 派单匹配算法权重
    this.matchingWeights = {
      distance: 0.25,      // 距离权重
      rating: 0.25,      // 评分权重
      workload: 0.2,     // 工作负荷权重
      price: 0.15,       // 价格权重
      history: 0.15      // 合作历史权重
    };

    // 数据智能模型
    this.dataIntelligence = {
      trendAnalysis: null,
      demandPrediction: null,
      priceOptimization: null
    };
  }

  // ==================== 设计师平台 ====================

  /**
   * 设计师注册认证
   */
  registerDesigner(designerInfo) {
    const { name, phone, certificates, portfolio, experience, serviceArea } = designerInfo;
    
    // 资质验证
    const validation = this.validateDesignerCertificates(certificates);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const designer = {
      id: `DS${Date.now()}`,
      name,
      phone,
      status: 'pending', // pending/approved/rejected
      certificates,
      portfolio: portfolio || [],
      experience: experience || 0,
      serviceArea: serviceArea || [],
      
      // 评级体系
      rating: {
        overall: 0,
        design: 0,
        service: 0,
        punctuality: 0,
        reviewCount: 0
      },
      
      // 能力图谱
      capabilities: {
        waterSystem: 0,    // 水系统 0-100
        airSystem: 0,      // 风系统
        fiveConstant: 0,   // 五恒系统
        smartControl: 0,   // 智能控制
        complexLayout: 0   // 复杂户型
      },
      
      // 业务数据
      stats: {
        totalProjects: 0,
        completedProjects: 0,
        totalGMV: 0,
        monthlyGMV: 0,
        customerSatisfaction: 0
      },
      
      // 派单相关
      availability: true,
      currentWorkload: 0,  // 当前项目数
      maxWorkload: 10,     // 最大负荷
      preferredProjectTypes: [],
      
      createdAt: new Date()
    };

    return { success: true, designer };
  }

  validateDesignerCertificates(certificates) {
    const required = ['身份证', '学历证明'];
    const optional = ['暖通工程师证', '设计师资格证', '瑞美认证'];
    
    for (const cert of required) {
      if (!certificates.includes(cert)) {
        return { valid: false, error: `缺少必需资质: ${cert}` };
      }
    }
    
    return { valid: true };
  }

  /**
   * 设计师评级计算
   */
  calculateDesignerRating(designerId) {
    const designer = this.getDesignerById(designerId);
    if (!designer) return null;

    const stats = designer.stats;
    const reviews = this.getDesignerReviews(designerId);
    
    // 完成率评分 (权重30%)
    const completionRate = stats.totalProjects > 0 
      ? (stats.completedProjects / stats.totalProjects) * 100 
      : 0;
    
    // 客户满意度评分 (权重40%)
    const satisfactionScore = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;
    
    // 专业能力评分 (权重20%)
    const capabilityScore = Object.values(designer.capabilities)
      .reduce((sum, val) => sum + val, 0) / 5;
    
    // 活跃度评分 (权重10%)
    const activityScore = Math.min((stats.monthlyGMV / 50000) * 100, 100);

    const overall = (
      completionRate * 0.3 +
      satisfactionScore * 0.4 +
      capabilityScore * 0.2 +
      activityScore * 0.1
    );

    // 确定等级
    let level = '初级';
    if (overall >= 90) level = '专家';
    else if (overall >= 80) level = '高级';
    else if (overall >= 70) level = '中级';

    return {
      overall: Math.round(overall),
      breakdown: {
        completion: Math.round(completionRate),
        satisfaction: Math.round(satisfactionScore),
        capability: Math.round(capabilityScore),
        activity: Math.round(activityScore)
      },
      level,
      reviewCount: reviews.length
    };
  }

  /**
   * 智能派单匹配
   */
  matchDesignerToProject(projectRequirements) {
    const { 
      location,           // 项目位置
      systemType,         // 系统类型
      projectScale,       // 项目规模
      budgetLevel,        // 预算等级
      timeline,           // 时间要求
      preferredLevel      // 期望设计师等级
    } = projectRequirements;

    // 获取可用设计师
    const availableDesigners = this.getAvailableDesigners(location);
    
    // 计算匹配分数
    const scoredDesigners = availableDesigners.map(designer => {
      const score = this.calculateMatchScore(designer, projectRequirements);
      return { designer, score };
    });

    // 排序并返回前3名
    scoredDesigners.sort((a, b) => b.score - a.score);
    
    return scoredDesigners.slice(0, 3).map((item, index) => ({
      rank: index + 1,
      designerId: item.designer.id,
      name: item.designer.name,
      score: Math.round(item.score),
      level: item.designer.rating.level,
      estimatedPrice: this.estimateDesignFee(item.designer, projectScale),
      availability: item.designer.availability ? '可接单' : '忙碌中'
    }));
  }

  calculateMatchScore(designer, requirements) {
    let score = 0;
    const weights = this.matchingWeights;

    // 距离评分 (25%)
    const distance = this.calculateDistance(designer.serviceArea, requirements.location);
    const distanceScore = Math.max(0, 100 - distance * 10); // 每10km减10分
    score += distanceScore * weights.distance;

    // 评分评分 (25%)
    const ratingScore = designer.rating.overall;
    score += ratingScore * weights.rating;

    // 工作负荷评分 (20%)
    const workloadScore = (1 - designer.currentWorkload / designer.maxWorkload) * 100;
    score += workloadScore * weights.workload;

    // 价格评分 (15%)
    const estimatedPrice = this.estimateDesignFee(designer, requirements.projectScale);
    const marketAverage = this.getMarketAverageDesignFee(requirements.projectScale);
    const priceScore = Math.max(0, 100 - Math.abs(estimatedPrice - marketAverage) / marketAverage * 100);
    score += priceScore * weights.price;

    // 专业匹配度 (隐含在历史合作中)
    const capabilityScore = this.calculateCapabilityMatch(designer, requirements.systemType);
    score += capabilityScore * weights.history;

    return score;
  }

  estimateDesignFee(designer, projectScale) {
    const baseRate = 50; // 50元/平米基础设计费
    const levelMultiplier = {
      '初级': 0.8,
      '中级': 1.0,
      '高级': 1.3,
      '专家': 1.8
    };
    
    return baseRate * projectScale * (levelMultiplier[designer.rating.level] || 1);
  }

  // ==================== 安装商网络 ====================

  /**
   * 安装商注册
   */
  registerInstaller(installerInfo) {
    const { 
      companyName, 
      contact, 
      businessLicense,
      qualifications,
      serviceArea,
      teamSize,
      equipment 
    } = installerInfo;

    const installer = {
      id: `IN${Date.now()}`,
      companyName,
      contact,
      status: 'pending',
      
      // 资质
      businessLicense,
      qualifications: qualifications || [], // 特种作业证等
      certificationLevel: '普通', // 普通/铜牌/银牌/金牌/钻石
      
      // 服务能力
      serviceArea: serviceArea || [],
      teamSize: teamSize || 0,
      equipment: equipment || [],
      serviceTypes: ['水系统'], // 逐步扩展
      
      // 评级
      rating: {
        overall: 0,
        quality: 0,
        punctuality: 0,
        service: 0,
        safety: 0,
        reviewCount: 0
      },
      
      // 业务统计
      stats: {
        totalProjects: 0,
        completedProjects: 0,
        totalRevenue: 0,
        warrantyClaims: 0,    // 保修索赔次数
        complaintCount: 0     // 投诉次数
      },
      
      // 调度相关
      availability: true,
      currentProjects: 0,
      maxCapacity: Math.max(5, teamSize * 2), // 估算容量
      
      createdAt: new Date()
    };

    return { success: true, installer };
  }

  /**
   * 安装商智能调度
   */
  scheduleInstallation(project, constraints = {}) {
    const { 
      location,
      systemType,
      projectScale,
      requiredDate,
      preferredLevel
    } = project;

    // 获取可用安装商
    const availableInstallers = this.getAvailableInstallers(location, systemType);
    
    // 评分排序
    const scoredInstallers = availableInstallers.map(installer => ({
      installer,
      score: this.calculateInstallerScore(installer, project),
      estimatedSchedule: this.estimateSchedule(installer, requiredDate)
    }));

    scoredInstallers.sort((a, b) => b.score - a.score);

    // 返回推荐方案
    return {
      recommendations: scoredInstallers.slice(0, 3).map((item, index) => ({
        rank: index + 1,
        installerId: item.installer.id,
        companyName: item.installer.companyName,
        score: Math.round(item.score),
        level: item.installer.certificationLevel,
        estimatedStart: item.estimatedSchedule.startDate,
        estimatedDuration: item.estimatedSchedule.duration,
        estimatedPrice: this.estimateInstallationFee(item.installer, projectScale),
        warranty: item.installer.certificationLevel === '钻石' ? 8 : 
                  item.installer.certificationLevel === '金牌' ? 5 : 3
      })),
      alternative: scoredInstallers.length > 3 ? {
        message: `还有${scoredInstallers.length - 3}家安装商可选`,
        viewMore: true
      } : null
    };
  }

  calculateInstallerScore(installer, project) {
    let score = 0;

    // 评级权重 (30%)
    const levelScores = { '普通': 60, '铜牌': 70, '银牌': 80, '金牌': 90, '钻石': 100 };
    score += (levelScores[installer.certificationLevel] || 60) * 0.3;

    // 评分权重 (30%)
    score += installer.rating.overall * 0.3;

    // 距离权重 (20%)
    const distance = this.calculateDistance(installer.serviceArea, project.location);
    score += Math.max(0, 100 - distance * 5) * 0.2;

    // 负荷权重 (20%)
    const capacityScore = (1 - installer.currentProjects / installer.maxCapacity) * 100;
    score += capacityScore * 0.2;

    return score;
  }

  // ==================== 供应商协同 ====================

  /**
   * 供应商注册
   */
  registerSupplier(supplierInfo) {
    const { companyName, category, products, cooperationMode, deliveryCapability } = supplierInfo;

    const supplier = {
      id: `SP${Date.now()}`,
      companyName,
      category, // 主机/管材/风阀/控制/辅材
      status: 'pending',
      
      // 产品
      products: products || [],
      priceList: {}, // 实时价格表
      
      // 合作模式
      cooperationMode: cooperationMode || '直供', // 直供/代销/联营
      
      // 交付能力
      deliveryCapability: {
        normalLeadTime: deliveryCapability?.normalLeadTime || 7, // 天
        emergencyLeadTime: deliveryCapability?.emergencyLeadTime || 3,
        minOrderQuantity: deliveryCapability?.minOrderQuantity || 1,
        maxMonthlySupply: deliveryCapability?.maxMonthlySupply || 1000
      },
      
      // 库存
      inventory: {},
      
      // 评级
      rating: {
        quality: 0,
        delivery: 0,
        price: 0,
        service: 0,
        overall: 0
      },
      
      createdAt: new Date()
    };

    return { success: true, supplier };
  }

  /**
   * 智能采购建议
   */
  generateProcurementAdvice(projectRequirements) {
    // 根据方案生成物料清单
    const materialList = this.generateMaterialList(projectRequirements);
    
    // 为每种材料匹配最佳供应商
    const procurementPlan = materialList.map(material => {
      const suppliers = this.getSuppliersForMaterial(material.category);
      const recommended = this.selectBestSupplier(suppliers, material);
      
      return {
        material,
        recommendedSupplier: recommended,
        alternatives: suppliers.slice(1, 4), // 备选3家
        estimatedDelivery: recommended?.deliveryCapability?.normalLeadTime || 7,
        totalCost: material.quantity * (recommended?.priceList[material.spec] || 0)
      };
    });

    return {
      plan: procurementPlan,
      totalCost: procurementPlan.reduce((sum, p) => sum + p.totalCost, 0),
      estimatedDelivery: Math.max(...procurementPlan.map(p => p.estimatedDelivery)),
      riskAssessment: this.assessProcurementRisk(procurementPlan)
    };
  }

  // ==================== 数据智能服务 ====================

  /**
   * 行业趋势分析
   */
  analyzeIndustryTrends(region = 'national', period = '12m') {
    // 模拟数据分析
    return {
      marketSize: {
        total: 150000000000, // 1500亿
        growth: 0.12,        // 12%增长
        forecast: 180000000000 // 明年预测
      },
      
      productTrends: [
        { system: '五恒系统', growth: 0.35, share: 0.15 },
        { system: '热泵系统', growth: 0.28, share: 0.22 },
        { system: '中央热水', growth: 0.15, share: 0.35 },
        { system: '全屋净水', growth: 0.20, share: 0.18 },
        { system: '智能控制', growth: 0.45, share: 0.10 }
      ],
      
      regionalHotspots: [
        { region: '长三角', growth: 0.15, avgOrderValue: 85000 },
        { region: '珠三角', growth: 0.18, avgOrderValue: 92000 },
        { region: '京津冀', growth: 0.10, avgOrderValue: 78000 },
        { region: '成渝', growth: 0.22, avgOrderValue: 65000 }
      ],
      
      customerPreferences: {
        budgetDistribution: {
          '5万以下': 0.15,
          '5-10万': 0.35,
          '10-20万': 0.32,
          '20万以上': 0.18
        },
        painPointPriority: [
          { painPoint: '热水等待', frequency: 0.42 },
          { painPoint: '温度不均', frequency: 0.38 },
          { painPoint: '空气质量', frequency: 0.35 },
          { painPoint: '能耗过高', frequency: 0.28 }
        ]
      }
    };
  }

  /**
   * 需求预测
   */
  predictDemand(region, season = null) {
    const currentMonth = new Date().getMonth();
    const isHeatingSeason = currentMonth >= 10 || currentMonth <= 2;
    const isCoolingSeason = currentMonth >= 5 && currentMonth <= 8;
    
    return {
      season: isHeatingSeason ? '采暖季' : isCoolingSeason ? '制冷季' : '过渡期',
      
      predictedDemand: {
        heatingSystem: isHeatingSeason ? 2.5 : 0.6, // 采暖季需求是平时的2.5倍
        coolingSystem: isCoolingSeason ? 2.2 : 0.5,
        hotWater: 1.0, // 全年稳定
        freshAir: 1.2  // 略高
      },
      
      priceForecast: {
        trend: isHeatingSeason ? 'upward' : 'stable',
        estimatedChange: isHeatingSeason ? 0.08 : 0.02,
        recommendation: isHeatingSeason 
          ? '建议提前备货，采暖季价格可能上涨8%' 
          : '价格稳定，可正常采购'
      },
      
      inventoryAdvice: {
        safetyStock: isHeatingSeason ? 1.5 : 1.0, // 安全库存倍数
        keyProducts: isHeatingSeason 
          ? ['壁挂炉', '地暖管', '分水器'] 
          : ['热泵主机', '风机盘管', '新风设备']
      }
    };
  }

  /**
   * 生成区域策略建议
   */
  generateRegionalStrategy(regionData) {
    const { region, currentShare, competitorShare, marketCharacteristics } = regionData;
    
    const strategies = [];
    
    // 份额分析
    if (currentShare < 0.15) {
      strategies.push({
        type: 'expansion',
        title: '渠道扩张',
        actions: ['增加经销商覆盖', '开设体验店', '加强小区推广'],
        expectedImpact: '+5%市场份额'
      });
    }
    
    // 竞品分析
    if (competitorShare.daikin > 0.3) {
      strategies.push({
        type: 'differentiation',
        title: '差异化竞争',
        actions: ['强化热水优势', '推广五恒系统', '突出服务品质'],
        expectedImpact: '提升品牌认知度20%'
      });
    }
    
    // 市场特征适配
    if (marketCharacteristics.avgBudget < 80000) {
      strategies.push({
        type: 'product',
        title: '产品策略调整',
        actions: ['推出性价比套餐', '分期付款方案', '老房改造专项'],
        expectedImpact: '转化率提升15%'
      });
    }

    return {
      region,
      currentSituation: {
        ourShare: currentShare,
        competitorShare,
        marketCharacteristics
      },
      recommendedStrategies: strategies,
      priority: strategies.length > 0 ? strategies[0] : null
    };
  }

  // ==================== 辅助方法 ====================

  getDesignerById(id) {
    // 实际应从数据库查询
    return null;
  }

  getAvailableDesigners(location) {
    return [];
  }

  getDesignerReviews(designerId) {
    return [];
  }

  getAvailableInstallers(location, systemType) {
    return [];
  }

  getSuppliersForMaterial(category) {
    return [];
  }

  selectBestSupplier(suppliers, material) {
    return suppliers[0] || null;
  }

  calculateDistance(area1, area2) {
    // 实际应计算地理距离
    return 0;
  }

  calculateCapabilityMatch(designer, systemType) {
    const capabilityMap = {
      '水系统': 'waterSystem',
      '风系统': 'airSystem',
      '五恒系统': 'fiveConstant',
      '智能控制': 'smartControl'
    };
    
    const capability = capabilityMap[systemType];
    return capability ? designer.capabilities[capability] : 50;
  }

  estimateSchedule(installer, requiredDate) {
    return {
      startDate: requiredDate,
      duration: 7 // 默认7天
    };
  }

  estimateInstallationFee(installer, projectScale) {
    return projectScale * 150; // 150元/平米基础安装费
  }

  getMarketAverageDesignFee(projectScale) {
    return projectScale * 50;
  }

  generateMaterialList(projectRequirements) {
    return [];
  }

  assessProcurementRisk(procurementPlan) {
    return {
      level: 'low',
      factors: []
    };
  }
}

module.exports = IndustryPlatformEngine;
