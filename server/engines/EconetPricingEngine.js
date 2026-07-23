/**
 * 【Econet智能控制加成引擎 - EconetPricingEngine】
 * 功能: Econet设备联动报价加成8-15%
 * PRD要求: M8-003-V2
 */

class EconetPricingEngine {
  constructor() {
    this.initialized = false;
    this.deviceTypes = new Map();
    this.pricingRules = new Map();
  }

  async initialize() {
    console.log('🔄 初始化Econet加成引擎...');

    // 初始化设备类型
    this.initializeDeviceTypes();

    // 初始化加成规则
    this.initializePricingRules();

    this.initialized = true;
    console.log('✅ Econet加成引擎初始化完成');
    return true;
  }

  initializeDeviceTypes() {
    const devices = [
      // ========== 1. 空气源热泵 ==========
      { key: 'hp_12_inverter', name: 'HP-12 变频空气源热泵', basePrice: 28000, econetPremium: 0.12, category: 'heat_pump' },
      { key: 'hp_16_inverter', name: 'HP-16 变频空气源热泵', basePrice: 35000, econetPremium: 0.12, category: 'heat_pump' },
      { key: 'hp_20_cascade', name: 'HP-20 级联空气源热泵', basePrice: 52000, econetPremium: 0.10, category: 'heat_pump' },
      { key: 'hp_25_commercial', name: 'HP-25 商用空气源热泵', basePrice: 68000, econetPremium: 0.10, category: 'heat_pump' },

      // ========== 2. 新风除湿系统 ==========
      { key: 'fa_250_basic', name: 'FA-250 壁挂新风机', basePrice: 4500, econetPremium: 0.10, category: 'fresh_air' },
      { key: 'fa_350_dehumid', name: 'FA-350 新风除湿一体机', basePrice: 8800, econetPremium: 0.12, category: 'fresh_air' },
      { key: 'fa_500_duct', name: 'FA-500 管道式新风机', basePrice: 12000, econetPremium: 0.12, category: 'fresh_air' },
      { key: 'fa_800_commercial', name: 'FA-800 商用新风系统', basePrice: 22000, econetPremium: 0.10, category: 'fresh_air' },

      // ========== 3. 全屋净水系统 ==========
      { key: 'wp_pre_filter', name: 'WP-PRE 前置过滤器', basePrice: 1200, econetPremium: 0.08, category: 'water_purify' },
      { key: 'wp_central', name: 'CW-PRO 中央净水器', basePrice: 6800, econetPremium: 0.10, category: 'water_purify' },
      { key: 'wp_softener', name: 'WS-3200 中央软水机', basePrice: 8500, econetPremium: 0.10, category: 'water_purify' },
      { key: 'wp_ro_under', name: 'RO-600G 厨下RO净水器', basePrice: 3800, econetPremium: 0.10, category: 'water_purify' },
      { key: 'wp_instant', name: 'WD-PRO 管线饮水机', basePrice: 2800, econetPremium: 0.08, category: 'water_purify' },

      // ========== 4. 地暖系统 ==========
      { key: 'fh_controller', name: 'FH-CTL 地暖温控器', basePrice: 1600, econetPremium: 0.15, category: 'floor_heating' },
      { key: 'fh_manifold', name: 'FH-MF8 智能分集水器', basePrice: 3500, econetPremium: 0.12, category: 'floor_heating' },
      { key: 'fh_boiler_wall', name: 'WM-28C 壁挂炉', basePrice: 18000, econetPremium: 0.12, category: 'floor_heating' },
      { key: 'fh_mixing_valve', name: 'FH-MIX 智能混水阀', basePrice: 1800, econetPremium: 0.10, category: 'floor_heating' },

      // ========== 5. 五恒系统 ==========
      { key: 'fc_20_residential', name: '5H-20 家用五恒系统', basePrice: 85000, econetPremium: 0.15, category: 'five_comfort' },
      { key: 'fc_50_villa', name: '5H-50 别墅五恒系统', basePrice: 168000, econetPremium: 0.15, category: 'five_comfort' },
      { key: 'fc_capillary', name: '5H-CAP 毛细管辐射模块', basePrice: 12000, econetPremium: 0.12, category: 'five_comfort' },

      // ========== 6. 热水器 ==========
      { key: 'wh_60l_electric', name: 'RE-60 储水式电热水器', basePrice: 3200, econetPremium: 0.10, category: 'water_heater' },
      { key: 'wh_16l_gas', name: 'RG-16 燃气热水器', basePrice: 4500, econetPremium: 0.12, category: 'water_heater' },
      { key: 'wh_heatpump_200', name: 'HPW-200 空气能热水器', basePrice: 9800, econetPremium: 0.15, category: 'water_heater' },
      { key: 'wh_instant', name: 'RI-PRO 即热式热水器', basePrice: 2800, econetPremium: 0.10, category: 'water_heater' },
      { key: 'wh_solar_hybrid', name: 'RS-300 太阳能混合热水器', basePrice: 15000, econetPremium: 0.12, category: 'water_heater' },

      // ========== 7. 智能控制终端 ==========
      { key: 'ctrl_thermostat', name: 'EC-T1 Econet智能温控面板', basePrice: 1200, econetPremium: 0.12, category: 'smart_control' },
      { key: 'ctrl_gateway', name: 'EC-GW Econet智能网关', basePrice: 2000, econetPremium: 0.08, category: 'smart_control' },
      { key: 'ctrl_zone_panel', name: 'EC-ZP 分区控制面板', basePrice: 1500, econetPremium: 0.10, category: 'smart_control' },

      // ========== 8. 传感器 ==========
      { key: 'sensor_temp_humidity', name: 'ES-TH 温湿度传感器', basePrice: 280, econetPremium: 0.08, category: 'sensor' },
      { key: 'sensor_air_quality', name: 'ES-AQ 空气质量传感器', basePrice: 600, econetPremium: 0.10, category: 'sensor' },
      { key: 'sensor_water_leak', name: 'ES-WL 水浸传感器', basePrice: 180, econetPremium: 0.08, category: 'sensor' },
      { key: 'sensor_pressure', name: 'ES-PR 管道压力传感器', basePrice: 350, econetPremium: 0.08, category: 'sensor' },
      { key: 'sensor_flow', name: 'ES-FL 流量传感器', basePrice: 450, econetPremium: 0.10, category: 'sensor' }
    ];

    devices.forEach(d => {
      this.deviceTypes.set(d.key, {
        name: d.name,
        basePrice: d.basePrice,
        econetPremium: d.econetPremium,
        category: d.category
      });
    });

    console.log(`📦 已加载 ${this.deviceTypes.size} 种Econet设备类型`);
  }

