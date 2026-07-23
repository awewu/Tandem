/**
 * PainPointDiagnosisEngine v3.0 - 增强版痛点问诊引擎
 * 
 * 升级内容:
 * - 扩展至6大维度48项痛点问题
 * - 移除痛点数量限制
 * - 6大系统全覆盖（五恒、热水、采暖、空调、新风、净水）
 * - 智能推荐3种方案并说明原因
 * - 支持多选痛点无限制
 */

class PainPointDiagnosisEngineV3 {
  constructor() {
    // 6大维度48项痛点定义
    this.painDimensions = {
      // 维度1: 温度体感痛点 (8项)
      temperature: {
        name: '温度体感痛点',
        icon: '🌡️',
        system: '五恒/空调/采暖',
        tags: [
          { id: 't_01', name: '楼层多→上下楼层温差大', condition: 'floors >= 2', autoCheck: true, severity: 'high', description: '热空气上升导致 upstairs 过热 downstairs 偏冷，温差可达3-5℃' },
          { id: 't_02', name: '落地窗/西晒→夏热冬冷能耗高', condition: 'features.includes("大面积落地窗") || features.includes("西晒")', autoCheck: true, severity: 'high', description: '西晒导致夏季午后室温急剧上升，空调负荷增加30%以上' },
          { id: 't_03', name: '老人同住→空调直吹不适', condition: 'hasElderly == true', autoCheck: true, severity: 'high', description: '传统分体空调冷风直吹引起头痛、关节不适，老人敏感度更高' },
          { id: 't_04', name: '冬季采暖地暖升温慢', condition: 'hasFloorHeating == false', autoCheck: false, severity: 'medium', description: '传统暖气片辐射采暖导致靠近区域过热，远离区域温度偏低' },
          { id: 't_05', name: '黄梅天/回南天室内闷热潮湿', condition: 'region in ["华东","华南"]', autoCheck: false, severity: 'medium', description: '梅雨季节室内湿度持续超过70%，体感黏腻不适' },
          { id: 't_06', name: '顶楼/阁楼夏天过热', condition: 'propertyType == "顶楼" || propertyType == "阁楼"', autoCheck: true, severity: 'high', description: '顶楼夏季温度比楼下高5-8℃，空调难以降温' },
          { id: 't_07', name: '空调噪音影响睡眠', condition: 'bedrooms >= 2', autoCheck: false, severity: 'medium', description: '分体空调外机噪音(50-60dB)影响夜间休息质量' },
          { id: 't_08', name: '温度调节不精准', condition: 'smartHome == false', autoCheck: false, severity: 'low', description: '传统空调温度波动大(±2℃)，体感不舒适' }
        ]
      },

      // 维度2: 热水用水痛点 (8项)
      hotWater: {
        name: '热水用水痛点',
        icon: '🚿',
        system: '热水系统',
        tags: [
          { id: 'h_01', name: '远端龙头/浴缸放冷水久', condition: 'bathrooms >= 2', autoCheck: true, severity: 'high', description: '卫生间距离热水器超过15米，管道冷水排放需30-60秒' },
          { id: 'h_02', name: '多点同时洗澡→水温波动', condition: 'bathrooms >= 2 || bathtubs >= 1', autoCheck: true, severity: 'high', description: '两个卫生间同时开启热水时，水温波动可达5-8℃' },
          { id: 'h_03', name: '用水高峰水流变小', condition: 'occupants >= 4', autoCheck: false, severity: 'medium', description: '早晚用水高峰期，多点同时用水导致水压下降' },
          { id: 'h_04', name: '浴缸放不满就凉了', condition: 'bathtubs >= 1', autoCheck: true, severity: 'high', description: '大浴缸(150L+)需要持续热水供应，储水式热水器无法满足' },
          { id: 'h_05', name: '电热水器不够用', condition: 'occupants >= 4', autoCheck: false, severity: 'medium', description: '储水式电热水器容量不足(60-80L)，连续2-3人后需等待加热' },
          { id: 'h_06', name: '热水器占空间', condition: 'area < 100', autoCheck: false, severity: 'low', description: '传统储水式热水器体积大，占用阳台/卫生间宝贵空间' },
          { id: 'h_07', name: '热水等待浪费水', condition: 'bathrooms >= 2', autoCheck: true, severity: 'medium', description: '每次等待热水浪费10-20L水资源，年浪费数千升' },
          { id: 'h_08', name: '热水费用高', condition: 'energyCostConcern == true', autoCheck: false, severity: 'medium', description: '电热水器电费高昂，燃气热水器燃气费用增长快' }
        ]
      },

      // 维度3: 潮湿/空气痛点 (9项)
      humidity: {
        name: '潮湿/空气痛点',
        icon: '💧',
        system: '新风/除湿',
        tags: [
          { id: 'a_01', name: '地下空间常年潮湿发霉', condition: 'basement != "无"', autoCheck: false, severity: 'high', description: '地下室因土壤湿气渗透，墙面常年潮湿，涂料脱落地板发霉' },
          { id: 'a_02', name: '换季时家人易过敏/哮喘', condition: 'hasAllergy == true', autoCheck: false, severity: 'high', description: '花粉、尘螨等过敏原导致打喷嚏、流鼻涕、呼吸困难' },
          { id: 'a_03', name: '通风差，CO₂高导致头昏乏力', condition: 'ventilation == "poor"', autoCheck: false, severity: 'medium', description: '密闭空间CO₂浓度超过1000ppm，导致注意力下降、嗜睡' },
          { id: 'a_04', name: '宠物/烹饪/装修异味难散', condition: 'hasPet || cookingStyle == "重油"', autoCheck: false, severity: 'medium', description: '宠物体味、油烟味、甲醛等有害气体长期滞留' },
          { id: 'a_05', name: '灰尘大，空调滤网需频繁清洗', condition: 'airQuality == "poor"', autoCheck: false, severity: 'low', description: 'PM2.5、灰尘堆积，每月需清洗空调滤网' },
          { id: 'a_06', name: '梅雨季发霉', condition: 'region in ["华东","华南"]', autoCheck: false, severity: 'high', description: '梅雨季节室内湿度持续超过70%，墙面衣柜家具易发霉' },
          { id: 'a_07', name: '冬天过于干燥', condition: 'region in ["华北","东北"]', autoCheck: false, severity: 'medium', description: '采暖季室内湿度长期低于30%，皮肤干燥呼吸道不适' },
          { id: 'a_08', name: '临街噪音大无法开窗', condition: 'nearRoad == true', autoCheck: false, severity: 'medium', description: '交通噪音(70-85dB)导致无法开窗通风，空气质量差' },
          { id: 'a_09', name: '装修后甲醛超标', condition: 'isNewDecoration == true', autoCheck: true, severity: 'high', description: '新装修甲醛、苯等有害气体超标，长期影响呼吸系统健康' }
        ]
      },

      // 维度4: 水质健康痛点 (8项)
      waterQuality: {
        name: '水质健康痛点',
        icon: '💧',
        system: '净水系统',
        tags: [
          { id: 'w_01', name: '烧水水垢多，清洗耗时', condition: 'waterHardness == "high"', autoCheck: false, severity: 'medium', description: '水质硬度高(≥300mg/L CaCO3)，水壶龙头花洒3-6个月结垢严重' },
          { id: 'w_02', name: '自来水中余氯/异味', condition: 'waterTaste == "chlorine"', autoCheck: false, severity: 'medium', description: '自来水余氯含量偏高(≥0.5mg/L)，有明显漂白粉味' },
          { id: 'w_03', name: '母婴/婴幼儿专属洁净用水', condition: 'hasInfant == true', autoCheck: true, severity: 'high', description: '担心自来水中重金属、细菌、农药残留影响婴幼儿健康' },
          { id: 'w_04', name: '花洒喷头堵塞', condition: 'waterHardness == "high"', autoCheck: false, severity: 'medium', description: '水垢堵塞花洒喷孔，水流变小、喷射不均匀' },
          { id: 'w_05', name: '桶装水换水麻烦+占地', condition: 'waterSource == "barrel"', autoCheck: false, severity: 'low', description: '频繁换水费力，水桶占用空间且易滋生细菌' },
          { id: 'w_06', name: '洗漱后皮肤干燥', condition: 'waterHardness == "high"', autoCheck: false, severity: 'low', description: '硬水洗脸后皮肤干燥紧绷，洗发水起泡少' },
          { id: 'w_07', name: '衣物洗涤后发黄变硬', condition: 'waterHardness == "high"', autoCheck: false, severity: 'low', description: '硬水洗衣导致衣物发黄、纤维变硬、寿命缩短' },
          { id: 'w_08', name: '厨房用水担忧', condition: 'hasInfant == true || hasElderly == true', autoCheck: true, severity: 'medium', description: '洗菜做饭用水安全担忧，农药重金属残留' }
        ]
      },

      // 维度5: 采暖/空调痛点 (8项)
      heatingCooling: {
        name: '采暖/空调痛点',
        icon: '❄️',
        system: '采暖/空调系统',
        tags: [
          { id: 'c_01', name: '暖气片占空间不美观', condition: 'heatingType == "radiator"', autoCheck: false, severity: 'medium', description: '传统暖气片占用墙面空间，影响家具摆放和室内美观' },
          { id: 'c_02', name: '空调外机位不够', condition: 'propertyType == "公寓"', autoCheck: false, severity: 'high', description: '公寓外机位有限，无法安装多台分体空调' },
          { id: 'c_03', name: '中央空调噪音大', condition: 'hasCentralAC == true', autoCheck: false, severity: 'medium', description: '传统中央空调运行噪音(40-50dB)影响休息' },
          { id: 'c_04', name: '地暖维修困难', condition: 'hasFloorHeating == true', autoCheck: false, severity: 'medium', description: '地暖管道漏水需破坏地面装修，维修成本高' },
          { id: 'c_05', name: '空调病频发', condition: 'acUsage == "high"', autoCheck: false, severity: 'medium', description: '长期吹空调导致头痛、关节痛、感冒等空调病' },
          { id: 'c_06', name: '冬季制热效果差', condition: 'region in ["华北","东北"]', autoCheck: false, severity: 'high', description: '普通空调-10℃以下制热效率急剧下降' },
          { id: 'c_07', name: '空调吹出灰尘/异味', condition: 'acAge > 3', autoCheck: false, severity: 'medium', description: '长期使用后内部积灰发霉，吹出的风有异味' },
          { id: 'c_08', name: '外机滴水影响邻居', condition: 'propertyType == "公寓"', autoCheck: false, severity: 'low', description: '多台外机冷凝水滴落，影响楼下邻居' }
        ]
      },

      // 维度6: 省心/智能/总包痛点 (7项)
      hassleFree: {
        name: '省心/智能/总包痛点',
        icon: '🔧',
        system: '智能控制/总包',
        tags: [
          { id: 's_01', name: '多品牌设备→多家售后相互推诿', condition: 'multiBrand == true', autoCheck: false, severity: 'high', description: '空调、地暖、热水等多家供应商，协调困难责任不清' },
          { id: 's_02', name: '隐蔽工程漏水/结露，维修需拆吊顶', condition: 'hasLeakHistory == true', autoCheck: false, severity: 'high', description: '水管、气管设计不合理，后期维修需破坏装修' },
          { id: 's_03', name: '设备无智能联动，需手动逐个操作', condition: 'smartHome == false', autoCheck: false, severity: 'medium', description: '各系统独立运行，无法统一控制，操作繁琐' },
          { id: 's_04', name: '能耗高，电费/燃气费超支', condition: 'energyCostConcern == true', autoCheck: false, severity: 'high', description: '设备能效低，每月能源费用超预算20-30%' },
          { id: 's_05', name: '怕增项超预算', condition: 'budgetStrict == true', autoCheck: false, severity: 'medium', description: '施工过程中不断出现增项费用，最终超出预算' },
          { id: 's_06', name: '怕管路设计出错', condition: 'firstTimeOwner == true', autoCheck: false, severity: 'medium', description: '担心隐蔽工程设计不合理，影响使用效果' },
          { id: 's_07', name: '后期维护麻烦', condition: 'busyOwner == true', autoCheck: false, severity: 'medium', description: '多个品牌设备售后维护需联系不同厂家，响应慢' }
        ]
      }
    };

    // 6大系统定义
    this.sixSystems = {
      wuheng: { name: '五恒恒温系统', icon: '🌡️', description: '恒温、恒湿、恒氧、恒洁、恒静' },
      hotWater: { name: '中央热水系统', icon: '🚿', description: '即开即热，全屋热水零等待' },
      heating: { name: '采暖系统', icon: '🔥', description: '地暖/暖气片，冬季温暖舒适' },
      ac: { name: '空调系统', icon: '❄️', description: '中央空调/分体空调，夏季清凉' },
      freshAir: { name: '新风系统', icon: '🌬️', description: '24小时新鲜空气，除霾降醛' },
      waterPurify: { name: '净水系统', icon: '💧', description: '全屋净化，饮水用水更健康' }
    };

    // AI识别规则扩展
    this.aiRules = [
      // 温度相关
      { pattern: { propertyType: ['独栋', '叠拼', '联排'] }, recommend: ['t_01', 't_02'], confidence: 0.95, reason: '多层户型存在楼层温差和采光问题' },
      { pattern: { features: ['西晒'] }, recommend: ['t_02'], confidence: 0.92, reason: '西晒导致夏季过热问题' },
      { pattern: { features: ['大面积落地窗'] }, recommend: ['t_02', 't_06'], confidence: 0.90, reason: '大面积玻璃导致夏热冬冷' },
      { pattern: { hasElderly: true }, recommend: ['t_03', 'h_04', 'w_03'], confidence: 0.91, reason: '老人对温度变化敏感，需要稳定热水和洁净用水' },
      { pattern: { hasInfant: true }, recommend: ['t_03', 'w_03', 'a_02'], confidence: 0.93, reason: '婴幼儿需要舒适温度、洁净用水和空气质量' },
      
      // 热水相关
      { pattern: { bathrooms: 3 }, recommend: ['h_01', 'h_02', 'h_04'], confidence: 0.94, reason: '多卫生间需要稳定热水供应' },
      { pattern: { bathtubs: 1 }, recommend: ['h_04'], confidence: 0.90, reason: '浴缸需要大流量持续热水' },
      { pattern: { occupants: 5 }, recommend: ['h_02', 'h_05'], confidence: 0.88, reason: '多人口家庭热水需求大' },
      
      // 潮湿/空气相关
      { pattern: { basement: ['1层', '2层'] }, recommend: ['a_01', 'a_06'], confidence: 0.95, reason: '地下室必然存在潮湿问题' },
      { pattern: { region: '华东' }, recommend: ['a_06', 't_05'], confidence: 0.89, reason: '华东地区梅雨季潮湿闷热' },
      { pattern: { isNewDecoration: true }, recommend: ['a_09', 'w_03'], confidence: 0.92, reason: '新装修需要除甲醛和净水' },
      
      // 省心相关
      { pattern: { multiBrand: true }, recommend: ['s_01', 's_07'], confidence: 0.90, reason: '多品牌设备售后复杂' },
      { pattern: { budgetStrict: true }, recommend: ['s_04', 's_05'], confidence: 0.85, reason: '预算敏感需要节能方案' }
    ];

    // 方案推荐规则
    this.solutionRules = [
      {
        id: 'solution_comprehensive',
        name: '全屋舒适总包方案',
        type: 'comprehensive',
        priority: 1,
        condition: { minPainPoints: 5 },
        systems: ['wuheng', 'hotWater', 'heating', 'ac', 'freshAir', 'waterPurify'],
        description: '瑞美六系统一站式解决方案，彻底解决所有痛点',
        whyChoose: [
          '✓ 六系统协同设计，避免管路冲突',
          '✓ 统一施工，缩短工期30%',
          '✓ 整体质保，售后一个电话解决',
          '✓ 智能联动，一个APP控制全屋',
          '✓ 长期节能，综合能效提升40%'
        ],
        budgetRange: { min: 80000, max: 150000 },
        recommendedFor: '追求极致舒适、预算充足、不想操心搭配的家庭'
      },
      {
        id: 'solution_practical',
        name: '实用舒适方案',
        type: 'practical',
        priority: 2,
        condition: { minPainPoints: 3 },
        systems: ['hotWater', 'heating', 'freshAir', 'waterPurify'],
        description: '优先解决核心痛点，性价比最高的选择',
        whyChoose: [
          '✓ 集中资源解决最紧迫的痛点',
          '✓ 投资回报率最高，每分钱都花在刀刃上',
          '✓ 后期可扩展，预留升级空间',
          '✓ 施工简单，工期短',
          '✓ 预算可控，无超支风险'
        ],
        budgetRange: { min: 40000, max: 70000 },
        recommendedFor: '预算有限、希望先解决核心问题的家庭'
      },
      {
        id: 'solution_luxury',
        name: '豪华尊享方案',
        type: 'luxury',
        priority: 3,
        condition: { minPainPoints: 4, area: 150 },
        systems: ['wuheng', 'hotWater', 'heating', 'ac', 'freshAir', 'waterPurify'],
        description: '顶配六系统+全屋智能，打造未来家居生活',
        whyChoose: [
          '✓ 全进口设备，品质保证',
          '✓ 全屋智能生态系统，语音/APP控制',
          '✓ 高端定制设计，与装修风格完美融合',
          '✓ VIP专属服务，24小时响应',
          '✓ 增值保值，提升房产价值'
        ],
        budgetRange: { min: 150000, max: 300000 },
        recommendedFor: '高端住宅、追求极致体验、预算充足的家庭'
      }
    ];

    // 字段验证规则
    this.validationRules = {
      propertyType: { required: true, options: ['平层', '大平层', '叠拼', '联排', '独栋', '顶楼', '阁楼'] },
      area: { required: true, min: 50, max: 1000, unit: '㎡' },
      floors: { required: true, min: 1, max: 5, unit: '层' },
      basement: { required: true, options: ['无', '1层', '2层'] },
      occupants: { required: true, min: 1, max: 10, unit: '人' },
      bathrooms: { required: true, min: 1, max: 10, unit: '个' },
      bathtubs: { required: false, min: 0, max: 5, unit: '个' },
      bedrooms: { required: false, min: 1, max: 10, unit: '个' },
      hasElderly: { required: false, type: 'boolean' },
      hasInfant: { required: false, type: 'boolean' },
      hasAllergy: { required: false, type: 'boolean' },
      hasPet: { required: false, type: 'boolean' },
      isNewDecoration: { required: false, type: 'boolean' },
      budgetStrict: { required: false, type: 'boolean' },
      energyCostConcern: { required: false, type: 'boolean' },
      multiBrand: { required: false, type: 'boolean' },
      smartHome: { required: false, type: 'boolean' },
      nearRoad: { required: false, type: 'boolean' },
      firstTimeOwner: { required: false, type: 'boolean' },
      busyOwner: { required: false, type: 'boolean' }
    };
  }

