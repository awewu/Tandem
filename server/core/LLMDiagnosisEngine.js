/**
 * 【Phase 2进化】LLMDiagnosisEngine v1.0
 * LLM大模型问诊引擎 - 自然语言方案设计
 * 
 * 功能:
 * - 多轮对话需求理解
 * - 自然语言户型描述解析
 * - 智能方案生成与讲解
 * - 竞品对比话术生成
 * 
 * 集成: OpenAI GPT-4 / Claude / 国内大模型
 */

class LLMDiagnosisEngine {
  constructor(config = {}) {
    this.version = '1.0';
    this.provider = config.provider || 'openai'; // openai/claude/azure
    this.apiKey = config.apiKey || process.env.LLM_API_KEY;
    this.model = config.model || 'gpt-4-turbo-preview';
    
    // 系统提示词模板
    this.systemPrompts = {
      diagnosis: `你是瑞美舒适家居的专业设计顾问，拥有20年暖通行业经验。
你的任务是通过自然对话了解客户的户型情况和舒适需求，然后推荐最适合的系统方案。

【对话原则】
1. 用专业但易懂的语言，避免过多术语
2. 一次只问1-2个问题，避免信息过载
3. 根据客户回答动态调整后续问题
4. 主动总结确认理解是否正确
5. 发现痛点时深入挖掘

【问诊流程】
第1轮: 欢迎+了解基础信息 (户型类型/面积/所在城市)
第2轮: 了解家庭成员 (人数/老人/小孩/宠物)
第3轮: 现有痛点挖掘 (热水/采暖/空气质量)
第4轮: 使用习惯 (作息/用水/温度偏好)
第5轮: 预算与期望 (投资意愿/品牌认知)
第6轮: 方案推荐与讲解

【输出格式】
始终以JSON格式返回，包含:
- response: 对客户的回复文本
- nextQuestions: 下一轮要问的问题数组
- extractedInfo: 已提取的客户信息
- painPoints: 已识别的痛点标签
- confidence: 信息完整度 (0-1)
- recommendedSystems: 推荐的系统(当confidence>0.8时)`,

      explanation: `你是瑞美舒适家居的方案讲解员，擅长用通俗易懂的方式解释复杂的暖通系统。

【讲解原则】
1. 用类比和生活化例子解释技术概念
2. 强调给客户带来的实际好处
3. 对比传统方案的劣势突出优势
4. 提供具体数据支撑 (省电/省钱/舒适度)

【讲解结构】
1. 一句话总结: 这是什么系统
2. 核心原理: 用类比解释
3. 解决的痛点: 具体改善
4. 对比优势: vs传统方案
5. 投资回报: 数据支撑`,

      comparison: `你是瑞美舒适家居的竞品分析师，客观专业但不贬低对手。

【对比原则】
1. 基于事实和数据，不贬低竞品
2. 突出瑞美的差异化优势
3. 针对不同竞品强调不同卖点
4. 承认竞品的优点，但说明瑞美的解决方案

【对比维度】
- 技术路线 (燃气/电热/热泵)
- 能效等级 (COP/IPLV)
- 品牌历史 (专业度/口碑)
- 服务体系 (安装/售后/质保)
- 智能化程度 (控制/节能)`
    };

    // 对话上下文管理
    this.conversations = new Map(); // sessionId -> context
    
    // 痛点关键词映射
    this.painPointKeywords = {
      '热水': ['tag_11', 'tag_12'],      // 热水等待
      '冷水': ['tag_11'],                // 冷水等待
      '地暖': ['tag_01', 'tag_02'],      // 温差大/西晒
      '空调': ['tag_01', 'tag_02'],      // 温差大/西晒
      '潮湿': ['tag_22'],                // 地下室潮湿
      '发霉': ['tag_22'],                // 发霉
      '灰尘': ['tag_31'],                // 灰尘多
      '过敏': ['tag_32'],                // 过敏
      '水质': ['tag_33'],                // 水质硬
      '水垢': ['tag_33'],                // 水垢
      '电费': ['tag_41'],                // 电费高
      '燃气费': ['tag_42'],              // 燃气费高
      '噪音': ['tag_51'],                // 噪音
      '占空间': ['tag_52']               // 占空间
    };

    // 推荐规则映射
    this.recommendationRules = {
      'tag_11': { system: '中央热水', priority: 1, reason: '解决多点用水等待' },
      'tag_12': { system: '循环热水', priority: 1, reason: '实现即开即热' },
      'tag_01': { system: '五恒恒温', priority: 1, reason: '解决温差大问题' },
      'tag_02': { system: '中央空调', priority: 2, reason: '解决西晒过热' },
      'tag_22': { system: '新风除湿', priority: 1, reason: '解决潮湿发霉' },
      'tag_31': { system: '全屋新风', priority: 2, reason: '过滤灰尘' },
      'tag_32': { system: '净化新风', priority: 1, reason: '净化过敏原' },
      'tag_33': { system: '全屋净水', priority: 1, reason: '改善水质' },
      'tag_41': { system: '热泵系统', priority: 1, reason: '高效节能省电' },
      'tag_42': { system: '空气能', priority: 1, reason: '替代燃气节能' }
    };
  }

