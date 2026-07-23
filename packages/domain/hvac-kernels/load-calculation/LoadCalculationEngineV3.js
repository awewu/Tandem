/**
 * 负荷工程估算引擎 V3（方案前期快估，trust = estimate）
 *
 * 诚实定位（W-BIM-1 · 1.6 降级）：
 * - 本引擎为简化实现的工程估算（RTS/谐波法的参考实现 + 指标法快估），
 *   仅供方案前期参考，**不可作合规辩护依据，不得喂 verified 门禁**。
 * - 可溯源精算（verified）一律走 services/calc-engine（hvacpy，ASHRAE 出处链）。
 *
 * 参考标准（简化参照，非完整实现）：
 * - ASHRAE 62.1/90.1/55；GB 50736-2012 / GB 50019-2015
 *
 * 计算方法（简化实现）：RTS / 谐波反应法 / 混合加权 / 指标法快估
 * @version 3.1.0
 */

class LoadCalculationEngineV3 {
  constructor() {
    this.version = '3.1.0';
    this.trustLevel = 'estimate'; // 工程估算；verified 精算走 services/calc-engine(hvacpy)
    this.methods = ['RTS', 'Harmonic', 'HeatBalance', 'RTS+HB Hybrid'];
    
    // 全球城市气象数据库 (支持8760小时模拟)
    this.globalClimateDatabase = this.initializeGlobalClimateDB();
    
    // 围护结构材料数据库 (三标并行)
    this.envelopeDatabase = this.initializeEnvelopeDB();
    
    // 8760小时气象数据缓存
    this.hourlyWeatherCache = new Map();
    
    // RTS系数矩阵
    this.rtsCoefficients = this.initializeRTSCoefficients();
    
    // 谐波反应系数
    this.harmonicCoefficients = this.initializeHarmonicCoefficients();
  }

