/**
 * 销售快速锁客模式 (M4-S) - QuickLockMode
 * 简化操作 + 3D简易效果 + 价值型报价预览
 * 专为销售现场谈单设计
 */

class QuickLockMode {
  constructor() {
    this.sessionTimeout = 30 * 60 * 1000; // 30分钟会话超时
    this.maxSteps = 4; // 4步完成方案
  }

  /**
   * 启动快速锁客流程
   */
  startSession(customerInfo, salesProfile) {
    return {
      sessionId: `QL-${Date.now()}`,
      startTime: new Date().toISOString(),
      customer: customerInfo,
      sales: salesProfile,
      currentStep: 1,
      totalSteps: this.maxSteps,
      status: 'active',
      progress: {
        step1_roomProfile: false,
        step2_painPoints: false,
        step3_solution: false,
        step4_quote: false
      },
      data: {
        roomProfile: null,
        painPoints: null,
        matchedSolution: null,
        quickQuote: null
      }
    };
  }

  /**
   * Step 1: 快速户型档案录入（简化版）
   */
  step1_RoomProfile(session, quickInput) {
    // 极简输入：只需要面积和户型类型
    const roomProfile = {
      area: quickInput.area || 100,
      type: quickInput.type || '平层', // 平层/大平层/叠拼/联排/独栋
      floors: quickInput.floors || 1,
      hasBasement: quickInput.hasBasement || false,
      city: quickInput.city || '北京',
      // 估算值（无需精确测量）
      estimatedBathrooms: Math.ceil(quickInput.area / 40),
      estimatedRooms: Math.ceil(quickInput.area / 30),
      // 快速选择
      keyFeatures: quickInput.keyFeatures || [] // ['西晒', '落地窗', '老人同住', '婴儿']
    };

    session.data.roomProfile = roomProfile;
    session.progress.step1_roomProfile = true;
    session.currentStep = 2;

    return {
      success: true,
      step: 1,
      message: '户型信息已记录',
      nextStep: '痛点快速勾选',
      estimatedTime: '2分钟',
      roomProfile
    };
  }

  /**
   * Step 2: 痛点快速勾选（5大维度标签）
   */
  step2_PainPoints(session, selectedTags) {
    // 简化为5个核心痛点分类，每类最多选2个
    const painPointCategories = {
      temperature: { name: '温度体感', icon: '❄️', maxSelect: 2 },
      hotWater: { name: '热水用水', icon: '💧', maxSelect: 2 },
      humidity: { name: '潮湿空气', icon: '🌊', maxSelect: 2 },
      waterQuality: { name: '水质健康', icon: '💧', maxSelect: 2 },
      hassle: { name: '省心总包', icon: '🏠', maxSelect: 1 }
    };

    const painPoints = {
      selected: selectedTags,
      category: painPointCategories,
      totalCount: selectedTags.length,
      severity: selectedTags.length >= 5 ? 'high' : selectedTags.length >= 3 ? 'medium' : 'low',
      aiSuggestion: this.generateQuickSuggestion(selectedTags, session.data.roomProfile)
    };

    session.data.painPoints = painPoints;
    session.progress.step2_painPoints = true;
    session.currentStep = 3;

    return {
      success: true,
      step: 2,
      message: `已勾选${selectedTags.length}个痛点`,
      nextStep: 'AI匹配方案',
      estimatedTime: '1分钟',
      painPoints,
      aiTip: painPoints.aiSuggestion
    };
  }