  /**
   * 开始新问诊会话
   */
  async startDiagnosis(sessionId, initialContext = {}) {
    const context = {
      sessionId,
      startedAt: new Date(),
      round: 1,
      customerInfo: {},
      painPoints: [],
      extractedEntities: {},
      conversation: [],
      ...initialContext
    };
    
    this.conversations.set(sessionId, context);
    
    const welcomeMessage = {
      response: `您好！我是瑞美舒适家居的设计顾问，很高兴为您服务🏠

为了给您推荐最适合的舒适家居方案，我想先了解一下您的基本情况：

1. 您家是什么户型？(平层/复式/别墅)
2. 建筑面积大约多少平米？
3. 您在哪个城市？`,
      nextQuestions: ['户型类型', '建筑面积', '所在城市'],
      extractedInfo: {},
      painPoints: [],
      confidence: 0.1,
      recommendedSystems: []
    };
    
    context.conversation.push({ role: 'assistant', content: welcomeMessage.response });
    
    return welcomeMessage;
  }

  /**
   * 处理用户回复
   */
  async processReply(sessionId, userMessage) {
    const context = this.conversations.get(sessionId);
    if (!context) {
      return { error: '会话不存在，请先开始问诊' };
    }

    // 记录用户消息
    context.conversation.push({ role: 'user', content: userMessage });
    
    // 提取信息
    const extracted = this.extractInformation(userMessage, context.round);
    context.customerInfo = { ...context.customerInfo, ...extracted.info };
    context.painPoints = [...new Set([...context.painPoints, ...extracted.painPoints])];
    context.extractedEntities = { ...context.extractedEntities, ...extracted.entities };
    
    // 调用LLM生成回复
    const llmResponse = await this.callLLM(context);
    
    // 更新上下文
    context.round++;
    context.conversation.push({ role: 'assistant', content: llmResponse.response });
    
    // 计算完整度
    const confidence = this.calculateConfidence(context);
    
    // 如果信息足够完整，生成推荐
    let recommendations = [];
    if (confidence > 0.8) {
      recommendations = this.generateRecommendations(context.painPoints, context.customerInfo);
    }
    
    return {
      response: llmResponse.response,
      nextQuestions: llmResponse.nextQuestions || [],
      extractedInfo: context.customerInfo,
      painPoints: context.painPoints,
      confidence,
      recommendedSystems: recommendations,
      isComplete: confidence > 0.9
    };
  }