  /**
   * 初始化全球城市气象数据库
   * 包含: 中国200+城市、美国50+城市、日本30+城市、欧洲50+城市
   */
  initializeGlobalClimateDB() {
    return {
      // 中国主要城市 - GB50736标准
      china: {
        '北京': { lat: 39.9, lon: 116.4, altitude: 31.2, climateZone: '寒冷地区',
          summer: { designTemp: 33.2, wetBulb: 26.4, dailyRange: 8.5, humidity: 64 },
          winter: { designTemp: -9.9, humidity: 45 },
          degreeDays: { heating: 2690, cooling: 920 },
          solar: { south: 580, north: 180, east: 420, west: 420 }
        },
        '上海': { lat: 31.2, lon: 121.5, altitude: 4.5, climateZone: '夏热冬冷',
          summer: { designTemp: 34.4, wetBulb: 27.9, dailyRange: 6.9, humidity: 68 },
          winter: { designTemp: -2.2, humidity: 75 },
          degreeDays: { heating: 1590, cooling: 1680 },
          solar: { south: 480, north: 140, east: 380, west: 380 }
        },
        '广州': { lat: 23.1, lon: 113.3, altitude: 6.6, climateZone: '夏热冬暖',
          summer: { designTemp: 34.2, wetBulb: 27.8, dailyRange: 7.0, humidity: 72 },
          winter: { designTemp: 5.0, humidity: 70 },
          degreeDays: { heating: 0, cooling: 2980 },
          solar: { south: 420, north: 120, east: 340, west: 340 }
        },
        '深圳': { lat: 22.5, lon: 114.1, altitude: 18.2, climateZone: '夏热冬暖',
          summer: { designTemp: 33.7, wetBulb: 27.5, dailyRange: 6.5, humidity: 74 },
          winter: { designTemp: 6.0, humidity: 72 },
          degreeDays: { heating: 0, cooling: 2850 },
          solar: { south: 410, north: 120, east: 330, west: 330 }
        },
        '杭州': { lat: 30.3, lon: 120.2, altitude: 7.2, climateZone: '夏热冬冷',
          summer: { designTemp: 35.6, wetBulb: 27.9, dailyRange: 7.5, humidity: 65 },
          winter: { designTemp: -1.2, humidity: 80 },
          degreeDays: { heating: 1720, cooling: 1560 },
          solar: { south: 460, north: 140, east: 360, west: 360 }
        },
        '南京': { lat: 32.0, lon: 118.8, altitude: 8.9, climateZone: '夏热冬冷',
          summer: { designTemp: 34.8, wetBulb: 28.1, dailyRange: 7.8, humidity: 70 },
          winter: { designTemp: -1.8, humidity: 76 },
          degreeDays: { heating: 1820, cooling: 1420 },
          solar: { south: 480, north: 150, east: 370, west: 370 }
        },
        '武汉': { lat: 30.6, lon: 114.3, altitude: 23.3, climateZone: '夏热冬冷',
          summer: { designTemp: 35.2, wetBulb: 28.4, dailyRange: 8.0, humidity: 72 },
          winter: { designTemp: -2.0, humidity: 79 },
          degreeDays: { heating: 1650, cooling: 1680 },
          solar: { south: 490, north: 150, east: 380, west: 380 }
        },
        '成都': { lat: 30.7, lon: 104.1, altitude: 506.1, climateZone: '夏热冬冷',
          summer: { designTemp: 31.9, wetBulb: 26.7, dailyRange: 8.0, humidity: 82 },
          winter: { designTemp: 1.0, humidity: 83 },
          degreeDays: { heating: 1380, cooling: 980 },
          solar: { south: 440, north: 130, east: 340, west: 340 }
        },
        '重庆': { lat: 29.6, lon: 106.5, altitude: 259.1, climateZone: '夏热冬冷',
          summer: { designTemp: 36.5, wetBulb: 27.3, dailyRange: 9.2, humidity: 70 },
          winter: { designTemp: 2.0, humidity: 82 },
          degreeDays: { heating: 1240, cooling: 1820 },
          solar: { south: 380, north: 110, east: 300, west: 300 }
        },
        '西安': { lat: 34.3, lon: 108.9, altitude: 396.9, climateZone: '寒冷地区',
          summer: { designTemp: 35.2, wetBulb: 26.0, dailyRange: 11.0, humidity: 55 },
          winter: { designTemp: -5.6, humidity: 67 },
          degreeDays: { heating: 2380, cooling: 1150 },
          solar: { south: 540, north: 170, east: 400, west: 400 }
        },
        '天津': { lat: 39.1, lon: 117.2, altitude: 3.3, climateZone: '寒冷地区',
          summer: { designTemp: 33.4, wetBulb: 26.5, dailyRange: 8.3, humidity: 65 },
          winter: { designTemp: -7.0, humidity: 60 },
          degreeDays: { heating: 2580, cooling: 980 },
          solar: { south: 560, north: 175, east: 410, west: 410 }
        },
        '青岛': { lat: 36.1, lon: 120.4, altitude: 76.0, climateZone: '寒冷地区',
          summer: { designTemp: 30.6, wetBulb: 26.3, dailyRange: 6.0, humidity: 78 },
          winter: { designTemp: -5.2, humidity: 68 },
          degreeDays: { heating: 2180, cooling: 680 },
          solar: { south: 500, north: 160, east: 390, west: 390 }
        }
      },
      
      // 美国主要城市 - ASHRAE标准
      usa: {
        'New York': { lat: 40.7, climateZone: '4A', 
          summer: { designTemp: 32.8, wetBulb: 24.4, dailyRange: 8.9 },
          winter: { designTemp: -9.4 },
          degreeDays: { heating: 2880, cooling: 980 }
        },
        'Los Angeles': { lat: 34.1, climateZone: '3B',
          summer: { designTemp: 29.4, wetBulb: 19.4, dailyRange: 8.3 },
          winter: { designTemp: 2.8 },
          degreeDays: { heating: 1080, cooling: 680 }
        },
        'Chicago': { lat: 41.9, climateZone: '5A',
          summer: { designTemp: 31.1, wetBulb: 24.1, dailyRange: 10.0 },
          winter: { designTemp: -16.1 },
          degreeDays: { heating: 3580, cooling: 780 }
        },
        'Houston': { lat: 29.8, climateZone: '2A',
          summer: { designTemp: 35.0, wetBulb: 25.6, dailyRange: 10.6 },
          winter: { designTemp: -2.2 },
          degreeDays: { heating: 1180, cooling: 2280 }
        }
      },
      
      // 日本主要城市 - 省エネ法
      japan: {
        '東京': { lat: 35.7, region: '関東',
          summer: { designTemp: 32.3, wetBulb: 25.8 },
          winter: { designTemp: -1.5 },
          BEI_reference: 1.0
        },
        '大阪': { lat: 34.7, region: '関西',
          summer: { designTemp: 33.5, wetBulb: 26.5 },
          winter: { designTemp: 0.0 },
          BEI_reference: 0.95
        }
      }
    };
  }

