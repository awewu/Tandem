// MongoDB初始化脚本

// 创建数据库和用户
db = db.getSiblingDB('rheem-platform');

// 创建应用用户
db.createUser({
  user: 'rheem_user',
  pwd: 'rheem_password',
  roles: [
    {
      role: 'readWrite',
      db: 'rheem-platform'
    }
  ]
});

// 创建集合和索引
db.createCollection('users');
db.createCollection('projects');
db.createCollection('devices');

// 用户集合索引
db.users.createIndex({ phone: 1 }, { unique: true });
db.users.createIndex({ storeName: 1 });
db.users.createIndex({ role: 1 });
db.users.createIndex({ status: 1 });
db.users.createIndex({ createdAt: -1 });

// 项目集合索引
db.projects.createIndex({ designer: 1 });
db.projects.createIndex({ status: 1 });
db.projects.createIndex({ type: 1 });
db.projects.createIndex({ 'customer.phone': 1 });
db.projects.createIndex({ createdAt: -1 });
db.projects.createIndex({ updatedAt: -1 });

// 设备集合索引
db.devices.createIndex({ name: 1 });
db.devices.createIndex({ model: 1 });
db.devices.createIndex({ brand: 1 });
db.devices.createIndex({ system: 1 });
db.devices.createIndex({ category: 1 });
db.devices.createIndex({ isRheem: 1 });
db.devices.createIndex({ status: 1 });
db.devices.createIndex({ submittedBy: 1 });

// 计算结果索引
db.calculationresults.createIndex({ project: 1 });
db.calculationresults.createIndex({ 'projectInfo.city': 1 });
db.calculationresults.createIndex({ 'projectInfo.buildingType': 1 });
db.calculationresults.createIndex({ 'metadata.timestamp': -1 });
db.calculationresults.createIndex({ status: 1 });

// 系统启用状态索引
db.calculationresults.createIndex({ 'hotwater.enabled': 1 });
db.calculationresults.createIndex({ 'water.enabled': 1 });
db.calculationresults.createIndex({ 'freshair.enabled': 1 });
db.calculationresults.createIndex({ 'cooling.enabled': 1 });
db.calculationresults.createIndex({ 'doas.enabled': 1 });
db.calculationresults.createIndex({ 'heating.enabled': 1 });
db.calculationresults.createIndex({ 'control.enabled': 1 });

// 费用汇总索引
db.calculationresults.createIndex({ 'summary.cost.total': 1 });

// 插入初始数据
db.users.insertOne({
  storeName: '瑞美总部体验店',
  contactPerson: '系统管理员',
  phone: '13800000000',
  password: '$2a$10$example.hash.here', // 需要在实际部署时替换
  region: '北京',
  role: 'admin',
  permissions: ['all'],
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date()
});

// 插入示例设备数据
db.devices.insertMany([
  {
    name: 'RHEEM-120 中央空调室外机',
    model: 'RHEEM-120',
    brand: '瑞美',
    isRheem: true,
    system: '五恒系统',
    category: '空调设备',
    specs: {
      coolingCapacity: '12kW',
      heatingCapacity: '14kW',
      efficiency: '4.2',
      noise: '35dB',
      power: '220V'
    },
    price: {
      factory: 15000,
      retail: 18000
    },
    description: '高效节能变频空调，适合120-150㎡户型',
    features: ['变频技术', '静音运行', '智能控制', '节能环保'],
    applications: '120-150㎡住宅',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'RHEEM-FRESH 新风系统',
    model: 'RHEEM-FRESH-300',
    brand: '瑞美',
    isRheem: true,
    system: '新风系统',
    category: '新风设备',
    specs: {
      airFlow: '300m³/h',
      efficiency: '95%',
      noise: '28dB',
      power: '110W'
    },
    price: {
      factory: 8000,
      retail: 9800
    },
    description: '全热交换新风系统，高效过滤PM2.5',
    features: ['全热交换', 'PM2.5过滤', '智能控制', '低噪音'],
    applications: '80-200㎡住宅',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

print('MongoDB初始化完成');
