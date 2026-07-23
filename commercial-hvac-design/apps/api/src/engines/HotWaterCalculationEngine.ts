/**
 * 热水负荷计算引擎
 * 依据: GB 50015-2019 建筑给水排水设计标准
 */

// 计算参数接口
export interface HotWaterCalculationParams {
  buildingType: string;           // 建筑类型
  buildingArea: number;           // 建筑面积 (m²)
  unitCount: number;            // 计算单位数 (人数/床位数/客房数)
  coldWaterTemp: number;        // 冷水计算温度 (℃)
  hotWaterTemp: number;         // 热水温度 (℃), 默认60℃
  hourlyVariationCoeff: number; // 小时变化系数 Kh
  dailyWaterQuota: number;      // 最高日用水定额 (L/人·d 或 L/床·d)
  usageType: 'allDay' | 'timed'; // 全日供应或定时供应
}

// 计算结果接口
export interface HotWaterCalculationResult {
  designHourlyHeatConsumption: number;  // 设计小时耗热量 Qh (kW)
  designHourlyWaterVolume: number;      // 设计小时热水量 (L/h)
  dailyHeatConsumption: number;         // 日耗热量 (kJ/d)
  dailyWaterVolume: number;           // 日热水量 (L/d)
  peakHour: number;                   // 峰值小时
  equipmentPower: number;             // 设备功率需求 (kW)
  storageTankVolume: number;          // 储热水箱容积 (L)
  formula: string;                    // 计算公式说明
  parameters: Record<string, number | string>; // 计算参数明细
}

// 建筑类型默认参数库 (依据GB 50015-2019)
const BUILDING_TYPE_PARAMS: Record<string, {
  dailyWaterQuota: { min: number; max: number };
  hourlyVariationCoeff: { min: number; max: number };
  usageTime: number;
  defaultTemp: number;
}> = {
  hotel: {
    dailyWaterQuota: { min: 120, max: 160 },
    hourlyVariationCoeff: { min: 2.33, max: 5.70 },
    usageTime: 24,
    defaultTemp: 60,
  },
  hospital: {
    dailyWaterQuota: { min: 70, max: 130 },
    hourlyVariationCoeff: { min: 1.6, max: 3.64 },
    usageTime: 24,
    defaultTemp: 60,
  },
  school: {
    dailyWaterQuota: { min: 15, max: 30 },
    hourlyVariationCoeff: { min: 1.5, max: 2.0 },
    usageTime: 4,
    defaultTemp: 60,
  },
  gym: {
    dailyWaterQuota: { min: 25, max: 40 },
    hourlyVariationCoeff: { min: 1.0, max: 2.0 },
    usageTime: 12,
    defaultTemp: 60,
  },
  restaurant: {
    dailyWaterQuota: { min: 15, max: 20 },
    hourlyVariationCoeff: { min: 1.5, max: 1.2 },
    usageTime: 12,
    defaultTemp: 60,
  },
  office: {
    dailyWaterQuota: { min: 5, max: 10 },
    hourlyVariationCoeff: { min: 1.5, max: 1.2 },
    usageTime: 8,
    defaultTemp: 60,
  },
  factory: {
    dailyWaterQuota: { min: 25, max: 40 },
    hourlyVariationCoeff: { min: 1.5, max: 2.5 },
    usageTime: 8,
    defaultTemp: 60,
  },
  swimmingPool: {
    dailyWaterQuota: { min: 50, max: 100 },
    hourlyVariationCoeff: { min: 1.0, max: 2.0 },
    usageTime: 12,
    defaultTemp: 27, // 泳池水温不同
  },
};

// 地区冷水温度表 (GB 50015-2019 表6.2.1)
const COLD_WATER_TEMP_BY_REGION: Record<string, number> = {
  '黑龙江': 4,
  '吉林': 4,
  '辽宁': 4,
  '内蒙古': 4,
  '新疆': 4,
  '北京': 10,
  '天津': 10,
  '河北': 10,
  '山东': 10,
  '山西': 10,
  '陕西': 10,
  '甘肃': 10,
  '宁夏': 10,
  '青海': 5,
  '西藏': 5,
  '上海': 15,
  '江苏': 15,
  '浙江': 15,
  '安徽': 15,
  '福建': 15,
  '江西': 15,
  '湖北': 15,
  '湖南': 15,
  '广东': 15,
  '广西': 15,
  '海南': 15,
  '台湾': 15,
  '香港': 15,
  '澳门': 15,
  '四川': 12,
  '重庆': 12,
  '贵州': 12,
  '云南': 12,
  '河南': 12,
};

