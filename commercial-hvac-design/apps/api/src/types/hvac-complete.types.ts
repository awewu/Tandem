/**
 * HVAC暖通系统完整数据类型定义（补充）
 * 涵盖：设计方案、项目报备、经销商管理、实时协作、报价订单等
 * 
 * 此文件补充 hvac.types.ts 中缺少的核心数据结构
 */

import type {
  Brand,
  SystemType,
  EquipmentCategory,
  ProjectType,
  BuildingType,
  ClimateZone,
  DealerType,
  DealerLevel,
  RegistrationStatus,
  OrderStatus,
  RoomType,
  HVACEquipment,
  LoadCalculation,
  LoadResults,
} from './hvac.types.js';

// ========================================
// 4. 暖通设计方案数据模型
// ========================================

export interface HVACDesign {
  id: string;
  projectId: string;
  name: string;                     // 方案名称
  version: number;                  // 版本号
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'draft' | 'reviewing' | 'approved' | 'rejected' | 'implemented';
  
  // 方案类型
  solutionType: SystemType;
  brand: Brand;
  
  // 基于的负荷计算
  loadCalculationId: string;
  loadResults: LoadResults;
  
  // 系统配置
  systemConfig: SystemConfiguration;
  
  // 设备清单
  equipmentList: DesignEquipment[];
  
  // 管路/风路设计
  piping: PipingDesign;
  ductwork?: DuctworkDesign;       // 风系统专用
  
  // 控制系统
  controlSystem: ControlSystem;
  
  // 性能分析
  performance: PerformanceAnalysis;
  
  // 成本分析
  costAnalysis: CostAnalysis;
  
  // 图纸与文档
  drawings: DesignDrawing[];
  
  // BIM数据
  bim?: BIMData;
  
  // 审核记录
  reviews: DesignReview[];
  
  // 备注
  notes: string;
}

export interface SystemConfiguration {
  // 系统架构
  architecture: 'single' | 'multi-split' | 'central' | 'hybrid';
  
  // 冷热源
  heatSource: {
    type: 'heat-pump' | 'boiler' | 'furnace' | 'hybrid';
    equipmentId: string;
    backupEquipmentId?: string;   // 备用设备
  };
  
  coldSource?: {                   // 制冷专用
    type: 'heat-pump' | 'chiller' | 'ac-unit';
    equipmentId: string;
  };
  
  // 末端形式
  terminals: {
    type: 'radiator' | 'floor-heating' | 'fcu' | 'ahu' | 'vr' | 'mix';
    zoneCount: number;              // 分区数量
    roomTerminals: RoomTerminal[];
  };
  
  // 热水系统
  hotWater?: {
    type: 'tank' | 'tankless' | 'heat-pump';
    equipmentId: string;
    capacity: number;             // L 容量
    recoveryRate: number;        // L/min 恢复速率
  };
  
  // 新风系统
  freshAir?: {
    type: 'erv' | 'hrv' | 'simple';
    equipmentId: string;
    airflowRate: number;         // m³/h 新风量
    heatRecoveryEfficiency: number; // % 热回收效率
  };
  
  // 净水系统
  waterTreatment?: {
    softener?: string;            // 软水机ID
    purifier?: string;            // 净水机ID
    wholeHouseFilter?: boolean;   // 全屋过滤
  };
}

export interface RoomTerminal {
  roomId: string;
  roomType: RoomType;
  terminalType: 'radiator' | 'floor-heating' | 'fcu' | 'vr' | 'ac-unit';
  equipmentId: string;
  quantity: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
  controls: {
    thermostat: boolean;          // 温控器
    zoneValve: boolean;          // 区域阀
    individualControl: boolean;  // 独立控制
  };
}

export interface DesignEquipment {
  equipmentId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  
  // 选型依据
  selectionReason: string;
  loadMatched: boolean;           // 是否匹配负荷
  capacityReserve: number;      // % 容量裕量
  
  // 安装位置
  location: {
    room: string;
    position: { x: number; y: number; z: number };
    orientation: string;
  };
  
