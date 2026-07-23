/**
 * 100组完整测试数据生成器
 * 覆盖8大角色、100个客户、100个项目的完整闭环
 */

const fs = require('fs');
const path = require('path');

// 辅助函数
const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const generatePhone = () => `1${random([3, 4, 5, 6, 7, 8, 9])}${randomInt(100000000, 999999999)}`;
const generateDate = (daysAgo = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};

// 姓名库
const surnames = ['王', '李', '张', '刘', '陈', '杨', '黄', '赵', '吴', '周', '徐', '孙', '马', '朱', '胡', '郭', '何', '林', '高', '罗'];
const names = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '涛', '明', '超', '秀英', '华', '鹏', '飞', '婷', '宇', '浩', '欣', '雨', '晨', '轩', '昊', '瑞', '嘉'];
const generateName = () => random(surnames) + random(names);

// 城市库
const cities = [
  { name: '北京', tier: 1 }, { name: '上海', tier: 1 }, { name: '广州', tier: 1 }, { name: '深圳', tier: 1 },
  { name: '杭州', tier: 2 }, { name: '南京', tier: 2 }, { name: '苏州', tier: 2 }, { name: '成都', tier: 2 },
  { name: '武汉', tier: 2 }, { name: '西安', tier: 2 }, { name: '重庆', tier: 2 }, { name: '天津', tier: 2 },
  { name: '青岛', tier: 2 }, { name: '宁波', tier: 2 }, { name: '无锡', tier: 2 }, { name: '佛山', tier: 2 },
  { name: '东莞', tier: 2 }, { name: '长沙', tier: 2 }, { name: '郑州', tier: 2 }, { name: '济南', tier: 2 },
  { name: '沈阳', tier: 2 }, { name: '大连', tier: 2 }, { name: '厦门', tier: 2 }, { name: '福州', tier: 2 }
];

// 23项痛点库
const painPoints = [
  { id: 'winter_cold', name: '冬天孩子房间温度不够', category: '温度' },
  { id: 'summer_dry', name: '空调吹得太干燥', category: '湿度' },
  { id: 'noise_disturb', name: '室外机噪音影响睡眠', category: '噪音' },
  { id: 'allergy_dust', name: '孩子过敏体质，灰尘多', category: '空气' },
  { id: 'humidity_mold', name: '梅雨季节墙面发霉', category: '湿度' },
  { id: 'hot_water_wait', name: '热水等待时间长', category: '热水' },
  { id: 'energy_cost', name: '电费太高', category: '能耗' },
  { id: 'temp_uneven', name: '房间温度不均匀', category: '温度' },
  { id: 'ac_draft', name: '空调直吹不舒服', category: '舒适' },
  { id: 'air_stuffy', name: '房间闷，空气不流通', category: '空气' },
  { id: 'smell_kitchen', name: '厨房油烟味串到客厅', category: '空气' },
  { id: 'water_pressure', name: '高层水压不稳', category: '热水' },
  { id: 'heating_cost', name: '暖气费太贵', category: '能耗' },
  { id: 'bathroom_cold', name: '卫生间冬天太冷', category: '温度' },
  { id: 'sleep_quality', name: '睡眠质量差', category: '舒适' }
];

// 户型库
const houseTypes = [
  { type: 'apartment', area: 89, rooms: '2室2厅', price: 42000 },
  { type: 'apartment', area: 120, rooms: '3室2厅', price: 68000 },
  { type: 'apartment', area: 135, rooms: '3室2厅', price: 78000 },
  { type: 'apartment', area: 150, rooms: '4室2厅', price: 88000 },
  { type: 'villa', area: 280, rooms: '5室3厅', price: 158000 },
  { type: 'villa', area: 350, rooms: '6室4厅', price: 198000 },
  { type: 'villa', area: 450, rooms: '7室5厅', price: 268000 },
  { type: 'commercial', area: 200, rooms: '办公空间', price: 120000 }
];

