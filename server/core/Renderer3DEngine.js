/**
 * 3D可视化渲染引擎 - Three.js集成
 * 生成高质量3D渲染效果图，支持实时渲染和高清导出
 */

class Renderer3DEngine {
  constructor() {
    this.renderModes = {
      preview: { quality: 'standard', time: 10, samples: 4 },
      standard: { quality: 'high', time: 30, samples: 16 },
      hd: { quality: 'ultra', time: 120, samples: 64 }
    };
    
    this.defaultSettings = {
      cameraPosition: { x: 15, y: 12, z: 15 },
      targetPosition: { x: 0, y: 0, z: 0 },
      ambientLight: 0.6,
      sunLight: 1.0,
      shadows: true,
      reflections: true,
      background: 'gradient' // 'gradient', 'white', 'transparent'
    };

    // 材质库
    this.materials = {
      wall: { color: 0xF5F5F5, roughness: 0.9, metalness: 0 },
      floor: { color: 0xE8DCC4, roughness: 0.8, metalness: 0.1 },
      ceiling: { color: 0xFFFFFF, roughness: 1, metalness: 0 },
      glass: { color: 0x88CCFF, roughness: 0, metalness: 0.9, transparent: true, opacity: 0.3 },
      metal: { color: 0x888888, roughness: 0.3, metalness: 0.8 },
      plastic: { color: 0xFFFFFF, roughness: 0.5, metalness: 0 },
      wood: { color: 0x8B4513, roughness: 0.7, metalness: 0 },
      copper: { color: 0xB87333, roughness: 0.4, metalness: 0.9 }
    };

    // 设备3D模型库
    this.deviceModels = {
      outdoorUnit: {
        type: 'box',
        dimensions: { w: 0.95, h: 0.7, d: 0.38 },
        color: 0xFFFFFF,
        details: ['grille', 'logo', 'pipes']
      },
      indoorUnit: {
        type: 'box',
        dimensions: { w: 0.7, h: 0.25, d: 0.5 },
        color: 0xFFFFFF,
        details: ['vent', 'panel']
      },
      freshAirUnit: {
        type: 'box',
        dimensions: { w: 0.7, h: 0.45, d: 0.5 },
        color: 0xEEEEEE,
        details: ['inlet', 'outlet', 'filter']
      },
      waterPurifier: {
        type: 'cylinder',
        dimensions: { r: 0.15, h: 0.4 },
        color: 0xFFFFFF,
        details: ['tank', 'faucet']
      },
      hotWaterTank: {
        type: 'cylinder',
        dimensions: { r: 0.25, h: 1.0 },
        color: 0xFFFFFF,
        details: ['tank', 'controls']
      },
      heatingManifold: {
        type: 'box',
        dimensions: { w: 0.4, h: 0.6, d: 0.1 },
        color: 0xCCCCCC,
        details: ['valves', 'gauges']
      },
      diffuser: {
        type: 'box',
        dimensions: { w: 0.2, h: 0.02, d: 0.2 },
        color: 0xFFFFFF,
        details: ['grille']
      }
    };

    // 管路颜色
    this.pipeColors = {
      ac_liquid: 0x00AA00,
      ac_gas: 0xFF0000,
      ac_drain: 0xFFFFFF,
      fresh_supply: 0x0066FF,
      fresh_exhaust: 0x666666,
      water_hot: 0xFF6600,
      water_cold: 0x00CCFF,
      heating_supply: 0xFF0000,
      heating_return: 0x0000FF
    };
  }

  /**
   * 生成3D场景
   */
  generateScene(projectData, designData, options = {}) {
    const settings = { ...this.defaultSettings, ...options };
    
    const scene = {
      metadata: {
        project: projectData.name,
        version: '1.0',
        created: new Date().toISOString(),
        renderMode: options.mode || 'standard'
      },
      camera: this.setupCamera(settings),
      lights: this.setupLights(settings),
      environment: this.setupEnvironment(projectData, settings),
      objects: this.buildObjects(projectData, designData),
      pipes: this.buildPipes(designData.pipes),
      annotations: this.buildAnnotations(designData),
      settings: settings
    };

    return scene;
  }

  /**
   * 渲染场景（生成图片数据）
   */
  async renderScene(scene, mode = 'standard') {
    const config = this.renderModes[mode] || this.renderModes.standard;
    
    const renderResult = {
      metadata: {
        mode: mode,
        quality: config.quality,
        samples: config.samples,
        renderTime: config.time,
        dimensions: { width: 1920, height: 1080 },
        format: 'png'
      },
      // 模拟渲染输出
      imageData: this.generateMockRenderData(scene, config),
      views: this.generateViews(scene)
    };

    return renderResult;
  }

