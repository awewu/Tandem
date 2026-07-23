/**
 * HVAC暖通系统核心数据类型定义
 * 涵盖设备、负荷计算、设计方案、项目报备、经销商管理等全领域
 */

// ========================================
// 1. 基础枚举类型
// ========================================

export type Brand = 'Rheem' | 'Ruud';
export type SystemType = 'water' | 'air' | 'hybrid';
export type EquipmentCategory = 
  | 'heat-pump' 
  | 'water-heater' 
  | 'furnace' 
  | 'air-conditioner'
  | 'boiler'
  | 'radiator'
  | 'fresh-air-unit'
  | 'purifier'
  | 'softener'
  | 'pump'
  | 'tank';

export type ProjectType = 'residential' | 'commercial' | 'industrial';
export type BuildingType = 
  | 'villa' 
  | 'apartment' 
  | 'office' 
  | 'hotel' 
  | 'hospital' 
  | 'school' 
  | 'factory' 
  | 'retail';

export type ClimateZone = 
  | 'severe-cold'     // 严寒地区
  | 'cold'            // 寒冷地区
  | 'hot-summer-cold-winter'  // 夏热冬冷
  | 'hot-summer-warm-winter'  // 夏热冬暖
  | 'mild';           // 温和地区

export type DealerType = 'dealer' | 'designer' | 'contractor' | 'distributor';
export type DealerLevel = 1 | 2 | 3 | 4;  // 钻石/金牌/银牌/普通

export type RegistrationStatus = 
  | 'active'      // 保护中
  | 'extended'    // 已延期
  | 'won'         // 已成交
  | 'lost'        // 已丢单
  | 'expired';    // 已过期

export type OrderStatus = 
  | 'draft'       // 草稿
  | 'confirmed'   // 已确认
  | 'paid'        // 已付款
  | 'producing'   // 生产中
  | 'shipped'     // 已发货
  | 'installed'   // 已安装
  | 'commissioned' // 已调试
  | 'completed'   // 已完成
  | 'cancelled';  // 已取消

export type RoomType = 
  | 'living'      // 客厅
  | 'bedroom'     // 卧室
  | 'kitchen'     // 厨房
  | 'bathroom'    // 卫生间
  | 'study'       // 书房
  | 'dining'      // 餐厅
  | 'balcony'     // 阳台
  | 'hallway'     // 走廊
  | 'basement'    // 地下室
  | 'attic';      // 阁楼

// ========================================
// 2. HVAC设备数据模型
// ========================================

export interface HVACEquipment {
  id: string;
  brand: Brand;
  category: EquipmentCategory;
  systemType: SystemType;
  model: string;              // 型号
  series: string;             // 系列
  name: string;               // 产品名称
  description: string;        // 产品描述
  
  // 技术规格
  specs: EquipmentSpecs;
  
  // 应用场景
  application: EquipmentApplication;
  
  // 价格信息
  price: EquipmentPrice;
  
  // 安装要求
  installation: InstallationRequirements;
  
  // 认证与专利
  certifications: string[];
  patents: PatentInfo[];
  
  // 媒体资源
  media: {
    images: string[];         // 产品图片
    videos: string[];         // 视频
    manuals: string[];        // 手册
    drawings: string[];       // 图纸
  };
  
  // 库存状态
  inventory: {
    available: boolean;
    stock: number;
    leadTime: number;         // 交货周期(天)
  };
  
  // 元数据
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    priority: number;         // 推荐优先级
    tags: string[];
  };
}

export interface EquipmentSpecs {
  // 制热性能
  heatingCapacity?: number;         // kW 额定制热能力
  heatingCapacityMin?: number;      // kW 最小制热能力
  heatingCapacityMax?: number;        // kW 最大制热能力
  cop?: number;                      // 制热能效比
  scop?: number;                     // 季节性能系数(制热)
  
  // 制冷性能
  coolingCapacity?: number;         // kW 额定制冷能力
  coolingCapacityMin?: number;        // kW 最小制冷能力
  coolingCapacityMax?: number;        // kW 最大制冷能力
  eer?: number;                      // 制冷能效比
  seer?: number;                     // 季节性能系数(制冷)
  
  // 热水性能
  hotWaterCapacity?: number;        // L/min 热水产率
  temperatureRise?: number;         // ℃ 温升
  recoveryTime?: number;            // min 恢复时间
  firstHourRating?: number;         // L 第一小时出水量
  