  // 连接信息
  connections: {
    waterIn?: string;             // 进水连接点
    waterOut?: string;            // 出水连接点
    power: string;                // 电源连接点
    control: string;              // 控制连接点
  };
  
  // 配件清单
  accessories: {
    id: string;
    name: string;
    quantity: number;
    price: number;
  }[];
  
  // 特殊要求
  specialRequirements: string[];
}

export interface PipingDesign {
  // 管路系统
  systemType: 'two-pipe' | 'four-pipe' | 'primary-secondary';
  
  // 主管路
  mains: PipeRoute[];
  
  // 分支管路
  branches: PipeRoute[];
  
  // 水力计算
  hydraulicCalc: {
    totalFlowRate: number;        // m³/h 总流量
    totalPressureDrop: number;   // kPa 总压降
    pumpHead: number;            // m 水泵扬程
    pumpPower: number;          // kW 水泵功率
    
    // 最不利环路
    criticalPath: {
      route: string[];
      pressureDrop: number;
      flowRate: number;
    };
    
    // 平衡分析
    balance: {
      maxImbalance: number;     // % 最大不平衡率
      valvesRequired: boolean;   // 是否需要平衡阀
    };
  };
  
  // 保温设计
  insulation: {
    type: string;
    thickness: number;           // mm
    material: string;
  };
  
  // 管材规格
  pipeSpecs: {
    material: 'ppr' | 'pe-rt' | 'copper' | 'steel';
    pressureRating: number;      // MPa
    sizes: { diameter: number; length: number }[];
  };
}

export interface PipeRoute {
  id: string;
  name: string;
  type: 'supply' | 'return' | 'hot' | 'cold' | 'drain';
  
  // 路径
  path: {
    start: { x: number; y: number; z: number };
    end: { x: number; y: number; z: number };
    waypoints: { x: number; y: number; z: number }[];
  };
  
  // 管径
  diameter: number;              // mm
  length: number;               // m
  
  // 流量参数
  flowRate: number;             // m³/h
  velocity: number;            // m/s
  pressureDrop: number;        // kPa
  
  // 连接设备
  connectedEquipment: string[];
}

export interface DuctworkDesign {
  // 风管系统
  systemType: 'low-pressure' | 'medium-pressure' | 'high-pressure';
  
  // 风管路由
  ducts: DuctRoute[];
  
  // 风口布置
  diffusers: Diffuser[];
  
  // 空气计算
  airflowCalc: {
    totalSupply: number;         // m³/h 总送风量
    totalReturn: number;        // m³/h 总回风量
    freshAirRatio: number;      // % 新风比例
    
    // 风机选型
    fanSelection: {
      supplyFanId: string;
      returnFanId?: string;
      staticPressure: number;   // Pa
    };
  };
  
  // 消声设计
  acoustic: {
    silencers: { position: string; length: number }[];
    noiseLevel: number;         // dB 末端噪音
  };
}

export interface DuctRoute {
  id: string;
  type: 'supply' | 'return' | 'fresh' | 'exhaust';
  
  // 截面
  section: {
    shape: 'rectangular' | 'circular';
    width?: number;            // mm 矩形宽
    height?: number;          // mm 矩形高
    diameter?: number;       // mm 圆形直径
  };
  
  // 路径
  path: {
    start: string;             // 起点设备ID
    end: string;              // 终点设备ID
    length: number;          // m
  };
  
  // 风量参数
  airflowRate: number;        // m³/h
  velocity: number;         // m/s
  pressureDrop: number;     // Pa/m
}

export interface Diffuser {
  id: string;
  roomId: string;
  type: 'ceiling' | 'wall' | 'slot' | 'jet';
  
  position: { x: number; y: number; z: number };
  
  airflowRate: number;        // m³/h 风量
  throwDistance: number;     // m 射程
  noiseLevel: number;        // NC 噪音等级
  
  // 调节
  adjustable: boolean;
  damperControl: boolean;
}

export interface ControlSystem {
  // 控制架构
  architecture: 'centralized' | 'decentralized' | 'hybrid';
  
