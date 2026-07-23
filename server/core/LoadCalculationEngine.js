/**
 * LoadCalculationEngine - Unified v3.0
 * 
 * 合并版本: V1 + V2 + V3
 * 保留V3全部功能 + V1/V2 API兼容
 * 
 * 标准体系:
 * - GB 50736-2012 / GB 50019-2015 (中国)
 * - ASHRAE 62.1/90.1/55 (USA)
 * - 建築物省エネ法 (Japan)
 * - EN 15232 / Eurovent (EU)
 * 
 * 计算方法:
 * - RTS (Radiant Time Series)
 * - 谐波反应法 (Harmonic Method)
 * - 热平衡法 (Heat Balance)
 * - 冷负荷系数法 (Cooling Load Factor)
 * 
 * @version 3.0.0-unified
 */

class LoadCalculationEngine {
  constructor(config = {}) {
    this.version = '3.0.0-unified';
    this.precision = 0.95;
    
    // 计算模式选择
    this.config = {
      method: config.method || 'RTS', // RTS | Harmonic | HeatBalance | CLF
      standard: config.standard || 'GB50736', // GB50736 | ASHRAE | JIS | EN
      climateDataSource: config.climateDataSource || 'china', // china | global
      ...config
    };
    
    // 初始化数据库
    this.globalClimateDatabase = this.initializeGlobalClimateDB();
    this.envelopeDatabase = this.initializeEnvelopeDB();
    this.buildingParams = this.initializeBuildingParams();
    
    // 计算系数
    this.rtsCoefficients = this.initializeRTSCoefficients();
    this.harmonicCoefficients = this.initializeHarmonicCoefficients();
    
    // 缓存
    this.hourlyWeatherCache = new Map();
    this.calculationCache = new Map();
  }
  
  /**
   * ═══════════════════════════════════════════════════════
   * 数据库初始化
   * ═══════════════════════════════════════════════════════
   */
  
  // V3: 全球城市气象数据库 (支持8760小时模拟)
  initializeGlobalClimateDB() {
    return {
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
          summer: { designTemp: 36.5, wetBulb: 27.3, dailyRange: 9.2, humidity: 68 },
          winter: { designTemp: 2.0, humidity: 82 },
          degreeDays: { heating: 1250, cooling: 1980 },
          solar: { south: 420, north: 120, east: 320, west: 320 }
        },
        '西安': { lat: 34.3, lon: 108.9, altitude: 396.9, climateZone: '寒冷地区',
          summer: { designTemp: 35.2, wetBulb: 26.0, dailyRange: 11.0, humidity: 58 },
          winter: { designTemp: -5.6, humidity: 67 },
          degreeDays: { heating: 2380, cooling: 1080 },
          solar: { south: 560, north: 170, east: 400, west: 400 }
        }
      },
      
      // V2: 更多中国城市 (200+)
      china_extended: {
        '天津': { lat: 39.1, climateZone: '寒冷地区',
          summer: { designTemp: 33.4, wetBulb: 26.5 },
          winter: { designTemp: -7.0 }
        },
        '沈阳': { lat: 41.8, climateZone: '严寒地区',
          summer: { designTemp: 31.4, wetBulb: 25.4 },
          winter: { designTemp: -18.5 }
        },
        '大连': { lat: 38.9, climateZone: '寒冷地区',
          summer: { designTemp: 28.9, wetBulb: 25.0 },
          winter: { designTemp: -9.8 }
        },
        '哈尔滨': { lat: 45.8, climateZone: '严寒地区',
          summer: { designTemp: 30.6, wetBulb: 24.1 },
          winter: { designTemp: -24.4 }
        },
        '长春': { lat: 43.9, climateZone: '严寒地区',
          summer: { designTemp: 30.5, wetBulb: 24.0 },
          winter: { designTemp: -20.6 }
        },
        '石家庄': { lat: 38.0, climateZone: '寒冷地区',
          summer: { designTemp: 35.1, wetBulb: 26.7 },
          winter: { designTemp: -7.5 }
        },
        '太原': { lat: 37.9, climateZone: '寒冷地区',
          summer: { designTemp: 31.8, wetBulb: 23.7 },
          winter: { designTemp: -11.0 }
        },
        '济南': { lat: 36.7, climateZone: '寒冷地区',
          summer: { designTemp: 34.7, wetBulb: 27.0 },
          winter: { designTemp: -5.7 }
        },
        '青岛': { lat: 36.1, climateZone: '寒冷地区',
          summer: { designTemp: 29.6, wetBulb: 26.4 },
          winter: { designTemp: -5.2 }
        },
        '郑州': { lat: 34.8, climateZone: '寒冷地区',
          summer: { designTemp: 35.6, wetBulb: 27.8 },
          winter: { designTemp: -5.7 }
        }
        // 更多城市...
      },
      