  /**
   * 信息提取
   */
  extractInformation(message, round) {
    const info = {};
    const painPoints = [];
    const entities = {};
    
    // 第1轮: 基础信息
    if (round === 1) {
      // 户型类型
      if (/(平层|公寓|普通住宅)/.test(message)) info.houseType = 'flat';
      if (/(复式|跃层|loft)/i.test(message)) info.houseType = 'duplex';
      if (/(别墅|联排|独栋|叠拼)/.test(message)) info.houseType = 'villa';
      
      // 面积
      const areaMatch = message.match(/(\d+)\s*(平米|平|㎡|m2)/i);
      if (areaMatch) info.area = parseInt(areaMatch[1]);
      
      // 城市
      const cityMatch = message.match(/(北京|上海|广州|深圳|杭州|南京|成都|武汉|西安|重庆|苏州|天津|[\u4e00-\u9fa5]{2,5}(?:市|区))/);
      if (cityMatch) info.city = cityMatch[1];
    }
    
    // 第2轮: 家庭结构
    if (round === 2) {
      const memberMatch = message.match(/(\d+)\s*(口人|个人|人)/);
      if (memberMatch) info.familySize = parseInt(memberMatch[1]);
      
      if (/(老人|父母|长辈)/.test(message)) info.hasElderly = true;
      if (/(小孩|孩子|婴儿|宝宝)/.test(message)) info.hasChildren = true;
      if (/(宠物|狗|猫)/.test(message)) info.hasPets = true;
    }
    
    // 第3-5轮: 痛点挖掘
    if (round >= 3) {
      Object.entries(this.painPointKeywords).forEach(([keyword, tags]) => {
        if (message.includes(keyword)) {
          painPoints.push(...tags);
        }
      });
    }
    
    // 第5轮: 预算
    if (round === 5) {
      const budgetMatch = message.match(/(\d+)\s*万/);
      if (budgetMatch) info.budget = parseInt(budgetMatch[1]) * 10000;
      
      if (/(高|好|足|充裕)/.test(message)) info.budgetLevel = 'high';
      if (/(中|一般|普通)/.test(message)) info.budgetLevel = 'medium';
      if (/(低|紧|有限|省)/.test(message)) info.budgetLevel = 'low';
    }
    
    return { info, painPoints, entities };
  }

  /**
   * 调用LLM
   */
  async callLLM(context) {
    // 实际应调用OpenAI/Claude API
    // 这里提供模拟实现框架
    
    const messages = [
      { role: 'system', content: this.systemPrompts.diagnosis },
      ...context.conversation.map(c => ({ role: c.role, content: c.content })),
      { 
        role: 'system', 
        content: `当前是第${context.round}轮对话。
已提取信息: ${JSON.stringify(context.customerInfo)}
已识别痛点: ${context.painPoints.join(', ')}
请根据上下文生成回复。` 
      }
    ];

    // 模拟响应 (实际应调用API)
    return this.simulateLLMResponse(context);
  }

