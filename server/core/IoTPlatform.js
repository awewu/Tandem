/**
 * 瑞美万物互联平台 v1.0 - IoTPlatform
 * 核心功能: 设备接入、消息路由、实时监控
 */

const EventEmitter = require('events');

class IoTPlatform extends EventEmitter {
  constructor(config = {}) {
    super();
    this.version = '1.0.0';
    this.devices = new Map();
    this.topics = new Map();
    this.messageQueue = [];
    this.stats = {
      totalDevices: 0,
      onlineDevices: 0,
      totalMessages: 0,
      messagesPerSecond: 0
    };
    this.initialized = false;
  }

  /**
   * 初始化IoT平台
   */
  async initialize() {
    console.log('[IoTPlatform] 初始化万物互联平台...');
    
    // 初始化MQTT Broker (模拟)
    await this.initBroker();
    
    // 启动消息处理
    this.startMessageProcessor();
    
    // 启动统计
    this.startStatsCollector();
    
    this.initialized = true;
    console.log('[IoTPlatform] 平台初始化完成');
    return true;
  }

  /**
   * 1. 设备注册与接入
   */
  registerDevice(deviceInfo) {
    const { deviceId, deviceType, capabilities, metadata = {} } = deviceInfo;
    
    if (this.devices.has(deviceId)) {
      throw new Error(`设备 ${deviceId} 已存在`);
    }

    const device = {
      deviceId,
      deviceType, // 'thermostat', 'water_heater', 'air_conditioner', etc.
      capabilities, // ['temperature', 'humidity', 'onoff', 'mode']
      metadata,
      status: 'offline',
      lastSeen: null,
      data: {},
      registeredAt: new Date().toISOString()
    };

    this.devices.set(deviceId, device);
    this.stats.totalDevices++;

    console.log(`[IoTPlatform] 设备注册成功: ${deviceId} (${deviceType})`);
    
    this.emit('deviceRegistered', device);
    
    return {
      success: true,
      deviceId,
      message: '设备注册成功',
      endpoints: this.generateEndpoints(deviceId)
    };
  }

