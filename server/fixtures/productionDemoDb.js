/**
 * Legacy production demo database.
 *
 * This module preserves the old in-memory data shape used by legacy routes
 * while server-production.js is being decomposed into v2 modules.
 */

function createProductionDemoDb(bcrypt) {
  if (!bcrypt || typeof bcrypt.hashSync !== 'function') {
    throw new Error('createProductionDemoDb requires bcrypt');
  }

  return {
  users: [
    { 
      id: 1, 
      phone: '13900000000', 
      password: bcrypt.hashSync('123456', 8), 
      name: '王店长', 
      role: 'store_admin', 
      roleName: '门店管理员',
      permissions: ['user_manage', 'data_view', 'price_manage', 'approve_workflow', 'view_all_projects'],
      storeId: 'STORE_001'
    },
    { 
      id: 2, 
      phone: '13800000000', 
      password: bcrypt.hashSync('123456', 8), 
      name: '张设计师', 
      role: 'designer', 
      roleName: '设计师',
      permissions: ['design_tool', '3d_render', 'drawing_export', 'template_use', 'view_own_projects'],
      specialty: ['五恒系统', '地暖系统']
    },
    { 
      id: 3, 
      phone: '13700000000', 
      password: bcrypt.hashSync('123456', 8), 
      name: '李销售', 
      role: 'sales', 
      roleName: '销售顾问',
      permissions: ['quick_lock', 'customer_manage', 'share_solution', 'create_quote', 'view_own_customers'],
      region: '华东区'
    },
    { 
      id: 4, 
      phone: '13600000000', 
      password: bcrypt.hashSync('123456', 8), 
      name: '陈经理', 
      role: 'rheem_admin', 
      roleName: '总部管理员',
      permissions: ['system_config', 'price_manage', 'user_manage', 'data_analytics', 'view_all_regions'],
      department: '运营管理部'
    },
    { 
      id: 5, 
      phone: '13500000000', 
      password: bcrypt.hashSync('123456', 8), 
      name: '刘总监', 
      role: 'rheem_official', 
      roleName: '瑞美官方',
      permissions: ['system_admin', 'audit_log', 'erp_integration', 'global_config', 'all_permissions'],
      position: '技术总监'
    },
    { 
      id: 6, 
      phone: '13400000000', 
      password: bcrypt.hashSync('123456', 8), 
      name: '张业主', 
      role: 'end_user', 
      roleName: '最终客户',
      permissions: ['view_own_solution', 'view_3d', 'view_quote', 'download_drawings', 'share_solution'],
      customerType: '别墅业主',
      projectId: 'PRJ_001'
    }
  ],
  projects: [],
  templates: [],
  sessionCounter: 0,
  // 角色切换审计日志
  roleSwitchLogs: [],
  // 客户档案 (按手机号索引)
  customers: [
    { id: 'C001', phone: '13400000000', name: '张业主', houseType: '别墅', area: 260, city: '上海', createdBy: 3, salesId: 3, designerId: 2, createdAt: '2026-03-10T09:00:00Z' },
    { id: 'C002', phone: '13311112222', name: '李女士', houseType: '大平层', area: 180, city: '杭州', createdBy: 3, salesId: 3, designerId: 2, createdAt: '2026-04-01T10:00:00Z' },
    { id: 'C003', phone: '13622223333', name: '王先生', houseType: '复式', area: 220, city: '南京', createdBy: 3, salesId: 3, designerId: null, createdAt: '2026-04-15T14:00:00Z' }
  ],
  // 报价单
  quotes: [
    { id: 'Q001', customerId: 'C001', quoteNumber: 'RH-20260310-001', systems: ['五恒系统', '全屋净水', '地暖'], totalPrice: 285000, status: 'approved', createdAt: '2026-03-12T09:00:00Z' },
    { id: 'Q002', customerId: 'C002', quoteNumber: 'RH-20260401-002', systems: ['中央空调', '新风系统'], totalPrice: 128000, status: 'pending', createdAt: '2026-04-02T11:00:00Z' }
  ],
  // 产品库
  products: [
    { id: 'PROD-001', model: 'RH-15A', specs: '15kW变频主机', scenario: '大平层', system: '中央空调', price: 15800, image: '/images/products/rh15a.png', updatedAt: '2026-04-01T10:00:00Z' },
    { id: 'PROD-002', model: 'RH-25B', specs: '25kW变频主机', scenario: '别墅', system: '中央空调', price: 25800, image: '/images/products/rh25b.png', updatedAt: '2026-04-01T10:00:00Z' },
    { id: 'PROD-003', model: 'FH-500', specs: '500m³/h全热交换', scenario: '全屋', system: '新风系统', price: 12800, image: '/images/products/fh500.png', updatedAt: '2026-04-01T10:00:00Z' },
    { id: 'PROD-004', model: 'WH-300L', specs: '300L空气能热水器', scenario: '别墅', system: '热水系统', price: 9800, image: '/images/products/wh300l.png', updatedAt: '2026-04-01T10:00:00Z' }
  ],
  // 价格配置
  pricing: {
    baseDiscount: 0.85,
    categoryDiscounts: { '五恒系统': 0.88, '净水系统': 0.9, '采暖系统': 0.87, '中央空调': 0.85, '新风系统': 0.88, '热水系统': 0.9 },
    specialOffers: [
      { id: 'OFFER-001', name: '春季促销', discount: 0.95, startDate: '2026-04-01', endDate: '2026-05-31', applicableSystems: ['中央空调', '新风系统'] }
    ],
    lastUpdated: '2026-04-01T10:00:00Z'
  },
  // 技术支持中心 - 合同表
  contracts: [
    {
      id: 'CNT-20260401-001',
      contractNumber: 'RH-20260401-001',
      customerId: 'C001',
      customerPhone: '13400000000',
      customerName: '张业主',
      projectAddress: '上海市浦东新区陆家嘴花园',
      houseType: '三室两厅',
      area: 120,
      systems: ['中央空调', '新风系统', '全屋净水'],
      totalPrice: 128000,
      status: 'in_progress',
      signedAt: '2026-04-01T10:00:00Z',
      expectedCompletion: '2026-04-20',
      salesId: 3,
      designerId: 2,
      materials: [
        { category: '主机设备', items: [
          { name: '中央空调主机', model: 'RH-16A', quantity: 1, unitPrice: 25800, totalPrice: 25800, supplier: '瑞美官方' },
          { name: '室内机', model: '3.6kW风管机', quantity: 3, unitPrice: 3200, totalPrice: 9600, supplier: '瑞美官方' }
        ]},
        { category: '新风系统', items: [
          { name: '全热交换新风机', model: 'FH-350', quantity: 1, unitPrice: 12800, totalPrice: 12800, supplier: '瑞美官方' },
          { name: '新风管道', model: 'PE管DN75', quantity: 30, unitPrice: 45, totalPrice: 1350, supplier: '华东建材' }
        ]},
        { category: '净水系统', items: [
          { name: '前置过滤器', model: 'WP-PF1', quantity: 1, unitPrice: 1200, totalPrice: 1200, supplier: '瑞美官方' },
          { name: '中央净水器', model: 'WP-CP3', quantity: 1, unitPrice: 5800, totalPrice: 5800, supplier: '瑞美官方' },
          { name: '末端直饮机', model: 'WP-RO5', quantity: 1, unitPrice: 3600, totalPrice: 3600, supplier: '瑞美官方' }
        ]},
        { category: '安装材料', items: [
          { name: '铜管', model: 'Φ6.35-Φ19.05', quantity: 45, unitPrice: 85, totalPrice: 3825, supplier: '金龙铜管' },
          { name: '保温棉', model: 'B1级橡塑', quantity: 60, unitPrice: 35, totalPrice: 2100, supplier: '华东建材' },
          { name: 'PVC排水管', model: 'Φ25-Φ32', quantity: 25, unitPrice: 18, totalPrice: 450, supplier: '联塑' }
        ]},
        { category: '人工费用', items: [
          { name: '安装人工费', model: '全套系统安装', quantity: 1, unitPrice: 15000, totalPrice: 15000, supplier: '上海安装队' },
          { name: '调试检测费', model: '系统调试', quantity: 1, unitPrice: 2500, totalPrice: 2500, supplier: '瑞美售后' }
        ]}
      ],
      drawings: [
        { id: 'DWG-001', name: '设备原理图', type: 'schematic', url: '/drawings/RH-001-schematic.svg', uploadedAt: '2026-04-02T09:00:00Z' },
        { id: 'DWG-002', name: '设备布局图', type: 'layout', url: '/drawings/RH-001-layout.svg', uploadedAt: '2026-04-02T09:00:00Z' },
        { id: 'DWG-003', name: '管路走向图', type: 'piping', url: '/drawings/RH-001-piping.svg', uploadedAt: '2026-04-02T09:00:00Z' }
      ],
      constructionLogs: [
        { date: '2026-04-05', phase: '进场准备', description: '设备材料进场验收', status: 'completed' },
        { date: '2026-04-08', phase: '隐蔽工程', description: '管路铺设完成', status: 'completed' },
        { date: '2026-04-12', phase: '设备安装', description: '主机及末端安装', status: 'in_progress' }
      ]
    },
    {
      id: 'CNT-20260315-002',
      contractNumber: 'RH-20260315-002',
      customerPhone: '13911112222',
      customerName: '李女士',
      projectAddress: '杭州市西湖区绿城桃花源',
      houseType: '别墅',
      area: 280,
      systems: ['五恒系统', '全屋净水', '热水系统'],
      totalPrice: 285000,
      status: 'completed',
      signedAt: '2026-03-15T14:00:00Z',
      expectedCompletion: '2026-04-10',
      actualCompletion: '2026-04-08',
      salesId: 3,
      designerId: 2,
      materials: [
        { category: '主机设备', items: [
          { name: '空气源热泵主机', model: 'RH-25B', quantity: 1, unitPrice: 45800, totalPrice: 45800, supplier: '瑞美官方' },
          { name: '毛细管辐射末端', model: 'DN20 PEX', quantity: 280, unitPrice: 45, totalPrice: 12600, supplier: '瑞美官方' }
        ]},
        { category: '新风除湿', items: [
          { name: '新风除湿一体机', model: 'FA-500D', quantity: 2, unitPrice: 24800, totalPrice: 49600, supplier: '瑞美官方' }
        ]},
        { category: '热水系统', items: [
          { name: '空气能热水器', model: 'WH-300L', quantity: 1, unitPrice: 12800, totalPrice: 12800, supplier: '瑞美官方' }
        ]}
      ],
      drawings: [
        { id: 'DWG-004', name: '五恒系统原理图', type: 'schematic', url: '/drawings/RH-002-schematic.svg', uploadedAt: '2026-03-16T10:00:00Z' },
        { id: 'DWG-005', name: '设备布置图', type: 'layout', url: '/drawings/RH-002-layout.svg', uploadedAt: '2026-03-16T10:00:00Z' }
      ],
      constructionLogs: [
        { date: '2026-03-20', phase: '进场准备', description: '设备材料进场', status: 'completed' },
        { date: '2026-03-25', phase: '隐蔽工程', description: '毛细管铺设完成', status: 'completed' },
        { date: '2026-04-02', phase: '设备安装', description: '主机安装调试', status: 'completed' },
        { date: '2026-04-08', phase: '竣工验收', description: '整体验收合格', status: 'completed' }
      ]
    }
  ],
  // 技术支持中心 - 材料库
  techMaterials: [
    { id: 'MAT-001', category: '主机设备', name: '中央空调主机 RH-16A', stock: 15, safetyStock: 10, unitPrice: 25800, supplier: '瑞美官方', location: 'A区-01货架' },
    { id: 'MAT-002', category: '主机设备', name: '中央空调主机 RH-25B', stock: 8, safetyStock: 5, unitPrice: 45800, supplier: '瑞美官方', location: 'A区-02货架' },
    { id: 'MAT-003', category: '新风系统', name: '全热交换新风机 FH-350', stock: 12, safetyStock: 8, unitPrice: 12800, supplier: '瑞美官方', location: 'B区-01货架' },
    { id: 'MAT-004', category: '净水系统', name: '中央净水器 WP-CP3', stock: 6, safetyStock: 10, unitPrice: 5800, supplier: '瑞美官方', location: 'B区-02货架', warning: '库存不足' },
    { id: 'MAT-005', category: '安装材料', name: '铜管 Φ6.35-Φ19.05', stock: 200, safetyStock: 100, unitPrice: 85, supplier: '金龙铜管', location: 'C区-01货架', unit: '米' },
    { id: 'MAT-006', category: '安装材料', name: '保温棉 B1级橡塑', stock: 150, safetyStock: 200, unitPrice: 35, supplier: '华东建材', location: 'C区-02货架', unit: '米', warning: '库存偏低' },
    { id: 'MAT-007', category: '安装材料', name: 'PVC排水管 Φ25', stock: 80, safetyStock: 50, unitPrice: 18, supplier: '联塑', location: 'C区-03货架', unit: '米' }
  ],
  // 施工班组管理
  constructionTeams: [
    {
      id: 'TEAM-001',
      name: '上海金牌安装一队',
      leader: '张师傅',
      leaderPhone: '13811112222',
      members: 5,
      specialty: ['中央空调', '地暖', '新风系统'],
      rating: 4.8,
      completedProjects: 128,
      status: 'available',
      workArea: '上海浦东新区',
      unitPrice: {
        standard: 280, // 标准工价 元/人/天
        weekend: 350,
        holiday: 420
      },
      createdAt: '2025-01-15T10:00:00Z'
    },
    {
      id: 'TEAM-002',
      name: '江苏精工安装队',
      leader: '李队长',
      leaderPhone: '13922223333',
      members: 6,
      specialty: ['五恒系统', '净水系统', '热水系统'],
      rating: 4.9,
      completedProjects: 86,
      status: 'busy',
      currentContract: 'CNT-20260401-001',
      workArea: '上海/苏州/杭州',
      unitPrice: {
        standard: 300,
        weekend: 380,
        holiday: 450
      },
      createdAt: '2025-03-20T10:00:00Z'
    },
    {
      id: 'TEAM-003',
      name: '浙江专业暖通队',
      leader: '王师傅',
      leaderPhone: '13733334444',
      members: 4,
      specialty: ['地暖', '暖气片', '中央空调'],
      rating: 4.7,
      completedProjects: 95,
      status: 'available',
      workArea: '杭州/宁波/绍兴',
      unitPrice: {
        standard: 260,
        weekend: 320,
        holiday: 400
      },
      createdAt: '2025-02-10T10:00:00Z'
    }
  ],
  // 费用结算记录
  settlementRecords: [
    {
      id: 'SET-001',
      contractId: 'CNT-20260315-002',
      contractNumber: 'RH-20260315-002',
      teamId: 'TEAM-002',
      teamName: '江苏精工安装队',
      settlementType: '人工费',
      workDays: 12,
      dailyRate: 300,
      totalAmount: 18000, // 6人 × 300元 × 10天
      materialCost: 8500,
      totalSettlement: 26500,
      status: 'paid',
      paymentDate: '2026-04-10',
      paymentMethod: '银行转账',
      invoiceNumber: 'INV-20260410-001',
      remarks: '五恒系统安装，含毛细管铺设、主机安装调试',
      createdAt: '2026-04-08T10:00:00Z'
    },
    {
      id: 'SET-002',
      contractId: 'CNT-20260401-001',
      contractNumber: 'RH-20260401-001',
      teamId: 'TEAM-002',
      teamName: '江苏精工安装队',
      settlementType: '进度款',
      workDays: 5,
      dailyRate: 300,
      totalAmount: 7500, // 部分结算
      materialCost: 3200,
      totalSettlement: 10700,
      status: 'pending',
      paymentDate: null,
      paymentMethod: null,
      invoiceNumber: null,
      remarks: '中央空调+新风系统安装中，进度60%',
      createdAt: '2026-04-15T10:00:00Z'
    }
  ],
  // 施工任务分配
  constructionTasks: [
    {
      id: 'TASK-001',
      contractId: 'CNT-20260401-001',
      contractNumber: 'RH-20260401-001',
      teamId: 'TEAM-002',
      teamName: '江苏精工安装队',
      tasks: [
        { phase: '进场准备', startDate: '2026-04-05', endDate: '2026-04-05', workers: 2, status: 'completed' },
        { phase: '管路铺设', startDate: '2026-04-08', endDate: '2026-04-10', workers: 4, status: 'completed' },
        { phase: '主机安装', startDate: '2026-04-12', endDate: '2026-04-14', workers: 3, status: 'in_progress' },
        { phase: '系统调试', startDate: '2026-04-15', endDate: '2026-04-16', workers: 2, status: 'pending' }
      ],
      totalWorkDays: 12,
      estimatedLaborCost: 18000,
      createdAt: '2026-04-05T10:00:00Z'
    }
  ]
};;
}

module.exports = {
  createProductionDemoDb
};