  // 主控制器
  mainController: {
    type: string;
    brand: Brand;
    features: string[];
  };
  
  // 控制策略
  strategies: {
    heating: 'on-off' | 'modulating' | 'pid';
    cooling: 'on-off' | 'modulating' | 'pid';
    hotWater: 'temperature-priority' | 'time-schedule';
    freshAir: 'co2-based' | 'time-schedule' | 'constant';
  };
  
  // 分区控制
  zoneControls: {
    zoneId: string;
    thermostat: string;
    setpoints: {
      heating: number;         // ℃
      cooling: number;        // ℃
      deadband: number;       // ℃ 死区
    };
    schedule: ControlSchedule;
  }[];
  
  // 智能功能
  smartFeatures: {
    weatherCompensation: boolean;  // 气候补偿
    occupancyDetection: boolean;   //  occupancy检测
    remoteControl: boolean;       // 远程控制
    energyMonitoring: boolean;    // 能耗监测
    aiOptimization: boolean;      // AI优化
  };
  
  // 集成接口
  integrations: {
    bacnet: boolean;
    modbus: boolean;
    knx: boolean;
    homekit?: boolean;
    matter?: boolean;
  };
}

export interface ControlSchedule {
  workday: { start: string; end: string; setpoint: number }[];
  weekend: { start: string; end: string; setpoint: number }[];
  holiday?: { start: string; end: string; setpoint: number }[];
}

export interface PerformanceAnalysis {
  // 能效指标
  energyEfficiency: {
    scop: number;               // 季节性能系数(制热)
    seer: number;              // 季节性能系数(制冷)
    copAnnual: number;         // 全年平均COP
    eerAnnual: number;        // 全年平均EER
  };
  
  // 年能耗预估
  annualConsumption: {
    heating: number;          // kWh
    cooling: number;         // kWh
    hotWater: number;       // kWh
    auxiliaries: number;    // kWh 辅助设备
    total: number;
  };
  
  // 运行成本
  operatingCost: {
    heating: number;          // 元/年
    cooling: number;         // 元/年
    hotWater: number;       // 元/年
    maintenance: number;    // 元/年 维护费
    total: number;
  };
  
  // 环保指标
  environmental: {
    co2Emissions: number;    // kg/年
    carbonReduction: number; // % 相比传统系统减排
    refrigerantGWP: number;   // 冷媒GWP值
  };
  
  // 舒适度分析
  comfort: {
    temperatureStability: number;  // ℃ 温度波动
    humidityControl: number;    // % 湿度控制精度
    airQualityIndex: number;    // 空气质量指数
    noiseLevel: number;        // dB 室内噪音
  };
  
  // 投资回收
  paybackAnalysis: {
    initialInvestment: number;   // 元 初始投资
    annualSavings: number;     // 元/年 年节约
    paybackPeriod: number;    // 年 回收期
    npv10Year: number;       // 元 10年净现值
    irr: number;            // % 内部收益率
  };
}

export interface CostAnalysis {
  // 设备成本
  equipmentCost: {
    heatSource: number;
    coldSource?: number;
    terminals: number;
    hotWater?: number;
    freshAir?: number;
    controls: number;
    accessories: number;
    subtotal: number;
  };
  
  // 安装成本
  installationCost: {
    labor: number;             // 人工费
    materials: number;        // 材料费(管材、风管等)
    commissioning: number;   // 调试费
    subtotal: number;
  };
  
  // 其他费用
  otherCosts: {
    design: number;           // 设计费
    projectManagement: number; // 项目管理费
    contingency: number;     // 不可预见费(5-10%)
    subtotal: number;
  };
  
  // 汇总
  summary: {
    totalEquipment: number;   // 设备总价
    totalInstallation: number; // 安装总价
    totalProject: number;     // 项目总价
    withTax: number;         // 含税总价
    
    // 三档报价
    basicPackage: number;    // 基础方案
    comfortPackage: number;  // 舒适方案
    premiumPackage: number;  // 尊享方案
  };
}

