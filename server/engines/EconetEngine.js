/**
 * 【Econet智能控制模块 - 立即补充】
 * 影响高端方案溢价能力的关键模块
 */

class EconetSmartControlSystem {
  constructor() {
    this.devices = new Map();
    this.scenes = new Map();
    this.automations = new Map();
    this.initialized = false;
  }

  // 初始化Econet系统
  async initialize() {
    console.log('🌐 初始化Econet智能控制系统...');
    
    // 加载设备列表
    await this.loadDevices();
    
    // 加载场景配置
    await this.loadScenes();
    
    // 加载自动化规则
    await this.loadAutomations();
    
    this.initialized = true;
    console.log('✅ Econet系统初始化完成');
    return true;
  }

  // 设备管理
  async loadDevices() {
    // 瑞美/恒热/路德全系智能设备 - 30+型号全覆盖
    const deviceTypes = [
      // ========== 1. 空气源热泵 (Heat Pump) ==========
      { type: 'hp_12_inverter', name: 'HP-12 变频空气源热泵', brand: 'Rheem', category: 'heat_pump', protocols: ['WiFi', 'Modbus'], power: '12kW', mqttTopic: 'econet/hp/+/status', capabilities: ['heating', 'cooling', 'dhw', 'defrost'], energyClass: 'A+++' },
      { type: 'hp_16_inverter', name: 'HP-16 变频空气源热泵', brand: 'Rheem', category: 'heat_pump', protocols: ['WiFi', 'Modbus'], power: '16kW', mqttTopic: 'econet/hp/+/status', capabilities: ['heating', 'cooling', 'dhw', 'defrost'], energyClass: 'A+++' },
      { type: 'hp_20_cascade', name: 'HP-20 级联空气源热泵', brand: 'Rheem', category: 'heat_pump', protocols: ['WiFi', 'Modbus', 'BACnet'], power: '20kW', mqttTopic: 'econet/hp/+/status', capabilities: ['heating', 'cooling', 'dhw', 'defrost', 'cascade'], energyClass: 'A++' },
      { type: 'hp_25_commercial', name: 'HP-25 商用空气源热泵', brand: 'Rheem', category: 'heat_pump', protocols: ['WiFi', 'Modbus', 'BACnet'], power: '25kW', mqttTopic: 'econet/hp/+/status', capabilities: ['heating', 'cooling', 'dhw', 'defrost', 'cascade'], energyClass: 'A++' },

      // ========== 2. 新风除湿系统 (Fresh Air) ==========
      { type: 'fa_250_basic', name: 'FA-250 壁挂新风机', brand: 'Rheem', category: 'fresh_air', protocols: ['WiFi'], power: '250m³/h', mqttTopic: 'econet/fa/+/status', capabilities: ['ventilation', 'filter', 'pm25'], energyClass: 'A+' },
      { type: 'fa_350_dehumid', name: 'FA-350 新风除湿一体机', brand: 'Rheem', category: 'fresh_air', protocols: ['WiFi', 'Zigbee'], power: '350m³/h', mqttTopic: 'econet/fa/+/status', capabilities: ['ventilation', 'dehumidify', 'filter', 'pm25', 'co2'], energyClass: 'A+' },
      { type: 'fa_500_duct', name: 'FA-500 管道式新风机', brand: 'Rheem', category: 'fresh_air', protocols: ['WiFi', 'Modbus'], power: '500m³/h', mqttTopic: 'econet/fa/+/status', capabilities: ['ventilation', 'dehumidify', 'filter', 'heat_recovery', 'pm25', 'co2'], energyClass: 'A++' },
      { type: 'fa_800_commercial', name: 'FA-800 商用新风系统', brand: 'Rheem', category: 'fresh_air', protocols: ['WiFi', 'Modbus', 'BACnet'], power: '800m³/h', mqttTopic: 'econet/fa/+/status', capabilities: ['ventilation', 'dehumidify', 'filter', 'heat_recovery', 'pm25', 'co2', 'voc'], energyClass: 'A++' },

      // ========== 3. 全屋净水系统 (Water Purification) ==========
      { type: 'wp_pre_filter', name: 'WP-PRE 前置过滤器', brand: 'Rheem', category: 'water_purify', protocols: ['Zigbee'], power: '无源', mqttTopic: 'econet/wp/+/status', capabilities: ['filter_status', 'flow_rate', 'pressure'], energyClass: 'N/A' },
      { type: 'wp_central', name: 'CW-PRO 中央净水器', brand: 'Rheem', category: 'water_purify', protocols: ['WiFi'], power: '2T/h', mqttTopic: 'econet/wp/+/status', capabilities: ['filter_status', 'tds', 'flow_rate', 'backwash'], energyClass: 'A' },
      { type: 'wp_softener', name: 'WS-3200 中央软水机', brand: 'Rheem', category: 'water_purify', protocols: ['WiFi'], power: '3.2T/h', mqttTopic: 'econet/wp/+/status', capabilities: ['hardness', 'salt_level', 'regeneration', 'flow_rate'], energyClass: 'A' },
      { type: 'wp_ro_under', name: 'RO-600G 厨下RO净水器', brand: 'Rheem', category: 'water_purify', protocols: ['WiFi'], power: '600加仑/天', mqttTopic: 'econet/wp/+/status', capabilities: ['tds_in', 'tds_out', 'filter_life', 'flow_rate'], energyClass: 'A+' },
      { type: 'wp_instant', name: 'WD-PRO 管线饮水机', brand: 'Rheem', category: 'water_purify', protocols: ['WiFi'], power: '即热式', mqttTopic: 'econet/wp/+/status', capabilities: ['temperature', 'child_lock', 'filter_life'], energyClass: 'A' },

      // ========== 4. 地暖系统 (Floor Heating) ==========
      { type: 'fh_controller', name: 'FH-CTL 地暖温控器', brand: 'Rheem', category: 'floor_heating', protocols: ['WiFi', 'Zigbee'], power: '控制器', mqttTopic: 'econet/fh/+/status', capabilities: ['temperature', 'schedule', 'zone_control'], energyClass: 'A' },
      { type: 'fh_manifold', name: 'FH-MF8 智能分集水器', brand: 'Rheem', category: 'floor_heating', protocols: ['Zigbee', 'Modbus'], power: '8路', mqttTopic: 'econet/fh/+/status', capabilities: ['zone_control', 'flow_balance', 'actuator', 'pressure'], energyClass: 'A' },
      { type: 'fh_boiler_wall', name: 'WM-28C 壁挂炉', brand: 'Rheem', category: 'floor_heating', protocols: ['WiFi', 'Modbus'], power: '28kW', mqttTopic: 'econet/fh/+/status', capabilities: ['heating', 'dhw', 'modulation', 'flame', 'pressure'], energyClass: 'A+' },
      { type: 'fh_mixing_valve', name: 'FH-MIX 智能混水阀', brand: 'Rheem', category: 'floor_heating', protocols: ['Zigbee'], power: '混水控制', mqttTopic: 'econet/fh/+/status', capabilities: ['supply_temp', 'return_temp', 'valve_position'], energyClass: 'N/A' },

      // ========== 5. 五恒系统 (Five-Comfort) ==========
      { type: 'fc_20_residential', name: '5H-20 家用五恒系统', brand: 'Rheem', category: 'five_comfort', protocols: ['WiFi', 'Modbus', 'Zigbee'], power: '20kW', mqttTopic: 'econet/fc/+/status', capabilities: ['temperature', 'humidity', 'oxygen', 'clean', 'quiet', 'radiant'], energyClass: 'A+++' },
      { type: 'fc_50_villa', name: '5H-50 别墅五恒系统', brand: 'Rheem', category: 'five_comfort', protocols: ['WiFi', 'Modbus', 'BACnet'], power: '50kW', mqttTopic: 'econet/fc/+/status', capabilities: ['temperature', 'humidity', 'oxygen', 'clean', 'quiet', 'radiant', 'multi_zone'], energyClass: 'A+++' },
      { type: 'fc_capillary', name: '5H-CAP 毛细管辐射模块', brand: 'Rheem', category: 'five_comfort', protocols: ['Modbus'], power: '辐射模块', mqttTopic: 'econet/fc/+/status', capabilities: ['supply_temp', 'return_temp', 'surface_temp', 'dew_point'], energyClass: 'A++' },

      // ========== 6. 热水器 (Water Heater) ==========
      { type: 'wh_60l_electric', name: 'RE-60 储水式电热水器', brand: 'Rheem', category: 'water_heater', protocols: ['WiFi'], power: '60L/3kW', mqttTopic: 'econet/wh/+/status', capabilities: ['temperature', 'timer', 'eco_mode', 'anti_scale'], energyClass: 'A' },
      { type: 'wh_16l_gas', name: 'RG-16 燃气热水器', brand: 'Rheem', category: 'water_heater', protocols: ['WiFi'], power: '16L/min', mqttTopic: 'econet/wh/+/status', capabilities: ['temperature', 'flow_rate', 'flame', 'zero_cold_water'], energyClass: 'A+' },
      { type: 'wh_heatpump_200', name: 'HPW-200 空气能热水器', brand: 'Rheem', category: 'water_heater', protocols: ['WiFi', 'Modbus'], power: '200L/1.5kW', mqttTopic: 'econet/wh/+/status', capabilities: ['temperature', 'compressor', 'defrost', 'eco_mode', 'timer'], energyClass: 'A+++' },
      { type: 'wh_instant', name: 'RI-PRO 即热式热水器', brand: 'Rheem', category: 'water_heater', protocols: ['WiFi'], power: '即热/8.5kW', mqttTopic: 'econet/wh/+/status', capabilities: ['temperature', 'flow_rate', 'power_adjust'], energyClass: 'A' },
      { type: 'wh_solar_hybrid', name: 'RS-300 太阳能混合热水器', brand: 'Rheem', category: 'water_heater', protocols: ['WiFi', 'Modbus'], power: '300L/太阳能+电辅', mqttTopic: 'econet/wh/+/status', capabilities: ['solar_temp', 'tank_temp', 'backup_heat', 'solar_fraction'], energyClass: 'A+++' },

      // ========== 7. 智能控制终端 (Smart Controls) ==========
      { type: 'ctrl_thermostat', name: 'EC-T1 Econet智能温控面板', brand: 'Rheem', category: 'smart_control', protocols: ['WiFi', 'Zigbee'], power: '控制面板', mqttTopic: 'econet/ctrl/+/status', capabilities: ['temperature', 'humidity', 'schedule', 'geofence', 'voice_control'], energyClass: 'N/A' },
      { type: 'ctrl_gateway', name: 'EC-GW Econet智能网关', brand: 'Rheem', category: 'smart_control', protocols: ['WiFi', 'Zigbee', 'Modbus', 'BACnet'], power: '网关', mqttTopic: 'econet/ctrl/+/status', capabilities: ['device_bridge', 'protocol_convert', 'edge_compute', 'ota_update'], energyClass: 'N/A' },
      { type: 'ctrl_zone_panel', name: 'EC-ZP 分区控制面板', brand: 'Rheem', category: 'smart_control', protocols: ['WiFi', 'Zigbee'], power: '分区面板', mqttTopic: 'econet/ctrl/+/status', capabilities: ['zone_temp', 'zone_schedule', 'occupancy'], energyClass: 'N/A' },

      // ========== 8. 传感器 (Sensors) ==========
      { type: 'sensor_temp_humidity', name: 'ES-TH 温湿度传感器', brand: 'Rheem', category: 'sensor', protocols: ['Zigbee'], power: '电池', mqttTopic: 'econet/sensor/+/status', capabilities: ['temperature', 'humidity', 'battery'], energyClass: 'N/A' },
      { type: 'sensor_air_quality', name: 'ES-AQ 空气质量传感器', brand: 'Rheem', category: 'sensor', protocols: ['WiFi'], power: 'USB供电', mqttTopic: 'econet/sensor/+/status', capabilities: ['pm25', 'co2', 'voc', 'temperature', 'humidity'], energyClass: 'N/A' },
      { type: 'sensor_water_leak', name: 'ES-WL 水浸传感器', brand: 'Rheem', category: 'sensor', protocols: ['Zigbee'], power: '电池', mqttTopic: 'econet/sensor/+/status', capabilities: ['leak_detect', 'battery'], energyClass: 'N/A' },
      { type: 'sensor_pressure', name: 'ES-PR 管道压力传感器', brand: 'Rheem', category: 'sensor', protocols: ['Zigbee'], power: '电池', mqttTopic: 'econet/sensor/+/status', capabilities: ['pressure', 'battery'], energyClass: 'N/A' },
      { type: 'sensor_flow', name: 'ES-FL 流量传感器', brand: 'Rheem', category: 'sensor', protocols: ['Zigbee', 'Modbus'], power: '管道供电', mqttTopic: 'econet/sensor/+/status', capabilities: ['flow_rate', 'cumulative_flow', 'temperature'], energyClass: 'N/A' }
    ];

    deviceTypes.forEach(device => {
      this.devices.set(device.type, {
        ...device,
        status: 'online',
        connected: false,
        data: {}
      });
    });

    console.log(`📱 已加载 ${this.devices.size} 种智能设备类型`);
  }

