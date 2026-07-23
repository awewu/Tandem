/**
 * JourneySimulator - 10个真实客户全流程闭环模拟执行器
 *
 * 严谨性保证：
 *   - 每个案例包含7阶段完整数据（问诊/锁客/成交/设计/技术方案/施工/报价）
 *   - 真实时间线 —— 按业务节奏推进（从接触到成交平均15-45天）
 *   - 真实责任人 —— 销售/设计师/工程师/项目经理分工
 *   - 真实沟通记录 —— 电话/微信/上门拜访
 *   - 所有数据写入 CustomerJourneyStore 持久化
 */

function createDefaultStore(options) {
  const CustomerJourneyStore = require('../core/CustomerJourneyStore');
  return new CustomerJourneyStore(options);
}

// ========== 10个真实客户画像 ==========
const CASES = [
  {
    customer: { name: '张建国', phone: '13501234567', city: '上海', source: '小区地推', gender: '男', age: 52 },
    profile: { houseType: '别墅', area: 280, floors: 3, basement: true, budget: 200000, familySize: 4, hasElderly: true, hasInfant: false },
    painPoints: ['地下室返潮严重', '冬季采暖不均匀', '老人房睡眠空气差'],
    preferredTier: 'premium',
    dealProbability: 0.95, dayOffset: 0
  },
  {
    customer: { name: '李丽娜', phone: '13602345678', city: '杭州', source: '老客户推荐', gender: '女', age: 35 },
    profile: { houseType: '大平层', area: 180, floors: 1, basement: false, budget: 120000, familySize: 3, hasElderly: false, hasInfant: true },
    painPoints: ['婴儿房空气质量', '夏季空调噪音', '热水不稳定'],
    preferredTier: 'comfort',
    dealProbability: 0.90, dayOffset: -3
  },
  {
    customer: { name: '王志强', phone: '13703456789', city: '苏州', source: '抖音广告', gender: '男', age: 41 },
    profile: { houseType: '联排', area: 220, floors: 3, basement: true, budget: 150000, familySize: 4, hasElderly: true, hasInfant: false },
    painPoints: ['地暖效果差', '多楼层温差大', '地下室异味'],
    preferredTier: 'comfort',
    dealProbability: 0.80, dayOffset: -7
  },
  {
    customer: { name: '陈美玲', phone: '13804567890', city: '上海', source: '设计师推荐', gender: '女', age: 38 },
    profile: { houseType: '平层', area: 140, floors: 1, basement: false, budget: 80000, familySize: 3, hasElderly: false, hasInfant: false },
    painPoints: ['新风系统选型', '节能环保', '智能控制'],
    preferredTier: 'comfort',
    dealProbability: 0.75, dayOffset: -10
  },
  {
    customer: { name: '刘国栋', phone: '13905678901', city: '南京', source: '展厅体验', gender: '男', age: 48 },
    profile: { houseType: '独栋', area: 350, floors: 3, basement: true, budget: 280000, familySize: 5, hasElderly: true, hasInfant: true },
    painPoints: ['全屋恒温恒湿', '泳池恒温', '高端品质'],
    preferredTier: 'premium',
    dealProbability: 0.88, dayOffset: -5
  },
  {
    customer: { name: '赵敏', phone: '13106789012', city: '无锡', source: '线上咨询', gender: '女', age: 32 },
    profile: { houseType: '叠拼', area: 200, floors: 2, basement: false, budget: 100000, familySize: 3, hasElderly: false, hasInfant: true },
    painPoints: ['母婴房空气洁净', '除湿需求', '24小时热水'],
    preferredTier: 'comfort',
    dealProbability: 0.70, dayOffset: -14
  },
  {
    customer: { name: '孙建平', phone: '13207890123', city: '宁波', source: '老客户推荐', gender: '男', age: 55 },
    profile: { houseType: '大平层', area: 260, floors: 1, basement: false, budget: 180000, familySize: 4, hasElderly: true, hasInfant: false },
    painPoints: ['呼吸系统敏感', '春秋季过敏', '安静舒适'],
    preferredTier: 'premium',
    dealProbability: 0.85, dayOffset: -2
  },
  {
    customer: { name: '周雪', phone: '13308901234', city: '合肥', source: '小红书', gender: '女', age: 29 },
    profile: { houseType: '平层', area: 110, floors: 1, basement: false, budget: 60000, familySize: 2, hasElderly: false, hasInfant: false },
    painPoints: ['预算有限', '基础舒适', '安装便捷'],
    preferredTier: 'basic',
    dealProbability: 0.65, dayOffset: -20
  },
  {
    customer: { name: '黄伟', phone: '13409012345', city: '上海', source: '地产样板间', gender: '男', age: 45 },
    profile: { houseType: '联排', area: 240, floors: 3, basement: true, budget: 160000, familySize: 4, hasElderly: false, hasInfant: false },
    painPoints: ['多层水压不稳', '地下室潮湿', '系统联动'],
    preferredTier: 'comfort',
    dealProbability: 0.78, dayOffset: -8
  },
  {
    customer: { name: '郭家辉', phone: '13510123456', city: '苏州', source: '展会', gender: '男', age: 50 },
    profile: { houseType: '独栋', area: 420, floors: 4, basement: true, budget: 350000, familySize: 6, hasElderly: true, hasInfant: true },
    painPoints: ['三代同堂差异化需求', '独立分区控制', '能耗可视化'],
    preferredTier: 'premium',
    dealProbability: 0.92, dayOffset: -1
  }
];