  simulateLLMResponse(context) {
    const round = context.round;
    const info = context.customerInfo;
    
    const responses = {
      2: {
        response: `了解了，您住在${info.city || '当地'}的${info.houseType === 'villa' ? '别墅' : info.houseType === 'duplex' ? '复式' : '平层'}，${info.area || ''}平米。

接下来想了解您家的居住情况：

1. 家里几口人住？
2. 有老人或小孩吗？
3. 养宠物吗？`,
        nextQuestions: ['家庭人口', '老人小孩', '宠物']
      },
      3: {
        response: `好的，${info.familySize || '您'}口之家${info.hasElderly ? '有老人' : ''}${info.hasChildren ? '有小孩' : ''}，对舒适度的要求确实会更高一些。

现在想了解一下，您家目前有哪些让您不满意的地方？比如：

- 热水方面：洗澡时要等很久才有热水？楼上楼下用水互相影响？
- 温度方面：冬天地暖不够暖？夏天空调直吹不舒服？
- 空气方面：灰尘大？潮湿发霉？有异味？`,
        nextQuestions: ['热水痛点', '温度痛点', '空气质量痛点']
      },
      4: {
        response: `明白了，${context.painPoints.length > 0 ? '您提到的' + context.painPoints.map(p => this.getPainPointName(p)).join('、') + '确实是很多家庭的困扰' : '看来您对现在的居住环境还算满意'}。

再了解一下您的使用习惯：

1. 一般几点起床睡觉？
2. 家里同时用热水的情况多吗？(比如洗澡的同时厨房用水)
3. 您对室内温度有什么偏好吗？`,
        nextQuestions: ['作息时间', '用水习惯', '温度偏好']
      },
      5: {
        response: `了解了，${info.hasElderly ? '有老人的话，24小时恒温恒湿确实很重要' : ''}${info.hasChildren ? '有小孩的话，空气质量和水质量要格外注意' : ''}。

最后想了解一下：

1. 您计划在舒适家居这块大概投入多少预算？
2. 您对瑞美/路德品牌有了解吗？
3. 您最看重的是节能省钱，还是极致舒适？`,
        nextQuestions: ['预算范围', '品牌认知', '优先级']
      },
      6: {
        response: `感谢您的耐心回答！根据您的情况，我为您整理了一份个性化方案建议：

**您的核心需求**: ${this.summarizeNeeds(context)}

**推荐系统**: 
${this.generateRecommendations(context.painPoints, info).map(r => `- ${r.system}: ${r.reason}`).join('\n')}

您希望我详细讲解哪个系统的原理和报价呢？`,
        nextQuestions: ['方案讲解', '报价咨询', '预约上门'],
        isComplete: true
      }
    };
    
    return responses[round] || { response: '请继续...', nextQuestions: [] };
  }

  getPainPointName(tag) {
    const names = {
      'tag_11': '热水等待', 'tag_12': '热水不足', 'tag_01': '温差大',
      'tag_02': '西晒', 'tag_22': '潮湿', 'tag_31': '灰尘',
      'tag_32': '过敏', 'tag_33': '水质', 'tag_41': '电费高'
    };
    return names[tag] || tag;
  }

  summarizeNeeds(context) {
    const parts = [];
    if (context.customerInfo.hasElderly) parts.push('老人舒适');
    if (context.customerInfo.hasChildren) parts.push('儿童健康');
    if (context.painPoints.includes('tag_11')) parts.push('热水即开即热');
    if (context.painPoints.includes('tag_01')) parts.push('恒温舒适');
    if (context.painPoints.includes('tag_22')) parts.push('除湿防霉');
    return parts.join(' + ') || '舒适升级';
  }

  generateRecommendations(painPoints, info) {
    const recommendations = [];
    const addedSystems = new Set();
    
    // 按优先级排序痛点
    const sortedPoints = painPoints.sort((a, b) => {
      const ruleA = this.recommendationRules[a];
      const ruleB = this.recommendationRules[b];
      return (ruleA?.priority || 9) - (ruleB?.priority || 9);
    });
    
    sortedPoints.forEach(tag => {
      const rule = this.recommendationRules[tag];
      if (rule && !addedSystems.has(rule.system)) {
        recommendations.push(rule);
        addedSystems.add(rule.system);
      }
    });
    
    // 预算适配
    if (info.budgetLevel === 'low') {
      // 优先推荐单系统
      return recommendations.slice(0, 2);
    }
    
    return recommendations;
  }

  calculateConfidence(context) {
    let score = 0;
    const info = context.customerInfo;
    
    if (info.houseType) score += 0.1;
    if (info.area) score += 0.1;
    if (info.city) score += 0.05;
    if (info.familySize) score += 0.1;
    if (info.hasElderly !== undefined || info.hasChildren !== undefined) score += 0.1;
    if (context.painPoints.length > 0) score += 0.2;
    if (context.round >= 5) score += 0.2;
    if (info.budgetLevel) score += 0.15;
    
    return Math.min(score, 1.0);
  }