  /**
   * Step 3: AI快速匹配方案（简化展示）
   */
  step3_Solution(session, painPointEngine, matchingEngine) {
    const roomProfile = session.data.roomProfile;
    const painPoints = session.data.painPoints;

    // 调用AI引擎
    const diagnosis = painPointEngine.diagnose(roomProfile, painPoints.selected);
    const matchResult = matchingEngine.match(diagnosis, roomProfile);

    // 简化为核心系统展示（最多3个）
    const coreSystems = matchResult.recommendedSystems.slice(0, 3).map(sys => ({
      name: sys.name,
      icon: this.getSystemIcon(sys.name),
      keyBenefit: sys.talkingPoints ? sys.talkingPoints[0] : '解决核心痛点',
      products: sys.products.slice(0, 2) // 只展示2个核心产品
    }));

    const solution = {
      systems: coreSystems,
      coverage: this.calculateCoverage(diagnosis.allTags, matchResult.matchedRules),
      tagline: this.generateTagline(coreSystems, diagnosis),
      visualHint: '点击可查看3D效果图'
    };

    session.data.matchedSolution = solution;
    session.progress.step3_solution = true;
    session.currentStep = 4;

    return {
      success: true,
      step: 3,
      message: 'AI方案匹配完成',
      nextStep: '价值型报价',
      estimatedTime: '3分钟',
      solution,
      diagnosis: {
        totalPainPoints: diagnosis.allTags.length,
        ownerProfile: diagnosis.ownerProfile
      }
    };
  }

  /**
   * Step 4: 价值型报价预览（简化版）
   */
  step4_QuickQuote(session, matchingEngine) {
    const solution = session.data.matchedSolution;
    const roomProfile = session.data.roomProfile;

    // 快速估价（基于面积和系统数量）
    const basePricePerSqm = 800; // 基础单价
    const systemMultiplier = solution.systems.length;
    const area = roomProfile.area;

    const quickQuote = {
      area,
      systems: solution.systems.map(sys => ({
        name: sys.name,
        solvesPainPoint: sys.keyBenefit,
        priceRange: this.estimateSystemPrice(sys.name, area),
        valuePoint: this.getValuePoint(sys.name)
      })),
      totalEstimate: {
        min: Math.round(area * basePricePerSqm * systemMultiplier * 0.8),
        max: Math.round(area * basePricePerSqm * systemMultiplier * 1.2),
        reference: Math.round(area * basePricePerSqm * systemMultiplier)
      },
      promotions: [
        { name: '全屋总包优惠', discount: '立减5000元' },
        { name: '老客户推荐', discount: '额外95折' }
      ],
      financing: {
        available: true,
        monthlyPayment: Math.round(area * basePricePerSqm * systemMultiplier / 24), // 24期
        note: '支持24期免息分期'
      },
      validity: '7天内有效',
      nextStep: '预约上门量房'
    };

    session.data.quickQuote = quickQuote;
    session.progress.step4_quote = true;
    session.status = 'completed';

    return {
      success: true,
      step: 4,
      message: '报价生成完成',
      complete: true,
      totalTime: '8分钟',
      quickQuote,
      lockActions: [
        { name: '保存方案', action: 'save' },
        { name: '分享客户', action: 'share' },
        { name: '预约量房', action: 'book' }
      ]
    };
  }

  /**
   * 生成3D简易效果图（简化渲染）
   */
  generateQuick3D(session, renderer3D) {
    const roomProfile = session.data.roomProfile;
    const solution = session.data.matchedSolution;

    // 简化3D场景生成（快速预览版）
    const quickScene = {
      type: 'quick_preview',
      layout: 'bird_view', // 鸟瞰图
      roomOutline: this.generateRoomOutline(roomProfile),
      devices: solution.systems.flatMap(sys => 
        this.simplifiedDeviceLayout(sys, roomProfile)
      ),
      highlights: solution.systems.map(sys => ({
        name: sys.name,
        position: 'center',
        benefit: sys.keyBenefit
      })),
      renderSettings: {
        quality: 'standard',
        time: '5秒内生成',
        style: 'clean_white'
      }
    };

    return {
      scene: quickScene,
      views: [
        { name: '鸟瞰图', type: 'bird', description: '全屋设备布局一览' },
        { name: '客厅视角', type: 'living', description: '核心设备展示' }
      ],
      interactive: false, // 简化版不支持交互
      note: '此为简化预览图，签约后提供高清效果图'
    };
  }