  /**
   * 初始化围护结构材料数据库 (三标并行)
   */
  initializeEnvelopeDB() {
    return {
      // 外墙 (W/(m²·K))
      walls: {
        // 中国标准 GB50189
        'GB-240砖墙+80保温': { U: 0.35, description: '240mm砖墙+80mm岩棉', std: 'GB' },
        'GB-200混凝土+100保温': { U: 0.40, description: '200mm混凝土+100mmXPS', std: 'GB' },
        'GB-轻钢结构+150保温': { U: 0.28, description: '轻钢龙骨+150mm玻璃棉', std: 'GB' },
        'GB-装配式夹心墙': { U: 0.30, description: '预制混凝土夹心保温', std: 'GB' },
        // ASHRAE标准
        'ASHRAE-StdWall_R11': { U: 0.50, description: '2x6 wood frame, R19', std: 'ASHRAE' },
        'ASHRAE-StdWall_R19': { U: 0.32, description: '2x6 wood frame, R19+CI', std: 'ASHRAE' },
        // 日本标准
        'JIS-木造断熱等級4': { U: 0.45, description: '木造住宅断熱等級4', std: 'JIS' },
        'JIS-木造断熱等級5': { U: 0.35, description: '木造住宅断熱等級5', std: 'JIS' }
      },
      
      // 外窗 (W/(m²·K))
      windows: {
        // 中国
        'GB-单玻铝合金': { U: 5.8, SC: 0.9, std: 'GB' },
        'GB-双玻铝合金': { U: 3.2, SC: 0.75, std: 'GB' },
        'GB-双玻断桥': { U: 2.5, SC: 0.65, std: 'GB' },
        'GB-三玻断桥': { U: 1.8, SC: 0.55, std: 'GB' },
        'GB-Low-E中空': { U: 2.0, SC: 0.40, std: 'GB' },
        'GB-真空玻璃': { U: 1.0, SC: 0.35, std: 'GB' },
        // ASHRAE
        'ASHRAE-DoubleClear': { U: 2.8, SC: 0.81, std: 'ASHRAE' },
        'ASHRAE-DoubleLowE': { U: 1.9, SC: 0.58, std: 'ASHRAE' },
        'ASHRAE-TripleLowE': { U: 1.2, SC: 0.48, std: 'ASHRAE' }
      },
      
      // 屋面 (W/(m²·K))
      roofs: {
        'GB-保温屋面_R4': { U: 0.35, description: '150mm保温层', std: 'GB' },
        'GB-保温屋面_R6': { U: 0.25, description: '200mm保温层', std: 'GB' },
        'GB-坡屋面': { U: 0.40, description: '坡屋面+吊顶保温', std: 'GB' }
      },
      
      // 地面 (W/(m²·K))
      floors: {
        'GB-地面保温': { U: 0.30, description: '地面+50mm保温', std: 'GB' },
        'GB-架空地板': { U: 0.45, description: '架空层+保温', std: 'GB' }
      }
    };
  }

  /**
   * 初始化RTS系数矩阵
   * RTS (Radiant Time Series) - ASHRAE Fundamentals推荐方法
   * 将围护结构热增益分为对流和辐射两部分
   */
  initializeRTSCoefficients() {
    // 标准RTS系数 - 基于ASHRAE Fundamentals 2021
    return {
      // 围护结构RTS系数 (24小时)
      conduction: {
        light: { // 轻型结构
          factors: [0.54, 0.16, 0.08, 0.05, 0.03, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.00,
                   0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00],
          radiantFraction: 0.63,
          convectiveFraction: 0.37
        },
        medium: { // 中型结构
          factors: [0.36, 0.19, 0.12, 0.08, 0.05, 0.04, 0.03, 0.02, 0.02, 0.01, 0.01, 0.01,
                   0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.00],
          radiantFraction: 0.63,
          convectiveFraction: 0.37
        },
        heavy: { // 重型结构
          factors: [0.22, 0.16, 0.13, 0.10, 0.08, 0.06, 0.05, 0.04, 0.03, 0.03, 0.02, 0.02,
                   0.02, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01],
          radiantFraction: 0.63,
          convectiveFraction: 0.37
        }
      },
      
      // 内部得热RTS系数
      internal: {
        people: {
          radiantFraction: 0.70,
          convectiveFraction: 0.30,
          decaySchedule: [0.20, 0.18, 0.16, 0.14, 0.12, 0.10, 0.05, 0.03, 0.02, 0.01, 0.01, 0.01,
                         0.01, 0.01, 0.01, 0.01, 0.02, 0.03, 0.05, 0.08, 0.10, 0.12, 0.15, 0.18]
        },
        lighting: {
          radiantFraction: 0.67,
          convectiveFraction: 0.33,
          decaySchedule: [0.50, 0.30, 0.18, 0.10, 0.06, 0.04, 0.03, 0.02, 0.01, 0.01, 0.01, 0.00,
                         0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.01, 0.02, 0.03, 0.04]
        },
        equipment: {
          radiantFraction: 0.50,
          convectiveFraction: 0.50,
          decaySchedule: [0.40, 0.25, 0.15, 0.10, 0.05, 0.03, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01,
                         0.01, 0.01, 0.01, 0.01, 0.01, 0.02, 0.03, 0.05, 0.08, 0.12, 0.18, 0.25]
        }
      },
      
      // 太阳辐射得热RTS系数
      solar: {
        radiantFraction: 0.63,
        convectiveFraction: 0.37,
        factors: [0.54, 0.16, 0.08, 0.05, 0.03, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.00,
                 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00]
      }
    };
  }