// 生成8大角色用户 (每角色3人 = 24人)
function generateUsers() {
  const roles = [
    { role: 'super_admin', name: '超级管理员', stores: [] },
    { role: 'hq_admin', name: '总部管理员', stores: [] },
    { role: 'hq_ops', name: '总部运营', stores: [] },
    { role: 'store_admin', name: '门店管理员', stores: [1, 2, 3, 4, 5, 6, 7, 8] },
    { role: 'designer', name: '设计师', stores: [1, 2, 3, 4, 5, 6, 7, 8] },
    { role: 'sales', name: '销售顾问', stores: [1, 2, 3, 4, 5, 6, 7, 8] },
    { role: 'tech_support', name: '技术支持', stores: [1, 2, 3, 4, 5, 6, 7, 8] },
    { role: 'construction_mgr', name: '施工管理', stores: [1, 2, 3, 4, 5, 6, 7, 8] }
  ];

  const users = [];
  let id = 1;

  roles.forEach(roleDef => {
    for (let i = 1; i <= 3; i++) {
      const assignedStores = roleDef.stores.length > 0
        ? roleDef.stores.slice((i - 1) * 2, i * 2)
        : [];

      users.push({
        id: id++,
        phone: generatePhone(),
        password: '123456',
        role: roleDef.role,
        name: generateName(),
        title: roleDef.name,
        storeIds: assignedStores,
        status: 'active',
        avatar: `/avatars/${roleDef.role}_${i}.png`,
        profile: {
          expertise: random(['暖通设计', '销售管理', '技术方案', '施工管理', '客户服务']),
          experience: randomInt(1, 10) + '年',
          certifications: ['Rheem认证', 'Ruud认证'].slice(0, randomInt(1, 2))
        },
        stats: {
          projects: randomInt(0, 50),
          customers: randomInt(0, 100),
          revenue: randomInt(0, 5000000)
        },
        createdAt: generateDate(randomInt(30, 365))
      });
    }
  });

  return users;
}

// 生成门店 (8个)
function generateStores() {
  const storeNames = [
    '瑞美旗舰店', '瑞美体验中心', '瑞美专卖店', '瑞美旗舰店',
    'Ruud旗舰店', 'Ruud体验店', '双品牌旗舰店', '区域旗舰店'
  ];

  return cities.slice(0, 8).map((city, i) => ({
    id: i + 1,
    name: `${city.name}${storeNames[i]}`,
    city: city.name,
    tier: city.tier,
    address: `${city.name}市${random(['朝阳区', '海淀区', '黄浦区', '浦东新区', '天河区', '南山区'])}路${randomInt(100, 999)}号`,
    phone: generatePhone(),
    managerId: i + 10, // 门店管理员ID
    status: 'active',
    stats: {
      customers: randomInt(50, 500),
      projects: randomInt(20, 200),
      revenue: randomInt(1000000, 10000000),
      completionRate: randomInt(85, 99)
    },
    members: [],
    createdAt: generateDate(randomInt(100, 365))
  }));
}

// 生成100个客户
function generateCustomers(users) {
  const salesUsers = users.filter(u => u.role === 'sales');
  const sources = ['walkin', 'referral', 'online', 'ads', 'partner'];
  const statuses = ['new', 'contacted', 'diagnosed', 'quoting', 'negotiating', 'contracted', 'completed'];

  return Array.from({ length: 100 }, (_, i) => {
    const house = random(houseTypes);
    const assignedSales = random(salesUsers);

    return {
      id: i + 1,
      customerNo: `CUST-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`,
      name: generateName(),
      phone: generatePhone(),
      wechat: `wx_${generatePhone()}`,
      source: random(sources),
      status: random(statuses),
      tags: [
        random(['别墅客户', '公寓客户', '商用客户']),
        random(['高意向', '中意向', '低意向']),
        random(['预算充足', '预算有限', '价格敏感'])
      ],
      profile: {
        area: house.area,
        rooms: house.rooms,
        houseType: house.type,
        budget: house.price * randomInt(8, 15) / 10,
        family: {
          members: randomInt(2, 6),
          children: randomInt(0, 2),
          elderly: randomInt(0, 2)
        },
        preferences: {
          style: random(['简约', '欧式', '中式', '现代']),
          priority: random(['舒适', '节能', '静音', '智能']),
          timeline: random(['1个月内', '3个月内', '半年内', '一年内'])
        }
      },
      assignedSalesId: assignedSales.id,
      assignedStoreId: assignedSales.storeIds[0],
      painPoints: [], // 在AI问诊后填充
      lastContactAt: generateDate(randomInt(0, 30)),
      createdAt: generateDate(randomInt(1, 90)),
      notes: [
        { date: generateDate(randomInt(1, 30)), content: '客户咨询暖气方案', author: assignedSales.name },
        { date: generateDate(randomInt(1, 15)), content: '已预约上门量房', author: assignedSales.name }
      ]
    };
  });
}

