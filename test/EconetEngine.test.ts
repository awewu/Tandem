/**
 * EconetEngine 单元测试
 * 测试覆盖率目标: 80%+
 */

import EconetEngine from '../server/engines/EconetEngine';

describe('EconetEngine', () => {
  let engine: any;

  beforeEach(async () => {
    // 创建新实例进行测试
    engine = new (EconetEngine as any).constructor();
  });

  afterEach(async () => {
    // 清理
    if (engine.devices) {
      engine.devices.clear();
    }
    if (engine.scenes) {
      engine.scenes.clear();
    }
    if (engine.automations) {
      engine.automations.clear();
    }
  });

  describe('初始化', () => {
    test('应该成功初始化', async () => {
      const result = await engine.initialize();
      expect(result).toBe(true);
      expect(engine.initialized).toBe(true);
    });

    test('应该加载设备列表', async () => {
      await engine.initialize();
      expect(engine.devices.size).toBeGreaterThan(0);
    });

    test('应该加载场景配置', async () => {
      await engine.initialize();
      expect(engine.scenes.size).toBeGreaterThan(0);
    });

    test('应该加载自动化规则', async () => {
      await engine.initialize();
      expect(engine.automations.size).toBeGreaterThan(0);
    });
  });

  describe('设备管理', () => {
    test('应该包含智能设备类型', async () => {
      await engine.initialize();
      const deviceTypes = Array.from(engine.devices.keys());
      
      expect(deviceTypes).toContain('smart_thermostat');
      expect(deviceTypes).toContain('smart_water_heater');
      expect(deviceTypes).toContain('smart_hvac');
    });

    test('设备应该包含必要属性', async () => {
      await engine.initialize();
      const device = engine.devices.get('smart_thermostat');
      
      expect(device).toHaveProperty('type');
      expect(device).toHaveProperty('name');
      expect(device).toHaveProperty('brand');
      expect(device).toHaveProperty('protocols');
      expect(device).toHaveProperty('status');
      expect(device).toHaveProperty('connected');
    });

    test('设备品牌应该是Rheem', async () => {
      await engine.initialize();
      const device = engine.devices.get('smart_thermostat');
      
      expect(device.brand).toBe('Rheem');
    });

    test('设备状态应该是online', async () => {
      await engine.initialize();
      const device = engine.devices.get('smart_thermostat');
      
      expect(device.status).toBe('online');
    });
  });

  describe('场景管理', () => {
    test('应该包含预设场景', async () => {
      await engine.initialize();
      const scenes = engine.getAllScenes();
      
      expect(scenes.length).toBeGreaterThan(0);
    });

    test('场景应该包含回家模式', async () => {
      await engine.initialize();
      const scenes = engine.getAllScenes();
      const homeScene = scenes.find((s: any) => s.id === 'scene_home');
      
      expect(homeScene).toBeDefined();
      expect(homeScene.name).toBe('回家模式');
    });

    test('场景应该包含离家模式', async () => {
      await engine.initialize();
      const scenes = engine.getAllScenes();
      const awayScene = scenes.find((s: any) => s.id === 'scene_away');
      
      expect(awayScene).toBeDefined();
      expect(awayScene.name).toBe('离家模式');
    });

    test('场景应该包含睡眠模式', async () => {
      await engine.initialize();
      const scenes = engine.getAllScenes();
      const sleepScene = scenes.find((s: any) => s.id === 'scene_sleep');
      
      expect(sleepScene).toBeDefined();
      expect(sleepScene.name).toBe('睡眠模式');
    });

    test('场景应该包含沐浴模式', async () => {
      await engine.initialize();
      const scenes = engine.getAllScenes();
      const bathScene = scenes.find((s: any) => s.id === 'scene_bath');
      
      expect(bathScene).toBeDefined();
      expect(bathScene.name).toBe('沐浴模式');
    });
  });

  describe('设备控制', () => {
    test('应该成功控制设备', async () => {
      await engine.initialize();
      const result = await engine.controlDevice('smart_thermostat', 'setTemp', 22);
      
      expect(result.success).toBe(true);
      expect(result.device).toBe('smart_thermostat');
      expect(result.action).toBe('setTemp');
      expect(result.value).toBe(22);
    });

    test('控制不存在的设备应该抛出错误', async () => {
      await engine.initialize();
      
      await expect(
        engine.controlDevice('nonexistent_device', 'setTemp', 22)
      ).rejects.toThrow();
    });

    test('应该更新设备数据', async () => {
      await engine.initialize();
      await engine.controlDevice('smart_thermostat', 'setTemp', 22);
      
      const device = engine.devices.get('smart_thermostat');
      expect(device.data.setTemp).toBe(22);
    });

    test('应该记录控制时间', async () => {
      await engine.initialize();
      await engine.controlDevice('smart_thermostat', 'setTemp', 22);
      
      const device = engine.devices.get('smart_thermostat');
      expect(device.lastControl).toBeDefined();
    });
  });

  describe('场景执行', () => {
    test('应该成功执行场景', async () => {
      await engine.initialize();
      const result = await engine.executeScene('scene_home');
      
      expect(result.success).toBe(true);
      expect(result.scene).toBe('scene_home');
      expect(result.name).toBe('回家模式');
    });

    test('执行不存在的场景应该抛出错误', async () => {
      await engine.initialize();
      
      await expect(
        engine.executeScene('nonexistent_scene')
      ).rejects.toThrow();
    });

    test('场景执行应该返回执行结果', async () => {
      await engine.initialize();
      const result = await engine.executeScene('scene_home');
      
      expect(result.executed).toBeGreaterThan(0);
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });
  });

  describe('设备状态查询', () => {
    test('应该获取设备状态', async () => {
      await engine.initialize();
      const status = await engine.getDeviceStatus('smart_thermostat');
      
      expect(status).toBeDefined();
      expect(status.id).toBe('smart_thermostat');
      expect(status.name).toBeDefined();
      expect(status.type).toBeDefined();
    });

    test('查询不存在的设备应该返回null', async () => {
      await engine.initialize();
      const status = await engine.getDeviceStatus('nonexistent_device');
      
      expect(status).toBeNull();
    });
  });

  describe('系统状态', () => {
    test('应该返回系统状态', async () => {
      await engine.initialize();
      const status = engine.getSystemStatus();
      
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('deviceCount');
      expect(status).toHaveProperty('sceneCount');
      expect(status).toHaveProperty('automationCount');
      expect(status).toHaveProperty('onlineDevices');
      expect(status).toHaveProperty('timestamp');
    });

    test('系统状态应该反映初始化状态', async () => {
      await engine.initialize();
      const status = engine.getSystemStatus();
      
      expect(status.initialized).toBe(true);
      expect(status.deviceCount).toBeGreaterThan(0);
      expect(status.sceneCount).toBeGreaterThan(0);
    });

    test('在线设备数应该等于设备总数', async () => {
      await engine.initialize();
      const status = engine.getSystemStatus();
      
      expect(status.onlineDevices).toBe(status.deviceCount);
    });
  });

  describe('溢价报价', () => {
    test('应该生成溢价报价', async () => {
      const basePrice = 10000;
      const quote = engine.generatePremiumQuote(basePrice);
      
      expect(quote).toHaveProperty('basePrice');
      expect(quote).toHaveProperty('premiumRate');
      expect(quote).toHaveProperty('premiumPrice');
      expect(quote).toHaveProperty('features');
      expect(quote).toHaveProperty('value');
    });

    test('溢价率应该是15%', async () => {
      const basePrice = 10000;
      const quote = engine.generatePremiumQuote(basePrice);
      
      expect(quote.premiumRate).toBe(0.15);
    });

    test('溢价价格应该正确计算', async () => {
      const basePrice = 10000;
      const quote = engine.generatePremiumQuote(basePrice);
      
      expect(quote.premiumPrice).toBe(Math.round(basePrice * 1.15));
    });

    test('应该包含Econet功能列表', async () => {
      const basePrice = 10000;
      const quote = engine.generatePremiumQuote(basePrice);
      
      expect(quote.features).toContain('Econet智能控制系统');
      expect(quote.features).toContain('5大智能场景模式');
      expect(quote.features).toContain('手机APP远程控制');
    });
  });

  describe('自动化规则', () => {
    test('应该加载自动化规则', async () => {
      await engine.initialize();
      
      expect(engine.automations.size).toBeGreaterThan(0);
    });

    test('自动化规则应该包含触发条件和动作', async () => {
      await engine.initialize();
      const automation = engine.automations.values().next().value;
      
      expect(automation).toHaveProperty('id');
      expect(automation).toHaveProperty('name');
      expect(automation).toHaveProperty('trigger');
      expect(automation).toHaveProperty('actions');
    });
  });
});