export interface DesignDrawing {
  id: string;
  type: 'floor-plan' | 'piping-diagram' | 'ductwork-diagram' | 'control-diagram' | '3d-view';
  name: string;
  description: string;
  
  // 文件信息
  file: {
    format: 'dwg' | 'pdf' | 'png' | 'svg';
    url: string;
    size: number;            // KB
    version: number;
  };
  
  // 图纸内容
  content: {
    scale: string;
    sheetSize: 'A4' | 'A3' | 'A2' | 'A1' | 'A0';
    floor?: number;         // 楼层
    area?: string;         // 区域
  };
  
  // 审批状态
  status: 'draft' | 'reviewing' | 'approved' | 'as-built';
  approvedBy?: string;
  approvedAt?: Date;
}

export interface BIMData {
  // BIM模型信息
  modelId: string;
  format: 'ifc' | 'rvt' | 'nwd';
  version: string;
  
  // 碰撞检测
  clashDetection: {
    enabled: boolean;
    lastRun: Date;
    issues: {
      id: string;
      severity: 'high' | 'medium' | 'low';
      description: string;
      location: { x: number; y: number; z: number };
      resolved: boolean;
    }[];
  };
  
  // 工程量
  quantities: {
    category: string;
    item: string;
    count: number;
    unit: string;
  }[];
  
  // 4D施工模拟
  constructionSimulation?: {
    enabled: boolean;
    phases: {
      phase: number;
      name: string;
      startDate: Date;
      endDate: Date;
      activities: string[];
    }[];
  };
}

export interface DesignReview {
  id: string;
  reviewer: string;
  role: 'designer' | 'engineer' | 'client' | 'consultant';
  reviewedAt: Date;
  
  // 评审内容
  aspects: {
    technical: { score: number; comment?: string };
    economic: { score: number; comment?: string };
    constructability: { score: number; comment?: string };
    sustainability: { score: number; comment?: string };
  };
  
  // 总体评价
  overallScore: number;
  decision: 'approve' | 'approve-with-comments' | 'reject' | 'request-modification';
  comments: string;
  
  // 修改要求
  actionItems?: {
    id: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    resolved: boolean;
  }[];
}

// ========================================
// 5. 项目报备数据模型（暖通专业扩展）
// ========================================

export interface ProjectRegistration {
  id: string;
  registrationNumber: string;    // 报备编号
  
  // 基本信息
  basicInfo: {
    name: string;                 // 项目名称
    type: ProjectType;
    buildingType: BuildingType;
    address: string;
    region: string;               // 所属区域/销售大区
  };
  
  // 客户信息
  client: {
    name: string;               // 客户姓名
    phone: string;
    email?: string;
    type: 'individual' | 'company' | 'government';
    company?: string;
  };
  
  // 暖通需求
  hvacRequirements: {
    area: number;               // m² 建筑面积
    floors: number;             // 楼层数
    rooms: number;              // 房间数
    
    requirements: {
      heating: boolean;         // 需要采暖
      cooling: boolean;         // 需要制冷
      hotWater: boolean;       // 需要热水
      freshAir: boolean;        // 需要新风
      purification: boolean;   // 需要净化
      humidification: boolean; // 需要加湿
    };
    
    painPoints: string[];       // 客户痛点标签
    preferredBrand?: Brand;    // 偏好品牌
    budgetRange: [number, number]; // 预算区间[min, max]
    
    // 特殊要求
    specialRequirements: string[];
  };
  
  // 报备状态
  status: RegistrationStatus;
  
  // 保护期
  protection: {
    startDate: Date;
    endDate: Date;              // 保护期结束
    extensionCount: number;    // 延期次数(最多2次)
    lastExtensionDate?: Date;
  };
  
  // 跟进记录
  followUps: FollowUpRecord[];
  
  // 关联订单
  orderId?: string;
  
  // 报备人
  registeredBy: {
    dealerId: string;
    dealerName: string;
    dealerType: DealerType;
    contact: string;
  };
  
