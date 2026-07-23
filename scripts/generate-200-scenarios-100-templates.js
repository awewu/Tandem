/**
 * 200组用户需求数据 + 100模板批量生成器
 * 基于2025年住房4.0标准 + 知名楼盘户型库
 */

const fs = require('fs');
const path = require('path');

// ==================== 基础数据池 ====================

// 主流城市 (50个)
const CITIES = {
  hot: [
    { name: '北京', tier: 1, climate: '寒冷', summerHigh: 36, winterLow: -8 },
    { name: '上海', tier: 1, climate: '夏热冬冷', summerHigh: 38, winterLow: 0 },
    { name: '广州', tier: 1, climate: '夏热冬暖', summerHigh: 36, winterLow: 8 },
    { name: '深圳', tier: 1, climate: '夏热冬暖', summerHigh: 35, winterLow: 10 },
    { name: '杭州', tier: 1, climate: '夏热冬冷', summerHigh: 38, winterLow: 1 }
  ],
  newTier1: [
    { name: '成都', tier: 1.5, climate: '夏热冬冷', summerHigh: 35, winterLow: 5 },
    { name: '南京', tier: 1.5, climate: '夏热冬冷', summerHigh: 38, winterLow: 0 },
    { name: '苏州', tier: 1.5, climate: '夏热冬冷', summerHigh: 38, winterLow: 0 },
    { name: '武汉', tier: 1.5, climate: '夏热冬冷', summerHigh: 38, winterLow: 0 },
    { name: '天津', tier: 1.5, climate: '寒冷', summerHigh: 35, winterLow: -7 },
    { name: '重庆', tier: 1.5, climate: '夏热冬冷', summerHigh: 40, winterLow: 5 },
    { name: '青岛', tier: 1.5, climate: '寒冷', summerHigh: 30, winterLow: -3 },
    { name: '宁波', tier: 1.5, climate: '夏热冬冷', summerHigh: 37, winterLow: 1 },
    { name: '厦门', tier: 1.5, climate: '夏热冬暖', summerHigh: 33, winterLow: 10 },
    { name: '长沙', tier: 1.5, climate: '夏热冬冷', summerHigh: 38, winterLow: 1 }
  ],
  tier2: [
    { name: '西安', tier: 2, climate: '寒冷', summerHigh: 40, winterLow: -5 },
    { name: '郑州', tier: 2, climate: '寒冷', summerHigh: 38, winterLow: -3 },
    { name: '济南', tier: 2, climate: '寒冷', summerHigh: 36, winterLow: -3 },
    { name: '合肥', tier: 2, climate: '夏热冬冷', summerHigh: 38, winterLow: 0 },
    { name: '福州', tier: 2, climate: '夏热冬暖', summerHigh: 37, winterLow: 8 },
    { name: '昆明', tier: 2, climate: '温和', summerHigh: 25, winterLow: 5 },
    { name: '大连', tier: 2, climate: '寒冷', summerHigh: 28, winterLow: -8 },
    { name: '哈尔滨', tier: 2, climate: '严寒', summerHigh: 28, winterLow: -25 },
    { name: '沈阳', tier: 2, climate: '严寒', summerHigh: 30, winterLow: -20 },
    { name: '长春', tier: 2, climate: '严寒', summerHigh: 28, winterLow: -23 }
  ]
};