  // 场景管理
  async loadScenes() {
    const defaultScenes = [
      {
        id: 'scene_home',
        name: '回家模式',
        icon: '🏠',
        description: '全屋舒适启动：温控+新风+热水预热',
        actions: [
          { device: 'ctrl_thermostat', action: 'setTemp', value: 22 },
          { device: 'fa_350_dehumid', action: 'setMode', value: 'auto' },
          { device: 'wh_16l_gas', action: 'turnOn', value: true },
          { device: 'fh_controller', action: 'setTemp', value: 24 }
        ]
      },
      {
        id: 'scene_away',
        name: '离家模式',
        icon: '🚪',
        description: '节能运行：降温+ECO模式+新风低速',
        actions: [
          { device: 'ctrl_thermostat', action: 'setTemp', value: 18 },
          { device: 'wh_16l_gas', action: 'ecoMode', value: true },
          { device: 'fa_350_dehumid', action: 'setSpeed', value: 'low' },
          { device: 'hp_12_inverter', action: 'setMode', value: 'eco' }
        ]
      },
      {
        id: 'scene_sleep',
        name: '睡眠模式',
        icon: '😴',
        description: '静音恒温：低噪+恒温恒湿+新风微风',
        actions: [
          { device: 'ctrl_thermostat', action: 'setTemp', value: 20 },
          { device: 'hp_12_inverter', action: 'setMode', value: 'sleep' },
          { device: 'fa_350_dehumid', action: 'setSpeed', value: 'silent' },
          { device: 'fh_controller', action: 'setTemp', value: 22 }
        ]
      },
      {
        id: 'scene_bath',
        name: '沐浴模式',
        icon: '🛁',
        description: '快速加热：零冷水+浴室暖风',
        actions: [
          { device: 'wh_16l_gas', action: 'boostMode', value: true },
          { device: 'wh_16l_gas', action: 'setTemp', value: 42 },
          { device: 'fh_controller', action: 'setZone', value: { zone: 'bathroom', temp: 26 } }
        ]
      },
      {
        id: 'scene_party',
        name: '聚会模式',
        icon: '🎉',
        description: '大负荷运行：满负荷供暖+新风强劲+热水大容量',
        actions: [
          { device: 'wh_heatpump_200', action: 'highCapacity', value: true },
          { device: 'hp_16_inverter', action: 'setMode', value: 'high' },
          { device: 'fa_500_duct', action: 'setSpeed', value: 'turbo' }
        ]
      },
      {
        id: 'scene_five_comfort',
        name: '五恒模式',
        icon: '🌟',
        description: '恒温恒湿恒氧恒洁恒静，极致舒适',
        actions: [
          { device: 'fc_20_residential', action: 'setMode', value: 'five_comfort' },
          { device: 'fa_350_dehumid', action: 'setHumidity', value: 55 },
          { device: 'sensor_air_quality', action: 'monitor', value: true },
          { device: 'ctrl_thermostat', action: 'setTemp', value: 22 }
        ]
      },
      {
        id: 'scene_purify',
        name: '净水模式',
        icon: '💧',
        description: '全屋净水联动：前置+中央+软水+末端',
        actions: [
          { device: 'wp_pre_filter', action: 'monitor', value: true },
          { device: 'wp_central', action: 'setMode', value: 'auto' },
          { device: 'wp_softener', action: 'checkSalt', value: true },
          { device: 'wp_ro_under', action: 'flush', value: true }
        ]
      },
      {
        id: 'scene_summer',
        name: '夏日清凉',
        icon: '☀️',
        description: '制冷+除湿+新风换气',
        actions: [
          { device: 'hp_12_inverter', action: 'setMode', value: 'cooling' },
          { device: 'fa_350_dehumid', action: 'setMode', value: 'dehumidify' },
          { device: 'ctrl_thermostat', action: 'setTemp', value: 24 }
        ]
      }
    ];

    defaultScenes.forEach(scene => {
      this.scenes.set(scene.id, scene);
    });

    console.log(`🎬 已加载 ${this.scenes.size} 个智能场景`);
  }