  // 竞争情况
  competition?: {
    competitors: string[];    // 竞争品牌
    ourAdvantages: string[];
    riskLevel: 'high' | 'medium' | 'low';
  };
  
  // 时间线
  timeline: {
    expectedDealDate: Date;   // 预计成交时间
    expectedInstallation: Date; // 预计安装时间
    actualDealDate?: Date;
    actualInstallation?: Date;
  };
  
  // 元数据
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    source: 'web' | 'app' | 'wechat' | 'referral' | 'exhibition';
  };
}

export interface FollowUpRecord {
  id: string;
  date: Date;
  type: 'phone' | 'visit' | 'email' | 'wechat' | 'meeting';
  
  content: {
    summary: string;            // 沟通摘要
    clientFeedback: string;    // 客户反馈
    concerns?: string[];       // 客户疑虑
  };
  
  outcome: {
    interestLevel: 'high' | 'medium' | 'low';  // 意向度
    nextAction: string;        // 下一步行动
    nextContactDate?: Date;   // 下次联系时间
  };
  
  recordedBy: string;
  attachments?: string[];     // 附件链接
}

// ========================================
// 6. 经销商/渠道数据模型
// ========================================

export interface Dealer {
  id: string;
  code: string;                  // 经销商编码
  
  // 基本信息
  basicInfo: {
    name: string;               // 公司名称
    shortName: string;         // 简称
    type: DealerType;
    level: DealerLevel;
    brand: Brand[];            // 授权品牌
    
    // 资质
    businessLicense: string;  // 营业执照号
    taxId: string;             // 税号
    legalPerson: string;       // 法人
    established: Date;         // 成立时间
  };
  
  // 联系信息
  contact: {
    address: string;
    city: string;
    province: string;
    phone: string;
    email: string;
    website?: string;
  };
  
  // 业务范围
  business: {
    regions: string[];          // 代理区域
    capabilities: string[];    // 能力标签
    services: ('sales' | 'design' | 'installation' | 'maintenance' | 'after-sales')[];
    specialties: EquipmentCategory[];  // 专业领域
  };
  
  // 团队规模
  team: {
    total: number;             // 总人数
    sales: number;            // 销售
    designers: number;        // 设计
    installers: number;      // 安装
    service: number;          // 售后
  };
  
  // 业绩数据
  performance: {
    monthlyTarget: number;     // 月度指标
    quarterlyTarget: number; // 季度指标
    yearlyTarget: number;     // 年度指标
    
    currentMonth: number;      // 当月完成
    currentQuarter: number;  // 当季完成
    currentYear: number;      // 当年完成
    
    completionRate: number;  // % 完成率
    yoyGrowth: number;        // % 同比增长
    
    ranking: {
      national: number;      // 全国排名
      regional: number;      // 区域排名
    };
  };
  
  // 佣金政策
  commission: {
    baseRate: number;          // % 基础佣金率
    bonusThreshold: number;   // 奖励门槛
    bonusRate: number;        // % 超额奖励率
    
    // 阶梯佣金
    tiers: {
      min: number;
      max: number;
      rate: number;
    }[];
    
    // 特殊产品佣金
    specialProducts: {
      category: EquipmentCategory;
      rate: number;
    }[];
  };
  
  // 账户信息
  account: {
    balance: number;          // 账户余额
    creditLimit: number;      // 信用额度
    paymentTerms: number;    // 账期(天)
    
    // 交易记录
    transactions: Transaction[];
  };
  
  // 评级与认证
  certifications: {
    authorized: boolean;      // 授权状态
    authorizationDate: Date;
    authorizationExpire: Date;
    
    certificates: {
      name: string;
      issuedBy: string;
      issuedAt: Date;
      expiresAt: Date;
      valid: boolean;
    }[];
  };
  
  // 关联项目
  projects: {
    registrations: string[];  // 报备项目ID
    orders: string[];        // 订单ID
    activeCount: number;    // 活跃项目数
  };
  
  // 评价
  rating: {
    overall: number;        // 1-5分
    sales: number;
    service: number;
    technical: number;
    
    reviews: {
      customerId: string;
      rating: number;
      comment: string;
      date: Date;
    }[];
  };
  