  // 物理参数
  dimensions: {
    length: number;                 // mm
    width: number;                  // mm
    height: number;                 // mm
  };
  weight: number;                   // kg
  
  // 电气参数
  electrical: {
    voltage: number;                // V
    phase: 1 | 3;                   // 相数
    frequency: 50 | 60;             // Hz
    maxCurrent: number;            // A
    maxPower: number;              // kW
  };
  
  // 噪音水平
  noiseLevel: {
    min: number;                    // dB
    max: number;                    // dB
    testCondition: string;          // 测试工况
  };
  
  // 环境适应性
  operatingRange: {
    minTemp: number;                // ℃ 最低工作温度
    maxTemp: number;                // ℃ 最高工作温度
    maxHumidity: number;            // % 最高湿度
  };
  
  // 冷媒信息
  refrigerant?: {
    type: string;                   // 如 R32, R410A
    charge: number;                 // kg
    gwp: number;                    // 全球变暖潜能值
  };
  
  // 水路/风路参数
  waterFlow?: {
    rated: number;                  // m³/h 额定流量
    min: number;                    // m³/h 最小流量
    max: number;                    // m³/h 最大流量
    pressureDrop: number;          // kPa 水侧压降
  };
  
  airflow?: {
    rated: number;                  // m³/h 额定风量
    min: number;                    // m³/h 最小风量
    max: number;                    // m³/h 最大风量
    staticPressure: number;        // Pa 静压
  };
}

export interface EquipmentApplication {
  minArea: number;                  // 最小适用面积
  maxArea: number;                  // 最大适用面积
  recommendedArea: number;          // 推荐面积
  
  climateZones: ClimateZone[];     // 适用气候区
  buildingTypes: BuildingType[];   // 适用建筑类型
  
  roomTypes: RoomType[];            // 适用房间类型
  floorTypes: ('basement' | 'ground' | 'middle' | 'top')[];
  
  // 系统兼容性
  compatibleWith: string[];        // 兼容设备ID列表
  requiredAccessories: string[];    // 必需配件ID列表
  optionalAccessories: string[];    // 可选配件ID列表
}

export interface EquipmentPrice {
  dealer: number;                   // 经销商价
  distributor: number;              // 分销商价
  retail: number;                   // 零售价
  msrp: number;                     // 厂商建议零售价
  
  installation: {                    // 安装费
    standard: number;               // 标准安装
    complex: number;                // 复杂安装
  };
  
  accessories: {                    // 配件价格
    [accessoryId: string]: number;
  };
  
  // 促销信息
  promotion?: {
    discount: number;               // 折扣率
    validUntil: Date;
    bundleDeals: string[];          // 捆绑优惠
  };
}

export interface InstallationRequirements {
  minClearance: {                   // 最小间距要求
    front: number;                  // mm
    back: number;                   // mm
    left: number;                   // mm
    right: number;                  // mm
    top: number;                    // mm
    bottom: number;               // mm
  };
  
  foundation: {
    type: 'wall-mounted' | 'floor-standing' | 'ceiling-mounted' | 'outdoor-pad';
    loadCapacity: number;          // kg 承重
    vibrationIsolation: boolean;   // 是否需要减震
  };
  
  utilities: {
    waterConnection: boolean;      // 需要水路
    drainRequired: boolean;        // 需要排水
    gasConnection?: boolean;       // 需要燃气
    electricalPhase: 1 | 3;        // 电源相数
    minCircuitBreaker: number;     // A 最小断路器
  };
  
  ductwork?: {                     // 风管要求
    supplySize: number;            // mm 送风管径
    returnSize: number;            // mm 回风管径
    maxDuctLength: number;         // m 最大风管长度
  };
  
  piping?: {                       // 管路要求
    pipeSize: number;              // mm 管径
    maxLength: number;             // m 最大管长
    maxLift: number;               // m 最大提升高度
    insulationRequired: boolean;   // 需要保温
  };
}

export interface PatentInfo {
  name: string;
  number: string;
  description: string;
  benefit: string;                // 给客户带来的好处
}

// ========================================
// 3. 负荷计算数据模型
// ========================================

export interface LoadCalculation {
  id: string;
  projectId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  
  // 建筑信息
  buildingInfo: BuildingInfo;
  
  // 气候数据
  climateData: ClimateData;
  
  // 围护结构参数
  envelope: EnvelopeParams;
  