  // 自动化规则
  async loadAutomations() {
    const automations = [
      {
        id: 'auto_temp_control',
        name: '温度自动控制',
        trigger: { type: 'schedule', time: '06:00' },
        condition: { sensor: 'sensor_temp_humidity', field: 'temperature', operator: '<', value: 10 },
        action: { scene: 'scene_home' }
      },
      {
        id: 'auto_water_heater',
        name: '热水智能预热',
        trigger: { type: 'schedule', time: '17:30' },
        condition: { dayOfWeek: [1,2,3,4,5] },
        action: { scene: 'scene_bath' }
      },
      {
        id: 'auto_eco_mode',
        name: '节能自动切换',
        trigger: { type: 'inactivity', duration: 30 },
        action: { scene: 'scene_away' }
      },
      {
        id: 'auto_air_quality',
        name: '空气质量联动',
        trigger: { type: 'sensor', device: 'sensor_air_quality' },
        condition: { field: 'pm25', operator: '>', value: 75 },
        action: { device: 'fa_350_dehumid', command: { mode: 'turbo', filter: 'hepa' } }
      },
      {
        id: 'auto_humidity_control',
        name: '湿度自动调节',
        trigger: { type: 'sensor', device: 'sensor_temp_humidity' },
        condition: { field: 'humidity', operator: '>', value: 70 },
        action: { device: 'fa_350_dehumid', command: { mode: 'dehumidify' } }
      },
      {
        id: 'auto_water_leak',
        name: '漏水紧急关阀',
        trigger: { type: 'sensor', device: 'sensor_water_leak' },
        condition: { field: 'leak_detect', operator: '==', value: true },
        action: { device: 'wp_pre_filter', command: { action: 'shutoff' }, alert: true }
      },
      {
        id: 'auto_filter_reminder',
        name: '滤芯更换提醒',
        trigger: { type: 'sensor', device: 'wp_ro_under' },
        condition: { field: 'filter_life', operator: '<', value: 10 },
        action: { notification: '净水器滤芯寿命不足10%，请尽快更换' }
      },
      {
        id: 'auto_defrost',
        name: '热泵自动除霜',
        trigger: { type: 'sensor', device: 'sensor_temp_humidity' },
        condition: { field: 'temperature', operator: '<', value: -5 },
        action: { device: 'hp_12_inverter', command: { mode: 'defrost' } }
      },
      {
        id: 'auto_summer_cool',
        name: '夏季高温制冷',
        trigger: { type: 'sensor', device: 'sensor_temp_humidity' },
        condition: { field: 'temperature', operator: '>', value: 30 },
        action: { scene: 'scene_summer' }
      },
      {
        id: 'auto_solar_optimize',
        name: '太阳能热水优化',
        trigger: { type: 'schedule', time: '14:00' },
        condition: { device: 'wh_solar_hybrid', field: 'solar_temp', operator: '>', value: 50 },
        action: { device: 'wh_solar_hybrid', command: { backup_heat: 'off' } }
      }
    ];

    automations.forEach(auto => {
      this.automations.set(auto.id, auto);
    });

    console.log(`⚙️ 已加载 ${this.automations.size} 条自动化规则`);
  }

