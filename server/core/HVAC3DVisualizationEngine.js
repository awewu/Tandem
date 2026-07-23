/**
 * HVAC 3D可视化数据引擎 (Server-side)
 * 
 * 功能：
 * 1. 根据设计数据生成3D场景描述
 * 2. 生成Three.js兼容的3D模型数据
 * 3. 支持水路/采暖/空调系统的3D展示
 * 4. 生成JSON格式的3D场景数据
 * 
 * P0级功能 - 3D可视化展示
 */

class HVAC3DVisualizationEngine {
  constructor() {
    this.version = '1.0.0';
    this.name = 'HVAC3DVisualizationEngine';
  }

  /**
   * 主入口：生成完整3D可视化数据
   * @param {Object} designData - 设计数据 (来自三大引擎)
   * @returns {Object} 3D场景数据
   */
  generate3DVisualization(designData) {
    console.log('[HVAC3DVisualizationEngine] 生成3D可视化数据...');
    
    const { waterSystem, heatingSystem, airConditioning, houseType, area } = designData;
    
    // 生成场景基础
    const scene = this.createBaseScene(houseType, area);
    
    // 添加水路系统3D模型
    if (waterSystem) {
      scene.objects.push(...this.generateWaterSystem3D(waterSystem));
    }
    
    // 添加采暖系统3D模型
    if (heatingSystem) {
      scene.objects.push(...this.generateHeatingSystem3D(heatingSystem));
    }
    
    // 添加空调系统3D模型
    if (airConditioning) {
      scene.objects.push(...this.generateACSystem3D(airConditioning));
    }
    
    return {
      version: this.version,
      timestamp: new Date().toISOString(),
      scene,
      metadata: {
        totalObjects: scene.objects.length,
        houseType,
        area,
        systems: {
          water: !!waterSystem,
          heating: !!heatingSystem,
          ac: !!airConditioning
        }
      }
    };
  }

  /**
   * 创建基础场景
   */
  createBaseScene(houseType, area) {
    // 房间尺寸估算
    const roomDimensions = this.estimateRoomDimensions(houseType, area);
    
    return {
      type: 'Scene',
      background: '#f0f4f8',
      camera: {
        position: [roomDimensions.width * 1.5, roomDimensions.length * 1.5, roomDimensions.height * 2],
        target: [roomDimensions.width / 2, roomDimensions.length / 2, 0],
        fov: 45
      },
      lights: [
        {
          type: 'ambient',
          color: '#ffffff',
          intensity: 0.6
        },
        {
          type: 'directional',
          color: '#ffffff',
          intensity: 0.8,
          position: [10, 10, 10]
        }
      ],
      objects: [
        // 地板
        {
          id: 'floor',
          type: 'box',
          dimensions: [roomDimensions.width, roomDimensions.length, 0.1],
          position: [roomDimensions.width / 2, roomDimensions.length / 2, -0.05],
          color: '#e8e8e8',
          material: 'floor'
        },
        // 墙壁 - 左
        {
          id: 'wall-left',
          type: 'box',
          dimensions: [0.2, roomDimensions.length, roomDimensions.height],
          position: [0, roomDimensions.length / 2, roomDimensions.height / 2],
          color: '#f5f5f5',
          material: 'wall',
          transparent: true,
          opacity: 0.3
        },
        // 墙壁 - 右
        {
          id: 'wall-right',
          type: 'box',
          dimensions: [0.2, roomDimensions.length, roomDimensions.height],
          position: [roomDimensions.width, roomDimensions.length / 2, roomDimensions.height / 2],
          color: '#f5f5f5',
          material: 'wall',
          transparent: true,
          opacity: 0.3
        },
        // 墙壁 - 前
        {
          id: 'wall-front',
          type: 'box',
          dimensions: [roomDimensions.width, 0.2, roomDimensions.height],
          position: [roomDimensions.width / 2, 0, roomDimensions.height / 2],
          color: '#f5f5f5',
          material: 'wall',
          transparent: true,
          opacity: 0.3
        },
        // 墙壁 - 后
        {
          id: 'wall-back',
          type: 'box',
          dimensions: [roomDimensions.width, 0.2, roomDimensions.height],
          position: [roomDimensions.width / 2, roomDimensions.length, roomDimensions.height / 2],
          color: '#f5f5f5',
          material: 'wall',
          transparent: true,
          opacity: 0.3
        }
      ],
      roomDimensions
    };
  }