  // 元数据
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    status: 'active' | 'suspended' | 'terminated';
    tags: string[];
  };
}

export interface Transaction {
  id: string;
  date: Date;
  type: 'order' | 'commission' | 'payment' | 'refund' | 'bonus';
  
  amount: number;
  currency: 'CNY';
  
  description: string;
  referenceId: string;         // 关联订单/项目ID
  
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
}

// ========================================
// 7. 实时协作数据模型
// ========================================

export interface DrawingSync {
  // 会话信息
  sessionId: string;
  designId: string;
  
  // 参与者
  participants: DrawingParticipant[];
  
  // 操作历史
  operations: DrawingOperation[];
  
  // 当前状态
  currentState: {
    version: number;
    lastModified: Date;
    modifiedBy: string;
    
    // 选中状态
    selections: {
      userId: string;
      elementIds: string[];
      color: string;           // 高亮颜色
    }[];
    
    // 视图状态
    viewState: {
      zoom: number;
      pan: { x: number; y: number };
      activeLayer: string;
      visibleLayers: string[];
    };
  };
  
  // 锁定状态
  lock: {
    locked: boolean;
    lockedBy?: string;
    lockedAt?: Date;
    reason?: string;
  };
  
  // 评论
  comments: DrawingComment[];
  
  // 会话元数据
  metadata: {
    createdAt: Date;
    createdBy: string;
    lastActivity: Date;
    expiresAt?: Date;
  };
}

export interface DrawingParticipant {
  userId: string;
  name: string;
  role: 'owner' | 'designer' | 'client' | 'reviewer' | 'guest';
  
  // 状态
  status: 'online' | 'away' | 'offline';
  joinedAt: Date;
  lastSeen: Date;
  
  // 光标位置
  cursor?: {
    x: number;
    y: number;
    visible: boolean;
  };
  
  // 权限
  permissions: {
    canEdit: boolean;
    canComment: boolean;
    canInvite: boolean;
    canLock: boolean;
  };
  
  // 个人视图设置
  viewSettings: {
    color: string;             // 光标颜色
    visible: boolean;         // 是否可见
  };
}

export interface DrawingOperation {
  id: string;
  timestamp: number;           // 时间戳(用于排序)
  userId: string;
  
  // 操作类型
  type: 'add' | 'delete' | 'modify' | 'move' | 'transform' | 'style' | 'property';
  
  // 目标
  target: {
    elementId: string;
    elementType: string;
  };
  
  // 操作数据
  data: {
    before?: any;              // 操作前状态
    after: any;               // 操作后状态
  };
  
  // 操作元数据
  meta: {
    undoable: boolean;         // 是否可撤销
    batchId?: string;         // 批量操作ID
    source: 'mouse' | 'keyboard' | 'api' | 'import';
  };
  
  // 已撤销
  undone: boolean;
  undoneBy?: string;
  undoneAt?: Date;
}

export interface DrawingComment {
  id: string;
  userId: string;
  userName: string;
  
  // 评论位置
  position: {
    x: number;
    y: number;
    elementId?: string;       // 关联元素
  };
  
  // 内容
  content: string;
  attachments?: string[];      // 附件
  
  // 时间
  createdAt: Date;
  updatedAt?: Date;
  
  // 回复
  replies?: {
    id: string;
    userId: string;
    userName: string;
    content: string;
    createdAt: Date;
  }[];
  
  // 状态
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
}

// ========================================
// 8. 报价与订单数据模型
// ========================================

export interface Quotation {
  id: string;
  quotationNumber: string;       // 报价单号
  
  // 关联
  projectId: string;
  registrationId?: string;
  designId: string;
  
  // 客户信息
  client: {
    name: string;
    phone: string;
    email?: string;
    address: string;
  };
  
  // 经销商
  dealer: {
    id: string;
    name: string;
    contact: string;
  };
  
  // 报价方案
  packages: QuotationPackage[];
  