// 全部知名楼盘 (基于住房4.0标准)
const PROJECTS_4_0 = [
  // 万科系
  { developer: '万科', name: '万科理想之地', city: '北京', grade: '改善型', price: 60000, area_range: [110, 180] },
  { developer: '万科', name: '万科·公园里', city: '上海', grade: '改善型', price: 75000, area_range: [95, 140] },
  { developer: '万科', name: '万科·璞悦', city: '深圳', grade: '高端型', price: 90000, area_range: [140, 220] },
  { developer: '万科', name: '万科·星城', city: '杭州', grade: '改善型', price: 50000, area_range: [89, 143] },
  { developer: '万科', name: '万科·都荟天地', city: '广州', grade: '改善型', price: 55000, area_range: [89, 128] },
  // 保利系
  { developer: '保利', name: '保利和光尘樾', city: '北京', grade: '高端型', price: 100000, area_range: [129, 260] },
  { developer: '保利', name: '保利天悦', city: '上海', grade: '高端型', price: 85000, area_range: [120, 180] },
  { developer: '保利', name: '保利·云上', city: '广州', grade: '改善型', price: 50000, area_range: [105, 158] },
  { developer: '保利', name: '保利·和光晨樾', city: '成都', grade: '改善型', price: 28000, area_range: [110, 168] },
  // 绿城系
  { developer: '绿城', name: '绿城·桂语听澜', city: '杭州', grade: '高端型', price: 80000, area_range: [140, 230] },
  { developer: '绿城', name: '绿城·凤起潮鸣', city: '杭州', grade: '高端型', price: 90000, area_range: [180, 280] },
  { developer: '绿城', name: '绿城·云栖玫瑰园', city: '北京', grade: '顶级型', price: 130000, area_range: [200, 500] },
  { developer: '绿城', name: '绿城·桃花源', city: '上海', grade: '别墅型', price: 150000, area_range: [300, 800] },
  { developer: '绿城', name: '绿城·诚园', city: '苏州', grade: '改善型', price: 50000, area_range: [125, 180] },
  // 龙湖系
  { developer: '龙湖', name: '龙湖·椿山万树', city: '北京', grade: '改善型', price: 65000, area_range: [89, 159] },
  { developer: '龙湖', name: '龙湖·璟云', city: '上海', grade: '改善型', price: 70000, area_range: [110, 168] },
  { developer: '龙湖', name: '龙湖·砚熙台', city: '广州', grade: '改善型', price: 50000, area_range: [95, 140] },
  { developer: '龙湖', name: '龙湖·原麓', city: '成都', grade: '改善型', price: 25000, area_range: [120, 188] },
  // 华润系
  { developer: '华润', name: '华润·瑞府', city: '北京', grade: '高端型', price: 110000, area_range: [144, 280] },
  { developer: '华润', name: '华润·万象府', city: '上海', grade: '高端型', price: 95000, area_range: [128, 220] },
  { developer: '华润', name: '华润·公元九里', city: '南京', grade: '改善型', price: 45000, area_range: [109, 168] },
  // 中海系
  { developer: '中海', name: '中海·寰宇时代', city: '上海', grade: '改善型', price: 80000, area_range: [95, 176] },
  { developer: '中海', name: '中海·学仕里', city: '北京', grade: '改善型', price: 75000, area_range: [89, 138] },
  { developer: '中海', name: '中海·汤臣一品', city: '上海', grade: '顶级型', price: 200000, area_range: [200, 600] },
  // 招商系
  { developer: '招商', name: '招商·依云四季', city: '深圳', grade: '改善型', price: 70000, area_range: [85, 158] },
  { developer: '招商', name: '招商·公园1872', city: '上海', grade: '改善型', price: 75000, area_range: [98, 168] },
  // 建发系
  { developer: '建发', name: '建发·央誉', city: '上海', grade: '高端型', price: 95000, area_range: [120, 230] },
  { developer: '建发', name: '建发·金茂玖玺', city: '北京', grade: '高端型', price: 115000, area_range: [150, 280] },
  // 滨江系
  { developer: '滨江', name: '滨江·武林壹号', city: '杭州', grade: '顶级型', price: 150000, area_range: [200, 500] },
  { developer: '滨江', name: '滨江·君品', city: '杭州', grade: '高端型', price: 80000, area_range: [110, 180] },
  // 金茂系 (科技住宅)
  { developer: '金茂', name: '北京金茂府', city: '北京', grade: '高端型', price: 120000, area_range: [130, 230] },
  { developer: '金茂', name: '上海金茂府', city: '上海', grade: '高端型', price: 110000, area_range: [140, 240] }
];