export class HotWaterCalculationEngine {
  // 水的比热容 (kJ/(kg·℃))
  private readonly WATER_SPECIFIC_HEAT = 4.187;
  // 热水密度 (kg/L)
  private readonly HOT_WATER_DENSITY = 0.983;
  // 秒转小时换算
  private readonly SECONDS_PER_HOUR = 3600;

  /**
   * 获取建筑类型默认参数
   */
  static getBuildingTypeDefaults(buildingType: string) {
    return BUILDING_TYPE_PARAMS[buildingType] || BUILDING_TYPE_PARAMS['hotel'];
  }

  /**
   * 根据地区获取冷水温度
   */
  static getColdWaterTempByRegion(province: string): number {
    return COLD_WATER_TEMP_BY_REGION[province] || 10; // 默认10℃
  }

  /**
   * 计算设计小时耗热量
   * 公式: Qh = Kh × m × qr × (tr - tl) × C × ρ / 86400
   */
  calculate(params: HotWaterCalculationParams): HotWaterCalculationResult {
    const {
      unitCount,
      coldWaterTemp,
      hotWaterTemp,
      hourlyVariationCoeff,
      dailyWaterQuota,
    } = params;

    // 温度差
    const tempDiff = hotWaterTemp - coldWaterTemp;

    // 日热水量 (L/d)
    const dailyWaterVolume = unitCount * dailyWaterQuota;

    // 设计小时耗热量 (kW)
    // Qh = Kh × m × qr × (tr - tl) × C × ρ / 86400
    const designHourlyHeatConsumption = (
      hourlyVariationCoeff *
      unitCount *
      dailyWaterQuota *
      tempDiff *
      this.WATER_SPECIFIC_HEAT *
      this.HOT_WATER_DENSITY /
      (24 * this.SECONDS_PER_HOUR) // 86400 seconds
    );

    // 设计小时热水量 (L/h)
    const designHourlyWaterVolume = (hourlyVariationCoeff * dailyWaterQuota * unitCount) / 24;

    // 日耗热量 (kJ/d)
    const dailyHeatConsumption = dailyWaterVolume * tempDiff * this.WATER_SPECIFIC_HEAT * this.HOT_WATER_DENSITY;

    // 设备功率需求 (考虑1.1冗余系数)
    const equipmentPower = designHourlyHeatConsumption * 1.1;

    // 储热水箱容积 (按高峰用水量计算, 存储1小时用量)
    const storageTankVolume = designHourlyWaterVolume * 1.5;

    // 峰值小时 (根据小时变化系数估算)
    const peakHour = 7; // 默认早上7点

    return {
      designHourlyHeatConsumption: Math.round(designHourlyHeatConsumption * 100) / 100,
      designHourlyWaterVolume: Math.round(designHourlyWaterVolume),
      dailyHeatConsumption: Math.round(dailyHeatConsumption),
      dailyWaterVolume: Math.round(dailyWaterVolume),
      peakHour,
      equipmentPower: Math.round(equipmentPower * 100) / 100,
      storageTankVolume: Math.round(storageTankVolume),
      formula: 'Qh = Kh × m × qr × (tr - tl) × C × ρ / 86400',
      parameters: {
        'Kh (小时变化系数)': hourlyVariationCoeff,
        'm (计算单位数)': unitCount,
        'qr (用水定额 L/d)': dailyWaterQuota,
        'tr (热水温度 ℃)': hotWaterTemp,
        'tl (冷水温度 ℃)': coldWaterTemp,
        'ΔT (温差 ℃)': tempDiff,
        'C (比热容 kJ/(kg·℃))': this.WATER_SPECIFIC_HEAT,
        'ρ (密度 kg/L)': this.HOT_WATER_DENSITY,
      },
    };
  }

