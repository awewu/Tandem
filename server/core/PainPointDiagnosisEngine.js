/**
 * 业主痛点问诊模块 (M2) - PainPointDiagnosisEngine
 * 5大维度痛点标签 + AI隐性痛点识别
 */

class PainPointDiagnosisEngine {
  constructor() {
    // 五大维度痛点定义
    this.painPointCategories = {
      temperature: {
        name: '温度体感痛点',
        tags: [
          { id: 'tag_01', name: '楼层温差大', description: '复式/别墅上下层温差超过3℃，热空气上升导致上层过热下层偏冷，影响整体舒适度', autoTrigger: ['multiFloor'] },
          { id: 'tag_02', name: '落地窗西晒', description: '大面积落地窗西向导致夏季午后室温急剧上升，空调负荷增加30%以上', autoTrigger: ['largeWindow', 'westFacing'] },
          { id: 'tag_03', name: '空调直吹难受', description: '传统分体空调冷风直吹人体，引起头痛、关节不适，老人儿童敏感度更高', autoTrigger: ['elderly', 'infant'] },
          { id: 'tag_04', name: '冬季采暖不均', description: '暖气片辐射采暖导致靠近暖气片区域过热，远离区域温度偏低，温差可达5-8℃', autoTrigger: ['oldBuilding'] },
          { id: 'tag_05', name: '地下室潮湿阴冷', description: '地下室常年温度比地上低3-5℃，湿度超过80%，容易滋生霉菌影响健康', autoTrigger: ['basement'] }
        ]
      },
      hotWater: {
        name: '热水用水痛点',
        tags: [
          { id: 'tag_11', name: '远端冷水等待久', description: '卫生间距离热水器超过15米，管道冷水排放需30-60秒，浪费水资源且体验差', autoTrigger: ['largeArea', 'multiBathroom'] },
          { id: 'tag_12', name: '多点用水水温波动', description: '两个卫生间同时开启热水时，水温波动可达5-8℃，洗浴体验极不稳定', autoTrigger: ['multiBathroom'] },
          { id: 'tag_13', name: '浴缸放不满就凉了', description: '大浴缸（150L以上）需要持续热水供应，普通储水式热水器无法满足需求', autoTrigger: ['bathtub'] },
          { id: 'tag_14', name: '电热水器不够用', description: '储水式电热水器容量不足（60-80L），连续洗浴2-3人后需要等待加热恢复', autoTrigger: ['largeFamily'] },
          { id: 'tag_15', name: '热水器占空间', description: '传统储水式热水器体积大（直径60cm、高80cm），占用阳台或卫生间宝贵空间', autoTrigger: ['smallBalcony'] }
        ]
      },
      humidity: {
        name: '潮湿/空气痛点',
        tags: [
          { id: 'tag_21', name: '梅雨季发霉', description: '梅雨季节室内湿度持续超过70%，墙面、衣柜、家具易发霉，影响健康和财产', autoTrigger: ['humidClimate'] },
          { id: 'tag_22', name: '地下室返潮', description: '地下室因土壤湿气渗透，墙面常年潮湿，涂料脱落、地板发霉，无法正常使用', autoTrigger: ['basement'] },
          { id: 'tag_23', name: '冬天过于干燥', description: '采暖季室内湿度长期低于30%，引起皮肤干燥、呼吸道不适，静电频发', autoTrigger: ['heatingSystem'] },
          { id: 'tag_24', name: '室内空气质量差', description: '装修后甲醛、苯等有害气体超标，PM2.5、CO2浓度高，长期影响呼吸系统健康', autoTrigger: ['newDecoration'] },
          { id: 'tag_25', name: '通风噪音大', description: '临街住宅开窗通风时，交通噪音（70-85dB）严重影响睡眠和休息', autoTrigger: ['nearRoad'] }
        ]
      },
      waterQuality: {
        name: '水质健康痛点',
        tags: [
          { id: 'tag_31', name: '自来水有异味', description: '自来水余氯含量偏高（≥0.5mg/L），有明显漂白粉味，影响饮水口感和烹饪', autoTrigger: [] },
          { id: 'tag_32', name: '烧水壶结垢', description: '水质硬度高（≥300mg/L CaCO3），水壶、龙头、花洒3-6个月结垢严重，影响使用寿命', autoTrigger: ['hardWaterArea'] },
          { id: 'tag_33', name: '母婴用水担心', description: '担心自来水中重金属、细菌、农药残留等污染物影响婴幼儿健康发育', autoTrigger: ['infant'] },
          { id: 'tag_34', name: '花洒喷头堵塞', description: '水垢堵塞花洒喷孔，导致水流变小、喷射不均匀，严重影响洗浴体验', autoTrigger: ['hardWaterArea'] }
        ]
      },
      hassle: {
        name: '省心总包痛点',
        tags: [
          { id: 'tag_41', name: '不想对接多品牌', description: '需要分别对接空调、地暖、热水、净水等多家供应商，协调困难，责任不清', autoTrigger: ['busyOwner'] },
          { id: 'tag_42', name: '怕增项超预算', description: '施工过程中不断出现增项费用，最终超出预算20-30%，经济压力增大', autoTrigger: [] },
          { id: 'tag_43', name: '怕管路设计出错', description: '担心隐蔽工程（水管、电路、气管）设计不合理，后期维修需要破坏装修', autoTrigger: [] },
          { id: 'tag_44', name: '后期维护麻烦', description: '多个品牌设备售后维护需要联系不同厂家，响应慢、责任推诿', autoTrigger: [] }
        ]
      }
    };

    // 户型条件触发器
    this.roomConditionTriggers = {
      multiFloor: { name: '多层户型', condition: (room) => room.floors > 1 },
      basement: { name: '有地下室', condition: (room) => room.hasBasement },
      largeWindow: { name: '大面积落地窗', condition: (room) => room.windowArea > room.area * 0.3 },
      westFacing: { name: '西晒户型', condition: (room) => room.orientation === 'west' },
      largeArea: { name: '大户型', condition: (room) => room.area > 120 },
      multiBathroom: { name: '多卫生间', condition: (room) => room.bathroomCount > 1 },
      bathtub: { name: '有浴缸', condition: (room) => room.hasBathtub },
      elderly: { name: '老人同住', condition: (room) => room.hasElderly },
      infant: { name: '母婴/幼童', condition: (room) => room.hasInfant },
      newDecoration: { name: '新装修', condition: (room) => room.isNewDecoration }
    };
  }