// 户型类型（住房4.0细分）
const HOUSE_TYPES = [
  // 刚需
  { type: 'studio', name: '开间公寓', area: [40, 55], rooms: '1房', target: '单身/年轻' },
  { type: '1B1B_compact', name: '紧凑一居', area: [55, 70], rooms: '1房1卫', target: '单身/丁克' },
  { type: '2B1B_basic', name: '基础两居', area: [70, 85], rooms: '2房1卫', target: '小三口/年轻' },
  { type: '2B2B_compact', name: '紧凑两居', area: [85, 100], rooms: '2房2卫', target: '三口之家' },
  // 改善
  { type: '3B2B_standard', name: '标准三居', area: [89, 120], rooms: '3房2卫', target: '改善型' },
  { type: '3B2B_premium', name: '舒适三居', area: [120, 145], rooms: '3房2卫', target: '改善高端' },
  { type: '3B3B_lux', name: '奢华三居', area: [140, 170], rooms: '3房3卫', target: '高端家庭' },
  { type: '4B2B_family', name: '家庭四居', area: [120, 145], rooms: '4房2卫', target: '多代同堂' },
  { type: '4B3B_premium', name: '舒适四居', area: [145, 180], rooms: '4房3卫', target: '高端改善' },
  // 高端
  { type: 'flat_180', name: '180大平层', area: [170, 220], rooms: '4房3卫', target: '塔尖客户' },
  { type: 'flat_220', name: '220大平层', area: [200, 260], rooms: '5房3卫', target: '资深成功' },
  { type: 'flat_280', name: '280大平层', area: [260, 320], rooms: '5房4卫', target: '富豪' },
  // 复式/Loft
  { type: 'duplex_140', name: '复式140', area: [130, 160], rooms: '4房3卫', target: '年轻有为' },
  { type: 'duplex_200', name: '复式200', area: [180, 240], rooms: '5房4卫', target: '高净值' },
  { type: 'loft_60', name: 'Loft小户', area: [50, 80], rooms: '上下层', target: '创业青年' },
  // 别墅
  { type: 'townhouse', name: '联排别墅', area: [200, 300], rooms: '5房5卫', target: '殷实家庭' },
  { type: 'semi_villa', name: '双拼别墅', area: [250, 400], rooms: '6房5卫', target: '富有家庭' },
  { type: 'villa_300', name: '独栋300', area: [300, 450], rooms: '6房5卫', target: '塔尖' },
  { type: 'villa_500', name: '独栋500', area: [450, 700], rooms: '7房6卫', target: '顶级' },
  { type: 'mansion', name: '豪宅500+', area: [500, 1200], rooms: '8房+', target: '终极' }
];

// 痛点池（基于真实需求调研）
const PAIN_POINTS = [
  // 温度类
  { id: 'P01', name: '冬天冷', severity: 'high', solutions: ['采暖', '地暖', '辐射'] },
  { id: 'P02', name: '夏天热', severity: 'high', solutions: ['空调', '中央空调', '辐射制冷'] },
  { id: 'P03', name: '室内温差大', severity: 'medium', solutions: ['全屋恒温', '辐射'] },
  { id: 'P04', name: '局部冷热不均', severity: 'medium', solutions: ['分区控制', 'VRV'] },
  // 湿度类
  { id: 'P05', name: '回南天潮湿', severity: 'high', solutions: ['除湿', 'DOAS新风'] },
  { id: 'P06', name: '冬季干燥', severity: 'medium', solutions: ['加湿', '恒湿系统'] },
  { id: 'P07', name: '霉菌滋生', severity: 'high', solutions: ['新风', '除湿', 'UV杀菌'] },
  // 空气类
  { id: 'P08', name: 'PM2.5高', severity: 'high', solutions: ['新风+HEPA', '净化器'] },
  { id: 'P09', name: '甲醛污染', severity: 'high', solutions: ['新风', '光触媒'] },
  { id: 'P10', name: 'CO2闷', severity: 'medium', solutions: ['DOAS', '智能新风'] },
  { id: 'P11', name: '过敏性鼻炎', severity: 'high', solutions: ['新风+HEPA13', '高效过滤'] },
  { id: 'P12', name: '宠物毛发', severity: 'medium', solutions: ['静电除尘', 'HEPA'] },
  // 热水类
  { id: 'P13', name: '热水等待久', severity: 'high', solutions: ['热水循环泵', '即热'] },
  { id: 'P14', name: '热水量不足', severity: 'high', solutions: ['容积式', '太阳能'] },
  { id: 'P15', name: '老人小孩烫伤风险', severity: 'high', solutions: ['防烫混合阀', '恒温'] },
  { id: 'P16', name: '燃气安全', severity: 'critical', solutions: ['热泵热水器', '电热'] },
  // 噪音类
  { id: 'P17', name: '空调外机噪音', severity: 'medium', solutions: ['静音外机', '隔音'] },
  { id: 'P18', name: '管道水流声', severity: 'low', solutions: ['吸音', '减振'] },
  { id: 'P19', name: '风管气流声', severity: 'medium', solutions: ['消音器', '降速'] },
  // 健康舒适类
  { id: 'P20', name: '睡眠质量差', severity: 'high', solutions: ['五恒系统', '智能温控'] },
  { id: 'P21', name: '老人膝关节不适', severity: 'medium', solutions: ['地暖', '辐射'] },
  { id: 'P22', name: '婴儿空气环境', severity: 'high', solutions: ['DOAS', '恒温恒湿'] },
  { id: 'P23', name: '居家办公舒适度', severity: 'medium', solutions: ['分区温控', '新风'] },
  // 节能类
  { id: 'P24', name: '电费太高', severity: 'high', solutions: ['热泵', '光伏', '变频'] },
  { id: 'P25', name: '燃气费太高', severity: 'medium', solutions: ['空气源热泵', '太阳能'] },
  // 智能化
  { id: 'P26', name: '系统手动操作繁琐', severity: 'medium', solutions: ['智能联动', '场景模式'] },
  { id: 'P27', name: '远程控制', severity: 'medium', solutions: ['Econet', 'IoT'] }
];