  /**
   * 估算房间尺寸
   */
  estimateRoomDimensions(houseType, area) {
    const configs = {
      '一居': { width: 6, length: 8, height: 2.8 },
      '二居': { width: 8, length: 10, height: 2.8 },
      '三居': { width: 10, length: 12, height: 2.8 },
      '四居': { width: 12, length: 14, height: 2.8 },
      '别墅': { width: 15, length: 18, height: 3 }
    };
    
    return configs[houseType] || { width: 10, length: 12, height: 2.8 };
  }

  /**
   * 生成水路系统3D模型
   */
  generateWaterSystem3D(waterSystem) {
    const objects = [];
    const { coldWater, hotWater, softWater, pureWater } = waterSystem.systems || {};
    
    // 入户总管
    if (coldWater && coldWater.mainPipe) {
      objects.push({
        id: 'water-main-pipe',
        type: 'cylinder',
        dimensions: { radius: coldWater.mainPipe.diameter / 1000, height: 0.5 },
        position: [0.5, 0.5, 2],
        color: '#4a90e2',
        material: 'pipe',
        label: '入户总管'
      });
    }
    
    // 热水器
    if (hotWater && hotWater.recommendedHeater) {
      objects.push({
        id: 'water-heater',
        type: 'cylinder',
        dimensions: { radius: 0.3, height: 1.2 },
        position: [1, 1, 1],
        color: '#C41230',
        material: 'device',
        label: hotWater.recommendedHeater.type,
        brand: 'rheem'
      });
    }
    
    // 软水机
    if (softWater && softWater.needed && softWater.recommendedSoftener) {
      objects.push({
        id: 'water-softener',
        type: 'box',
        dimensions: { width: 0.5, height: 0.8, depth: 0.4 },
        position: [2, 0.5, 0.5],
        color: '#3182ce',
        material: 'device',
        label: '软水机'
      });
    }
    
    // 净水机
    if (pureWater && pureWater.stages) {
      objects.push({
        id: 'water-purifier',
        type: 'box',
        dimensions: { width: 0.4, height: 0.6, depth: 0.3 },
        position: [0.5, 2, 0.8],
        color: '#C41230',
        material: 'device',
        label: '净水机'
      });
    }
    
    // 管路线路
    if (coldWater && coldWater.branchPipes) {
      coldWater.branchPipes.forEach((pipe, index) => {
        objects.push({
          id: `water-pipe-${index}`,
          type: 'cylinder',
          dimensions: { radius: pipe.diameter / 1000, height: 3 },
          position: [3 + index * 1.5, 0.5, 2.5],
          color: '#4a90e2',
          material: 'pipe',
          label: pipe.name,
          transparent: true,
          opacity: 0.8
        });
      });
    }
    
    return objects;
  }