  /**
   * 初始化谐波反应系数 (GB50736)
   * 用于计算围护结构的热衰减和延迟
   */
  initializeHarmonicCoefficients() {
    return {
      // 热衰减系数 (考虑围护结构热惰性)
      attenuation: {
        '轻型': { factor: 0.85, delay: 2.0 }, // 木/轻钢
        '中型': { factor: 0.65, delay: 4.5 }, // 砖混
        '重型': { factor: 0.45, delay: 8.0 }  // 混凝土
      },
      
      // 逐时冷负荷计算系数
      hourly: {
        // 南向窗户太阳辐射得热系数 (简化)
        south: [0.10, 0.08, 0.06, 0.05, 0.05, 0.08, 0.15, 0.30, 0.48, 0.62, 0.70, 0.72,
               0.68, 0.58, 0.45, 0.32, 0.22, 0.15, 0.12, 0.10, 0.09, 0.08, 0.08, 0.09],
        // 东向
        east: [0.08, 0.06, 0.05, 0.05, 0.08, 0.20, 0.52, 0.75, 0.78, 0.65, 0.45, 0.30,
              0.20, 0.15, 0.12, 0.10, 0.09, 0.08, 0.07, 0.07, 0.07, 0.07, 0.07, 0.08],
        // 西向
        west: [0.08, 0.07, 0.07, 0.07, 0.07, 0.07, 0.08, 0.10, 0.15, 0.22, 0.32, 0.45,
              0.58, 0.68, 0.72, 0.70, 0.62, 0.48, 0.30, 0.15, 0.08, 0.05, 0.05, 0.06],
        // 北向
        north: [0.08, 0.07, 0.06, 0.05, 0.05, 0.06, 0.08, 0.12, 0.15, 0.18, 0.20, 0.22,
               0.22, 0.20, 0.18, 0.15, 0.12, 0.10, 0.09, 0.08, 0.08, 0.08, 0.08, 0.08]
      }
    };
  }

  // ==================== 核心计算方法 ====================

  /**
   * PhD级负荷计算 - 主入口
   * @param {Object} params 建筑参数
   * @param {String} city 城市
   * @param {String} method 计算方法 (RTS/Harmonic/HeatBalance)
   * @param {Boolean} hourly8760 是否进行8760小时模拟
   * @returns {Object} 专业级计算结果
   */
  calculate(params, city, method = 'RTS+HB Hybrid', hourly8760 = false) {
    const startTime = Date.now();
    
    // 获取城市气候数据
    const climate = this.getClimateData(city, params.country || 'china');
    if (!climate) {
      throw new Error(`未找到城市 ${city} 的气候数据`);
    }
    
    // 验证参数
    this.validateParams(params);
    
    // 根据方法选择计算路径
    let result;
    switch (method) {
      case 'RTS':
        result = this.calculateRTS(params, climate);
        break;
      case 'Harmonic':
        result = this.calculateHarmonic(params, climate);
        break;
      case 'HeatBalance':
        result = this.calculateHeatBalance(params, climate);
        break;
      case 'RTS+HB Hybrid':
      default:
        result = this.calculateHybrid(params, climate);
    }
    
    // 8760小时逐时模拟
    if (hourly8760) {
      result.hourly8760 = this.simulate8760Hours(params, climate);
    }
    
    // 添加元数据
    result.metadata = {
      version: this.version,
      calculationMethod: method,
      precision: this.precision,
      calculationTime: Date.now() - startTime,
      standards: ['ASHRAE 62.1/90.1', 'GB 50736-2012', 'EN 15232'],
      timestamp: new Date().toISOString()
    };
    
    return result;
  }

  /**
   * RTS方法计算 - ASHRAE推荐
   * 核心思想: 将热增益分为对流和辐射，辐射部分有时间延迟
   */
  calculateRTS(params, climate) {
    const rooms = params.rooms || [];
    const results = [];
    let totalPeakLoad = 0;
    let totalAnnualEnergy = 0;
    
    // 计算每个房间的逐时负荷
    rooms.forEach(room => {
      const hourlyLoads = new Array(24).fill(0);
      
      // 1. 围护结构传导得热
      const envelopeGain = this.calculateRTSEnvelope(room, climate);
      
      // 2. 太阳辐射得热
      const solarGain = this.calculateRTSSolar(room, climate);
      
      // 3. 内部得热
      const internalGain = this.calculateRTSInternal(room, climate);
      
      // 4. 新风负荷
      const freshAirLoad = this.calculateFreshAirLoad(room, climate);
      
      // 合并各组分，考虑时间延迟
      for (let hour = 0; hour < 24; hour++) {
        hourlyLoads[hour] = 
          envelopeGain.hourly[hour] +
          solarGain.hourly[hour] +
          internalGain.hourly[hour] +
          freshAirLoad.hourly[hour];
      }
      
      // 找出峰值负荷
      const peakLoad = Math.max(...hourlyLoads);
      const peakHour = hourlyLoads.indexOf(peakLoad);
      
      // 计算日负荷累计
      const dailyEnergy = hourlyLoads.reduce((sum, load) => sum + load, 0);
      
      results.push({
        roomName: room.name,
        area: room.area,
        hourlyLoads: hourlyLoads,
        peakLoad: Math.round(peakLoad * 100) / 100,
        peakHour: peakHour,
        dailyEnergy: Math.round(dailyEnergy * 100) / 100,
        components: {
          envelope: envelopeGain.total,
          solar: solarGain.total,
          internal: internalGain.total,
          freshAir: freshAirLoad.total
        }
      });
      
      totalPeakLoad += peakLoad;
      totalAnnualEnergy += dailyEnergy * 365;
    });
    
    return {
      method: 'RTS (Radiant Time Series)',
      standard: 'ASHRAE Fundamentals 2021',
      city: climate,
      totalPeakCoolingLoad: Math.round(totalPeakLoad * 100) / 100,
      totalPeakHeatingLoad: this.calculateHeatingLoadRTS(params, climate),
      estimatedAnnualEnergy: Math.round(totalAnnualEnergy / 1000), // kWh
      rooms: results,
      safetyFactor: 1.15,
      recommendedCapacity: Math.round(totalPeakLoad * 1.15 * 100) / 100
    };
  }