  /**
   * 执行完整痛点问诊 v3.0
   */
  diagnose(roomProfile, selectedTags = []) {
    // 1. 验证户型数据
    const validation = this.validateRoomProfile(roomProfile);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    // 2. 获取所有可用痛点标签（不再限制数量）
    const availableTags = this.getAvailableTags(roomProfile);

    // 3. AI识别隐性痛点
    const aiRecommendations = this.aiRecognizePainPoints(roomProfile, selectedTags);

    // 4. 分析已选痛点
    const selectedAnalysis = this.analyzeSelectedTags(selectedTags, roomProfile);

    // 5. 推荐3种方案并说明原因
    const recommendedSolutions = this.recommendSolutions(selectedTags, roomProfile);

    // 6. 生成业主画像
    const profile = this.generateResidentProfile(roomProfile, selectedTags);

    return {
      success: true,
      data: {
        roomProfile,
        availableTags,
        totalPainPoints: this.countTotalPainPoints(),
        aiRecommendations,
        selectedAnalysis,
        recommendedSolutions,
        profile,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * 统计总痛点数量
   */
  countTotalPainPoints() {
    let count = 0;
    Object.values(this.painDimensions).forEach(dim => {
      count += dim.tags.length;
    });
    return count;
  }

  /**
   * 验证户型档案
   */
  validateRoomProfile(profile) {
    const errors = [];
    
    Object.keys(this.validationRules).forEach(field => {
      const rule = this.validationRules[field];
      const value = profile[field];

      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({ field, message: `${field} 为必填项` });
        return;
      }

      if (value !== undefined && rule.min !== undefined) {
        if (value < rule.min || value > rule.max) {
          errors.push({ field, message: `${field} 必须在 ${rule.min}-${rule.max} ${rule.unit} 之间` });
        }
      }

      if (value !== undefined && rule.options && !rule.options.includes(value)) {
        errors.push({ field, message: `${field} 必须是以下之一: ${rule.options.join(', ')}` });
      }
    });

    return { valid: errors.length === 0, errors };
  }

  /**
   * 获取可用的痛点标签
   */
  getAvailableTags(roomProfile) {
    const result = {};

    Object.keys(this.painDimensions).forEach(dimension => {
      const dim = this.painDimensions[dimension];
      result[dimension] = {
        name: dim.name,
        icon: dim.icon,
        system: dim.system,
        tags: dim.tags.map(tag => {
          const condition = this.evaluateCondition(tag.condition, roomProfile);
          return {
            ...tag,
            available: true, // v3.0: 所有痛点都可选，不限数量
            disabled: false,
            tooltip: condition ? null : this.getConditionTooltip(tag.condition),
            conditionMet: condition
          };
        })
      };
    });

    return result;
  }

  /**
   * 评估条件
   */
  evaluateCondition(condition, profile) {
    if (!condition) return true;
    
    try {
      const patterns = [
        { regex: /(\w+)\s*=\s*"([^"]+)"/, fn: (f, v) => String(profile[f]) === v },
        { regex: /(\w+)\s*=\s*(\d+)/, fn: (f, v) => Number(profile[f]) === Number(v) },
        { regex: /(\w+)\s*!=\s*"([^"]+)"/, fn: (f, v) => String(profile[f]) !== v },
        { regex: /(\w+)\s*!=\s*(\d+)/, fn: (f, v) => Number(profile[f]) !== Number(v) },
        { regex: /(\w+)\s*>\s*(\d+)/, fn: (f, v) => Number(profile[f]) > Number(v) },
        { regex: /(\w+)\s*<\s*(\d+)/, fn: (f, v) => Number(profile[f]) < Number(v) },
        { regex: /(\w+)\s*>=\s*(\d+)/, fn: (f, v) => Number(profile[f]) >= Number(v) },
        { regex: /(\w+)\s*<=\s*(\d+)/, fn: (f, v) => Number(profile[f]) <= Number(v) }
      ];
      
      for (const pattern of patterns) {
        const match = condition.match(pattern.regex);
        if (match) {
          return pattern.fn(match[1], match[2]);
        }
      }
      
      const featureMatch = condition.match(/features\.includes\("([^"]+)"\)/);
      if (featureMatch) {
        const features = profile.features || [];
        return features.includes(featureMatch[1]);
      }
      
      const regionMatch = condition.match(/region\s+in\s+\[(.+?)\]/);
      if (regionMatch) {
        const regions = regionMatch[1].replace(/"/g, '').split(',').map(r => r.trim());
        return regions.includes(profile.region);
      }
      
      return false;
    } catch (e) {
      console.warn('条件评估失败:', condition, e.message);
      return false;
    }
  }

  /**
   * 获取条件提示
   */
  getConditionTooltip(condition) {
    const tooltips = {
      'floors >= 2': '需要地上层数≥2层',
      'features.includes("大面积落地窗") || features.includes("西晒")': '需要有大面积落地窗或西晒',
      'bathrooms >= 2': '需要卫生间总数≥2个',
      'bathrooms >= 2 || bathtubs >= 1': '需要卫生间≥2个或浴缸≥1个',
      'hasElderly == true': '需要有老人同住',
      'hasInfant == true': '需要有婴幼儿',
      'basement != "无"': '需要有地下室',
      'waterHardness == "high"': '需要水质硬度高',
      'region in ["华东","华南"]': '适用于华东/华南地区',
      'region in ["华北","东北"]': '适用于华北/东北地区'
    };
    return tooltips[condition] || '系统检测到相关条件';
  }

  /**
   * AI识别隐性痛点
   */
  aiRecognizePainPoints(roomProfile, manuallySelected = []) {
    const recommendations = [];

    this.aiRules.forEach(rule => {
      const matched = this.matchPattern(roomProfile, rule.pattern);
      if (matched) {
        rule.recommend.forEach(tagId => {
          if (manuallySelected.includes(tagId)) return;
          
          const tagInfo = this.findTagById(tagId);
          if (tagInfo) {
            recommendations.push({
              tagId,
              tagName: tagInfo.name,
              reason: rule.reason || this.generateRecommendationReason(tagId, roomProfile),
              confidence: rule.confidence,
              canCancel: true,
              severity: tagInfo.severity
            });
          }
        });
      }
    });

    // 按置信度排序
    recommendations.sort((a, b) => b.confidence - a.confidence);

    return {
      recommendations: recommendations.slice(0, 8), // 最多推荐8个
      total: recommendations.length,
      accuracy: this.calculateAccuracy(recommendations)
    };
  }

  /**
   * 匹配AI规则模式
   */
  matchPattern(profile, pattern) {
    return Object.keys(pattern).every(key => {
      const expected = pattern[key];
      const actual = profile[key];
      
      if (Array.isArray(expected)) {
        if (Array.isArray(actual)) {
          return actual.some(v => expected.includes(v));
        }
        return expected.includes(actual);
      }
      
      return actual === expected;
    });
  }

  /**
   * 查找标签信息
   */
  findTagById(tagId) {
    for (const dim of Object.values(this.painDimensions)) {
      const tag = dim.tags.find(t => t.id === tagId);
      if (tag) return { ...tag, dimension: dim.name, system: dim.system };
    }
    return null;
  }

  /**
   * 生成推荐理由
   */
  generateRecommendationReason(tagId, profile) {
    const reasons = {
      't_01': `检测到您的户型为${profile.propertyType}，共${profile.floors}层，可能存在楼层温差问题`,
      't_02': `检测到您有大面积落地窗或西晒，可能存在夏热冬冷问题`,
      't_03': `检测到您家有老人同住，需要避免空调直吹不适`,
      'h_01': `检测到您的户型有${profile.bathrooms}个卫生间，可能存在远端热水等待问题`,
      'h_02': `多卫生间同时用水时水温容易波动`,
      'h_04': `检测到您家有浴缸，需要大流量持续热水`,
      'a_01': `检测到您有地下室，可能存在潮湿发霉问题`,
      'a_09': `新装修房屋需要重点关注甲醛等有害气体`,
      'w_03': `检测到您家有婴幼儿，需要专属洁净用水保障`,
      's_01': `多品牌设备售后维护复杂，建议统一品牌`
    };
    return reasons[tagId] || '系统检测到您可能存在此痛点';
  }

  /**
   * 计算识别精度
   */
  calculateAccuracy(recommendations) {
    if (recommendations.length === 0) return 1.0;
    const avgConfidence = recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length;
    return avgConfidence;
  }

  /**
   * 分析已选痛点
   */
  analyzeSelectedTags(selectedTags, roomProfile) {
    if (!selectedTags || selectedTags.length === 0) {
      return { count: 0, bySystem: {}, severity: 'low' };
    }

    const bySystem = {};
    let highSeverityCount = 0;
    let mediumSeverityCount = 0;

    selectedTags.forEach(tagId => {
      const tag = this.findTagById(tagId);
      if (tag) {
        const system = tag.system || '其他';
        if (!bySystem[system]) {
          bySystem[system] = { count: 0, tags: [] };
        }
        bySystem[system].count++;
        bySystem[system].tags.push(tag);

        if (tag.severity === 'high') highSeverityCount++;
        if (tag.severity === 'medium') mediumSeverityCount++;
      }
    });

    let severity = 'low';
    if (highSeverityCount >= 3) severity = 'critical';
    else if (highSeverityCount >= 1 || mediumSeverityCount >= 3) severity = 'high';
    else if (mediumSeverityCount >= 1) severity = 'medium';

    return {
      count: selectedTags.length,
      bySystem,
      severity,
      highSeverityCount,
      mediumSeverityCount
    };
  }

  /**
   * 推荐3种方案并说明原因
   */
  recommendSolutions(selectedTags, roomProfile) {
    const analysis = this.analyzeSelectedTags(selectedTags, roomProfile);
    const solutions = [];

    // 方案1: 全屋舒适总包方案 (推荐)
    const comprehensive = this.generateComprehensiveSolution(analysis, roomProfile);
    solutions.push(comprehensive);

    // 方案2: 实用舒适方案 (性价比)
    const practical = this.generatePracticalSolution(analysis, roomProfile);
    solutions.push(practical);

    // 方案3: 豪华尊享方案 (高端)
    const luxury = this.generateLuxurySolution(analysis, roomProfile);
    solutions.push(luxury);

    return solutions;
  }

  /**
   * 生成全屋舒适总包方案
   */
  generateComprehensiveSolution(analysis, roomProfile) {
    const selectedCount = analysis.count || 5;
    const highSeverity = analysis.highSeverityCount || 0;
    
    // 确定包含的6大系统
    const includedSystems = ['wuheng', 'hotWater', 'heating', 'ac', 'freshAir', 'waterPurify'];
    
    // 根据痛点调整
    const bySystem = analysis.bySystem || {};
    if (bySystem['热水系统'] && bySystem['热水系统'].count >= 2) {
      // 热水痛点多，加强热水系统
    }

    return {
      id: 'solution_comprehensive',
      name: '全屋舒适总包方案',
      type: 'comprehensive',
      matchScore: Math.min(98, 85 + selectedCount * 2),
      includedSystems,
      sixSystemsDisplay: this.generateSixSystemsDisplay(includedSystems),
      description: '瑞美六系统一站式解决方案，彻底解决所有痛点',
      whyChoose: [
        '✓ 六系统协同设计，避免管路冲突，确保最佳效果',
        '✓ 统一施工团队，缩短工期30%，减少协调成本',
        '✓ 整体质保10年，售后一个电话解决所有问题',
        '✓ Econet智能联动，一个APP控制全屋设备',
        '✓ 长期节能40%，2-3年收回投资成本',
        '✓ 专业设计师上门，定制最适合您家的方案'
      ],
      whyChooseTitle: '为什么选择这个方案？',
      budgetRange: { min: 80000, max: 150000, unit: '元' },
      estimatedTotal: this.calculateBudget(includedSystems, roomProfile, 'standard'),
      recommendedFor: this.generateRecommendedFor(analysis, 'comprehensive'),
      talkingPoints: this.generateTalkingPoints(analysis, includedSystems),
      priority: 1,
      badge: '💎 推荐方案'
    };
  }

  /**
   * 生成实用舒适方案
   */
  generatePracticalSolution(analysis, roomProfile) {
    const selectedCount = analysis.count || 3;
    
    // 根据痛点优先级选择核心系统
    const bySystem = analysis.bySystem || {};
    const includedSystems = [];
    
    // 必选：热水系统
    if (bySystem['热水系统'] && bySystem['热水系统'].count > 0) {
      includedSystems.push('hotWater');
    }
    // 温度痛点 → 采暖+空调
    if (bySystem['五恒/空调/采暖'] && bySystem['五恒/空调/采暖'].count > 0) {
      includedSystems.push('heating', 'ac');
    }
    // 空气痛点 → 新风
    if (bySystem['新风/除湿'] && bySystem['新风/除湿'].count > 0) {
      includedSystems.push('freshAir');
    }
    // 水质痛点 → 净水
    if (bySystem['净水系统'] && bySystem['净水系统'].count > 0) {
      includedSystems.push('waterPurify');
    }
    
    // 确保至少3个系统
    if (includedSystems.length < 3) {
      const defaults = ['hotWater', 'heating', 'freshAir'];
      defaults.forEach(sys => {
        if (!includedSystems.includes(sys)) includedSystems.push(sys);
      });
    }

    return {
      id: 'solution_practical',
      name: '实用舒适方案',
      type: 'practical',
      matchScore: Math.min(95, 75 + selectedCount * 2),
      includedSystems,
      sixSystemsDisplay: this.generateSixSystemsDisplay(includedSystems),
      description: '优先解决核心痛点，性价比最高的明智选择',
      whyChoose: [
        '✓ 集中资源解决最紧迫的痛点，投资回报率最高',
        '✓ 每分钱都花在刀刃上，预算可控无超支风险',
        '✓ 后期可无缝扩展，预留升级空间',
        '✓ 施工简单工期短，最快7天完成安装',
        '✓ 基础功能完善，满足绝大多数家庭需求',
        '✓ 可选分期付款，减轻一次性支出压力'
      ],
      whyChooseTitle: '为什么选择这个方案？',
      budgetRange: { min: 40000, max: 70000, unit: '元' },
      estimatedTotal: this.calculateBudget(includedSystems, roomProfile, 'practical'),
      recommendedFor: this.generateRecommendedFor(analysis, 'practical'),
      talkingPoints: this.generateTalkingPoints(analysis, includedSystems),
      priority: 2,
      badge: '💰 性价比之选'
    };
  }

  /**
   * 生成豪华尊享方案
   */
  generateLuxurySolution(analysis, roomProfile) {
    const selectedCount = analysis.count || 4;
    const area = roomProfile.area || 120;
    
    const includedSystems = ['wuheng', 'hotWater', 'heating', 'ac', 'freshAir', 'waterPurify'];
    
    return {
      id: 'solution_luxury',
      name: '豪华尊享方案',
      type: 'luxury',
      matchScore: Math.min(99, 90 + selectedCount * 1.5),
      includedSystems,
      sixSystemsDisplay: this.generateSixSystemsDisplay(includedSystems, true),
      description: '顶配六系统+全屋智能，打造未来家居生活标准',
      whyChoose: [
        '✓ 全进口高端设备，品质与性能双重保障',
        '✓ 全屋智能生态系统，支持语音/APP/场景自动化',
        '✓ 高端定制设计，与装修风格完美融合',
        '✓ VIP专属服务，24小时响应，终身维护',
        '✓ 增值保值，提升房产价值5-10%',
        '✓ 独家10年延保，使用无后顾之忧'
      ],
      whyChooseTitle: '为什么选择这个方案？',
      budgetRange: { min: 150000, max: area > 200 ? 350000 : 250000, unit: '元' },
      estimatedTotal: this.calculateBudget(includedSystems, roomProfile, 'luxury'),
      recommendedFor: this.generateRecommendedFor(analysis, 'luxury'),
      talkingPoints: this.generateTalkingPoints(analysis, includedSystems, true),
      priority: 3,
      badge: '👑 顶级配置'
    };
  }

  /**
   * 生成6大系统展示
   */
  generateSixSystemsDisplay(includedSystems, isLuxury = false) {
    const sixSystems = [
      { key: 'wuheng', name: '五恒恒温系统', icon: '🌡️', color: '#FF6B6B' },
      { key: 'hotWater', name: '中央热水系统', icon: '🚿', color: '#4ECDC4' },
      { key: 'heating', name: '采暖系统', icon: '🔥', color: '#FF9F43' },
      { key: 'ac', name: '空调系统', icon: '❄️', color: '#54A0FF' },
      { key: 'freshAir', name: '新风系统', icon: '🌬️', color: '#5F27CD' },
      { key: 'waterPurify', name: '净水系统', icon: '💧', color: '#00D2D3' }
    ];

    return sixSystems.map(sys => ({
      ...sys,
      included: includedSystems.includes(sys.key),
      highlight: includedSystems.includes(sys.key) && isLuxury,
      description: this.getSystemDescription(sys.key)
    }));
  }

  /**
   * 获取系统描述
   */
  getSystemDescription(key) {
    const descriptions = {
      wuheng: '恒温·恒湿·恒氧·恒洁·恒静',
      hotWater: '即开即热·全屋零等待',
      heating: '地暖/暖气片·冬季温暖',
      ac: '中央空调·夏季清凉',
      freshAir: '24h新风·除霾降醛',
      waterPurify: '全屋净化·健康用水'
    };
    return descriptions[key] || '';
  }

  /**
   * 计算预算
   */
  calculateBudget(includedSystems, roomProfile, tier) {
    const basePrices = {
      wuheng: { standard: 35000, practical: 0, luxury: 55000 },
      hotWater: { standard: 15000, practical: 12000, luxury: 25000 },
      heating: { standard: 20000, practical: 18000, luxury: 35000 },
      ac: { standard: 25000, practical: 20000, luxury: 40000 },
      freshAir: { standard: 15000, practical: 12000, luxury: 25000 },
      waterPurify: { standard: 12000, practical: 10000, luxury: 20000 }
    };

    const area = roomProfile.area || 100;
    const areaFactor = area / 100; // 面积系数

    let total = 0;
    includedSystems.forEach(sys => {
      const price = basePrices[sys]?.[tier] || 0;
      total += price * areaFactor;
    });

    return Math.round(total);
  }

  /**
   * 生成适用人群说明
   */
  generateRecommendedFor(analysis, type) {
    const bySystem = analysis.bySystem || {};
    const parts = [];

    if (type === 'comprehensive') {
      parts.push('追求生活品质的家庭');
      if (analysis.highSeverityCount >= 3) parts.push('痛点较多的用户');
      if (bySystem['省心/智能/总包']) parts.push('不想操心的业主');
      parts.push('预算充足、注重长期价值的家庭');
    } else if (type === 'practical') {
      parts.push('预算有限的家庭');
      if (analysis.count <= 5) parts.push('痛点相对较少的用户');
      parts.push('希望先解决核心问题的务实派');
      parts.push('后期有升级计划的家庭');
    } else if (type === 'luxury') {
      parts.push('高端住宅业主');
      parts.push('追求极致生活体验的家庭');
      parts.push('预算充足、不妥协品质的消费者');
      parts.push('注重房产增值的业主');
    }

    return parts;
  }

  /**
   * 生成讲解话术
   */
  generateTalkingPoints(analysis, includedSystems, isLuxury = false) {
    const points = [];
    
    // 根据痛点生成针对性话术
    const bySystem = analysis.bySystem || {};
    
    if (bySystem['温度体感痛点'] || bySystem['五恒/空调/采暖']) {
      points.push('✓ 温控系统解决温度不适，全年恒温±1℃');
    }
    if (bySystem['热水用水痛点'] || bySystem['热水系统']) {
      points.push('✓ 中央热水系统即开即热，远端出水3秒到达');
    }
    if (bySystem['潮湿/空气痛点'] || bySystem['新风/除湿']) {
      points.push('✓ 新风除湿系统24小时循环，告别潮湿发霉');
    }
    if (bySystem['水质健康痛点'] || bySystem['净水系统']) {
      points.push('✓ 全屋净水从入户到入口全程净化，母婴级标准');
    }
    
    // 通用话术
    points.push('✓ 智能控制系统，手机APP远程操控，省心省电');
    points.push('✓ 专业安装团队，标准化施工，质保10年');
    
    if (isLuxury) {
      points.push('✓ 全进口设备，品质保证，VIP专属服务');
    }

    return points;
  }

  /**
   * 生成业主画像
   */
  generateResidentProfile(roomProfile, selectedTags) {
    const selectedCount = selectedTags ? selectedTags.length : 0;
    
    return {
      summary: `${roomProfile.propertyType || '住宅'}·${roomProfile.area || 100}㎡·${roomProfile.floors || 1}层·${roomProfile.occupants || 3}人`,
      selectedPainPoints: selectedCount,
      totalAvailable: this.countTotalPainPoints(),
      keyConcerns: this.getTopConcerns(selectedTags, 3),
      generatedAt: new Date().toISOString(),
      generationTime: '< 1秒'
    };
  }

  /**
   * 获取主要关注点
   */
  getTopConcerns(selectedTags, limit) {
    if (!selectedTags || selectedTags.length === 0) return [];
    
    const tags = selectedTags.slice(0, limit).map(tagId => {
      const tag = this.findTagById(tagId);
      return tag ? tag.name : tagId;
    });
    
    return tags;
  }
}

module.exports = PainPointDiagnosisEngineV3;
