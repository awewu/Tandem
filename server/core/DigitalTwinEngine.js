/**
 * 瑞美数字孪生引擎 v1.0 - DigitalTwinEngine
 * 核心功能: 3D可视化、实时映射、远程操控
 */

class DigitalTwinEngine {
  constructor(config = {}) {
    this.version = '1.0.0';
    this.scenes = new Map();
    this.devices = new Map();
    this.cameras = new Map();
    this.updateInterval = null;
    this.initialized = false;
  }

  /**
   * 初始化数字孪生引擎
   */
  async initialize() {
    console.log('[DigitalTwin] 初始化数字孪生引擎...');
    await this.load3DEngine();
    this.startRealTimeSync();
    this.initialized = true;
    console.log('[DigitalTwin] 引擎初始化完成');
    return true;
  }

  /**
   * 1. 创建3D场景
   */
  createScene(projectData) {
    const { projectId, houseType, area, layout, systems } = projectData;
    
    const scene = {
      id: `scene_${projectId}`,
      projectId,
      houseType,
      area,
      layout: this.parseLayout(layout),
      systems: systems || [],
      devices: new Map(),
      pipes: [],
      cameras: [],
      createdAt: new Date().toISOString(),
      lastUpdate: new Date().toISOString()
    };

    // 生成设备3D模型
    systems.forEach(system => {
      system.devices.forEach(device => {
        const device3D = this.createDevice3D(device);
        scene.devices.set(device.id, device3D);
      });
    });

    // 生成管路3D模型
    scene.pipes = this.generatePipes3D(systems);

    this.scenes.set(projectId, scene);

    console.log(`[DigitalTwin] 创建3D场景: ${projectId}`);
    
    return {
      success: true,
      sceneId: scene.id,
      deviceCount: scene.devices.size,
      pipeCount: scene.pipes.length,
      viewUrl: `/api/twin/scenes/${projectId}/view`
    };
  }