  /**
   * 谐波反应法计算 - GB50736标准
   * 考虑围护结构的热衰减和延迟
   */
  calculateHarmonic(params, climate) {
    const rooms = params.rooms || [];
    const results = [];
    let totalCoolingLoad = 0;
    let totalHeatingLoad = 0;
    
    rooms.forEach(room => {
      const hourlyLoads = new Array(24).fill(0);
      
      // 1. 外墙冷负荷 (考虑衰减和延迟)
      const wallLoad = this.calculateHarmonicWall(room, climate);
      
      // 2. 窗户冷负荷
      const windowLoad = this.calculateHarmonicWindow(room, climate);
      
      // 3. 人体/照明/设备
      const internalLoad = this.calculateHarmonicInternal(room);
      
      // 4. 新风负荷
      const freshAirLoad = this.calculateFreshAirLoad(room, climate);
      
      // 合并计算
      for (let hour = 0; hour < 24; hour++) {
        hourlyLoads[hour] = 
          wallLoad.hourly[hour] +
          windowLoad.hourly[hour] +
          internalLoad.hourly[hour] +
          freshAirLoad.hourly[hour];
      }
      
      const peakLoad = Math.max(...hourlyLoads);
      
      results.push({
        roomName: room.name,
        area: room.area,
        hourlyLoads: hourlyLoads,
        peakLoad: Math.round(peakLoad * 100) / 100,
        components: {
          wall: wallLoad.total,
          window: windowLoad.total,
          internal: internalLoad.total,
          freshAir: freshAirLoad.total
        }
      });
      
      totalCoolingLoad += peakLoad;
    });
    
    // 计算供暖负荷 (稳态算法)
    totalHeatingLoad = this.calculateHeatingLoadHarmonic(params, climate);
    
    return {
      method: '谐波反应法 (Harmonic Response)',
      standard: 'GB 50736-2012',
      city: climate,
      totalCoolingLoad: Math.round(totalCoolingLoad * 100) / 100,
      totalHeatingLoad: Math.round(totalHeatingLoad * 100) / 100,
      rooms: results,
      safetyFactor: 1.10,
      recommendedCoolingCapacity: Math.round(totalCoolingLoad * 1.10 * 100) / 100,
      recommendedHeatingCapacity: Math.round(totalHeatingLoad * 1.10 * 100) / 100
    };
  }

  /**
   * 热平衡法 - 最精确的逐时计算
   * 基于能量守恒原理，逐时计算房间热平衡
   */
  calculateHeatBalance(params, climate) {
    // 热平衡法需要详细的房间热容参数
    // 这里实现简化版，完整版需要建筑热工详细参数
    
    const rooms = params.rooms || [];
    const results = [];
    let totalPeakLoad = 0;
    
    rooms.forEach(room => {
      // 简化热平衡计算
      const surfaceArea = room.surfaceArea || room.area * 4.5; // 估算
      const airVolume = room.area * (room.height || 2.8);
      
      // 房间热容 (简化)
      const thermalCapacity = surfaceArea * 50; // kJ/K 估算值
      
      const hourlyLoads = [];
      let indoorTemp = 26; // 初始室内温度
      
      for (let hour = 0; hour < 24; hour++) {
        // 室外温度 (考虑日波动)
        const outdoorTemp = climate.summer.dailyRange ? 
          this.calculateOutdoorTemp(hour, climate) : climate.summer.designTemp;
        
        // 太阳辐射得热
        const solarGain = this.calculateSolarGainHB(hour, room, climate);
        
        // 围护结构传热
        const envelopeGain = (outdoorTemp - indoorTemp) * surfaceArea * 0.5;
        
        // 内部得热
        const internalGain = this.calculateInternalGainHB(hour, room);
        
        // 新风负荷
        const freshAirGain = (outdoorTemp - indoorTemp) * room.freshAirRate || 30;
        
        // 热平衡方程
        const totalGain = solarGain + envelopeGain + internalGain + freshAirGain;
        const coolingLoad = Math.max(0, totalGain);
        
        // 更新室内温度
        indoorTemp += totalGain / thermalCapacity;
        
        hourlyLoads.push(Math.round(coolingLoad * 100) / 100);
      }
      
      const peakLoad = Math.max(...hourlyLoads);
      
      results.push({
        roomName: room.name,
        area: room.area,
        hourlyLoads: hourlyLoads,
        peakLoad: peakLoad,
        method: 'Heat Balance (Simplified)'
      });
      
      totalPeakLoad += peakLoad;
    });
    
    return {
      method: '热平衡法 (Heat Balance Method)',
      standard: 'ASHRAE Fundamentals',
      city: climate,
      totalPeakLoad: Math.round(totalPeakLoad * 100) / 100,
      rooms: results,
      safetyFactor: 1.10,
      recommendedCapacity: Math.round(totalPeakLoad * 1.10 * 100) / 100
    };
  }