  /**
   * 分析户型并生成痛点诊断
   */
  diagnose(roomProfile, selectedTags = []) {
    // 完整性检查：确保用户至少选择一个痛点
    if (!selectedTags || selectedTags.length === 0) {
      throw new Error('请至少选择一个痛点后再进行AI诊断');
    }

    const diagnosis = {
      timestamp: new Date().toISOString(),
      roomProfile,
      selectedTags: [],
      aiSuggestedTags: [],
      allTags: [],
      painPointSummary: {},
      recommendationPriority: []
    };

    // 1. 处理用户选择的标签
    diagnosis.selectedTags = this.processSelectedTags(selectedTags);

    // 2. AI识别隐性痛点（仅在用户已选择痛点的基础上进行补充）
    diagnosis.aiSuggestedTags = this.aiRecognizePainPoints(roomProfile, diagnosis.selectedTags);

    // 3. 合并所有痛点
    diagnosis.allTags = [...diagnosis.selectedTags, ...diagnosis.aiSuggestedTags];

    // 4. 生成痛点汇总
    diagnosis.painPointSummary = this.summarizePainPoints(diagnosis.allTags);

    // 5. 生成推荐优先级
    diagnosis.recommendationPriority = this.calculatePriority(diagnosis.allTags, roomProfile);

    // 6. 生成业主画像
    diagnosis.ownerProfile = this.generateOwnerProfile(roomProfile, diagnosis.allTags);

    return diagnosis;
  }

  /**
   * AI识别隐性痛点
   */
  aiRecognizePainPoints(roomProfile, selectedTags) {
    const suggested = [];
    const selectedIds = selectedTags.map(t => t.id);

    // 遍历所有可能的触发条件
    for (const [categoryKey, category] of Object.entries(this.painPointCategories)) {
      for (const tag of category.tags) {
        // 如果已经选择，跳过
        if (selectedIds.includes(tag.id)) continue;

        // 检查自动触发条件
        for (const trigger of tag.autoTrigger || []) {
          const triggerFunc = this.roomConditionTriggers[trigger]?.condition;
          if (triggerFunc && triggerFunc(roomProfile)) {
            suggested.push({
              ...tag,
              category: category.name,
              reason: `AI识别：根据户型${this.roomConditionTriggers[trigger].name}自动推荐`,
              confidence: 0.85
            });
            break;
          }
        }
      }
    }

    return suggested;
  }

  /**
   * 处理用户选择的标签
   */
  processSelectedTags(tagIds) {
    const processed = [];
    
    for (const category of Object.values(this.painPointCategories)) {
      for (const tag of category.tags) {
        if (tagIds.includes(tag.id)) {
          processed.push({
            ...tag,
            category: category.name,
            source: 'user_selected'
          });
        }
      }
    }

    return processed;
  }

  /**
   * 汇总痛点
   */
  summarizePainPoints(allTags) {
    const summary = {
      totalCount: allTags.length,
      byCategory: {},
      topPainPoints: [],
      severity: 'medium'
    };

    // 按分类统计
    for (const tag of allTags) {
      const category = tag.category;
      if (!summary.byCategory[category]) {
        summary.byCategory[category] = { count: 0, tags: [] };
      }
      summary.byCategory[category].count++;
      summary.byCategory[category].tags.push(tag);
    }

    // 排序获取Top痛点
    summary.topPainPoints = allTags
      .sort((a, b) => (b.severityScore || 5) - (a.severityScore || 5))
      .slice(0, 3);

    // 判断严重程度
    if (allTags.length >= 8) summary.severity = 'high';
    else if (allTags.length >= 4) summary.severity = 'medium';
    else summary.severity = 'low';

    return summary;
  }