// 生成100个项目 (从客户转化)
function generateProjects(customers, users) {
  const designers = users.filter(u => u.role === 'designer');
  const constructionMgrs = users.filter(u => u.role === 'construction_mgr');
  const stages = [
    { status: 'diagnosis', progress: 20, days: 1 },
    { status: 'design', progress: 40, days: 3 },
    { status: 'quotation', progress: 60, days: 5 },
    { status: 'approval', progress: 70, days: 7 },
    { status: 'contract', progress: 80, days: 10 },
    { status: 'construction', progress: 90, days: 30 },
    { status: 'completed', progress: 100, days: 45 }
  ];

  return customers.map((customer, i) => {
    const stage = random(stages);
    const designer = random(designers);
    const constructionMgr = stage.status === 'construction' || stage.status === 'completed'
      ? random(constructionMgrs)
      : null;

    // 生成AI问诊数据
    const customerPainPoints = Array.from({ length: randomInt(3, 6) }, () => random(painPoints));
    const matchedSystems = ['空调', '地暖', '新风', '热水'].slice(0, randomInt(2, 4));

    // 生成报价
    const basePrice = customer.profile.budget;
    const discount = randomInt(5, 15);
    const finalPrice = Math.round(basePrice * (100 - discount) / 100);
    const needsApproval = finalPrice > 100000;

    return {
      id: i + 1,
      projectNo: `PRJ-${new Date().getFullYear()}-${String(i + 1).padStart(5, '0')}`,
      customerId: customer.id,
      customerName: customer.name,
      salesId: customer.assignedSalesId,
      designerId: designer.id,
      constructionMgrId: constructionMgr?.id,

      status: stage.status,
      progress: stage.progress,

      // AI问诊数据
      diagnosis: {
        painPoints: customerPainPoints.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          severity: randomInt(1, 5)
        })),
        matchedSystems: matchedSystems,
        aiRecommendations: matchedSystems.map(s => `${s}系统推荐`),
        timestamp: generateDate(stage.days + randomInt(1, 5))
      },

      // 设计方案
      design: stage.status !== 'diagnosis' ? {
        templateId: randomInt(1, 6),
        templateName: random(['翡翠滨江', '桃花源', '天玺', '金茂府', '独栋', '洋房']),
        floorplan: {
          area: customer.profile.area,
          rooms: customer.profile.rooms,
          layout: random(['南北通透', '东西向', '南向'])
        },
        equipment: {
          outdoor: { model: `RHPC-${randomInt(10, 50)}G`, capacity: `${randomInt(10, 50)}kW` },
          indoor: matchedSystems.map(s => ({
            room: random(['客厅', '主卧', '次卧']),
            model: `RAUC-${randomInt(20, 70)}G`,
            capacity: `${randomInt(2, 7)}kW`
          })),
          freshAir: { model: `ERV-${randomInt(200, 2000)}`, airflow: `${randomInt(200, 2000)}m³/h` }
        },
        drawings: {
          schematic: '/drawings/schematic_001.svg',
          layout: '/drawings/layout_001.svg',
          piping: '/drawings/piping_001.svg'
        },
        timestamp: generateDate(stage.days)
      } : null,

      // 报价信息
      quotation: stage.status !== 'diagnosis' && stage.status !== 'design' ? {
        items: matchedSystems.map(s => ({
          category: s,
          products: [
            { name: `${s}主机`, spec: '一级能效', qty: 1, unitPrice: randomInt(10000, 50000), total: 0 },
            { name: `${s}末端`, spec: '标准型', qty: randomInt(3, 8), unitPrice: randomInt(2000, 8000), total: 0 }
          ]
        })),
        subtotal: basePrice,
        discount: discount,
        discountAmount: Math.round(basePrice * discount / 100),
        tax: Math.round(finalPrice * 0.09),
        total: finalPrice,
        status: needsApproval && stage.status === 'quotation' ? 'pending_approval' : 'approved',
        approvedBy: needsApproval && stage.status !== 'quotation' ? random(users.filter(u => u.role === 'store_admin')).id : null,
        timestamp: generateDate(Math.max(0, stage.days - 5))
      } : null,

      // 施工管理
      construction: stage.status === 'construction' || stage.status === 'completed' ? {
        siteId: `SITE-${i + 1}`,
        address: customer.profile.address || `${customer.profile.area}㎡住宅`,
        tasks: [
          { name: '设备进场', status: 'completed', date: generateDate(stage.days - 10) },
          { name: '隐蔽工程', status: stage.progress >= 90 ? 'completed' : 'in_progress', date: generateDate(stage.days - 5) },
          { name: '系统调试', status: stage.status === 'completed' ? 'completed' : 'pending', date: null },
          { name: '竣工验收', status: stage.status === 'completed' ? 'completed' : 'pending', date: stage.status === 'completed' ? generateDate(0) : null }
        ],
        progress: stage.progress,
        startDate: generateDate(stage.days),
        estimatedEndDate: generateDate(-15),
        actualEndDate: stage.status === 'completed' ? generateDate(0) : null,
        photos: stage.status === 'construction' || stage.status === 'completed' ? [
          { url: '/photos/site_001.jpg', date: generateDate(5), desc: '施工现场' },
          { url: '/photos/site_002.jpg', date: generateDate(2), desc: '设备安装' }
        ] : []
      } : null,

      // 时间线
      timeline: [
        { stage: 'created', date: generateDate(stage.days + 10), user: customer.assignedSalesId, note: '创建项目' },
        { stage: 'diagnosis', date: generateDate(stage.days + 5), user: customer.assignedSalesId, note: '完成AI问诊' },
        ...(stage.status !== 'diagnosis' ? [{ stage: 'design', date: generateDate(stage.days), user: designer.id, note: '设计方案确认' }] : []),
        ...(stage.status !== 'diagnosis' && stage.status !== 'design' ? [{ stage: 'quotation', date: generateDate(Math.max(0, stage.days - 5)), user: designer.id, note: `报价生成${needsApproval ? ' (待审批)' : ''}` }] : [])
      ],

      createdAt: generateDate(stage.days + 10),
      updatedAt: generateDate(randomInt(0, 5))
    };
  });
}