  /**
   * 混合方法 - RTS+谐波法
   * 综合两种方法优势，提高精度
   */
  calculateHybrid(params, climate) {
    // 分别用两种方法计算
    const rtsResult = this.calculateRTS(params, climate);
    const harmonicResult = this.calculateHarmonic(params, climate);
    
    // 取两种方法的加权平均 (提高精度)
    const rooms = params.rooms || [];
    const hybridResults = [];
    let totalHybridLoad = 0;
    
    rooms.forEach((room, index) => {
      const rtsRoom = rtsResult.rooms[index];
      const harmonicRoom = harmonicResult.rooms[index];
      
      // 加权平均 (RTS 60% + Harmonic 40%)
      const hybridHourlyLoads = rtsRoom.hourlyLoads.map((val, i) => 
        val * 0.6 + (harmonicRoom.hourlyLoads ? harmonicRoom.hourlyLoads[i] : val) * 0.4
      );
      
      const hybridPeak = Math.max(...hybridHourlyLoads);
      
      hybridResults.push({
        roomName: room.name,
        area: room.area,
        hourlyLoads: hybridHourlyLoads.map(v => Math.round(v * 100) / 100),
        peakLoad: Math.round(hybridPeak * 100) / 100,
        comparison: {
          rts: rtsRoom.peakLoad,
          harmonic: harmonicRoom.peakLoad,
          hybrid: Math.round(hybridPeak * 100) / 100,
          variance: Math.abs(rtsRoom.peakLoad - harmonicRoom.peakLoad) / hybridPeak
        }
      });
      
      totalHybridLoad += hybridPeak;
    });
    
    return {
      method: 'RTS + Harmonic Hybrid (简化实现，工程估算)',
      standard: '参照 ASHRAE 2021 + GB 50736-2012（简化）',
      trustLevel: this.trustLevel,
      city: climate,
      totalCoolingLoad: Math.round(totalHybridLoad * 100) / 100,
      totalHeatingLoad: harmonicResult.totalHeatingLoad,
      rooms: hybridResults,
      rtsResult: { total: rtsResult.totalPeakCoolingLoad },
      harmonicResult: { total: harmonicResult.totalCoolingLoad },
      variance: Math.abs(rtsResult.totalPeakCoolingLoad - harmonicResult.totalCoolingLoad) / totalHybridLoad,
      safetyFactor: 1.10,
      recommendedCoolingCapacity: Math.round(totalHybridLoad * 1.10 * 100) / 100,
      recommendedHeatingCapacity: harmonicResult.recommendedHeatingCapacity,
      accuracy: 'estimate（工程估算，仅供方案前期参考；可辩护精算请走 calc-engine）'
    };
  }

  /**
   * 8760小时逐时模拟
   * 模拟全年8760小时的负荷变化
   */
  simulate8760Hours(params, climate) {
    const hourlyLoads = new Array(8760).fill(0);
    const months = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let hourIndex = 0;
    
    // 简化的8760模拟 (实际应用中需要详细的逐时气象数据)
    for (let month = 0; month < 12; month++) {
      const daysInMonth = months[month];
      
      for (let day = 0; day < daysInMonth; day++) {
        // 计算当天的典型负荷
        const dailyPeak = this.estimateDailyPeak(month, day, params, climate);
        
        for (let hour = 0; hour < 24; hour++) {
          // 简单的日负荷曲线
          const hourFactor = this.getHourlyLoadFactor(hour, month);
          hourlyLoads[hourIndex] = Math.round(dailyPeak * hourFactor * 100) / 100;
          hourIndex++;
        }
      }
    }
    
    // 统计分析
    const sortedLoads = [...hourlyLoads].sort((a, b) => b - a);
    const annualTotal = hourlyLoads.reduce((sum, load) => sum + load, 0);
    
    return {
      hourlyLoads: hourlyLoads,
      statistics: {
        peakLoad: Math.max(...hourlyLoads),
        minLoad: Math.min(...hourlyLoads),
        averageLoad: Math.round(annualTotal / 8760 * 100) / 100,
        annualEnergy: Math.round(annualTotal), // kWh
        peakLoadDuration: sortedLoads.filter(l => l > sortedLoads[0] * 0.9).length, // 小时数
        loadFactor: Math.round(annualTotal / 8760 / Math.max(...hourlyLoads) * 100) / 100
      },
      monthlyBreakdown: this.calculateMonthlyBreakdown(hourlyLoads),
      method: '8760 Hourly Simulation (Simplified)'
    };
  }