  initializePricingRules() {
    // 基础加成规则
    this.pricingRules.set('base_premium', {
      min: 0.08, // 8%最低加成
      max: 0.15, // 15%最高加成
      default: 0.10 // 默认10%
    });

    // 设备组合加成规则
    this.pricingRules.set('combo_premium', {
      threshold: 3, // 3个以上设备触发组合加成
      bonus: 0.02, // 额外2%加成
      maxBonus: 0.05 // 最高额外5%
    });

    // 品牌加成规则
    this.pricingRules.set('brand_premium', {
      rheem: 0.01, // Rheem品牌额外1%
      ruud: 0.01, // Ruud品牌额外1%
      default: 0
    });

    // 区域加成规则
    this.pricingRules.set('region_premium', {
      tier1: { regions: ['华东', '华南'], premium: 0.01 }, // 一线城市1%
      tier2: { regions: ['华北', '华中'], premium: 0.005 }, // 二线城市0.5%
      tier3: { regions: ['西北', '东北'], premium: 0 } // 三线城市0%
    });

    console.log(`📋 已加载 ${this.pricingRules.size} 条加成规则`);
  }

  /**
   * 计算Econet加成
   * @param {Object} solution - 方案数据
   * @returns {Object} 加成计算结果
   */
  calculateEconetPremium(solution) {
    if (!this.initialized) {
      throw new Error('Econet加成引擎未初始化');
    }

    const result = {
      basePrice: 0,
      econetPremium: 0,
      premiumPercentage: 0,
      premiumDetails: [],
      totalWithPremium: 0
    };

    // 1. 计算基础价格
    if (solution.devices && Array.isArray(solution.devices)) {
      solution.devices.forEach(device => {
        const deviceType = this.deviceTypes.get(device.type);
        if (deviceType) {
          const devicePrice = deviceType.basePrice * (device.quantity || 1);
          result.basePrice += devicePrice;
        }
      });
    }

    // 2. 计算设备加成
    let devicePremium = 0;
    if (solution.devices && Array.isArray(solution.devices)) {
      solution.devices.forEach(device => {
        const deviceType = this.deviceTypes.get(device.type);
        if (deviceType) {
          const devicePremiumAmount = deviceType.basePrice * deviceType.econetPremium * (device.quantity || 1);
          devicePremium += devicePremiumAmount;
          result.premiumDetails.push({
            type: device.type,
            name: deviceType.name,
            basePrice: deviceType.basePrice,
            premiumRate: deviceType.econetPremium * 100,
            premiumAmount: devicePremiumAmount
          });
        }
      });
    }
    result.econetPremium += devicePremium;

    // 3. 计算组合加成
    const deviceCount = solution.devices ? solution.devices.length : 0;
    const comboRule = this.pricingRules.get('combo_premium');
    if (deviceCount >= comboRule.threshold) {
      const comboBonus = Math.min(
        comboRule.bonus * (deviceCount - comboRule.threshold + 1),
        comboRule.maxBonus
      );
      const comboPremiumAmount = result.basePrice * comboBonus;
      result.econetPremium += comboPremiumAmount;
      result.premiumDetails.push({
        type: 'combo',
        name: `设备组合加成 (${deviceCount}台设备)`,
        basePrice: result.basePrice,
        premiumRate: comboBonus * 100,
        premiumAmount: comboPremiumAmount
      });
    }

    // 4. 计算品牌加成
    const brandRule = this.pricingRules.get('brand_premium');
    const brandPremium = brandRule[solution.brand?.toLowerCase()] || brandRule.default;
    if (brandPremium > 0) {
      const brandPremiumAmount = result.basePrice * brandPremium;
      result.econetPremium += brandPremiumAmount;
      result.premiumDetails.push({
        type: 'brand',
        name: `${solution.brand}品牌加成`,
        basePrice: result.basePrice,
        premiumRate: brandPremium * 100,
        premiumAmount: brandPremiumAmount
      });
    }

    // 5. 计算区域加成
    const regionRule = this.pricingRules.get('region_premium');
    let regionPremium = 0;
    Object.values(regionRule).forEach(tier => {
      if (tier.regions.includes(solution.region)) {
        regionPremium = tier.premium;
      }
    });
    if (regionPremium > 0) {
      const regionPremiumAmount = result.basePrice * regionPremium;
      result.econetPremium += regionPremiumAmount;
      result.premiumDetails.push({
        type: 'region',
        name: `${solution.region}区域加成`,
        basePrice: result.basePrice,
        premiumRate: regionPremium * 100,
        premiumAmount: regionPremiumAmount
      });
    }

    // 6. 计算总加成比例和总价
    result.premiumPercentage = (result.econetPremium / result.basePrice) * 100;
    result.totalWithPremium = result.basePrice + result.econetPremium;

    // 验证加成比例在8-15%范围内
    const baseRule = this.pricingRules.get('base_premium');
    if (result.premiumPercentage < baseRule.min * 100) {
      result.premiumPercentage = baseRule.min * 100;
      result.econetPremium = result.basePrice * baseRule.min;
      result.totalWithPremium = result.basePrice + result.econetPremium;
    } else if (result.premiumPercentage > baseRule.max * 100) {
      result.premiumPercentage = baseRule.max * 100;
      result.econetPremium = result.basePrice * baseRule.max;
      result.totalWithPremium = result.basePrice + result.econetPremium;
    }

    console.log(`💰 Econet加成计算完成: ${result.premiumPercentage.toFixed(2)}%`);
    return result;
  }

  /**
   * 获取设备类型列表
   */
  getDeviceTypes() {
    return Array.from(this.deviceTypes.values());
  }

  /**
   * 获取设备类型详情
   */
  getDeviceType(type) {
    return this.deviceTypes.get(type);
  }

  /**
   * 获取加成规则
   */
  getPricingRules() {
    return this.pricingRules;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      deviceTypes: this.deviceTypes.size,
      pricingRules: this.pricingRules.size,
      minPremium: this.pricingRules.get('base_premium').min * 100,
      maxPremium: this.pricingRules.get('base_premium').max * 100
    };
  }
}

// 导出单例
module.exports = EconetPricingEngine;