  /**
   * 2. 设备上线
   */
  deviceConnect(deviceId, connectionInfo) {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`设备 ${deviceId} 不存在`);
    }

    device.status = 'online';
    device.lastSeen = new Date().toISOString();
    device.connection = connectionInfo;

    this.stats.onlineDevices++;

    console.log(`[IoTPlatform] 设备上线: ${deviceId}`);
    
    this.emit('deviceConnected', device);
    
    return {
      success: true,
      deviceId,
      status: 'online',
      timestamp: device.lastSeen
    };
  }

  /**
   * 3. 设备数据上报
   */
  publishData(deviceId, data) {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`设备 ${deviceId} 不存在`);
    }

    if (device.status !== 'online') {
      console.warn(`[IoTPlatform] 设备 ${deviceId} 离线，数据暂存`);
    }

    // 更新设备数据
    device.data = { ...device.data, ...data };
    device.lastSeen = new Date().toISOString();

    // 创建消息
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      deviceId,
      deviceType: device.deviceType,
      timestamp: device.lastSeen,
      data,
      topic: `device/${deviceId}/data`
    };

    // 加入消息队列
    this.messageQueue.push(message);
    this.stats.totalMessages++;

    // 触发数据处理
    this.emit('dataReceived', message);
    
    // 路由到订阅者
    this.routeMessage(message);

    return {
      success: true,
      messageId: message.id,
      timestamp: message.timestamp
    };
  }

  /**
   * 4. 设备控制指令下发
   */
  sendCommand(deviceId, command) {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`设备 ${deviceId} 不存在`);
    }

    if (device.status !== 'online') {
      throw new Error(`设备 ${deviceId} 离线，无法发送指令`);
    }

    const controlMessage = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      deviceId,
      type: 'command',
      command,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    console.log(`[IoTPlatform] 发送指令到 ${deviceId}:`, command);
    
    // 模拟指令发送
    setTimeout(() => {
      controlMessage.status = 'delivered';
      this.emit('commandDelivered', controlMessage);
    }, 50);

    return {
      success: true,
      commandId: controlMessage.id,
      status: 'sent',
      estimatedDelivery: '< 100ms'
    };
  }

  /**
   * 5. 订阅设备数据
   */
  subscribe(deviceId, callback) {
    const topic = `device/${deviceId}/data`;
    
    if (!this.topics.has(topic)) {
      this.topics.set(topic, new Set());
    }
    
    this.topics.get(topic).add(callback);
    
    console.log(`[IoTPlatform] 订阅主题: ${topic}`);
    
    return {
      success: true,
      topic,
      subscriptionId: `sub_${Date.now()}`
    };
  }

  /**
   * 6. 批量设备控制 (场景联动)
   */
  batchControl(deviceIds, command) {
    const results = [];
    
    for (const deviceId of deviceIds) {
      try {
        const result = this.sendCommand(deviceId, command);
        results.push({ deviceId, ...result });
      } catch (error) {
        results.push({ deviceId, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    return {
      success: successCount === deviceIds.length,
      total: deviceIds.length,
      successCount,
      failCount: deviceIds.length - successCount,
      results
    };
  }

  /**
   * 7. 获取设备状态
   */
  getDeviceStatus(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`设备 ${deviceId} 不存在`);
    }

    // 检查是否超时离线
    if (device.status === 'online' && device.lastSeen) {
      const lastSeen = new Date(device.lastSeen);
      const now = new Date();
      const diffMinutes = (now - lastSeen) / 1000 / 60;
      
      if (diffMinutes > 5) { // 5分钟无数据视为离线
        device.status = 'offline';
        this.stats.onlineDevices--;
      }
    }

    return {
      deviceId: device.deviceId,
      deviceType: device.deviceType,
      status: device.status,
      lastSeen: device.lastSeen,
      data: device.data,
      capabilities: device.capabilities,
      uptime: this.calculateUptime(device)
    };
  }

  /**
   * 8. 获取平台统计
   */
  getStats() {
    return {
      ...this.stats,
      timestamp: new Date().toISOString(),
      deviceTypes: this.getDeviceTypeDistribution(),
      onlineRate: this.stats.totalDevices > 0 
        ? ((this.stats.onlineDevices / this.stats.totalDevices) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * 9. 设备发现 (自动扫描)
   */
  async discoverDevices(networkRange) {
    console.log(`[IoTPlatform] 扫描网络 ${networkRange} 中的设备...`);
    
    // 模拟设备发现
    const discoveredDevices = [
      { deviceId: 'thermo_001', deviceType: 'thermostat', ip: '192.168.1.101' },
      { deviceId: 'wh_001', deviceType: 'water_heater', ip: '192.168.1.102' },
      { deviceId: 'ac_001', deviceType: 'air_conditioner', ip: '192.168.1.103' }
    ];

    return {
      success: true,
      count: discoveredDevices.length,
      devices: discoveredDevices
    };
  }

  /**
   * 10. 场景联动规则
   */
  createSceneRule(rule) {
    const { name, trigger, actions, conditions = [] } = rule;
    
    const sceneRule = {
      id: `scene_${Date.now()}`,
      name,
      trigger,
      conditions,
      actions,
      enabled: true,
      createdAt: new Date().toISOString()
    };

    console.log(`[IoTPlatform] 创建场景规则: ${name}`);
    
    // 监听触发条件
    this.on(trigger.event, (data) => {
      if (this.checkConditions(conditions, data)) {
        console.log(`[IoTPlatform] 场景触发: ${name}`);
        this.executeActions(actions);
      }
    });

    return {
      success: true,
      ruleId: sceneRule.id,
      rule: sceneRule
    };
  }

  // 内部方法
  generateEndpoints(deviceId) {
    return {
      publish: `/api/iot/devices/${deviceId}/publish`,
      subscribe: `/api/iot/devices/${deviceId}/subscribe`,
      command: `/api/iot/devices/${deviceId}/command`
    };
  }

  routeMessage(message) {
    const topic = message.topic;
    const subscribers = this.topics.get(topic);
    
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error(`[IoTPlatform] 消息路由错误:`, error);
        }
      });
    }
  }

  checkConditions(conditions, data) {
    return conditions.every(condition => {
      const { field, operator, value } = condition;
      const fieldValue = data[field];
      
      switch (operator) {
        case 'eq': return fieldValue === value;
        case 'gt': return fieldValue > value;
        case 'lt': return fieldValue < value;
        case 'gte': return fieldValue >= value;
        case 'lte': return fieldValue <= value;
        default: return false;
      }
    });
  }

  executeActions(actions) {
    actions.forEach(action => {
      if (action.type === 'device_control') {
        this.sendCommand(action.deviceId, action.command);
      } else if (action.type === 'notification') {
        console.log(`[IoTPlatform] 发送通知: ${action.message}`);
      }
    });
  }

  calculateUptime(device) {
    if (!device.registeredAt) return '0h';
    const registered = new Date(device.registeredAt);
    const now = new Date();
    const hours = Math.floor((now - registered) / 1000 / 60 / 60);
    return `${hours}h`;
  }

  getDeviceTypeDistribution() {
    const distribution = {};
    this.devices.forEach(device => {
      distribution[device.deviceType] = (distribution[device.deviceType] || 0) + 1;
    });
    return distribution;
  }

  async initBroker() {
    console.log('[IoTPlatform] 启动MQTT Broker...');
    return new Promise(resolve => setTimeout(resolve, 100));
  }

  startMessageProcessor() {
    setInterval(() => {
      // 处理消息队列
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        // 消息已路由，这里可以添加持久化逻辑
      }
    }, 100);
  }

  startStatsCollector() {
    setInterval(() => {
      this.stats.messagesPerSecond = Math.floor(this.stats.totalMessages / 60);
    }, 60000);
  }
}

module.exports = IoTPlatform;