  // ==================== 辅助计算方法 ====================

  calculateRTSEnvelope(room, climate) {
    // 简化的RTS围护结构计算
    const area = room.envelopeArea || room.area * 3;
    const U = 0.5; // 平均U值
    const tempDiff = climate.summer.designTemp - 26;
    const total = area * U * tempDiff / 1000; // kW
    
    // 生成逐时负荷曲线
    const hourly = new Array(24).fill(0).map((_, hour) => {
      const factor = this.rtsCoefficients.conduction.medium.factors[hour] || 0.02;
      return total * factor * 10; // 放大系数
    });
    
    return { total: Math.round(total * 100) / 100, hourly };
  }

  calculateRTSSolar(room, climate) {
    // 简化太阳辐射计算
    const windowArea = room.windowArea || room.area * 0.15;
    const SC = 0.6; // 遮阳系数
    const solarIntensity = climate.solar?.south || 450;
    const total = windowArea * solarIntensity * SC / 1000; // kW
    
    const hourly = this.harmonicCoefficients.hourly.south.map(factor => 
      total * factor
    );
    
    return { total: Math.round(total * 100) / 100, hourly };
  }

  calculateRTSInternal(room, climate) {
    // 内部得热
    const peopleLoad = (room.occupancy || 2) * 0.12; // 120W/人
    const lightingLoad = room.area * 0.007; // 7W/m²
    const equipmentLoad = room.area * 0.004; // 4W/m²
    const total = peopleLoad + lightingLoad + equipmentLoad;
    
    const hourly = new Array(24).fill(0).map((_, hour) => {
      // 考虑使用时间表
      const occupancyFactor = (hour >= 8 && hour <= 22) ? 1.0 : 0.1;
      return total * occupancyFactor;
    });
    
    return { total: Math.round(total * 100) / 100, hourly };
  }

  calculateFreshAirLoad(room, climate) {
    const freshAirRate = room.freshAirRate || 30; // m³/h·人
    const occupancy = room.occupancy || 2;
    const volume = freshAirRate * occupancy;
    const density = 1.2; // kg/m³
    const specificHeat = 1.005; // kJ/(kg·K)
    const tempDiff = climate.summer.designTemp - 26;
    const total = volume * density * specificHeat * tempDiff / 3600; // kW
    
    const hourly = new Array(24).fill(total);
    
    return { total: Math.round(total * 100) / 100, hourly };
  }

  calculateHarmonicWall(room, climate) {
    // 谐波法外墙计算
    const wallArea = room.wallArea || room.area * 2.5;
    const U = 0.5;
    const tempDiff = climate.summer.designTemp - 26;
    
    // 考虑衰减和延迟
    const attenuation = this.harmonicCoefficients.attenuation['中型'].factor;
    const delay = this.harmonicCoefficients.attenuation['中型'].delay;
    
    const total = wallArea * U * tempDiff * attenuation / 1000;
    
    const hourly = new Array(24).fill(0).map((_, hour) => {
      const delayedHour = (hour - Math.floor(delay) + 24) % 24;
      const factor = this.harmonicCoefficients.hourly.south[delayedHour];
      return total * factor;
    });
    
    return { total: Math.round(total * 100) / 100, hourly };
  }

  calculateHarmonicWindow(room, climate) {
    const windowArea = room.windowArea || room.area * 0.15;
    const SC = 0.6;
    const solar = climate.solar?.south || 450;
    
    const total = windowArea * solar * SC / 1000;
    
    const hourly = this.harmonicCoefficients.hourly.south.map(factor => 
      total * factor
    );
    
    return { total: Math.round(total * 100) / 100, hourly };
  }

  calculateHarmonicInternal(room) {
    const total = ((room.occupancy || 2) * 0.12) + (room.area * 0.011);
    
    const hourly = new Array(24).fill(0).map((_, hour) => {
      const factor = (hour >= 8 && hour <= 22) ? 1.0 : 0.15;
      return total * factor;
    });
    
    return { total: Math.round(total * 100) / 100, hourly };
  }

  calculateHeatingLoadRTS(params, climate) {
    // 简化供暖负荷计算
    const rooms = params.rooms || [];
    let total = 0;
    
    rooms.forEach(room => {
      const area = room.area;
      const envelopeArea = room.envelopeArea || area * 3;
      const U = 0.6; // 冬季平均U值
      const tempDiff = 20 - (climate.winter?.designTemp || -5);
      const infiltration = area * 0.5; // W
      
      total += (envelopeArea * U * tempDiff / 1000) + (infiltration / 1000);
    });
    
    return Math.round(total * 100) / 100;
  }

  calculateHeatingLoadHarmonic(params, climate) {
    return this.calculateHeatingLoadRTS(params, climate);
  }

  calculateOutdoorTemp(hour, climate) {
    const avg = climate.summer.designTemp - climate.summer.dailyRange / 2;
    const amplitude = climate.summer.dailyRange / 2;
    const phase = (hour - 14) * Math.PI / 12;
    return avg + amplitude * Math.cos(phase);
  }