// 生成器
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return Math.random() * (max - min) + min; }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }
function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

const allCities = [...CITIES.hot, ...CITIES.newTier1, ...CITIES.tier2];

// ==================== 生成200组用户场景 ====================

function generate200Scenarios() {
  const scenarios = [];
  
  // 分布：50刚需 + 80改善 + 50高端 + 20别墅
  const distribution = [
    { count: 50, grades: ['刚需型'], houseTypeFilter: ['studio', '1B1B_compact', '2B1B_basic', '2B2B_compact'] },
    { count: 80, grades: ['改善型'], houseTypeFilter: ['3B2B_standard', '3B2B_premium', '4B2B_family', 'duplex_140'] },
    { count: 50, grades: ['高端型'], houseTypeFilter: ['3B3B_lux', '4B3B_premium', 'flat_180', 'flat_220', 'flat_280', 'duplex_200'] },
    { count: 20, grades: ['别墅型', '顶级型'], houseTypeFilter: ['townhouse', 'semi_villa', 'villa_300', 'villa_500', 'mansion'] }
  ];
  
  let id = 1;
  
  distribution.forEach(group => {
    for (let i = 0; i < group.count; i++) {
      const city = pick(allCities);
      const houseTypes = HOUSE_TYPES.filter(h => group.houseTypeFilter.includes(h.type));
      const houseType = pick(houseTypes);
      const area = rand(houseType.area[0], houseType.area[1]);
      
      // 选择项目（按城市和级别）
      const projectsInCity = PROJECTS_4_0.filter(p => p.city === city.name);
      const project = projectsInCity.length > 0 ? pick(projectsInCity) : null;
      
      // 选择痛点 (3-7个)
      const painCount = rand(3, 7);
      const pains = pickN(PAIN_POINTS, painCount);
      
      // 客户画像
      const ageBrackets = ['25-30', '30-40', '40-50', '50-60', '60+'];
      const incomeBrackets = ['年入30万', '年入50万', '年入80万', '年入100万', '年入200万', '年入500万+'];
      const familyTypes = ['单身', '小两口', '三口之家', '四口之家', '三代同堂'];
      
      // 预算（基于级别）
      const budgetMap = {
        '刚需型': [3, 8],
        '改善型': [8, 25],
        '高端型': [25, 60],
        '顶级型': [60, 200],
        '别墅型': [50, 500]
      };
      const grade = group.grades[0];
      const budget = rand(budgetMap[grade][0], budgetMap[grade][1]);
      
      // 系统需求（基于级别）
      const systemsMap = {
        '刚需型': ['空调', '热水器'],
        '改善型': ['中央空调', '采暖', '热水器', '新风'],
        '高端型': ['VRV/VRF', '地暖', '热水循环', 'DOAS新风', '净水'],
        '顶级型': ['五恒系统', 'DOAS', '热水循环', '净水软水', '全屋智能', 'CFD优化'],
        '别墅型': ['五恒+VRV', '地暖+辐射', '中央热水', 'DOAS新风', '净水软水', '泳池设备', '全屋智能', '光伏']
      };
      const systems = systemsMap[grade] || systemsMap['改善型'];
      
      scenarios.push({
        id: `S${String(id).padStart(3, '0')}`,
        // 客户信息
        customer: {
          name: `客户${id}`,
          age: pick(ageBrackets),
          income: pick(incomeBrackets),
          family: pick(familyTypes),
          occupation: pick(['企业高管', '医生', 'IT工程师', '创业者', '律师', '教师', '公务员', '金融', '设计师', '退休'])
        },
        // 项目信息
        project: {
          city: city.name,
          tier: city.tier,
          climate: city.climate,
          summerHigh: city.summerHigh,
          winterLow: city.winterLow,
          name: project ? project.name : `${city.name}某楼盘`,
          developer: project ? project.developer : '其他',
          isHouse40: project ? true : Math.random() > 0.3, // 70%住房4.0标准
          unitPrice: project ? project.price : pick([20000, 30000, 40000, 50000, 60000, 80000])
        },
        // 户型信息
        house: {
          type: houseType.type,
          name: houseType.name,
          area: area,
          rooms: houseType.rooms,
          ceilingHeight: project && project.developer ? 3.0 : pick([2.8, 3.0, 3.3]), // 住房4.0要求3.0+
          orientation: pick(['南北通透', '南向', '东南向', '西南向']),
          floors: houseType.type.includes('villa') || houseType.type.includes('duplex') ? rand(2, 3) : 1
        },
        // 需求级别
        grade,
        // 痛点
        painPoints: pains.map(p => p.id),
        painPointDetails: pains,
        // 系统需求
        systemsRequired: systems,
        // 预算
        budget: budget * 10000,
        budgetCN: `${budget}万`,
        // 期望
        expectations: pickN([
          '德系工艺品质',
          '日系节能精细',
          '美系大气豪华',
          '智能化全屋',
          '20年质保',
          '免维护',
          '一体化交付',
          '原装进口',
          '低噪音',
          '健康呼吸',
          '老人小孩友好',
          '宠物友好',
          '快速响应'
        ], rand(3, 6)),
        // 时间
        timeline: pick(['1个月', '2个月', '3个月', '半年', '装修期内', '入住前']),
        // 决策因素
        decisionFactors: pickN(['品牌', '价格', '工艺', '服务', '案例', '设计师', '工期', '质保'], rand(3, 5)),
        // 来源
        source: pick(['搜索引擎', '小红书', '抖音', '设计师推荐', '朋友介绍', '展厅咨询', '小区推广']),
        // 创建时间
        createdAt: new Date(Date.now() - rand(0, 90) * 86400000).toISOString().split('T')[0]
      });
      
      id++;
    }
  });
  
  return scenarios;
}