  /**
   * 生成方案讲解
   */
  async generateExplanation(systemName, customerProfile) {
    const explanations = {
      '中央热水': {
        summary: '即开即热的全屋热水系统',
        principle: '就像家里的自来水管网一样，热水管也是环路设计，配合循环泵让热水24小时在管道里循环流动，所以任何一个水龙头打开就是热水。',
        benefits: [
          '洗澡不用等，即开即热',
          '楼上楼下同时用水互不影响',
          '比普通热水器省电30%'
        ],
        comparison: '普通热水器: 要等1-2分钟出热水，浪费水和时间 | 中央热水: 即开即热，舒适省心',
        roi: '每天省水约50L，一年省18000L；省等待时间每天15分钟，一年省90小时'
      },
      '五恒恒温': {
        summary: '恒温恒湿恒氧恒静恒洁的全屋气候系统',
        principle: '就像给房子装上了一个"智能肺"，通过地暖+辐射空调+新风联动，让室内温度均匀(±1℃)，湿度适中(40-60%)，空气新鲜。',
        benefits: [
          '没有空调直吹的干燥和不适',
          '温度均匀，不会忽冷忽热',
          '空气湿度适宜，皮肤不干燥'
        ],
        comparison: '传统空调: 直吹干燥、温度不均、噪音大 | 五恒系统: 无感舒适、全屋均匀、超静音',
        roi: '比普通空调地暖节能40%，100平房子一年省电费约3000元'
      },
      '新风除湿': {
        summary: '除湿+新风+净化三合一系统',
        principle: '就像给地下室装了一个"呼吸机"，把潮湿的空气抽出去，同时过滤新鲜空气进来，保持干爽清新。',
        benefits: [
          '地下室不再潮湿发霉',
          '空气新鲜无异味',
          '灰尘少，打扫轻松'
        ],
        comparison: '除湿机: 只除湿不换气，噪音大 | 新风除湿: 除湿+换气+净化，一机三用',
        roi: '保护装修和家具不发霉，延长使用寿命5-10年'
      }
    };
    
    return explanations[systemName] || { summary: systemName };
  }

  /**
   * 生成竞品对比话术
   */
  async generateComparison(competitor, ourSystem) {
    const comparisons = {
      '大金': {
        theirStrength: '品牌知名度高，VRV技术成熟',
        ourAdvantage: '瑞美140年热水专家，热泵技术领先；双品牌更灵活；服务体系更完善',
        keyPoint: '如果您更看重热水和整体舒适度，瑞美是更专业的选择'
      },
      '美的': {
        theirStrength: '性价比高，渠道覆盖广',
        ourAdvantage: '瑞美专注暖通百年，技术积淀更深；美国原装进口品质；专业安装服务',
        keyPoint: '舒适家居是长期投资，专业度和品质更重要'
      },
      '格力': {
        theirStrength: '空调技术强，品牌认知度高',
        ourAdvantage: '瑞美是全系统解决方案，不只是空调；热水+采暖+新风一体化设计',
        keyPoint: '格力是空调专家，瑞美是舒适家居专家'
      }
    };
    
    return comparisons[competitor] || { ourAdvantage: '瑞美140年专业积淀，全系统解决方案' };
  }

  /**
   * 获取对话历史
   */
  getConversationHistory(sessionId) {
    const context = this.conversations.get(sessionId);
    if (!context) return null;
    
    return {
      sessionId,
      startedAt: context.startedAt,
      rounds: context.round,
      conversation: context.conversation,
      finalRecommendations: context.painPoints.length > 0 ? this.generateRecommendations(context.painPoints, context.customerInfo) : []
    };
  }

  /**
   * 清除对话
   */
  clearConversation(sessionId) {
    this.conversations.delete(sessionId);
  }
}

module.exports = LLMDiagnosisEngine;