  /**
   * 生成多角度视图
   */
  generateViews(scene) {
    const views = [
      { name: '鸟瞰图', angle: 'bird', position: { x: 20, y: 25, z: 20 }, description: '全屋俯视角度' },
      { name: '客厅视角', angle: 'living', position: { x: 5, y: 1.6, z: 5 }, description: '客厅漫游视角' },
      { name: '主卧视角', angle: 'bedroom', position: { x: 8, y: 1.6, z: 3 }, description: '主卧漫游视角' },
      { name: '厨房视角', angle: 'kitchen', position: { x: 2, y: 1.6, z: 8 }, description: '厨房设备展示' },
      { name: '设备平台', angle: 'equipment', position: { x: 15, y: 2, z: 0 }, description: '室外设备展示' }
    ];

    return views.map(v => ({
      ...v,
      thumbnail: this.generateThumbnail(scene, v),
      fullSize: this.generateFullView(scene, v)
    }));
  }

  /**
   * 生成VR就绪场景
   */
  generateVRScene(scene) {
    return {
      format: 'WebXR',
      stereo: true,
      fov: 90,
      scenes: [
        { name: '入口', position: { x: 0, y: 1.7, z: 0 } },
        { name: '客厅', position: { x: 5, y: 1.7, z: 5 } },
        { name: '主卧', position: { x: 10, y: 1.7, z: 3 } }
      ],
      hotspots: this.generateHotspots(scene)
    };
  }

  /**
   * 生成AR场景数据
   */
  generateARScene(scene) {
    return {
      format: 'USDZ/GLB',
      anchor: 'floor',
      scale: 0.01, // 真实比例
      devices: scene.objects.filter(o => o.type === 'device').map(d => ({
        id: d.id,
        model: d.model,
        position: d.position,
        dimensions: d.dimensions,
        placement: d.placement || 'floor'
      }))
    };
  }

  /**
   * 设置相机
   */
  setupCamera(settings) {
    return {
      type: 'perspective',
      fov: 60,
      position: settings.cameraPosition,
      target: settings.targetPosition,
      up: { x: 0, y: 1, z: 0 },
      near: 0.1,
      far: 1000
    };
  }

  /**
   * 设置灯光
   */
  setupLights(settings) {
    return {
      ambient: {
        color: 0xFFFFFF,
        intensity: settings.ambientLight
      },
      sun: {
        type: 'directional',
        color: 0xFFFFFF,
        intensity: settings.sunLight,
        position: { x: 50, y: 100, z: 50 },
        castShadow: settings.shadows
      },
      fill: {
        type: 'point',
        color: 0xFFEEDD,
        intensity: 0.3,
        position: { x: 10, y: 8, z: 10 }
      }
    };
  }

  /**
   * 设置环境
   */
  setupEnvironment(project, settings) {
    const rooms = project.rooms || this.generateDefaultRooms(project.area);
    
    return {
      background: settings.background,
      rooms: rooms.map(r => ({
        id: r.id,
        name: r.name,
        bounds: {
          x: 0,
          y: 0,
          z: 0,
          width: (r.width || 4),
          height: (r.length || 5),
          ceilingHeight: 2.8
        },
        materials: {
          walls: this.materials.wall,
          floor: this.materials.floor,
          ceiling: this.materials.ceiling
        },
        openings: this.generateOpenings(r)
      })),
      grid: { size: 20, divisions: 20, color: 0xCCCCCC }
    };
  }

  /**
   * 构建3D对象
   */
  buildObjects(project, design) {
    const objects = [];

    // 添加设备
    if (design.devices) {
      design.devices.forEach((device, index) => {
        const model = this.getDeviceModel(device);
        objects.push({
          id: `device-${index}`,
          type: 'device',
          category: device.category,
          name: device.name,
          model: device.model,
          position: device.position || this.getDefaultPosition(device, index),
          rotation: device.rotation || { x: 0, y: 0, z: 0 },
          dimensions: model.dimensions,
          geometry: model.type,
          material: model.color,
          details: model.details,
          castShadow: true,
          receiveShadow: true
        });
      });
    }

    // 添加家具（简化的）
    objects.push(...this.generateFurniture(project.rooms));

    return objects;
  }

  /**
   * 构建管路
   */
  buildPipes(pipes) {
    if (!pipes) return [];

    return pipes.map((pipe, index) => ({
      id: `pipe-${index}`,
      type: 'pipe',
      system: pipe.type,
      color: this.pipeColors[pipe.type] || 0x888888,
      diameter: this.getPipeDiameter(pipe.spec),
      points: this.generatePipePoints(pipe),
      insulation: pipe.insulation,
      material: 'standard'
    }));
  }

