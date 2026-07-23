/**
 * 痛点-方案-产品匹配引擎 (M3) - PainPointMatchingEngine
 * tag匹配规则 + 强制推荐逻辑
 */

class PainPointMatchingEngine {
  constructor() {
    // 匹配规则库
    this.matchingRules = [
      {
        id: 'rule_001',
        name: '热水痛点强制匹配',
        condition: { tagCategory: '热水用水痛点', minCount: 2 },
        action: {
          forceRecommend: true,
          system: '中央热水系统',
          brand: '恒热EVERHOT',
          products: ['恒热EVERHOT-150L', '恒热EVERHOT-200L'],
          explanation: '检测到${count}个热水痛点，强制推荐恒热中央热水+全屋循环方案',
          talkingPoints: [
            '恒热EVERHOT中央热水，热水即开即来，无需等待',
            '全屋循环设计，远端卫生间也能秒出热水',
            '大容量储水，浴缸也能一次性放满',
            '一台机器解决全屋热水，节省阳台空间'
          ]
        }
      },
      {
        id: 'rule_002',
        name: '老人/婴儿舒适度匹配',
        condition: { 
          orTags: ['老人常住', '母婴/幼童', '空调直吹难受'],
          minCount: 1 
        },
        action: {
          forceRecommend: true,
          system: '五恒恒温系统',
          products: ['五恒主机', '毛细管网', '地暖系统', 'Econet智能温控'],
          explanation: '检测到老人/婴儿同住或怕吹风痛点，推荐五恒恒温+分区控制',
          talkingPoints: [
            '五恒系统无风感制冷，告别空调直吹',
            '恒温恒湿，温度均匀无温差',
            '地暖+顶冷，脚暖头凉，老人关节更舒适',
            'Econet智能分区，不同房间可独立调温'
          ]
        }
      },
      {
        id: 'rule_003',
        name: '潮湿/地下室强制匹配',
        condition: { 
          orTags: ['地下室返潮', '梅雨季发霉', '潮湿阴冷'],
          minCount: 1 
        },
        action: {
          forceRecommend: true,
          system: '新风除湿系统',
          products: ['全热交换新风机', '中央除湿机', '地下室专用除湿'],
          explanation: '检测到潮湿相关痛点，强制绑定新风+全屋除湿',
          talkingPoints: [
            '全热交换新风，除湿不降温',
            '地下室专用除湿，告别发霉返潮',
            '24小时自动除湿，湿度恒定在50%左右',
            '梅雨季也能保持干爽舒适'
          ]
        }
      },
      {
        id: 'rule_004',
        name: '水质痛点强制匹配',
        condition: { tagCategory: '水质健康痛点', minCount: 2 },
        action: {
          forceRecommend: true,
          system: '全屋净水系统',
          products: ['前置过滤器', '中央净水机', '中央软水机', 'RO直饮机'],
          explanation: '检测到${count}个水质痛点，自动生成三级梯级净水方案',
          talkingPoints: [
            '三级梯级净水，从入户到入口全程净化',
            '前置过滤+中央净水，去除泥沙铁锈',
            '中央软水机，解决水垢问题，花洒不再堵塞',
            'RO直饮机，母婴直饮标准，喝水更安心'
          ]
        }
      },
      {
        id: 'rule_005',
        name: '省心总包强制匹配',
        condition: { 
          orTags: ['不想对接多品牌', '怕增项超预算', '怕管路设计出错'],
          minCount: 1 
        },
        action: {
          forceRecommend: true,
          system: '瑞美全屋总包方案',
          products: ['六系统全套', '统一施工', 'Econet智能控制', '整体质保'],
          explanation: '检测到省心需求，输出瑞美六系统全屋一体化总包方案',
          talkingPoints: [
            '瑞美六系统一站式解决，无需对接多品牌',
            '统一设计施工，管路不冲突，避免返工',
            '一口价包干，无增项超预算风险',
            '整体质保，售后一个电话全解决'
          ]
        }
      },
      {
        id: 'rule_006',
        name: '大户型中央空调匹配',
        condition: { roomCondition: 'area', minValue: 120 },
        action: {
          recommend: true,
          system: '中央空调系统',
          products: ['RHEEM多联机', '风管机'],
          explanation: '大户型推荐中央空调，美观省空间',
          talkingPoints: [
            '隐藏式安装，不占用室内空间',
            '一台外机带动全屋，阳台更整洁',
            '分区控制，不同房间独立调温',
            'RHEEM一级能效，省电40%'
          ]
        }
      }
    ];

    // 产品库
    this.productDatabase = {
      '恒热EVERHOT-150L': {
        brand: '恒热',
        model: 'EVERHOT-150L',
        category: '中央热水',
        price: 12800,
        specs: { capacity: 150, power: 3, recoveryRate: '120L/h' },
        applicableScenarios: ['3-4人家庭', '2-3个卫生间'],
        solvesPainPoints: ['远端冷水等待', '多点用水波动', '电热水器不够用']
      },
      '恒热EVERHOT-200L': {
        brand: '恒热',
        model: 'EVERHOT-200L',
        category: '中央热水',
        price: 15800,
        specs: { capacity: 200, power: 3, recoveryRate: '150L/h' },
        applicableScenarios: ['4-6人家庭', '3-4个卫生间', '有浴缸'],
        solvesPainPoints: ['浴缸放不满', '大流量需求', '大家庭热水供应']
      },
      '五恒主机': {
        brand: '瑞美',
        model: 'RHEEM-5H-120',
        category: '五恒系统',
        price: 35000,
        specs: { cooling: 12, heating: 14, coverage: '100-130㎡' },
        applicableScenarios: ['高端住宅', '老人/婴儿家庭', '怕吹风人群'],
        solvesPainPoints: ['空调直吹', '温差大', '干燥', '老人舒适度']
      },
      'RHEEM多联机': {
        brand: '瑞美',
        model: 'RHEEM-VRF-160',
        category: '中央空调',
        price: 28000,
        specs: { cooling: 16, cop: 4.2, indoorUnits: 5 },
        applicableScenarios: ['120㎡以上大户型', '多房间同时制冷'],
        solvesPainPoints: ['分体机占空间', '多台外机不美观', '高电费']
      }
    };
  }