// 生成操作日志
function generateLogs(projects, users) {
  const logs = [];
  let logId = 1;

  projects.forEach(project => {
    // 为每个项目生成5-15条操作日志
    const logCount = randomInt(5, 15);

    for (let i = 0; i < logCount; i++) {
      const user = random(users);
      const actions = [
        'create_project', 'update_diagnosis', 'save_design', 'generate_quotation',
        'submit_approval', 'approve_quotation', 'sign_contract', 'start_construction',
        'upload_photo', 'update_progress', 'complete_project', 'add_note'
      ];

      logs.push({
        id: logId++,
        projectId: project.id,
        projectNo: project.projectNo,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: random(actions),
        data: { timestamp: generateDate(randomInt(0, 30)) },
        ip: `192.168.1.${randomInt(1, 255)}`,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: generateDate(randomInt(0, 30))
      });
    }
  });

  return logs;
}

// 主函数
function generateAllData() {
  console.log('🚀 开始生成100组完整测试数据...\n');

  // 1. 生成用户
  const users = generateUsers();
  console.log(`✅ 生成用户: ${users.length}人 (8大角色 × 3人)`);

  // 2. 生成门店
  const stores = generateStores();
  console.log(`✅ 生成门店: ${stores.length}个`);

  // 为门店分配成员
  stores.forEach(store => {
    store.members = users.filter(u => u.storeIds.includes(store.id)).map(u => u.id);
  });

  // 3. 生成客户
  const customers = generateCustomers(users);
  console.log(`✅ 生成客户: ${customers.length}人`);

  // 4. 生成项目
  const projects = generateProjects(customers, users);
  console.log(`✅ 生成项目: ${projects.length}个`);

  // 5. 生成操作日志
  const logs = generateLogs(projects, users);
  console.log(`✅ 生成操作日志: ${logs.length}条`);

  // 6. 统计项目阶段分布
  const stageStats = {};
  projects.forEach(p => {
    stageStats[p.status] = (stageStats[p.status] || 0) + 1;
  });
  console.log('\n📊 项目阶段分布:');
  Object.entries(stageStats).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}个 (${count}%)`);
  });

  // 保存数据
  const outputDir = path.join(__dirname, 'test-data-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(outputDir, 'users.json'),
    JSON.stringify(users, null, 2)
  );
  fs.writeFileSync(
    path.join(outputDir, 'stores.json'),
    JSON.stringify(stores, null, 2)
  );
  fs.writeFileSync(
    path.join(outputDir, 'customers.json'),
    JSON.stringify(customers, null, 2)
  );
  fs.writeFileSync(
    path.join(outputDir, 'projects.json'),
    JSON.stringify(projects, null, 2)
  );
  fs.writeFileSync(
    path.join(outputDir, 'logs.json'),
    JSON.stringify(logs, null, 2)
  );

  // 生成汇总报告
  const summary = {
    generatedAt: new Date().toISOString(),
    stats: {
      users: users.length,
      stores: stores.length,
      customers: customers.length,
      projects: projects.length,
      logs: logs.length
    },
    roleDistribution: {},
    projectStageDistribution: stageStats,
    sampleUsers: users.slice(0, 3),
    sampleProjects: projects.slice(0, 3)
  };

  users.forEach(u => {
    summary.roleDistribution[u.role] = (summary.roleDistribution[u.role] || 0) + 1;
  });

  fs.writeFileSync(
    path.join(outputDir, 'summary.json'),
    JSON.stringify(summary, null, 2)
  );

  console.log(`\n✨ 数据生成完成！文件保存到: ${outputDir}`);
  console.log('\n📁 生成文件:');
  console.log('   - users.json (24用户)');
  console.log('   - stores.json (8门店)');
  console.log('   - customers.json (100客户)');
  console.log('   - projects.json (100项目)');
  console.log('   - logs.json (操作日志)');
  console.log('   - summary.json (汇总报告)');

  return { users, stores, customers, projects, logs, summary };
}

// 执行生成
if (require.main === module) {
  generateAllData();
}

module.exports = { generateAllData };