  /**
   * 计算推荐优先级
   */
  calculatePriority(allTags, roomProfile) {
    const priorities = [];

    // 热水痛点 ≥ 2个 → 优先推荐中央热水
    const hotWaterCount = allTags.filter(t => t.category === '热水用水痛点').length;
    if (hotWaterCount >= 2) {
      priorities.push({
        system: '中央热水系统',
        reason: `检测到${hotWaterCount}个热水痛点，建议恒热EVERHOT中央热水+全屋循环`,
        priority: 1,
        products: ['恒热EVERHOT-150L', '循环泵', '保温管路']
      });
    }

    // 老人/婴儿 + 怕吹风 → 优先推荐五恒系统
    const hasElderlyOrInfant = allTags.some(t => 
      t.name.includes('老人') || t.name.includes('母婴') || t.name.includes('直吹')
    );
    if (hasElderlyOrInfant) {
      priorities.push({
        system: '五恒恒温系统',
        reason: '检测到老人/婴儿同住或怕吹风痛点，推荐五恒恒温+分区地暖',
        priority: 2,
        products: ['五恒主机', '地暖管', '智能温控器']
      });
    }

    // 地下室/发霉 → 优先推荐新风+除湿
    const hasMoisture = allTags.some(t => 
      t.name.includes('地下室') || t.name.includes('发霉') || t.name.includes('返潮')
    );
    if (hasMoisture) {
      priorities.push({
        system: '新风除湿系统',
        reason: '检测到潮湿相关痛点，推荐全热交换新风+全屋除湿',
        priority: 3,
        products: ['新风主机', '除湿机', '风管系统']
      });
    }

    // 水质痛点 ≥ 2个 → 推荐全屋净水
    const waterQualityCount = allTags.filter(t => t.category === '水质健康痛点').length;
    if (waterQualityCount >= 2) {
      priorities.push({
        system: '全屋净水系统',
        reason: `检测到${waterQualityCount}个水质痛点，推荐三级梯级净水方案`,
        priority: 4,
        products: ['前置过滤器', '中央净水机', '软水机', 'RO直饮机']
      });
    }

    // 省心痛点 → 推荐全屋总包
    const hasHassle = allTags.some(t => t.category === '省心总包痛点');
    if (hasHassle) {
      priorities.push({
        system: '瑞美全屋总包方案',
        reason: '检测到省心需求，推荐瑞美六系统一体化总包',
        priority: 5,
        products: ['六系统全套', '统一施工', '瑞美Econet智能控制']
      });
    }

    return priorities.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 生成业主画像
   */
  generateOwnerProfile(roomProfile, allTags) {
    const profile = {
      familyType: this.detectFamilyType(roomProfile, allTags),
      sensitivityLevel: this.calculateSensitivity(allTags),
      decisionStyle: this.detectDecisionStyle(allTags),
      budgetExpectation: this.estimateBudget(allTags),
      keyConcerns: allTags.slice(0, 3).map(t => t.name)
    };

    return profile;
  }

  detectFamilyType(room, tags) {
    if (tags.some(t => t.name.includes('母婴') || t.name.includes('幼童'))) {
      return { type: 'new_parent', label: '新手父母家庭', priority: 'health' };
    }
    if (tags.some(t => t.name.includes('老人'))) {
      return { type: 'elderly_care', label: '养老家庭', priority: 'comfort' };
    }
    if (room.area > 150) {
      return { type: 'luxury', label: '高端改善家庭', priority: 'quality' };
    }
    return { type: 'standard', label: '品质改善家庭', priority: 'value' };
  }

  calculateSensitivity(tags) {
    const hasHealth = tags.some(t => 
      t.name.includes('母婴') || t.name.includes('健康') || t.name.includes('发霉')
    );
    if (hasHealth) return { level: 'high', label: '高敏感度', focus: '健康' };
    
    const hasComfort = tags.some(t => 
      t.name.includes('舒适') || t.name.includes('温度') || t.name.includes('吹风')
    );
    if (hasComfort) return { level: 'medium', label: '中敏感度', focus: '舒适' };
    
    return { level: 'normal', label: '标准敏感度', focus: '性价比' };
  }

  detectDecisionStyle(tags) {
    if (tags.some(t => t.name.includes('省心') || t.name.includes('总包'))) {
      return { style: 'simple', label: '省心型', preference: '一站式解决' };
    }
    return { style: 'detailed', label: '细致型', preference: '对比选型' };
  }

  estimateBudget(tags) {
    const baseBudget = 50000;
    const systemCount = new Set(tags.map(t => t.category)).size;
    return {
      min: baseBudget + systemCount * 15000,
      max: baseBudget + systemCount * 35000,
      expectation: '中高档'
    };
  }
}

module.exports = PainPointDiagnosisEngine;