// ==================== 生成100个模板 ====================

function generate100Templates() {
  const templates = [];
  let id = 1;
  
  // 25个刚需模板
  HOUSE_TYPES.filter(h => ['studio', '1B1B_compact', '2B1B_basic', '2B2B_compact'].includes(h.type)).forEach(ht => {
    [3, 4, 5].forEach(citySize => {
      ['夏热冬冷', '夏热冬暖', '寒冷'].forEach(climate => {
        if (id <= 25) {
          templates.push(createTemplate(id++, '刚需', ht, climate, '经济型'));
        }
      });
    });
  });
  
  // 40个改善模板
  HOUSE_TYPES.filter(h => ['3B2B_standard', '3B2B_premium', '4B2B_family', 'duplex_140'].includes(h.type)).forEach(ht => {
    ['夏热冬冷', '夏热冬暖', '寒冷', '严寒', '温和'].forEach(climate => {
      ['标准', '舒适', '智能'].forEach(grade => {
        if (id <= 65) {
          templates.push(createTemplate(id++, '改善', ht, climate, grade));
        }
      });
    });
  });
  
  // 25个高端模板
  const highEndTypes = HOUSE_TYPES.filter(h => ['3B3B_lux', '4B3B_premium', 'flat_180', 'flat_220', 'flat_280', 'duplex_200'].includes(h.type));
  ['夏热冬冷', '夏热冬暖', '寒冷', '严寒', '温和'].forEach(climate => {
    highEndTypes.forEach(ht => {
      if (id <= 90) {
        templates.push(createTemplate(id++, '高端', ht, climate, '豪华'));
      }
    });
  });
  
  // 10个别墅模板  
  const villaTypes = HOUSE_TYPES.filter(h => ['townhouse', 'semi_villa', 'villa_300', 'villa_500', 'mansion'].includes(h.type));
  ['夏热冬冷', '夏热冬暖'].forEach(climate => {
    villaTypes.forEach(ht => {
      if (id <= 100) {
        templates.push(createTemplate(id++, '别墅', ht, climate, '顶级'));
      }
    });
  });
  
  // 补齐到100
  while (templates.length < 100) {
    const ht = pick(HOUSE_TYPES);
    const climate = pick(['夏热冬冷', '夏热冬暖', '寒冷', '严寒', '温和']);
    const grade = pick(['标准', '舒适', '智能', '豪华', '顶级']);
    const cat = ht.area[0] < 90 ? '刚需' : ht.area[0] < 145 ? '改善' : ht.area[0] < 220 ? '高端' : '别墅';
    templates.push(createTemplate(id++, cat, ht, climate, grade));
  }
  
  return templates.slice(0, 100);
}