  // 推荐方案
  recommendedPackage: string;      // 推荐方案ID
  
  // 有效期
  validUntil: Date;
  
  // 条款
  terms: {
    payment: string;             // 付款条款
    delivery: string;            // 交货条款
    installation: string;        // 安装条款
    warranty: string;            // 保修条款
  };
  
  // 审批
  approval: {
    status: 'draft' | 'pending' | 'approved' | 'rejected';
    approver?: string;
    approvedAt?: Date;
    comments?: string;
  };
  
  // 状态
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
  
  // 时间戳
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
  
  // 备注
  notes: string;
}

export interface QuotationPackage {
  id: string;
  name: string;                  // 方案名称(基础/舒适/尊享)
  level: 'basic' | 'comfort' | 'premium';
  
  // 系统配置
  systemConfig: SystemConfiguration;
  
  // 设备清单
  equipment: {
    itemId: string;
    name: string;
    model: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    description: string;
  }[];
  
  // 费用明细
  pricing: {
    equipmentTotal: number;      // 设备费
    installation: number;       // 安装费
    accessories: number;       // 配件费
    design: number;            // 设计费
    management: number;       // 管理费
    tax: number;             // 税金
    
    subtotal: number;          // 小计
    discount: number;         // 优惠
    total: number;           // 总计
  };
  
  // 价值主张
  valueProposition: {
    keyBenefits: string[];       // 核心优势
    includedServices: string[]; // 包含服务
    warranty: string;         // 保修承诺
    guarantees: string[];     // 保障承诺
  };
  
  // 匹配度分析
  matchAnalysis?: {
    score: number;              // 匹配分数
    reasons: string[];         // 推荐理由
    fitFor: string[];         // 适合人群
  };
}

export interface Order {
  id: string;
  orderNumber: string;           // 订单号 HT-YYMM-XXXX
  
  // 关联
  quotationId: string;
  projectId: string;
  registrationId?: string;
  
  // 客户
  client: {
    name: string;
    phone: string;
    email?: string;
    address: string;
  };
  
  // 经销商
  dealer: {
    id: string;
    name: string;
    commission: number;          // 佣金金额
    commissionRate: number;      // 佣金比例
  };
  
  // 订单内容
  items: OrderItem[];
  
  // 金额
  amounts: {
    equipment: number;
    installation: number;
    accessories: number;
    other: number;
    subtotal: number;
    tax: number;
    total: number;
    paid: number;
    balance: number;
  };
  
  // 付款记录
  payments: Payment[];
  
  // 状态流转
  status: OrderStatus;
  statusHistory: {
    from: OrderStatus;
    to: OrderStatus;
    timestamp: Date;
    operator: string;
    note: string;
  }[];
  
  // 安装信息
  installation?: {
    scheduledDate?: Date;
    actualDate?: Date;
    installer: string;
    contact: string;
    address: string;
    status: 'pending' | 'scheduled' | 'in-progress' | 'completed';
    notes?: string;
  };
  
  // 物流信息
  logistics?: {
    shippingDate?: Date;
    trackingNumber?: string;
    carrier?: string;
    status: 'preparing' | 'shipped' | 'in-transit' | 'delivered';
    items: {
      itemId: string;
      quantity: number;
      status: string;
    }[];
  };
  
  // 时间戳
  createdAt: Date;
  updatedAt: Date;
  confirmedAt?: Date;
  completedAt?: Date;
  
  // 备注
  notes: string;
}

export interface OrderItem {
  id: string;
  equipmentId: string;
  name: string;
  model: string;
  
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  
  // 交付状态
  delivery: {
    ordered: number;
    produced: number;
    shipped: number;
    delivered: number;
    installed: number;
  };
  
  // 序列号
  serialNumbers?: string[];
}

export interface Payment {
  id: string;
  date: Date;
  
  type: 'deposit' | 'progress' | 'final' | 'retention';
  
  amount: number;
  method: 'cash' | 'transfer' | 'check' | 'credit' | 'installment';
  
  status: 'pending' | 'received' | 'confirmed' | 'refunded';
  