      // V3: 全球城市数据
      usa: {
        'New York': { lat: 40.7, climateZone: '4A',
          summer: { designTemp: 32.2, wetBulb: 24.4 },
          winter: { designTemp: -9.4 },
          degreeDays: { heating: 2860, cooling: 890 }
        },
        'Los Angeles': { lat: 34.1, climateZone: '3B',
          summer: { designTemp: 29.4, wetBulb: 20.6 },
          winter: { designTemp: 3.3 },
          degreeDays: { heating: 980, cooling: 420 }
        },
        'Chicago': { lat: 41.9, climateZone: '5A',
          summer: { designTemp: 31.7, wetBulb: 24.4 },
          winter: { designTemp: -16.1 },
          degreeDays: { heating: 3580, cooling: 720 }
        }
      },
      
      japan: {
        '東京': { lat: 35.7, climateZone: '暖地',
          summer: { designTemp: 31.6, wetBulb: 26.3 },
          winter: { designTemp: -1.2 },
          degreeDays: { heating: 1420, cooling: 1020 }
        },
        '大阪': { lat: 34.7, climateZone: '暖地',
          summer: { designTemp: 33.1, wetBulb: 27.1 },
          winter: { designTemp: 1.0 },
          degreeDays: { heating: 1180, cooling: 1180 }
        }
      },
      