function createTemplate(id, category, houseType, climate, grade) {
  const area = (houseType.area[0] + houseType.area[1]) / 2;
  
  // 系统配置（基于级别+气候）
  const config = generateSystemConfig(category, climate, grade, area);
  
  return {
    id: `TPL-${String(id).padStart(3, '0')}`,
    name: `${category}-${houseType.name}-${climate}气候-${grade}`,
    category,
    grade,
    climate,
    houseType: houseType.type,
    area: Math.round(area),
    rooms: houseType.rooms,
    target: houseType.target,
    
    // 系统设计
    systems: config.systems,
    
    // 设备清单
    equipment: config.equipment,
    
    // 工程量
    quantity: config.quantity,
    
    // 价格
    pricing: {
      hardware: config.hardware,
      installation: config.installation,
      total: config.hardware + config.installation,
      pricePerM2: Math.round((config.hardware + config.installation) / area)
    },
    
    // 性能指标
    performance: {
      coolingLoad: Math.round(area * (climate === '夏热冬暖' ? 180 : 150)),     // W/m²
      heatingLoad: Math.round(area * (climate === '严寒' ? 120 : climate === '寒冷' ? 90 : 60)),
      airChangeRate: grade === '豪华' || grade === '顶级' ? 1.0 : 0.5,             // ACH
      noiseLevel: grade === '顶级' ? 28 : grade === '豪华' ? 32 : 38,                 // dB
      energyClass: grade === '顶级' ? 'A++' : grade === '豪华' ? 'A+' : 'A',
      pmv: '-0.5~+0.5',
      ppd: grade === '顶级' ? 5 : grade === '豪华' ? 8 : 10
    },
    
    // 适用场景
    applicableScenarios: generateScenarios(category, climate, area),
    
    // 痛点匹配
    targetPainPoints: generateTargetPains(category, climate, grade),
    
    // 标签
    tags: [category, climate, grade, houseType.target, ...(grade === '顶级' ? ['五恒', 'DOAS', 'AI'] : [])],
    
    // 适配品牌
    compatibleBrands: ['Rheem', 'Ruud', '恒热', '瑞诺瓦'],
    
    // 售后
    warranty: grade === '顶级' ? '20年' : grade === '豪华' ? '15年' : '10年',
    
    // 工期
    duration: category === '别墅' ? '60-90天' : category === '高端' ? '30-45天' : '15-25天',
    
    // 创建信息
    createdAt: new Date().toISOString(),
    rating: randFloat(4.5, 5.0).toFixed(1),
    callCount: rand(5, 100)
  };
}