  /**
   * 2. 实时数据同步
   */
  syncRealTimeData(projectId, deviceData) {
    const scene = this.scenes.get(projectId);
    if (!scene) {
      throw new Error(`场景 ${projectId} 不存在`);
    }

    const { deviceId, temperature, pressure, flow, status, power } = deviceData;
    
    const device = scene.devices.get(deviceId);
    if (device) {
      // 更新设备状态
      device.data = {
        temperature,
        pressure,
        flow,
        status,
        power,
        lastUpdate: new Date().toISOString()
      };

      // 更新3D模型状态
      device.model.status = status;
      device.model.temperature = temperature;
      
      scene.lastUpdate = new Date().toISOString();

      // 触发数据更新事件
      this.onDataUpdate(projectId, deviceId, device.data);
    }

    return {
      success: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 3. 摄像头接入 (工地直播)
   */
  connectCamera(projectId, cameraConfig) {
    const { cameraId, streamUrl, position } = cameraConfig;
    
    const camera = {
      id: cameraId,
      projectId,
      streamUrl,
      position,
      status: 'connected',
      connectedAt: new Date().toISOString()
    };

    this.cameras.set(cameraId, camera);

    const scene = this.scenes.get(projectId);
    if (scene) {
      scene.cameras.push(camera);
    }

    console.log(`[DigitalTwin] 摄像头接入: ${cameraId}`);

    return {
      success: true,
      cameraId,
      liveUrl: `/api/twin/cameras/${cameraId}/live`,
      embedUrl: `/api/twin/cameras/${cameraId}/embed`
    };
  }

  /**
   * 4. AI图像识别 (工地监控)
   */
  analyzeCameraImage(cameraId, imageData) {
    const camera = this.cameras.get(cameraId);
    if (!camera) {
      throw new Error(`摄像头 ${cameraId} 不存在`);
    }

    // 模拟AI分析
    const analysis = {
      timestamp: new Date().toISOString(),
      cameraId,
      detections: []
    };

    // 检测人员
    const personCount = Math.floor(Math.random() * 5);
    if (personCount > 0) {
      analysis.detections.push({
        type: 'person',
        count: personCount,
        confidence: 0.85,
        bbox: [[100, 100], [200, 300]]
      });
    }

    // 检测安全帽
    if (Math.random() > 0.7) {
      analysis.detections.push({
        type: 'safety_violation',
        violation: 'no_helmet',
        severity: 'medium',
        confidence: 0.78,
        message: '检测到人员未佩戴安全帽'
      });
    }

    // 检测进度
    analysis.progress = {
      stage: '管道安装',
      completion: 65,
      estimatedFinish: '3天后'
    };

    return analysis;
  }

  /**
   * 5. 远程操控
   */
  remoteControl(projectId, deviceId, command) {
    const scene = this.scenes.get(projectId);
    if (!scene) {
      throw new Error(`场景 ${projectId} 不存在`);
    }

    const device = scene.devices.get(deviceId);
    if (!device) {
      throw new Error(`设备 ${deviceId} 不存在`);
    }

    console.log(`[DigitalTwin] 远程操控: ${deviceId}`, command);

    // 模拟设备响应
    setTimeout(() => {
      device.data.status = command.action === 'turn_on' ? 'running' : 'stopped';
      device.data.lastUpdate = new Date().toISOString();
    }, 100);

    return {
      success: true,
      deviceId,
      command,
      executedAt: new Date().toISOString(),
      estimatedEffect: '2秒内生效'
    };
  }

  /**
   * 6. 获取场景视图数据
   */
  getSceneView(projectId, options = {}) {
    const scene = this.scenes.get(projectId);
    if (!scene) {
      throw new Error(`场景 ${projectId} 不存在`);
    }

    const { includeDevices = true, includePipes = true, includeCameras = true } = options;

    const viewData = {
      projectId: scene.projectId,
      houseType: scene.houseType,
      area: scene.area,
      layout: scene.layout,
      lastUpdate: scene.lastUpdate,
      statistics: {
        deviceCount: scene.devices.size,
        onlineCount: this.countOnlineDevices(scene),
        alarmCount: this.countAlarms(scene)
      }
    };

    if (includeDevices) {
      viewData.devices = Array.from(scene.devices.values()).map(d => ({
        id: d.id,
        type: d.type,
        position: d.position,
        status: d.data.status,
        temperature: d.data.temperature,
        lastUpdate: d.data.lastUpdate
      }));
    }

    if (includePipes) {
      viewData.pipes = scene.pipes;
    }

    if (includeCameras) {
      viewData.cameras = scene.cameras.map(c => ({
        id: c.id,
        status: c.status,
        liveUrl: c.streamUrl
      }));
    }

    return viewData;
  }

  /**
   * 7. BIM模型转换
   */
  convertBIMToScene(bimData) {
    const { ifcData, projectInfo } = bimData;
    
    console.log('[DigitalTwin] 转换BIM模型...');

    // 提取BIM信息
    const scene = {
      id: `bim_${Date.now()}`,
      source: 'BIM',
      projectInfo,
      elements: this.parseBIMElements(ifcData),
      convertedAt: new Date().toISOString()
    };

    return {
      success: true,
      sceneId: scene.id,
      elementCount: scene.elements.length,
      conversionQuality: 'high',
      scene
    };
  }

  /**
   * 8. 能耗仿真
   */
  simulateEnergyConsumption(projectId, config) {
    const { duration = 24, interval = 1 } = config; // 小时
    
    const simulation = {
      projectId,
      duration: `${duration}小时`,
      interval: `${interval}小时`,
      results: []
    };

    // 生成仿真数据
    for (let i = 0; i < duration; i += interval) {
      const hour = i;
      const outdoorTemp = 20 + Math.sin((hour - 6) * Math.PI / 12) * 10; // 温度曲线
      const load = hour >= 8 && hour <= 22 ? 80 : 30; // 负载曲线
      
      simulation.results.push({
        hour,
        outdoorTemp: outdoorTemp.toFixed(1),
        energyConsumption: (load * 0.5).toFixed(2),
        cost: (load * 0.5 * 0.6).toFixed(2),
        sourceMix: {
          heatpump: 60,
          gas: 30,
          electric: 10
        }
      });
    }

    // 计算总计
    const totalConsumption = simulation.results.reduce((sum, r) => sum + parseFloat(r.energyConsumption), 0);
    const totalCost = simulation.results.reduce((sum, r) => sum + parseFloat(r.cost), 0);

    return {
      ...simulation,
      totalConsumption: totalConsumption.toFixed(2),
      totalCost: totalCost.toFixed(2),
      averageHourlyCost: (totalCost / duration).toFixed(2)
    };
  }

  // 内部方法
  parseLayout(layout) {
    // 解析户型数据
    return {
      rooms: layout.rooms || [],
      dimensions: layout.dimensions || { width: 10, depth: 8, height: 2.8 },
      orientation: layout.orientation || 'south'
    };
  }

  createDevice3D(device) {
    return {
      id: device.id,
      type: device.type,
      name: device.name,
      position: device.position || { x: 0, y: 0, z: 0 },
      rotation: device.rotation || { x: 0, y: 0, z: 0 },
      scale: device.scale || { x: 1, y: 1, z: 1 },
      model: {
        url: `/models/${device.type}.glb`,
        status: 'idle',
        animations: []
      },
      data: {
        status: 'offline',
        temperature: null,
        pressure: null,
        flow: null,
        lastUpdate: null
      }
    };
  }

  generatePipes3D(systems) {
    const pipes = [];
    
    systems.forEach(system => {
      if (system.pipes) {
        system.pipes.forEach(pipe => {
          pipes.push({
            id: pipe.id,
            type: pipe.type, // 'hot_water', 'cold_water', 'refrigerant'
            diameter: pipe.diameter,
            start: pipe.startPosition,
            end: pipe.endPosition,
            path: this.calculatePipePath(pipe),
            insulation: pipe.insulation || false,
            flow: 0,
            temperature: null
          });
        });
      }
    });

    return pipes;
  }

  calculatePipePath(pipe) {
    // 简化路径计算
    return [
      pipe.startPosition,
      { x: (pipe.startPosition.x + pipe.endPosition.x) / 2, y: pipe.startPosition.y, z: pipe.startPosition.z },
      pipe.endPosition
    ];
  }

  onDataUpdate(projectId, deviceId, data) {
    // 触发数据更新回调
    console.log(`[DigitalTwin] 数据更新: ${projectId}/${deviceId}`, data);
  }

  countOnlineDevices(scene) {
    let count = 0;
    scene.devices.forEach(device => {
      if (device.data.status === 'running') count++;
    });
    return count;
  }

  countAlarms(scene) {
    let count = 0;
    scene.devices.forEach(device => {
      if (device.data.temperature > 80) count++;
    });
    return count;
  }

  parseBIMElements(ifcData) {
    // 简化BIM解析
    return [
      { type: 'wall', count: 10 },
      { type: 'window', count: 6 },
      { type: 'door', count: 4 },
      { type: 'equipment', count: 8 }
    ];
  }

  async load3DEngine() {
    console.log('[DigitalTwin] 加载3D引擎...');
    return new Promise(resolve => setTimeout(resolve, 100));
  }

  startRealTimeSync() {
    this.updateInterval = setInterval(() => {
      // 定期同步数据
      this.scenes.forEach((scene, projectId) => {
        // 检查设备超时
        scene.devices.forEach(device => {
          if (device.data.lastUpdate) {
            const lastUpdate = new Date(device.data.lastUpdate);
            const now = new Date();
            if (now - lastUpdate > 60000) { // 1分钟无更新
              device.data.status = 'offline';
            }
          }
        });
      });
    }, 5000);
  }
}

module.exports = DigitalTwinEngine;