  /**
   * 构建标注
   */
  buildAnnotations(design) {
    return {
      labels: design.devices?.map((d, i) => ({
        id: `label-${i}`,
        text: d.name,
        position: { x: d.position?.x || 0, y: (d.position?.y || 0) + 0.5, z: d.position?.z || 0 },
        size: 0.3,
        color: 0x000000
      })) || [],
      dimensions: [],
      notes: [
        '设备位置详见设备定位图',
        '管路走向详见各系统图',
        '安装方式详见节点详图'
      ]
    };
  }

  /**
   * 获取设备3D模型
   */
  getDeviceModel(device) {
    const category = device.category?.toLowerCase() || '';
    
    if (category.includes('室外')) {
      return this.deviceModels.outdoorUnit;
    } else if (category.includes('室内')) {
      return this.deviceModels.indoorUnit;
    } else if (category.includes('新风')) {
      return this.deviceModels.freshAirUnit;
    } else if (category.includes('净水')) {
      return this.deviceModels.waterPurifier;
    } else if (category.includes('热水')) {
      return this.deviceModels.hotWaterTank;
    } else if (category.includes('采暖')) {
      return this.deviceModels.heatingManifold;
    }
    
    return this.deviceModels.indoorUnit;
  }

  /**
   * 获取默认位置
   */
  getDefaultPosition(device, index) {
    const positions = [
      { x: 2, y: 2.5, z: 2 },   // 吊顶安装
      { x: 5, y: 2.5, z: 2 },   // 吊顶安装
      { x: 8, y: 2.5, z: 3 },   // 吊顶安装
      { x: 15, y: 0.5, z: 0 }   // 地面安装（室外机）
    ];
    return positions[index % positions.length];
  }

  /**
   * 生成家具
   */
  generateFurniture(rooms) {
    // 简化版，实际应加载家具模型库
    return [];
  }

  /**
   * 生成默认房间
   */
  generateDefaultRooms(area) {
    const count = Math.max(1, Math.floor(area / 30));
    const rooms = [];
    
    for (let i = 0; i < count; i++) {
      rooms.push({
        id: `room-${i}`,
        name: ['客厅', '主卧', '次卧', '书房'][i] || `房间${i+1}`,
        width: 4 + Math.random() * 2,
        length: 4 + Math.random() * 2
      });
    }
    
    return rooms;
  }

  /**
   * 生成门窗开口
   */
  generateOpenings(room) {
    return [
      { type: 'door', wall: 'bottom', position: 0.5, width: 0.9 },
      { type: 'window', wall: 'top', position: 0.3, width: 1.5 }
    ];
  }

  /**
   * 获取管径
   */
  getPipeDiameter(spec) {
    const diameters = {
      'Φ6.35mm': 0.006,
      'Φ9.52mm': 0.01,
      'Φ12.7mm': 0.013,
      'Φ15.88mm': 0.016,
      'Φ19.05mm': 0.019,
      'DN15': 0.02,
      'DN20': 0.025,
      'DN25': 0.032
    };
    return diameters[spec] || 0.02;
  }

  /**
   * 生成管路路径点
   */
  generatePipePoints(pipe) {
    // 简化版路径生成
    return [
      { x: 2, y: 2.5, z: 2 },
      { x: 5, y: 2.5, z: 2 },
      { x: 8, y: 2.5, z: 2 },
      { x: 15, y: 0.5, z: 0 }
    ];
  }

  /**
   * 生成热点
   */
  generateHotspots(scene) {
    const devices = scene.objects.filter(o => o.type === 'device');
    return devices.map((d, i) => ({
      id: `hotspot-${i}`,
      name: d.name,
      position: d.position,
      description: `${d.name} - ${d.model}`,
      info: '点击查看详情'
    }));
  }

  /**
   * 生成缩略图（模拟）
   */
  generateThumbnail(scene, view) {
    return {
      url: `thumb-${view.angle}.png`,
      width: 320,
      height: 180,
      size: '50KB'
    };
  }

  /**
   * 生成全尺寸视图（模拟）
   */
  generateFullView(scene, view) {
    return {
      url: `view-${view.angle}-1920x1080.png`,
      width: 1920,
      height: 1080,
      size: '2MB'
    };
  }

  /**
   * 生成模拟渲染数据
   */
  generateMockRenderData(scene, config) {
    return {
      format: 'base64',
      data: '[模拟PNG图像数据]',
      size: { width: 1920, height: 1080 },
      fileSize: `${Math.round(500 + config.samples * 10)}KB`,
      checksum: `render-${Date.now()}`
    };
  }
}

module.exports = Renderer3DEngine;