function generateSystemConfig(category, climate, grade, area) {
  const config = {
    systems: [],
    equipment: [],
    quantity: {},
    hardware: 0,
    installation: 0
  };
  
  // 空调
  if (climate.includes('热')) {
    const acType = grade === '顶级' ? 'VRV+辐射制冷' : 
                   grade === '豪华' ? 'VRV多联机' :
                   grade === '智能' ? '中央空调' : '分体空调';
    const acPrice = grade === '顶级' ? area * 1200 :
                    grade === '豪华' ? area * 800 :
                    grade === '智能' ? area * 500 : area * 200;
    config.systems.push({ type: '空调', config: acType });
    config.hardware += acPrice;
    config.equipment.push({
      category: '空调系统',
      items: [
        { name: '室外机', model: grade === '顶级' ? 'RH-OD200-INV' : 'RH-OD120', qty: Math.ceil(area / 100) },
        { name: '室内机', model: 'RHI-25T/36T/45T', qty: Math.ceil(area / 25) }
      ]
    });
  }
  
  // 采暖
  if (climate === '寒冷' || climate === '严寒' || climate === '夏热冬冷') {
    const heatType = grade === '顶级' ? '空气源热泵+地暖+辐射' :
                     grade === '豪华' ? '燃气壁挂炉+地暖' :
                     grade === '智能' ? '燃气壁挂炉+暖气片' : '电暖';
    const heatPrice = grade === '顶级' ? area * 800 :
                      grade === '豪华' ? area * 400 :
                      grade === '智能' ? area * 250 : area * 100;
    config.systems.push({ type: '采暖', config: heatType });
    config.hardware += heatPrice;
    config.equipment.push({
      category: '采暖系统',
      items: [
        { name: grade === '顶级' ? '热泵主机' : '燃气壁挂炉', model: 'RH-B24/HP-12', qty: 1 },
        { name: '分集水器', model: 'RH-MF8', qty: Math.ceil(area / 80) },
        { name: '地暖管', model: 'PEX DN20', qty: `${Math.ceil(area * 5)}m` }
      ]
    });
  }
  
  // 热水
  const waterType = grade === '顶级' ? '空气源热泵+太阳能+循环' :
                    grade === '豪华' ? '空气源热泵+循环泵' :
                    grade === '智能' ? '燃气热水器+循环' : '燃气热水器';
  const waterPrice = grade === '顶级' ? 28000 : grade === '豪华' ? 15000 : grade === '智能' ? 8000 : 4500;
  config.systems.push({ type: '热水', config: waterType });
  config.hardware += waterPrice;
  config.equipment.push({
    category: '热水系统',
    items: [
      { name: '热水器', model: grade === '顶级' ? 'HPWH-500L' : 'RGE-80', qty: 1 },
      { name: '循环泵', model: 'WP-RS25', qty: grade !== '经济型' ? 1 : 0 }
    ]
  });
  
  // 新风（住房4.0必配）
  const freshType = grade === '顶级' ? '五恒系统(DOAS+恒温恒湿)' :
                    grade === '豪华' ? 'DOAS新风+热回收' :
                    grade === '智能' ? '全热交换新风' : '基础新风';
  const freshPrice = grade === '顶级' ? area * 600 : 
                     grade === '豪华' ? area * 350 :
                     grade === '智能' ? area * 200 : area * 100;
  config.systems.push({ type: '新风', config: freshType });
  config.hardware += freshPrice;
  config.equipment.push({
    category: '新风系统',
    items: [
      { name: '新风主机', model: grade === '顶级' ? 'DOAS-1000' : 'FRESH-350', qty: Math.ceil(area / 200) },
      { name: '送风口', model: 'OUT-200', qty: Math.ceil(area / 30) },
      { name: 'HEPA滤芯', model: 'H13', qty: Math.ceil(area / 100) }
    ]
  });
  
  // 净水（高端配置）
  if (grade === '顶级' || grade === '豪华' || grade === '智能') {
    const waterPurifyPrice = grade === '顶级' ? 45000 : grade === '豪华' ? 18000 : 8000;
    config.systems.push({ type: '净水', config: '前置+软水+末端RO' });
    config.hardware += waterPurifyPrice;
  }
  
  // 智能控制
  if (category === '高端' || category === '别墅') {
    config.systems.push({ type: '智能控制', config: '全屋IoT+场景联动' });
    config.hardware += 25000;
  }
  
  // 安装费
  config.installation = Math.round(config.hardware * 0.25);
  
  return config;
}

function generateScenarios(category, climate, area) {
  const scenarios = [];
  if (category === '刚需') scenarios.push('首套房', '小两口', '出租');
  if (category === '改善') scenarios.push('换房', '三口之家', '老人同住');
  if (category === '高端') scenarios.push('改善升级', '商务接待', '塔尖客户');
  if (category === '别墅') scenarios.push('终极住宅', '家族传承');
  if (climate.includes('热')) scenarios.push('夏季舒适', '潮湿应对');
  if (climate.includes('冷')) scenarios.push('采暖需求', '保温节能');
  return scenarios;
}