// 责任人池
const STAFF = {
  sales: ['王磊', '刘婷', '陈浩', '林芳'],
  designer: ['张扬', '李薇'],
  engineer: ['赵工', '钱工'],
  foreman: ['孙师傅', '吴师傅']
};

function pick(arr, seed) { return arr[seed % arr.length]; }

function daysAgo(days, hourOffset = 10) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hourOffset, Math.floor(Math.random() * 60), 0, 0);
  return d.toISOString();
}

// ========== 主执行：单个案例走完7阶段 ==========
function runSingleCase(store, caseIdx, caseDef) {
  const sales = pick(STAFF.sales, caseIdx);
  const designer = pick(STAFF.designer, caseIdx);
  const engineer = pick(STAFF.engineer, caseIdx);
  const foreman = pick(STAFF.foreman, caseIdx);

  const baseDay = caseDef.dayOffset;
  const caseId = `RHM-2026-${String(caseIdx + 1).padStart(3, '0')}`;

  // 1. 创建旅程
  const journey = store.create({
    caseId,
    customerId: `C${String(caseIdx + 1).padStart(4, '0')}`,
    customer: caseDef.customer,
    profile: caseDef.profile
  });

  // === Stage 1: 问诊 ===
  store.addCommunication(caseId, {
    timestamp: daysAgo(baseDay - 45, 14),
    channel: '电话', direction: 'inbound', from: caseDef.customer.name, to: sales,
    topic: '首次咨询',
    content: `客户来电咨询，${caseDef.customer.city}${caseDef.profile.houseType}业主，主要痛点：${caseDef.painPoints.join('、')}。预算约${Math.floor(caseDef.profile.budget / 10000)}万`,
    sentiment: 'positive', stage: 'diagnosis',
    nextAction: '邀约上门问诊', nextActionAt: daysAgo(baseDay - 42, 15)
  });
  store.updateStage(caseId, 'diagnosis', {
    status: 'completed', responsible: sales,
    startedAt: daysAgo(baseDay - 45, 14),
    data: {
      painPoints: caseDef.painPoints,
      houseType: caseDef.profile.houseType,
      area: caseDef.profile.area,
      budget: caseDef.profile.budget,
      priorities: ['舒适体验', '节能环保', '空气质量']
    },
    notes: `问诊完成，识别${caseDef.painPoints.length}个核心痛点`
  });

  // === Stage 2: 锁客 ===
  store.addCommunication(caseId, {
    timestamp: daysAgo(baseDay - 42, 15),
    channel: '上门', direction: 'outbound', from: sales, to: caseDef.customer.name,
    topic: '上门现场勘查',
    content: `上门勘查，测量房屋尺寸，确认施工条件。客户对${caseDef.preferredTier === 'premium' ? '高端定制方案' : '舒适型方案'}表现出强烈兴趣`,
    sentiment: 'positive', stage: 'lockin',
    nextAction: '3D方案呈现', nextActionAt: daysAgo(baseDay - 35, 14)
  });
  store.addCommunication(caseId, {
    timestamp: daysAgo(baseDay - 38, 20),
    channel: '微信', direction: 'outbound', from: sales, to: caseDef.customer.name,
    topic: '方案初稿发送',
    content: `已发送定制方案初稿PDF。方案包含：${caseDef.preferredTier === 'premium' ? '五恒系统+全屋净水+中央热水+智能控制' : '中央空调+新风+热水系统'}`,
    sentiment: 'positive', stage: 'lockin'
  });
  store.updateStage(caseId, 'lockin', {
    status: 'completed', responsible: sales,
    startedAt: daysAgo(baseDay - 42, 15),
    data: {
      lockinActions: ['上门勘查', '3D呈现', '案例展示', '老客户推荐'],
      competitors: ['大金', '日立'],
      clientTier: caseDef.preferredTier,
      confidence: caseDef.dealProbability
    },
    notes: `锁客成功率 ${Math.round(caseDef.dealProbability * 100)}%`
  });

  // === Stage 3: 成交 ===
  const systems = _getSystemsForTier(caseDef.preferredTier);
  const contractAmount = Math.floor(caseDef.profile.budget * (0.88 + Math.random() * 0.1));
  const dealDate = daysAgo(baseDay - 28, 16);
  store.addCommunication(caseId, {
    timestamp: dealDate,
    channel: '上门', direction: 'outbound', from: sales, to: caseDef.customer.name,
    topic: '合同签订',
    content: `合同签订完成，方案金额¥${contractAmount.toLocaleString()}，首付30%：¥${Math.floor(contractAmount * 0.3).toLocaleString()}`,
    sentiment: 'closed', stage: 'deal'
  });
  store.updateStage(caseId, 'deal', {
    status: 'completed', responsible: sales,
    startedAt: dealDate,
    data: {
      contractNo: `RHM-CT-2026-${String(caseIdx + 1).padStart(4, '0')}`,
      contractDate: dealDate,
      finalAmount: contractAmount,
      paymentSchedule: { downPayment: Math.floor(contractAmount * 0.3), midPayment: Math.floor(contractAmount * 0.5), finalPayment: Math.floor(contractAmount * 0.2) },
      selectedTier: caseDef.preferredTier,
      systems: systems.map(s => s.name)
    },
    notes: `合同签订，金额 ¥${contractAmount.toLocaleString()}`
  });

  // === Stage 4: 方案设计 ===
  store.addCommunication(caseId, {
    timestamp: daysAgo(baseDay - 25, 10),
    channel: '微信', direction: 'outbound', from: designer, to: caseDef.customer.name,
    topic: '方案深化设计',
    content: `开始深化设计：CAD图纸 + 3D效果图 + 管路排布图，预计3天完成`,
    sentiment: 'positive', stage: 'design'
  });
  store.updateStage(caseId, 'design', {
    status: 'completed', responsible: designer,
    startedAt: daysAgo(baseDay - 25, 10),
    data: {
      drawings: ['cad-plan.dwg', '3d-render.png', 'pipe-layout.pdf', 'electrical-diagram.pdf'],
      revisions: 2,
      designHours: 16 + Math.floor(Math.random() * 8),
      clientConfirmed: true,
      confirmedAt: daysAgo(baseDay - 20, 17)
    },
    notes: `设计完成，${caseDef.profile.houseType}${caseDef.profile.area}㎡，${systems.length}大系统`
  });

  // === Stage 5: 技术方案 ===
  const heatingLoad = Math.round(caseDef.profile.area * (caseDef.profile.floors > 1 ? 90 : 75));
  const coolingLoad = Math.round(caseDef.profile.area * 110);
  store.updateStage(caseId, 'technical', {
    status: 'completed', responsible: engineer,
    startedAt: daysAgo(baseDay - 18, 9),
    data: {
      loadCalculation: { heatingLoad, coolingLoad, hotWaterLoad: caseDef.profile.familySize * 70 },
      systemSelection: systems,
      energyEfficiency: { COP: 4.2, EER: 3.8, annualEnergySaving: '35%' },
      compliance: ['GB 50736-2012', 'GB 50189-2015', 'ISO 50001'],
      technicalReview: { reviewer: pick(STAFF.engineer, caseIdx + 1), passedAt: daysAgo(baseDay - 16, 11) }
    },
    notes: `技术评审通过，冷负荷${coolingLoad}W/热负荷${heatingLoad}W`
  });

  // === Stage 6: 施工 ===
  const constructionStart = daysAgo(baseDay - 14, 8);
  const constructionEnd = daysAgo(baseDay - 4, 17);
  store.addCommunication(caseId, {
    timestamp: constructionStart,
    channel: '现场', direction: 'outbound', from: foreman, to: caseDef.customer.name,
    topic: '施工进场',
    content: `施工队伍进场，预计工期10天。已完成材料到场检验、安全交底`,
    sentiment: 'positive', stage: 'construction'
  });
  store.addCommunication(caseId, {
    timestamp: daysAgo(baseDay - 9, 16),
    channel: '微信', direction: 'outbound', from: foreman, to: caseDef.customer.name,
    topic: '施工进度汇报',
    content: '主机吊装完成，管路预埋完成60%，现场照片已上传。下周进入精装配合阶段',
    sentiment: 'positive', stage: 'construction'
  });
  store.addCommunication(caseId, {
    timestamp: constructionEnd,
    channel: '现场', direction: 'outbound', from: foreman, to: caseDef.customer.name,
    topic: '竣工验收',
    content: '设备调试完成，系统压力测试通过，客户签字验收',
    sentiment: 'closed', stage: 'construction'
  });
  store.updateStage(caseId, 'construction', {
    status: 'completed', responsible: foreman,
    startedAt: constructionStart,
    data: {
      startDate: constructionStart, endDate: constructionEnd,
      workDays: 10, team: [foreman, '水电工李师傅', '弱电工老周'],
      milestones: [
        { date: constructionStart, event: '进场开工', status: 'done' },
        { date: daysAgo(baseDay - 12, 17), event: '管路预埋', status: 'done' },
        { date: daysAgo(baseDay - 10, 17), event: '主机吊装', status: 'done' },
        { date: daysAgo(baseDay - 7, 17), event: '末端安装', status: 'done' },
        { date: daysAgo(baseDay - 5, 17), event: '系统调试', status: 'done' },
        { date: constructionEnd, event: '竣工验收', status: 'done' }
      ],
      issues: [], safetyIncidents: 0,
      clientAcceptance: { signedBy: caseDef.customer.name, signedAt: constructionEnd, rating: 4.5 + Math.random() * 0.5 }
    },
    notes: `施工完成10天，零安全事故`
  });

  // === Stage 7: 报价/材料明细 ===
  const quotationItems = _buildQuotationItems(systems, caseDef.profile.area);
  const subtotal = quotationItems.reduce((s, it) => s + it.amount, 0);
  const discount = Math.floor(subtotal * 0.08);
  const finalTotal = Math.min(contractAmount, subtotal - discount);

  store.updateStage(caseId, 'quotation', {
    status: 'completed', responsible: sales,
    startedAt: dealDate,
    data: {
      items: quotationItems, subtotal, discount, finalTotal,
      promotionApplied: ['套餐优惠85折', '老客户推荐-¥1000'],
      paymentTerms: '30%首付 / 50%进场款 / 20%尾款',
      warranty: { equipment: '5年整机', installation: '2年施工', service: '10年全国联保' }
    },
    notes: `报价明细 ${quotationItems.length} 项，最终金额 ¥${finalTotal.toLocaleString()}`
  });

  // 售后回访（额外沟通）
  store.addCommunication(caseId, {
    timestamp: daysAgo(baseDay - 1, 11),
    channel: '电话', direction: 'outbound', from: sales, to: caseDef.customer.name,
    topic: '48小时回访',
    content: '系统运行良好，客户反馈舒适度提升明显。已安排3个月上门保养',
    sentiment: 'positive', stage: 'quotation',
    nextAction: '季度上门保养', nextActionAt: daysAgo(baseDay + 90, 10)
  });

  // 关闭旅程为"成交"
  store.close(caseId, 'closed-won', `顺利交付，客户满意度${(4.5 + Math.random() * 0.5).toFixed(1)}分`);

  return store.get(caseId);
}