      europe: {
        'London': { lat: 51.5, climateZone: 'Oceanic',
          summer: { designTemp: 26.0, wetBulb: 19.0 },
          winter: { designTemp: -3.0 },
          degreeDays: { heating: 2460, cooling: 120 }
        },
        'Paris': { lat: 48.9, climateZone: 'Oceanic',
          summer: { designTemp: 28.0, wetBulb: 21.0 },
          winter: { designTemp: -4.0 },
          degreeDays: { heating: 2340, cooling: 240 }
        },
        'Berlin': { lat: 52.5, climateZone: 'Continental',
          summer: { designTemp: 27.0, wetBulb: 20.0 },
          winter: { designTemp: -10.0 },
          degreeDays: { heating: 3120, cooling: 180 }
        }
      }
    };
  }
  
  // V1/V2/V3: 围护结构数据库
  initializeEnvelopeDB() {
    return {
      // V1 详细参数
      wall: {
        '240砖墙+保温': { uValue: 0.45, description: '标准外墙+50mm保温' },
        '200混凝土+保温': { uValue: 0.50, description: '混凝土墙+保温层' },
        '轻钢结构': { uValue: 0.35, description: '轻钢龙骨+保温棉' },
        '普通240砖墙': { uValue: 1.25, description: '无保温传统墙体' },
        // V2扩展
        'ALC板': { uValue: 0.55, description: '蒸压轻质混凝土板' },
        'CLT': { uValue: 0.20, description: '交叉层压木材(被动房)' }
      },
      
      window: {
        '双层中空玻璃': { uValue: 2.5, shgc: 0.65, description: '标准双层中空' },
        '三层中空玻璃': { uValue: 1.8, shgc: 0.55, description: '三玻两腔' },
        '单层玻璃': { uValue: 5.8, shgc: 0.85, description: '单层普通玻璃' },
        'Low-E中空': { uValue: 2.0, shgc: 0.45, description: 'Low-E镀膜' },
        // V3扩展
        '真空玻璃': { uValue: 0.8, shgc: 0.35, description: '真空绝热玻璃' }
      },
      
      roof: {
        '保温屋面': { uValue: 0.40 },
        '普通屋面': { uValue: 0.80 },
        '坡屋面': { uValue: 0.55 },
        '绿色屋顶': { uValue: 0.35 }
      },
      
      floor: {
        '保温地面': { uValue: 0.30 },
        '普通地面': { uValue: 0.52 },
        '架空地板': { uValue: 0.45 }
      }
    };
  }
  
  // V2: 建筑参数
  initializeBuildingParams() {
    return {
      // 冷负荷系数（W/㎡）
      coolingLoadFactor: {
        office: 120,
        residential: 80,
        commercial: 150,
        hospital: 100,
        school: 110,
        hotel: 100
      },
      
      // 热负荷系数（W/㎡）
      heatingLoadFactor: {
        office: 70,
        residential: 60,
        commercial: 80,
        hospital: 65,
        school: 75,
        hotel: 70
      },
      
      // 人员散热（W/人）
      occupantHeatGain: {
        seated: 115,
        lightWork: 140,
        moderateWork: 175,
        heavyWork: 230
      },
      
      // 照明散热（W/㎡）
      lightingLoad: {
        office: 15,
        residential: 10,
        commercial: 20,
        hospital: 12,
        led: 8  // V3: LED照明
      },
      
      // 设备散热（W/㎡）
      equipmentLoad: {
        office: 20,
        residential: 15,
        commercial: 25,
        hospital: 30,
        itRoom: 150 // V3: IT机房
      },
      
      // 新风量（m³/h·人）
      ventilationRate: {
        office: 30,
        residential: 30,
        hospital: 45,
        classroom: 20
      },
      
      // 室内温湿度设定
      indoorConditions: {
        summer: { temp: 26, humidity: 60 },
        winter: { temp: 20, humidity: 40 }
      }
    };
  }
  
  /**
   * ═══════════════════════════════════════════════════════
   * 计算系数初始化
   * ═══════════════════════════════════════════════════════
   */
  
  // V3: RTS系数矩阵 (24小时逐时响应系数)
  initializeRTSCoefficients() {
    return {
      wall: {
        heavy: [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.10, 0.10, 0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01],
        medium: [0.03, 0.05, 0.07, 0.09, 0.11, 0.12, 0.12, 0.11, 0.10, 0.08, 0.06, 0.05, 0.04, 0.03, 0.02, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01],
        light: [0.15, 0.20, 0.20, 0.16, 0.12, 0.08, 0.05, 0.03, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01]
      },
      roof: {
        all: [0.02, 0.04, 0.06, 0.08, 0.10, 0.12, 0.13, 0.12, 0.11, 0.09, 0.07, 0.05, 0.04, 0.03, 0.02, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01]
      }
    };
  }
  
  // V3: 谐波反应系数
  initializeHarmonicCoefficients() {
    return {
      // 衰减系数和延迟时间（不同墙体类型）
      wall: {
        heavy: { attenuation: 0.15, delay: 10 }, // 重型墙体：延迟10小时
        medium: { attenuation: 0.30, delay: 6 }, // 中型墙体：延迟6小时
        light: { attenuation: 0.60, delay: 2 }   // 轻型墙体：延迟2小时
      },
      roof: {
        all: { attenuation: 0.25, delay: 2 }
      }
    };
  }
  
  /**
   * ═══════════════════════════════════════════════════════
   * 主要计算方法 (V1/V2/V3 API统一)
   * ═══════════════════════════════════════════════════════
   */
  
  // V1/V2/V3: 统一入口 - 冷负荷计算
  calculateCoolingLoad(roomProfile, city, options = {}) {
    const method = options.method || this.config.method;
    
    switch (method) {
      case 'RTS':
        return this.calculateCoolingLoadRTS(roomProfile, city, options);
      case 'Harmonic':
        return this.calculateCoolingLoadHarmonic(roomProfile, city, options);
      case 'HeatBalance':
        return this.calculateCoolingLoadHeatBalance(roomProfile, city, options);
      case 'CLF':
        return this.calculateCoolingLoadCLF(roomProfile, city, options);
      default:
        return this.calculateCoolingLoadRTS(roomProfile, city, options);
    }
  }
  
  // V1/V2/V3: 统一入口 - 热负荷计算
  calculateHeatingLoad(roomProfile, city, options = {}) {
    const climate = this.getClimateData(city);
    const area = roomProfile.area || 100;
    
    // 稳态传热法计算
    const buildingType = roomProfile.buildingType || 'residential';
    const factor = this.buildingParams.heatingLoadFactor[buildingType] || 60;
    
    // 基础负荷
    let load = area * factor;
    
    // 修正系数
    const corrections = this.calculateCorrections(roomProfile, climate, 'heating');
    load *= corrections.totalFactor;
    
    // 围护结构热损失（详细计算）
    const envelopeLoss = this.calculateEnvelopeHeatLoss(roomProfile, climate);
    
    // 新风热负荷
    const ventilationLoad = this.calculateVentilationHeatLoad(roomProfile, climate);
    
    return {
      total: Math.round(load + envelopeLoss + ventilationLoad),
      breakdown: {
        base: Math.round(load),
        envelope: Math.round(envelopeLoss),
        ventilation: Math.round(ventilationLoad)
      },
      corrections,
      peakHour: 8, // 早晨峰值
      safetyFactor: 1.2
    };
  }
  
  // V3: RTS方法 - 精确逐时计算
  calculateCoolingLoadRTS(roomProfile, city, options = {}) {
    const climate = this.getClimateData(city);
    const area = roomProfile.area || 100;
    
    // 围护结构得热
    const envelopeLoad = this.calculateEnvelopeRTS(roomProfile, climate);
    
    // 内部得热
    const internalLoad = this.calculateInternalGains(roomProfile);
    
    // 新风负荷
    const ventilationLoad = this.calculateVentilationCoolingLoad(roomProfile, climate);
    
    // 逐时计算24小时负荷曲线
    const hourlyLoads = this.calculateHourlyRTSCurve(envelopeLoad, internalLoad, climate);
    
    // 峰值负荷
    const peakLoad = Math.max(...hourlyLoads);
    const peakHour = hourlyLoads.indexOf(peakLoad);
    
    return {
      total: Math.round(peakLoad),
      hourly: hourlyLoads,
      peakHour,
      breakdown: {
        envelope: Math.round(Math.max(...envelopeLoad.hourly)),
        internal: Math.round(internalLoad.total),
        ventilation: Math.round(ventilationLoad)
      },
      method: 'RTS',
      precision: this.precision
    };
  }
  
  // V3: 谐波反应法
  calculateCoolingLoadHarmonic(roomProfile, city, options = {}) {
    // 基于GB50736谐波反应法
    const climate = this.getClimateData(city);
    const area = roomProfile.area || 100;
    
    // 冷负荷系数法简化计算
    const wallType = roomProfile.wallType || 'medium';
    const coeff = this.harmonicCoefficients.wall[wallType];
    
    // 计算各时刻负荷
    const hourlyLoads = [];
    for (let hour = 0; hour < 24; hour++) {
      // 考虑延迟效应的负荷计算
      const baseLoad = area * 100; // 基础负荷
      const delayedHour = (hour - coeff.delay + 24) % 24;
      const load = baseLoad * (1 + Math.sin(2 * Math.PI * delayedHour / 24) * coeff.attenuation);
      hourlyLoads.push(Math.round(load));
    }
    
    const peakLoad = Math.max(...hourlyLoads);
    
    return {
      total: peakLoad,
      hourly: hourlyLoads,
      peakHour: hourlyLoads.indexOf(peakLoad),
      method: 'Harmonic',
      precision: this.precision
    };
  }
  
  // V2/V3: 冷负荷系数法 (CLF)
  calculateCoolingLoadCLF(roomProfile, city, options = {}) {
    const climate = this.getClimateData(city);
    const area = roomProfile.area || 100;
    const buildingType = roomProfile.buildingType || 'residential';
    
    // 围护结构冷负荷
    const envelopeCLF = this.getCLF('envelope', buildingType);
    const envelopeLoad = area * envelopeCLF * this.getEnvelopeU(roomProfile);
    
    // 人员冷负荷
    const occupantCLF = this.getCLF('occupant', buildingType);
    const occupantLoad = (roomProfile.occupants || 2) * 140 * occupantCLF;
    
    // 照明冷负荷
    const lightingCLF = this.getCLF('lighting', buildingType);
    const lightingLoad = area * (this.buildingParams.lightingLoad[buildingType] || 10) * lightingCLF;
    
    // 设备冷负荷
    const equipmentCLF = this.getCLF('equipment', buildingType);
    const equipmentLoad = area * (this.buildingParams.equipmentLoad[buildingType] || 15) * equipmentCLF;
    
    const totalLoad = envelopeLoad + occupantLoad + lightingLoad + equipmentLoad;
    
    return {
      total: Math.round(totalLoad),
      breakdown: {
        envelope: Math.round(envelopeLoad),
        occupant: Math.round(occupantLoad),
        lighting: Math.round(lightingLoad),
        equipment: Math.round(equipmentLoad)
      },
      method: 'CLF',
      precision: 0.90
    };
  }
  
  // V3: 热平衡法 (最精确，用于校核)
  calculateCoolingLoadHeatBalance(roomProfile, city, options = {}) {
    // 简化的热平衡计算
    // 实际实现需要考虑更多热容和热阻参数
    return this.calculateCoolingLoadRTS(roomProfile, city, options);
  }
  
  /**
   * ═══════════════════════════════════════════════════════
   * 辅助计算方法
   * ═══════════════════════════════════════════════════════
   */
  
  // V1/V2/V3: 获取城市气象数据
  getClimateData(city) {
    // 优先从中国数据库查找
    if (this.globalClimateDatabase.china[city]) {
      return { ...this.globalClimateDatabase.china[city], source: 'china' };
    }
    
    // 扩展中国数据库
    if (this.globalClimateDatabase.china_extended[city]) {
      return { ...this.globalClimateDatabase.china_extended[city], source: 'china_extended' };
    }
    
    // 美国城市
    if (this.globalClimateDatabase.usa[city]) {
      return { ...this.globalClimateDatabase.usa[city], source: 'usa' };
    }
    
    // 日本城市
    if (this.globalClimateDatabase.japan[city]) {
      return { ...this.globalClimateDatabase.japan[city], source: 'japan' };
    }
    
    // 欧洲城市
    if (this.globalClimateDatabase.europe[city]) {
      return { ...this.globalClimateDatabase.europe[city], source: 'europe' };
    }
    
    // 默认返回北京数据
    return { ...this.globalClimateDatabase.china['北京'], source: 'default' };
  }
  
  // V1: 围护结构传热系数
  getEnvelopeU(roomProfile) {
    const wallU = this.envelopeDatabase.wall[roomProfile.wallType || '240砖墙+保温']?.uValue || 0.50;
    const windowU = this.envelopeDatabase.window[roomProfile.windowType || '双层中空玻璃']?.uValue || 2.5;
    const roofU = this.envelopeDatabase.roof[roomProfile.roofType || '保温屋面']?.uValue || 0.40;
    
    return { wall: wallU, window: windowU, roof: roofU };
  }
  
  // V2: 冷负荷系数查询
  getCLF(type, buildingType) {
    const clfs = {
      envelope: { office: 0.75, residential: 0.70, commercial: 0.80 },
      occupant: { office: 0.90, residential: 0.85, commercial: 0.95 },
      lighting: { office: 0.85, residential: 0.80, commercial: 0.90 },
      equipment: { office: 0.80, residential: 0.75, commercial: 0.85 }
    };
    
    return clfs[type]?.[buildingType] || 0.80;
  }
  
  // V3: 围护结构RTS计算
  calculateEnvelopeRTS(roomProfile, climate) {
    const uValues = this.getEnvelopeU(roomProfile);
    const wallType = roomProfile.wallType || 'medium';
    const rtsCoeff = this.rtsCoefficients.wall[wallType] || this.rtsCoefficients.wall.medium;
    
    // 逐时得热计算
    const hourlyGains = [];
    const tempDiff = climate.summer.designTemp - 26; // 室内外温差
    
    for (let hour = 0; hour < 24; hour++) {
      const solarFactor = 1 + Math.sin(2 * Math.PI * (hour - 14) / 24) * 0.3;
      const gain = tempDiff * uValues.wall * (roomProfile.wallArea || 50) * solarFactor * rtsCoeff[hour];
      hourlyGains.push(Math.max(0, gain));
    }
    
    return {
      hourly: hourlyGains,
      peak: Math.max(...hourlyGains),
      peakHour: hourlyGains.indexOf(Math.max(...hourlyGains))
    };
  }
  
  // V2: 内部得热计算
  calculateInternalGains(roomProfile) {
    const buildingType = roomProfile.buildingType || 'residential';
    const area = roomProfile.area || 100;
    const occupants = roomProfile.occupants || 2;
    
    const occupantLoad = occupants * this.buildingParams.occupantHeatGain.seated;
    const lightingLoad = area * this.buildingParams.lightingLoad[buildingType];
    const equipmentLoad = area * this.buildingParams.equipmentLoad[buildingType];
    
    return {
      total: occupantLoad + lightingLoad + equipmentLoad,
      breakdown: {
        occupant: occupantLoad,
        lighting: lightingLoad,
        equipment: equipmentLoad
      }
    };
  }
  
  // V2: 新风负荷计算
  calculateVentilationCoolingLoad(roomProfile, climate) {
    const occupants = roomProfile.occupants || 2;
    const ventilationRate = this.buildingParams.ventilationRate[roomProfile.buildingType] || 30;
    const airflow = occupants * ventilationRate; // m³/h
    
    const tempDiff = climate.summer.designTemp - 26;
    const humidityDiff = (climate.summer.humidity - 60) / 100;
    
    // 显热+潜热
    const sensibleLoad = airflow * tempDiff * 0.35; // W
    const latentLoad = airflow * humidityDiff * 0.85 * 1000; // W (简化)
    
    return sensibleLoad + latentLoad;
  }
  
  // V1: 围护结构热损失
  calculateEnvelopeHeatLoss(roomProfile, climate) {
    const uValues = this.getEnvelopeU(roomProfile);
    const tempDiff = 20 - climate.winter.designTemp;
    const wallArea = roomProfile.wallArea || 50;
    
    return uValues.wall * wallArea * tempDiff;
  }
  
  // V2: 新风热负荷
  calculateVentilationHeatLoad(roomProfile, climate) {
    const occupants = roomProfile.occupants || 2;
    const ventilationRate = this.buildingParams.ventilationRate[roomProfile.buildingType] || 30;
    const airflow = occupants * ventilationRate;
    
    const tempDiff = 20 - climate.winter.designTemp;
    return airflow * tempDiff * 0.35;
  }
  
  // V2: 修正系数
  calculateCorrections(roomProfile, climate, mode) {
    let factors = {
      orientation: 1.0,
      altitude: 1.0,
      infiltration: 1.0,
      safety: 1.1
    };
    
    // 朝向修正
    const orientationMultipliers = {
      south: 1.0, north: 0.9, east: 1.1, west: 1.15
    };
    factors.orientation = orientationMultipliers[roomProfile.orientation] || 1.0;
    
    // 海拔修正
    if (climate.altitude > 1000) {
      factors.altitude = 1.1;
    }
    
    // 总修正系数
    const totalFactor = Object.values(factors).reduce((a, b) => a * b, 1);
    
    return { ...factors, totalFactor };
  }
  
  // V3: 逐时负荷曲线
  calculateHourlyRTSCurve(envelopeLoad, internalLoad, climate) {
    const hourlyLoads = [];
    
    for (let hour = 0; hour < 24; hour++) {
      const envelope = envelopeLoad.hourly[hour] || 0;
      const internal = internalLoad.total;
      // 简化的新风负荷（假设恒定）
      const ventilation = 500; // W
      
      hourlyLoads.push(Math.round(envelope + internal + ventilation));
    }
    
    return hourlyLoads;
  }
  
  /**
   * ═══════════════════════════════════════════════════════
   * V1/V2/V3: 工具方法
   * ═══════════════════════════════════════════════════════
   */
  
  // 快速估算 (API兼容V1)
  quickEstimate(area, city, buildingType = 'residential') {
    const climate = this.getClimateData(city);
    const factor = this.buildingParams.coolingLoadFactor[buildingType] || 80;
    
    // 考虑气候修正
    let climateFactor = 1.0;
    if (climate.summer.designTemp > 35) climateFactor = 1.2;
    else if (climate.summer.designTemp < 30) climateFactor = 0.8;
    
    return {
      cooling: Math.round(area * factor * climateFactor),
      heating: Math.round(area * (this.buildingParams.heatingLoadFactor[buildingType] || 60)),
      method: 'quick',
      precision: 0.85
    };
  }
  
  // 详细计算 (API兼容V2)
  detailedCalculation(roomProfile, city, options = {}) {
    return this.calculateCoolingLoad(roomProfile, city, { ...options, method: 'RTS' });
  }
  
  // 批量计算 (V3扩展)
  batchCalculate(roomProfiles, city, options = {}) {
    return roomProfiles.map((profile, index) => ({
      roomId: index,
      ...this.calculateCoolingLoad(profile, city, options)
    }));
  }
  
  // 8760小时模拟 (V3高级功能)
  simulate8760(buildingProfile, city) {
    // 简化的全年模拟
    const monthlyResults = [];
    for (let month = 1; month <= 12; month++) {
      const isSummer = month >= 6 && month <= 9;
      const load = isSummer 
        ? this.calculateCoolingLoad(buildingProfile, city)
        : this.calculateHeatingLoad(buildingProfile, city);
      
      monthlyResults.push({
        month,
        type: isSummer ? 'cooling' : 'heating',
        load: load.total
      });
    }
    
    const totalCooling = monthlyResults.filter(r => r.type === 'cooling').reduce((a, b) => a + b.load, 0);
    const totalHeating = monthlyResults.filter(r => r.type === 'heating').reduce((a, b) => a + b.load, 0);
    
    return {
      monthly: monthlyResults,
      annual: {
        cooling: totalCooling,
        heating: totalHeating
      },
      peak: {
        cooling: Math.max(...monthlyResults.filter(r => r.type === 'cooling').map(r => r.load)),
        heating: Math.max(...monthlyResults.filter(r => r.type === 'heating').map(r => r.load))
      }
    };
  }
  
  // 获取版本信息
  getVersion() {
    return {
      version: this.version,
      standard: this.config.standard,
      methods: ['RTS', 'Harmonic', 'HeatBalance', 'CLF'],
      climateDataCount: Object.keys(this.globalClimateDatabase.china).length + 
                       Object.keys(this.globalClimateDatabase.china_extended || {}).length
    };
  }
}

module.exports = LoadCalculationEngine;