function generateTargetPains(category, climate, grade) {
  const pains = [];
  if (climate.includes('热')) pains.push('P02', 'P03', 'P05');
  if (climate.includes('冷')) pains.push('P01', 'P03', 'P21');
  if (grade === '顶级' || grade === '豪华') pains.push('P08', 'P11', 'P20', 'P22');
  pains.push('P13', 'P14');
  if (category === '别墅' || grade === '顶级') pains.push('P15', 'P26');
  return [...new Set(pains)];
}

// ==================== 执行生成 ====================

const scenarios = generate200Scenarios();
const templates = generate100Templates();

// 写入文件
const dataDir = path.join(__dirname, '..', 'test-data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

fs.writeFileSync(
  path.join(dataDir, '200-user-scenarios.json'),
  JSON.stringify({
    version: 'v8.0',
    generatedAt: new Date().toISOString(),
    standard: 'GB 55013-2025 住宅项目规范 (住房4.0)',
    count: scenarios.length,
    distribution: {
      '刚需型': scenarios.filter(s => s.grade === '刚需型').length,
      '改善型': scenarios.filter(s => s.grade === '改善型').length,
      '高端型': scenarios.filter(s => s.grade === '高端型').length,
      '顶级型': scenarios.filter(s => s.grade === '顶级型').length,
      '别墅型': scenarios.filter(s => s.grade === '别墅型').length
    },
    cities: [...new Set(scenarios.map(s => s.project.city))].length,
    developers: [...new Set(scenarios.map(s => s.project.developer))].filter(Boolean),
    scenarios
  }, null, 2),
  'utf8'
);

fs.writeFileSync(
  path.join(dataDir, '100-templates-library.json'),
  JSON.stringify({
    version: 'v8.0',
    generatedAt: new Date().toISOString(),
    count: templates.length,
    distribution: {
      '刚需': templates.filter(t => t.category === '刚需').length,
      '改善': templates.filter(t => t.category === '改善').length,
      '高端': templates.filter(t => t.category === '高端').length,
      '别墅': templates.filter(t => t.category === '别墅').length
    },
    templates
  }, null, 2),
  'utf8'
);

console.log('\n' + '='.repeat(80));
console.log('🎉 200组用户数据 + 100模板批量生成完成');
console.log('='.repeat(80));

console.log(`\n📊 用户场景分布 (${scenarios.length}组):`);
console.log(`   刚需型: ${scenarios.filter(s => s.grade === '刚需型').length}`);
console.log(`   改善型: ${scenarios.filter(s => s.grade === '改善型').length}`);
console.log(`   高端型: ${scenarios.filter(s => s.grade === '高端型').length}`);
console.log(`   顶级型: ${scenarios.filter(s => s.grade === '顶级型').length}`);
console.log(`   别墅型: ${scenarios.filter(s => s.grade === '别墅型').length}`);
console.log(`   覆盖城市: ${[...new Set(scenarios.map(s => s.project.city))].length}`);
console.log(`   涉及开发商: ${[...new Set(scenarios.map(s => s.project.developer))].filter(Boolean).join(',')}`);

console.log(`\n📚 模板库分布 (${templates.length}个):`);
console.log(`   刚需类: ${templates.filter(t => t.category === '刚需').length}`);
console.log(`   改善类: ${templates.filter(t => t.category === '改善').length}`);
console.log(`   高端类: ${templates.filter(t => t.category === '高端').length}`);
console.log(`   别墅类: ${templates.filter(t => t.category === '别墅').length}`);

console.log('\n📁 生成的文件:');
console.log(`   test-data/200-user-scenarios.json (${(JSON.stringify(scenarios).length / 1024).toFixed(1)}KB)`);
console.log(`   test-data/100-templates-library.json (${(JSON.stringify(templates).length / 1024).toFixed(1)}KB)`);

console.log('\n💰 价格范围:');
const prices = templates.map(t => t.pricing.total);
console.log(`   模板最低: ¥${Math.min(...prices).toLocaleString()}`);
console.log(`   模板最高: ¥${Math.max(...prices).toLocaleString()}`);
console.log(`   平均价格: ¥${Math.round(prices.reduce((a, b) => a + b, 0) / prices.length).toLocaleString()}`);

console.log('\n' + '='.repeat(80) + '\n');