  /**
   * 计算定时供应系统的设计小时耗热量
   * 公式不同: Qh = Σ(qh × n × b) × (tr - tl) × C × ρ / 3600
   */
  calculateTimedSystem(
    fixtures: Array<{ type: string; flowRate: number; count: number; simultaneityFactor: number }>,
    coldWaterTemp: number,
    hotWaterTemp: number
  ): HotWaterCalculationResult {
    const tempDiff = hotWaterTemp - coldWaterTemp;

    // 计算卫生器具的小时耗热量
    let hourlyHeatConsumption = 0;
    let totalFlow = 0;

    for (const fixture of fixtures) {
      const { flowRate, count, simultaneityFactor } = fixture;
      // 每个器具的耗热量
      const fixtureHeat = flowRate * count * simultaneityFactor * tempDiff * 
                         this.WATER_SPECIFIC_HEAT * this.HOT_WATER_DENSITY;
      hourlyHeatConsumption += fixtureHeat;
      totalFlow += flowRate * count * simultaneityFactor;
    }

    // 转换为kW (除以3600秒)
    const designHourlyHeatConsumption = hourlyHeatConsumption / this.SECONDS_PER_HOUR;

    return {
      designHourlyHeatConsumption: Math.round(designHourlyHeatConsumption * 100) / 100,
      designHourlyWaterVolume: Math.round(totalFlow),
      dailyHeatConsumption: Math.round(hourlyHeatConsumption * 12), // 假设12小时使用
      dailyWaterVolume: Math.round(totalFlow * 12),
      peakHour: 19, // 晚上高峰
      equipmentPower: Math.round(designHourlyHeatConsumption * 1.1 * 100) / 100,
      storageTankVolume: Math.round(totalFlow * 1.5),
      formula: 'Qh = Σ(qh × n × b) × (tr - tl) × C × ρ / 3600',
      parameters: {
        '器具数量': fixtures.length,
        '同时使用系数': '按器具类型',
        'tr (热水温度 ℃)': hotWaterTemp,
        'tl (冷水温度 ℃)': coldWaterTemp,
        'ΔT (温差 ℃)': tempDiff,
      },
    };
  }

  /**
   * 生成24小时负荷曲线数据
   */
  generate24HourCurve(params: HotWaterCalculationParams): Array<{ hour: number; heatConsumption: number; waterVolume: number }> {
    const curve: Array<{ hour: number; heatConsumption: number; waterVolume: number }> = [];
    
    // 基准小时平均负荷
    const avgHourlyHeat = params.unitCount * params.dailyWaterQuota * 
                         (params.hotWaterTemp - params.coldWaterTemp) * 
                         this.WATER_SPECIFIC_HEAT * this.HOT_WATER_DENSITY / 
                         (24 * this.SECONDS_PER_HOUR);

    // 典型酒店用水曲线模式 (可根据建筑类型调整)
    const hourlyPatterns: Record<number, number> = {
      0: 0.3, 1: 0.2, 2: 0.2, 3: 0.2, 4: 0.3, 5: 0.5,
      6: 0.8, 7: 1.2, 8: 0.9, 9: 0.6, 10: 0.5, 11: 0.6,
      12: 0.8, 13: 0.7, 14: 0.5, 15: 0.5, 16: 0.6, 17: 0.8,
      18: 1.0, 19: 1.3, 20: 1.1, 21: 0.9, 22: 0.7, 23: 0.5,
    };

    for (let hour = 0; hour < 24; hour++) {
      const pattern = hourlyPatterns[hour] || 0.5;
      curve.push({
        hour,
        heatConsumption: Math.round(avgHourlyHeat * pattern * params.hourlyVariationCoeff * 100) / 100,
        waterVolume: Math.round(params.dailyWaterQuota * params.unitCount / 24 * pattern * params.hourlyVariationCoeff),
      });
    }

    return curve;
  }
}

// 导出单例实例
export const hotWaterEngine = new HotWaterCalculationEngine();