  // 房间明细
  rooms: RoomLoad[];
  
  // 计算结果
  results: LoadResults;
  
  // 计算参数
  calculationParams: CalculationParams;
  
  // 备注
  notes: string;
}

export interface BuildingInfo {
  name: string;
  type: BuildingType;
  projectType: ProjectType;
  
  location: {
    province: string;
    city: string;
    district: string;
    address: string;
    latitude: number;
    longitude: number;
    altitude: number;              // m 海拔
  };
  
  dimensions: {
    totalArea: number;             // m² 总建筑面积
    heatedArea: number;            // m² 采暖面积
    cooledArea: number;            // m² 空调面积
    floorCount: number;            // 层数
    floorHeight: number;           // m 层高
    basementArea?: number;        // m² 地下室面积
    basementHeight?: number;      // m 地下室层高
  };
  
  orientation: {
    mainFacade: number;            // 度，正北为0，顺时针
    shape: 'rectangle' | 'l-shape' | 'u-shape' | 'irregular';
    aspectRatio: number;          // 长宽比
  };
  
  occupancy: {
    totalPersons: number;          // 总人数
    personsPerRoom: number;        // 每房间人数
    occupancySchedule: string;     // 使用时间表
  };
  
  operation: {
    heatingSeason: {               // 采暖季
      start: string;              // MM-DD
      end: string;                // MM-DD
      hoursPerDay: number;
      daysPerWeek: number;
    };
    coolingSeason: {             // 制冷季
      start: string;
      end: string;
      hoursPerDay: number;
      daysPerWeek: number;
    };
    hotWaterHours: number;        // 日热水使用小时
  };
}

export interface ClimateData {
  climateZone: ClimateZone;
  
  // 冬季参数
  winter: {
    outdoorTemp: number;          // ℃ 室外计算温度
    indoorTemp: number;           // ℃ 室内设计温度
    relativeHumidity: number;     // % 相对湿度
    windSpeed: number;            // m/s 风速
    solarRadiation: number;       // W/m² 太阳辐射
    heatingDegreeDays: number;    // 采暖度日数
  };
  
  // 夏季参数
  summer: {
    dryBulbTemp: number;          // ℃ 干球温度
    wetBulbTemp: number;         // ℃ 湿球温度
    indoorTemp: number;          // ℃ 室内设计温度
    indoorHumidity: number;      // % 室内相对湿度
    relativeHumidity: number;    // % 室外相对湿度
    windSpeed: number;           // m/s 风速
    solarRadiation: number;      // W/m² 太阳辐射
    coolingDegreeDays: number;   // 制冷度日数
  };
  
  // 极端天气
  extreme: {
    minTemp: number;             // ℃ 历史最低
    maxTemp: number;            // ℃ 历史最高
    maxWindSpeed: number;        // m/s 最大风速
  };
  
  // 土壤参数(地源热泵用)
  ground?: {
    temp: number;                // ℃ 年平均地温
    thermalConductivity: number; // W/(m·K) 导热系数
    diffusivity: number;         // m²/s 热扩散率
  };
}

export interface EnvelopeParams {
  // 外墙
  walls: {
    area: number;                // m²
    uValue: number;              // W/(m²·K) 传热系数
    construction: string;        // 构造描述
    insulation: {
      type: string;
      thickness: number;        // mm
      conductivity: number;     // W/(m·K)
    };
  };
  
  // 屋顶
  roof: {
    area: number;
    uValue: number;
    type: 'flat' | 'pitched' | 'attic';
    insulation: {
      type: string;
      thickness: number;
      conductivity: number;
    };
  };
  
  // 地面/地板
  floor: {
    area: number;
    uValue: number;
    type: 'on-grade' | 'suspended' | 'basement';
    insulation: {
      type: string;
      thickness: number;
    };
  };
  
  // 外窗
  windows: {
    totalArea: number;           // m²
    wallRatio: number;         // 窗墙比
    uValue: number;            // W/(m²·K)
    shgc: number;              // 太阳得热系数
    shading: {
      type: 'internal' | 'external' | 'between-glass' | 'none';
      factor: number;          // 遮阳系数
    };
    orientation: {             // 各朝向窗面积
      north: number;
      south: number;
      east: number;
      west: number;
    };
  };
  
  // 外门
  doors: {
    count: number;
    area: number;
    uValue: number;
    airTightness: number;        // m³/(m·h) 气密性
  };
  