  /**
   * 执行匹配引擎
   */
  match(painPointDiagnosis, roomProfile) {
    // 安全默认值：painPointDiagnosis 可能形如 {painPoints:[...]} 或 {selectedTags:[...]} 或 {allTags:[...]}
    painPointDiagnosis = painPointDiagnosis || {};
    if (!Array.isArray(painPointDiagnosis.painPoints))   painPointDiagnosis.painPoints   = [];
    if (!Array.isArray(painPointDiagnosis.selectedTags)) painPointDiagnosis.selectedTags = [];
    if (!Array.isArray(painPointDiagnosis.allTags)) {
      // 从 painPoints / selectedTags 推导 allTags（避免下游 .filter 崩溃）
      const fromPP = painPointDiagnosis.painPoints.map(p =>
        typeof p === 'string' ? { id: p, name: p, category: 'general' } : p);
      const fromST = painPointDiagnosis.selectedTags.map(t =>
        typeof t === 'string' ? { id: t, name: t, category: 'general' } : t);
      painPointDiagnosis.allTags = [...fromPP, ...fromST];
    }
    roomProfile = Object.assign({ area: 100, city: '上海', houseType: '三居', budget: 80000 }, roomProfile || {});

    const result = {
      timestamp: new Date().toISOString(),
      input: { painPoints: painPointDiagnosis, room: roomProfile },
      matchedRules: [],
      recommendedSystems: [],
      productPackages: [],
      totalEstimate: 0,
      explanation: '',
      talkingPoints: [],
      visualMap: null
    };

    // 1. 评估所有匹配规则
    for (const rule of this.matchingRules) {
      const matchResult = this.evaluateRule(rule, painPointDiagnosis, roomProfile);
      if (matchResult.matched) {
        result.matchedRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          confidence: matchResult.confidence,
          action: rule.action
        });
      }
    }

    // 2. 生成推荐系统列表（去重+排序）
    result.recommendedSystems = this.generateSystemRecommendations(result.matchedRules);

    // 3. 生成产品包
    result.productPackages = this.generateProductPackages(result.recommendedSystems, roomProfile);

    // 4. 计算总价估算
    result.totalEstimate = this.calculateTotalEstimate(result.productPackages);

    // 5. 生成讲解话术
    result.talkingPoints = this.generateTalkingPoints(result.matchedRules, result.recommendedSystems);

    // 6. 生成可视化映射图
    result.visualMap = this.generateVisualMap(painPointDiagnosis, result.recommendedSystems);

    return result;
  }

  /**
   * 评估单条规则
   */
  evaluateRule(rule, diagnosis, room) {
    const condition = rule.condition;
    let matched = false;
    let confidence = 0;

    // 根据痛点分类匹配
    if (condition.tagCategory) {
      const categoryTags = diagnosis.allTags.filter(t => t.category === condition.tagCategory);
      if (categoryTags.length >= condition.minCount) {
        matched = true;
        confidence = Math.min(1.0, categoryTags.length / condition.minCount * 0.8 + 0.2);
      }
    }

    // 根据具体标签匹配
    if (condition.orTags) {
      const matchedTags = diagnosis.allTags.filter(t => 
        condition.orTags.some(tagName => t.name.includes(tagName) || t.id.includes(tagName))
      );
      if (matchedTags.length >= condition.minCount) {
        matched = true;
        confidence = Math.min(1.0, matchedTags.length / condition.minCount * 0.8 + 0.2);
      }
    }

    // 根据户型条件匹配
    if (condition.roomCondition) {
      const roomValue = room[condition.roomCondition];
      if (roomValue >= condition.minValue) {
        matched = true;
        confidence = Math.min(1.0, roomValue / condition.minValue * 0.5 + 0.5);
      }
    }

    return { matched, confidence };
  }

  /**
   * 生成系统推荐列表
   */
  generateSystemRecommendations(matchedRules) {
    const systems = new Map();

    // 按匹配规则生成推荐
    for (const match of matchedRules) {
      const action = match.action;
      const key = action.system;
      
      if (!systems.has(key)) {
        systems.set(key, {
          name: action.system,
          forceRecommend: action.forceRecommend || false,
          confidence: match.confidence,
          products: action.products,
          explanation: action.explanation,
          talkingPoints: action.talkingPoints,
          priority: action.forceRecommend ? 1 : 2
        });
      }
    }

    // 转换为数组并排序（强制推荐优先）
    return Array.from(systems.values())
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * 生成产品包
   */
  generateProductPackages(systems, room) {
    const packages = [];

    for (const system of systems) {
      const products = [];
      let subtotal = 0;

      for (const productKey of system.products) {
        const product = this.productDatabase[productKey];
        if (product) {
          // 根据户型调整数量和规格
          const quantity = this.calculateQuantity(product, room);
          const itemTotal = product.price * quantity;
          
          products.push({
            ...product,
            quantity,
            itemTotal
          });
          subtotal += itemTotal;
        }
      }

      packages.push({
        system: system.name,
        products,
        subtotal,
        solvesPainPoints: system.explanation
      });
    }

    return packages;
  }

  /**
   * 计算产品数量
   */
  calculateQuantity(product, room) {
    if (product.category === '中央空调') {
      return Math.ceil(room.area / 30); // 每30㎡一个室内机
    }
    if (product.category === '中央热水') {
      return 1; // 一套热水系统
    }
    if (product.category === '五恒系统') {
      return Math.ceil(room.area / 120); // 每120㎡一套主机
    }
    return 1;
  }

  /**
   * 计算总价估算
   */
  calculateTotalEstimate(packages) {
    const baseTotal = packages.reduce((sum, pkg) => sum + pkg.subtotal, 0);
    const installationFee = baseTotal * 0.15; // 安装费15%
    const designFee = baseTotal * 0.05; // 设计费5%
    return Math.round(baseTotal + installationFee + designFee);
  }

  /**
   * 生成讲解话术
   */
  generateTalkingPoints(matchedRules, systems) {
    const points = [];
    
    // 开场话术
    points.push({
      stage: '开场',
      content: '根据您家的户型和痛点，我们的AI系统为您匹配了专属舒适家居方案'
    });

    // 痛点对应话术
    for (const match of matchedRules) {
      points.push({
        stage: '痛点对应',
        rule: match.ruleName,
        content: match.action.explanation,
        talkingPoints: match.action.talkingPoints
      });
    }

    // 价值总结话术
    const forcedSystems = systems.filter(s => s.forceRecommend);
    if (forcedSystems.length > 0) {
      points.push({
        stage: '价值总结',
        content: `这套方案${forcedSystems.length}大系统联动，一次性解决您的${forcedSystems.map(s => s.name).join('、')}问题`
      });
    }

    return points;
  }

  /**
   * 生成可视化映射图数据
   */
  generateVisualMap(diagnosis, systems) {
    return {
      type: 'pain_to_solution_map',
      layout: 'three_column', // 三栏布局：痛点池 -> 系统处方 -> 产品落地
      columns: {
        painPoints: {
          title: '痛点池',
          items: diagnosis.allTags.map(tag => ({
            id: tag.id,
            name: tag.name,
            category: tag.category,
            icon: this.getPainPointIcon(tag.category)
          }))
        },
        systems: {
          title: '系统处方',
          items: systems.map(sys => ({
            name: sys.name,
            confidence: sys.confidence,
            forceRecommend: sys.forceRecommend,
            explanation: sys.explanation
          }))
        },
        products: {
          title: '产品落地',
          items: systems.flatMap(sys => 
            sys.products.map(p => this.productDatabase[p]).filter(Boolean)
          )
        }
      },
      connections: this.generateConnections(diagnosis.allTags, systems)
    };
  }

  getPainPointIcon(category) {
    const icons = {
      '温度体感痛点': '❄️',
      '热水用水痛点': '💧',
      '潮湿/空气痛点': '🌊',
      '水质健康痛点': '💧',
      '省心总包痛点': '🏠'
    };
    return icons[category] || '⚠️';
  }

  generateConnections(tags, systems) {
    const connections = [];
    
    for (const tag of tags) {
      for (const sys of systems) {
        // 简化连接逻辑
        if (sys.explanation && sys.explanation.includes(tag.name)) {
          connections.push({
            from: tag.id,
            to: sys.name,
            type: 'solves'
          });
        }
      }
    }
    
    return connections;
  }
}

module.exports = PainPointMatchingEngine;