  // 收款信息
  receivedBy: string;
  receivedAt?: Date;
  
  // 凭证
  receiptNumber?: string;
  attachments?: string[];
  
  // 备注
  note: string;
}

// ========================================
// 9. 用户与权限数据模型
// ========================================

export interface User {
  id: string;
  username: string;
  email: string;
  phone: string;
  
  // 个人信息
  profile: {
    name: string;
    avatar?: string;
    department?: string;
    title?: string;
  };
  
  // 角色
  roles: UserRole[];
  
  // 关联经销商
  dealer?: {
    id: string;
    name: string;
    type: DealerType;
  };
  
  // 权限
  permissions: string[];
  
  // 偏好设置
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    language: 'zh-CN' | 'en-US';
    notifications: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
    dashboardLayout: string;
  };
  
  // 统计
  stats: {
    lastLogin: Date;
    loginCount: number;
    projectsCount: number;
    designsCount: number;
  };
  
  // 状态
  status: 'active' | 'inactive' | 'suspended';
  
  // 时间戳
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 
  | 'admin'           // 管理员
  | 'dealer-admin'   // 经销商管理员
  | 'dealer-sales'   // 经销商销售
  | 'dealer-designer' // 经销商设计师
  | 'designer'       // 独立设计师
  | 'installer'      // 安装商
  | 'client'         // 客户
  | 'guest';         // 访客

// ========================================
// 10. API请求/响应类型
// ========================================

// 分页请求
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// 分页响应
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// API响应包装
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    duration: number;
  };
}

// 筛选参数
export interface FilterParams {
  [key: string]: string | number | boolean | string[] | undefined;
}

// 搜索参数
export interface SearchParams extends PaginationParams, FilterParams {
  keyword?: string;
  searchFields?: string[];
}

// ========================================
// 11. 系统配置与日志
// ========================================

export interface SystemConfig {
  // 公司信息
  company: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website: string;
  };
  
  // 业务参数
  business: {
    protectionPeriodDays: number;  // 保护期天数
    protectionExtensions: number;    // 可延期次数
    minProjectAmount: number;      // 最小项目金额
    quotationValidityDays: number;  // 报价有效期
    
    // 佣金规则
    commissionRules: {
      baseRate: number;
      tiers: { threshold: number; rate: number }[];
    };
  };
  
  // 计算参数
  calculation: {
    defaultClimateZone: ClimateZone;
    safetyFactorHeating: number;
    safetyFactorCooling: number;
    
    // 负荷计算默认值
    indoorTempHeating: number;
    indoorTempCooling: number;
    
    // 能耗计算
    electricityPrice: number;      // 元/kWh
    gasPrice?: number;             // 元/m³
  };
  
  // 通知设置
  notifications: {
    expiryWarningDays: number[];   // 保护期到期警告天数
    followUpReminderDays: number;  // 跟进提醒间隔
  };
}

export interface SystemLog {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  
  // 来源
  source: {
    module: string;
    function: string;
    userId?: string;
    ip?: string;
  };
  
  // 内容
  message: string;
  details?: any;
  
  // 上下文
  context?: {
    requestId?: string;
    traceId?: string;
    metadata?: any;
  };
}

// ========================================
// 12. 辅助类型
// ========================================

// 地址
export interface Address {
  province: string;
  city: string;
  district: string;
  street: string;
  building?: string;
  unit?: string;
  zipCode?: string;
}

// 时间段
export interface TimeRange {
  start: Date;
  end: Date;
  timezone?: string;
}

// 金额
export interface Money {
  amount: number;
  currency: 'CNY' | 'USD' | 'EUR';
}

// 文件
export interface FileInfo {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: Date;
  uploadedBy: string;
}

// 统计数据
export interface Statistics {
  period: 'day' | 'week' | 'month' | 'quarter' | 'year';
  startDate: Date;
  endDate: Date;
  
  metrics: {
    name: string;
    value: number;
    unit?: string;
    change?: number;           // 环比变化
    changePercent?: number;
  }[];
}