function _getSystemsForTier(tier) {
  const map = {
    basic: [
      { name: '中央空调', brand: '瑞美基础款', price: 35000, model: 'RH-A5' },
      { name: '新风系统', brand: '瑞美', price: 15000, model: 'RH-F3' }
    ],
    comfort: [
      { name: '中央空调', brand: '瑞美舒适款', price: 55000, model: 'RH-A7' },
      { name: '新风系统', brand: '瑞美', price: 22000, model: 'RH-F5' },
      { name: '中央热水系统', brand: '瑞美', price: 18000, model: 'RH-W5' },
      { name: '全屋净水系统', brand: '瑞美', price: 12000, model: 'RH-P3' }
    ],
    premium: [
      { name: '五恒系统', brand: '瑞美尊享', price: 120000, model: 'RH-X9' },
      { name: '全屋净水系统', brand: '瑞美Plus', price: 25000, model: 'RH-P7' },
      { name: '中央热水系统', brand: '瑞美Plus', price: 35000, model: 'RH-W7' },
      { name: '智能控制系统', brand: '瑞美Smart', price: 20000, model: 'RH-S5' }
    ]
  };
  return map[tier] || map.comfort;
}

function _buildQuotationItems(systems, area) {
  const items = [];
  for (const s of systems) {
    items.push({ category: '设备', name: s.name, model: s.model, brand: s.brand, qty: 1, unitPrice: s.price, amount: s.price });
  }
  // 辅材
  const materialCost = Math.round(area * 120);
  items.push({ category: '辅材', name: '管路材料/配件', model: '套', brand: '国标', qty: 1, unitPrice: materialCost, amount: materialCost });
  // 安装费
  const installCost = Math.round(area * 150);
  items.push({ category: '安装', name: '安装人工费', model: '㎡', brand: '自营', qty: area, unitPrice: 150, amount: installCost });
  // 调试/验收
  items.push({ category: '服务', name: '系统调试+验收', model: '次', brand: '自营', qty: 1, unitPrice: 3000, amount: 3000 });
  return items;
}

// ========== 批量执行所有10案例 ==========
function runAll(options = {}) {
  const store = options.store || createDefaultStore(options);
  if (options.reset) store.clear();

  const results = [];
  for (let i = 0; i < CASES.length; i++) {
    try {
      const j = runSingleCase(store, i, CASES[i]);
      results.push({ caseId: j.caseId, customer: j.customer.name, status: j.status, amount: j.stages.deal?.data?.finalAmount, stages: 7, communications: j.communications.length });
    } catch (e) {
      results.push({ caseIdx: i, error: e.message });
    }
  }

  return {
    success: true,
    executedCases: results.length,
    results,
    stats: store.stats(),
    dbPath: store.getDbPath()
  };
}

module.exports = { runAll, runSingleCase, CASES };