  /**
   * 生成采暖系统3D模型
   */
  generateHeatingSystem3D(heatingSystem) {
    const objects = [];
    const { underfloor, radiator } = heatingSystem.systems || {};
    
    // 壁挂炉/锅炉
    if (heatingSystem.heatSource && heatingSystem.heatSource.type === '燃气壁挂炉') {
      objects.push({
        id: 'heating-boiler',
        type: 'box',
        dimensions: { width: 0.5, height: 0.9, depth: 0.35 },
        position: [8, 1, 1],
        color: '#C41230',
        material: 'device',
        label: '燃气壁挂炉',
        brand: 'rheem'
      });
    }
    
    // 分水器
    if (underfloor && underfloor.manifold) {
      objects.push({
        id: 'heating-manifold',
        type: 'box',
        dimensions: { width: 0.6, height: 0.4, depth: 0.2 },
        position: [7, 0.5, 0.5],
        color: '#d69e2e',
        material: 'device',
        label: `分水器 (${underfloor.manifold.loops}路)`
      });
    }
    
    // 地暖管路
    if (underfloor && underfloor.pipeLayout && underfloor.pipeLayout.circuits) {
      underfloor.pipeLayout.circuits.forEach((circuit, index) => {
        // 简化的地暖盘管表示
        objects.push({
          id: `underfloor-pipe-${index}`,
          type: 'torus',
          dimensions: { radius: 2 + index * 0.3, tube: 0.008 },
          position: [5, 5 + index * 2, 0.02],
          color: '#ed8936',
          material: 'pipe',
          label: `${circuit.room} 地暖`,
          rotation: [90, 0, 0]
        });
      });
    }
    
    // 暖气片
    if (radiator && radiator.radiators) {
      radiator.radiators.forEach((rad, index) => {
        objects.push({
          id: `radiator-${index}`,
          type: 'box',
          dimensions: { 
            width: 0.1, 
            height: parseInt(rad.height) / 1000 || 0.6, 
            depth: rad.sections * 0.08 
          },
          position: [0.2, 2 + index * 2, 1],
          color: '#e2e8f0',
          material: 'radiator',
          label: `${rad.room} 暖气片`
        });
      });
    }
    
    return objects;
  }

  /**
   * 生成空调系统3D模型
   */
  generateACSystem3D(acSystem) {
    const objects = [];
    
    if (!acSystem.acSystem) return objects;
    
    const { type, indoorUnits, outdoorUnit } = acSystem.acSystem;
    
    // 室外机
    if (outdoorUnit) {
      objects.push({
        id: 'ac-outdoor-unit',
        type: 'box',
        dimensions: { width: 1.2, height: 0.8, depth: 0.5 },
        position: [11, 1, 1],
        color: '#E4002B',
        material: 'device',
        label: `${outdoorUnit.hp} 室外机`,
        brand: 'ruud'
      });
    }
    
    // 室内机
    if (indoorUnits && indoorUnits.length > 0) {
      indoorUnits.forEach((unit, index) => {
        const isDucted = unit.type && unit.type.includes('风管');
        
        objects.push({
          id: `ac-indoor-${index}`,
          type: isDucted ? 'box' : 'cylinder',
          dimensions: isDucted 
            ? { width: 1, height: 0.3, depth: 0.6 }
            : { radius: 0.15, height: 0.8 },
          position: [2 + index * 3, 2 + index * 2, 2.5],
          color: '#ffffff',
          material: 'device',
          label: `${unit.room} ${unit.capacity}`,
          brand: 'ruud'
        });
        
        // 冷媒管
        objects.push({
          id: `ac-refrigerant-pipe-${index}`,
          type: 'cylinder',
          dimensions: { radius: 0.006, height: 3 },
          position: [2 + index * 3, 0.5, 2.5],
          color: '#c0c0c0',
          material: 'pipe',
          label: '冷媒管'
        });
      });
    }
    
    // 新风系统
    if (acSystem.freshAir && acSystem.freshAir.units) {
      acSystem.freshAir.units.forEach((unit, index) => {
        objects.push({
          id: `fresh-air-unit-${index}`,
          type: 'box',
          dimensions: { width: 0.6, height: 0.4, depth: 0.5 },
          position: [9, 2 + index * 2, 2.5],
          color: '#48bb78',
          material: 'device',
          label: `新风 ${unit.capacity}`
        });
      });
    }
    
    return objects;
  }

  /**
   * 生成场景预览缩略图数据 (用于前端渲染)
   */
  generatePreviewData(designData) {
    const visualization = this.generate3DVisualization(designData);
    
    return {
      type: 'preview',
      scene: visualization.scene,
      camera: {
        position: visualization.scene.camera.position,
        target: visualization.scene.camera.target
      },
      objects: visualization.scene.objects.map(obj => ({
        id: obj.id,
        type: obj.type,
        label: obj.label,
        color: obj.color,
        position: obj.position
      }))
    };
  }

  /**
   * 健康检查
   */
  healthCheck() {
    return {
      status: 'ok',
      version: this.version,
      name: this.name,
      timestamp: new Date().toISOString()
    };
  }
}

// 导出
module.exports = { HVAC3DVisualizationEngine };