  // 控制设备
  async controlDevice(deviceId, action, value) {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`设备 ${deviceId} 不存在`);
    }

    console.log(`🎮 控制设备: ${device.name} - ${action} = ${value}`);
    
    // 模拟设备控制
    device.data[action] = value;
    device.lastControl = new Date().toISOString();
    
    return {
      success: true,
      device: deviceId,
      action,
      value,
      timestamp: device.lastControl
    };
  }

  // 执行场景
  async executeScene(sceneId) {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      throw new Error(`场景 ${sceneId} 不存在`);
    }

    console.log(`🎬 执行场景: ${scene.name}`);
    
    const results = [];
    for (const action of scene.actions) {
      try {
        const result = await this.controlDevice(
          action.device,
          action.action,
          action.value
        );
        results.push(result);
      } catch (error) {
        console.error(`场景执行失败: ${action.device}`, error);
        results.push({ success: false, error: error.message });
      }
    }

    return {
      success: true,
      scene: sceneId,
      name: scene.name,
      executed: results.length,
      results
    };
  }

  // 获取设备状态
  async getDeviceStatus(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) return null;

    return {
      id: deviceId,
      name: device.name,
      type: device.type,
      brand: device.brand,
      status: device.status,
      connected: device.connected,
      data: device.data,
      lastUpdate: device.lastControl
    };
  }

  // 获取所有场景
  getAllScenes() {
    return Array.from(this.scenes.values()).map(scene => ({
      id: scene.id,
      name: scene.name,
      icon: scene.icon,
      description: scene.description
    }));
  }

  // 获取系统状态
  getSystemStatus() {
    return {
      initialized: this.initialized,
      deviceCount: this.devices.size,
      sceneCount: this.scenes.size,
      automationCount: this.automations.size,
      onlineDevices: Array.from(this.devices.values()).filter(d => d.status === 'online').length,
      timestamp: new Date().toISOString()
    };
  }

  // 生成高端方案溢价报价
  generatePremiumQuote(basePrice) {
    const premiumRate = 0.15; // 15%溢价
    const premiumPrice = basePrice * (1 + premiumRate);
    
    return {
      basePrice,
      premiumRate,
      premiumPrice: Math.round(premiumPrice),
      features: [
        'Econet智能控制系统',
        '5大智能场景模式',
        '手机APP远程控制',
        '语音控制支持',
        '自动化节能运行',
        '实时能耗监控'
      ],
      value: '每1元投入，节省2元能耗费用/年'
    };
  }
}

// 导出模块
module.exports = EconetSmartControlSystem;