  // 气密性
  airTightness: {
    ach50: number;              // 换气次数@50Pa
    n50: number;                // 自然换气次数
    envelopeArea: number;       // m² 外围护面积
    volume: number;             // m³ 建筑体积
  };
  
  // 热桥
  thermalBridges: {
    psiValue: number;          // W/(m·K) 线性传热系数
    length: number;            // m 热桥长度
    additionalLoss: number;    // % 附加热损失比例
  };
}

export interface RoomLoad {
  id: string;
  name: string;
  type: RoomType;
  floor: number;
  
  dimensions: {
    area: number;               // m²
    height: number;             // m
    volume: number;            // m³
  };
  
  // 围护结构
  envelope: {
    wallArea: number;
    windowArea: number;
    roofArea?: number;
    floorArea?: number;
    orientation: string;
  };
  
  // 内部负荷
  internalLoads: {
    occupants: number;          // 人数
    occupantSensible: number;  // W 人员显热
    occupantLatent: number;    // W 人员潜热
    
    lighting: number;          // W 照明功率
    equipment: number;         // W 设备功率
    appliances: number;        // W 电器功率
  };
  
  // 通风要求
  ventilation: {
    freshAirRate: number;       // m³/(h·人) 新风量
    totalFreshAir: number;     // m³/h 总新风量
    infiltration: number;      // m³/h 渗透风量
  };
  
  // 负荷计算结果
  results: {
    heatingLoad: number;       // W 热负荷
    coolingLoadSensible: number;  // W 冷负荷(显热)
    coolingLoadLatent: number;    // W 冷负荷(潜热)
    coolingLoadTotal: number;     // W 冷负荷(总计)
    
    peakHeatingTime: string;      // 峰值热负荷时间
    peakCoolingTime: string;      // 峰值冷负荷时间
    
    loadDensityHeating: number;   // W/m² 热负荷指标
    loadDensityCooling: number;   // W/m² 冷负荷指标
  };
  
  // 设计参数
  designParams: {
    heatingTemp: number;         // ℃ 采暖设计温度
    coolingTemp: number;         // ℃ 空调设计温度
    humidityWinter: number;      // % 冬季湿度
    humiditySummer: number;      // % 夏季湿度
  };
}

export interface LoadResults {
  // 建筑总负荷
  building: {
    heatingLoad: number;         // W
    coolingLoadSensible: number;
    coolingLoadLatent: number;
    coolingLoadTotal: number;
    hotWaterLoad: number;        // W
  };
  
  // 负荷指标
  metrics: {
    heatingLoadPerArea: number;  // W/m²
    coolingLoadPerArea: number;
    heatingLoadPerVolume: number; // W/m³
    coolingLoadPerVolume: number;
  };
  
  // 分区负荷(按楼层/朝向)
  byFloor: {
    [floor: number]: {
      heating: number;
      cooling: number;
    };
  };
  
  byOrientation: {
    north: { heating: number; cooling: number; };
    south: { heating: number; cooling: number; };
    east: { heating: number; cooling: number; };
    west: { heating: number; cooling: number; };
  };
  
  // 负荷组成分析
  components: {
    envelope: { heating: number; cooling: number; };  // 围护结构
    ventilation: { heating: number; cooling: number; };  // 通风
    internal: { heating: number; cooling: number; };  // 内部负荷
    infiltration: { heating: number; cooling: number; };  // 渗透
    solar: { heating: number; cooling: number; };     // 太阳辐射
  };
  
  // 年能耗预估
  annualEstimates: {
    heatingEnergy: number;       // kWh/年
    coolingEnergy: number;
    hotWaterEnergy: number;
    totalEnergy: number;
    
    heatingCost: number;         // 元/年
    coolingCost: number;
    hotWaterCost: number;
    totalCost: number;
  };
}

export interface CalculationParams {
  method: 'manual' | 'software' | 'ai';  // 计算方法
  standard: 'GB' | 'ASHRAE' | 'CIBSE';   // 遵循标准
  
  // 安全系数
  safetyFactors: {
    heating: number;
    cooling: number;
    hotWater: number;
  };
  
  // 同时使用系数
  diversityFactors: {
    heating: number;
    cooling: number;
    hotWater: number;
  };
  
  // 附加系数
  additionalFactors: {
    intermittent: number;       // 间歇使用系数
    futureExpansion: number;    // 发展裕量
    altitude: number;          // 海拔修正
  };
}