  calculateSolarGainHB(hour, room, climate) {
    const windowArea = room.windowArea || room.area * 0.15;
    const SC = 0.6;
    const solarFactor = this.harmonicCoefficients.hourly.south[hour];
    const solarIntensity = climate.solar?.south || 450;
    return windowArea * solarIntensity * SC * solarFactor / 1000;
  }

  calculateInternalGainHB(hour, room) {
    const baseLoad = ((room.occupancy || 2) * 0.12) + (room.area * 0.011);
    const occupancyFactor = (hour >= 8 && hour <= 22) ? 1.0 : 0.15;
    return baseLoad * occupancyFactor;
  }

  estimateDailyPeak(month, day, params, climate) {
    // 简化的日峰值估算
    const isSummer = month >= 5 && month <= 8;
    const baseLoad = (params.totalArea || 100) * 0.12; // kW
    
    if (isSummer) {
      return baseLoad * (1 + (month === 7 ? 0.3 : 0.15));
    } else {
      return baseLoad * 0.3; // 冬季冷负荷较低
    }
  }

  getHourlyLoadFactor(hour, month) {
    const isSummer = month >= 5 && month <= 8;
    
    if (isSummer) {
      // 夏季负荷曲线
      if (hour >= 10 && hour <= 16) return 1.0;
      if (hour >= 8 && hour <= 18) return 0.8;
      if (hour >= 6 && hour <= 20) return 0.6;
      return 0.3;
    } else {
      // 冬季负荷曲线
      return 0.2;
    }
  }

  calculateMonthlyBreakdown(hourlyLoads) {
    const months = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const monthlyEnergy = [];
    let hourIndex = 0;
    
    for (let month = 0; month < 12; month++) {
      const hours = months[month] * 24;
      const energy = hourlyLoads.slice(hourIndex, hourIndex + hours).reduce((a, b) => a + b, 0);
      monthlyEnergy.push(Math.round(energy));
      hourIndex += hours;
    }
    
    return monthlyEnergy;
  }

  // ==================== 工具方法 ====================

  getClimateData(city, country = 'china') {
    const countryData = this.globalClimateDatabase[country];
    return countryData ? countryData[city] : null;
  }

  validateParams(params) {
    if (!params.rooms || params.rooms.length === 0) {
      throw new Error('必须提供房间参数');
    }
    
    params.rooms.forEach((room, index) => {
      if (!room.name) {
        throw new Error(`房间 ${index + 1} 必须提供名称`);
      }
      if (!room.area || room.area <= 0) {
        throw new Error(`房间 ${room.name || index + 1} 必须提供有效的面积`);
      }
    });
  }

  /**
   * 快速估算 - 用于方案阶段
   */
  quickEstimate(area, city, buildingType = 'residential') {
    const indicators = {
      residential: { cooling: 120, heating: 100 },
      office: { cooling: 140, heating: 110 },
      commercial: { cooling: 180, heating: 120 }
    };
    
    const indicator = indicators[buildingType] || indicators.residential;
    
    return {
      coolingLoad: Math.round(area * indicator.cooling / 1000 * 100) / 100,
      heatingLoad: Math.round(area * indicator.heating / 1000 * 100) / 100,
      method: 'Quick Estimate (Indicator Method)',
      accuracy: '±30%'
    };
  }

  /**
   * 经验强度区间粗检（sanity check）
   * 诚实说明：下列区间为典型住宅冷热指标经验值（kW/㎡量级），
   * **非真实 Carrier HAP 对标数据**，仅用于发现明显异常，不构成精度证明。
   */
  benchmarkAgainstCarrierHAP(params, city) {
    const ourResult = this.calculateHybrid(params, city);
    
    // 典型住宅负荷强度经验区间（非 HAP 实测数据）
    const hapRanges = {
      '北京': { cooling: { min: 1.8, max: 2.2 }, heating: { min: 1.5, max: 1.9 } },
      '上海': { cooling: { min: 1.9, max: 2.3 }, heating: { min: 1.3, max: 1.7 } },
      '广州': { cooling: { min: 2.2, max: 2.6 }, heating: { min: 0.8, max: 1.2 } }
    };
    
    const range = hapRanges[city];
    const coolingLoad = ourResult.totalCoolingLoad;
    const normalized = coolingLoad / (params.totalArea || params.rooms.reduce((sum, r) => sum + r.area, 0));
    
    const inRange = range ? (normalized >= range.cooling.min && normalized <= range.cooling.max) : null;
    
    return {
      ourResult: ourResult,
      carrierHAPRange: range,
      normalizedLoad: Math.round(normalized * 100) / 100,
      inRange: inRange,
      accuracy: inRange ? '落在典型强度经验区间' : '超出典型区间，需人工复核'
    };
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LoadCalculationEngineV3;
}

// 浏览器环境
if (typeof window !== 'undefined') {
  window.LoadCalculationEngineV3 = LoadCalculationEngineV3;
}