  /**
   * 生成AI建议
   */
  generateQuickSuggestion(selectedTags, roomProfile) {
    const suggestions = [];

    if (selectedTags.length === 0) {
      suggestions.push('💡 根据户型面积，建议关注热水和空调系统');
    }

    if (roomProfile.area > 120 && !selectedTags.some(t => t.includes('热水'))) {
      suggestions.push('💡 大户型建议考虑中央热水系统，解决多点用水问题');
    }

    if (selectedTags.some(t => t.includes('老人') || t.includes('婴儿'))) {
      suggestions.push('💡 有老人/婴儿家庭，建议五恒系统，无风感更舒适');
    }

    return suggestions;
  }

  /**
   * 获取系统图标
   */
  getSystemIcon(systemName) {
    const icons = {
      '中央热水系统': '💧',
      '五恒恒温系统': '🌡️',
      '新风除湿系统': '🍃',
      '全屋净水系统': '💧',
      '中央空调系统': '❄️',
      '瑞美全屋总包方案': '🏠'
    };
    return icons[systemName] || '✨';
  }

  /**
   * 计算痛点覆盖率
   */
  calculateCoverage(allTags, matchedRules) {
    const solvedTags = new Set();
    for (const rule of matchedRules) {
      // 简化逻辑
      allTags.forEach(tag => solvedTags.add(tag.id));
    }
    return Math.round((solvedTags.size / allTags.length) * 100);
  }

  /**
   * 生成Slogan
   */
  generateTagline(systems, diagnosis) {
    const systemNames = systems.map(s => s.name).join('、');
    const painCount = diagnosis.allTags.length;
    
    return `「${systemNames}」联动方案，一站式解决${painCount}大居住痛点`;
  }

  /**
   * 估算系统价格
   */
  estimateSystemPrice(systemName, area) {
    const basePrices = {
      '中央热水系统': { min: 12000, max: 20000 },
      '五恒恒温系统': { min: 30000, max: 50000 },
      '新风除湿系统': { min: 8000, max: 15000 },
      '全屋净水系统': { min: 10000, max: 18000 },
      '中央空调系统': { min: 20000, max: 40000 },
      '瑞美全屋总包方案': { min: 50000, max: 100000 }
    };
    
    return basePrices[systemName] || { min: 10000, max: 20000 };
  }

  /**
   * 获取价值点
   */
  getValuePoint(systemName) {
    const points = {
      '中央热水系统': '即开即热，全屋零冷水',
      '五恒恒温系统': '无风感，四季恒温舒适',
      '新风除湿系统': '24小时新鲜干爽空气',
      '全屋净水系统': '从入户到入口全程净化',
      '中央空调系统': '隐藏安装，美观省空间',
      '瑞美全屋总包方案': '一站式解决，省心省力'
    };
    return points[systemName] || '提升居住品质';
  }

  /**
   * 生成房间轮廓
   */
  generateRoomOutline(roomProfile) {
    // 简化房间轮廓
    const area = roomProfile.area;
    const width = Math.sqrt(area * 1.2); // 近似长方形
    const length = area / width;
    
    return {
      width: Math.round(width),
      length: Math.round(length),
      rooms: Math.ceil(area / 30),
      style: 'simple_outline'
    };
  }

  /**
   * 简化设备布局
   */
  simplifiedDeviceLayout(system, roomProfile) {
    // 返回简化版设备位置
    return system.products.map((product, index) => ({
      name: product,
      system: system.name,
      position: index === 0 ? 'center' : 'corner',
      size: 'medium'
    }));
  }

  /**
   * 导出会话数据（用于转设计师精细化模式）
   */
  exportSession(session) {
    return {
      sessionId: session.sessionId,
      exportTime: new Date().toISOString(),
      data: session.data,
      progress: session.progress,
      transferable: true,
      note: '可一键导入设计师精细化模式，继续完善方案'
    };
  }
}

module.exports = QuickLockMode;
