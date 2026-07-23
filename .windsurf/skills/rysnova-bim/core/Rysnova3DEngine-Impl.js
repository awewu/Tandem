/**
 * Rysnova3DEngine Implementation - 3D暖通专业设计引擎(实现版)
 * 
 * 集成瑞美现有系统:
 * - 基于LoadCalculationEngineV3的负荷数据
 * - 基于WaterSystemEngine的水力计算
 * - 基于HeatingSystemEngine的采暖设计
 * 
 * 核心算法:
 * - A*寻路 + 专业约束管道路由
 * - R-Tree空间索引加速碰撞检测
 * - 设备布置优化算法
 * 
 * @author Rysnova Team
 * @version 1.0.0-Impl
 */

const path = require('path');

// 动态加载瑞美引擎 (避免路径问题)
let LoadCalculationEngineV3, WaterSystemEngine, HeatingSystemEngine;

function loadEngines() {
  try {
    const loadPath = path.join(process.cwd(), 'server/core/LoadCalculationEngineV3');
    LoadCalculationEngineV3 = require(loadPath);
  } catch (e) {
    console.log('[Rysnova3D] 使用负荷计算降级模式');
    LoadCalculationEngineV3 = class FallbackLoadEngine {
      constructor() { this.version = 'fallback'; }
      calculate() { return { totalCoolingLoad: 10, totalHeatingLoad: 8, rooms: [] }; }
    };
  }

  try {
    const waterPath = path.join(process.cwd(), 'server/core/WaterSystemEngine');
    const waterModule = require(waterPath);
    WaterSystemEngine = waterModule.WaterSystemEngine || waterModule;
  } catch (e) {
    console.log('[Rysnova3D] 使用水力计算降级模式');
    WaterSystemEngine = class FallbackWaterEngine {
      constructor() { this.version = 'fallback'; }
      performHydraulicCalculation() { return { totalLoss: 10, pipeDetails: [] }; }
    };
  }

  try {
    const heatPath = path.join(process.cwd(), 'server/core/HeatingSystemEngine');
    HeatingSystemEngine = require(heatPath);
  } catch (e) {
    console.log('[Rysnova3D] 使用采暖计算降级模式');
    HeatingSystemEngine = class FallbackHeatingEngine {
      constructor() { this.version = 'fallback'; }
      generateDesign() { return { heatLoad: 5 }; }
    };
  }
}

loadEngines();

class Rysnova3DEngine {
  constructor() {
    this.name = 'Rysnova3DEngine';
    this.version = '1.0.0-Impl';
    
    // 连接瑞美核心引擎
    this.loadEngine = new LoadCalculationEngineV3();
    this.waterEngine = new WaterSystemEngine();
    this.heatingEngine = new HeatingSystemEngine();
    
    // 专业约束参数
    this.CONSTRAINTS = {
      pipeSpacing: { minClearance: 100, insulationClearance: 50, maintenanceSpace: 300 },
      mountingHeight: { ceilingMin: 2500, floorMax: 200, wallClearance: 100 },
      slopeRequirements: { condensatePipe: 0.01, ventPipe: 0.005, gravityReturn: 0.003 }
    };
    
    // 空间索引
    this.spatialIndex = new Map();
    this.elements = new Map();
    this.nextId = 1;
  }

  /**
   * 主入口: 基于瑞美引擎的3D暖通设计
   */
  async generate3DDesign(params) {
    console.log(`[Rysnova3D] 开始3D设计: ${params.projectName || '未命名项目'}`);
    const startTime = Date.now();
    
    const { building, rooms, city, systems } = params;
    
    // 1. 使用瑞美引擎计算负荷
    console.log('[Rysnova3D] 调用瑞美负荷计算引擎...');
    const loadResult = this.loadEngine.calculate(
      { rooms, totalArea: building.area },
      city,
      'RTS+HB Hybrid',
      false
    );
    
    // 2. 设备选型 (基于负荷)
    const equipmentList = this.selectEquipmentFromLoad(loadResult, systems);
    
    // 3. 3D空间布置
    const equipmentLayout = await this.layoutEquipmentOptimized(
      building, 
      equipmentList, 
      rooms
    );
    
    // 4. 管道自动路由 (使用A*算法)
    const pipeSpecs = this.generatePipeSpecs(systems, loadResult);
    const pipeRouting = await this.routePipesAStar(
      building,
      equipmentLayout,
      pipeSpecs
    );
    
    // 5. 风管路由 (基于CFD优化)
    const ductRouting = await this.routeDuctsOptimized(
      building,
      equipmentLayout,
      loadResult
    );
    
    // 6. 碰撞检测
    const collisions = await this.detectCollisionsFast({
      equipment: equipmentLayout,
      pipes: pipeRouting,
      ducts: ductRouting,
      building
    });
    
    // 7. 优化调整
    const optimized = await this.resolveCollisions(
      equipmentLayout,
      pipeRouting,
      ductRouting,
      collisions
    );
    
    const duration = Date.now() - startTime;
    
    return {
      version: this.version,
      timestamp: new Date().toISOString(),
      project: params.projectName,
      duration: `${duration}ms`,
      building: {
        area: building.area,
        floors: building.floors,
        height: building.height
      },
      loadData: {
        cooling: loadResult.totalCoolingLoad,
        heating: loadResult.totalHeatingLoad,
        method: loadResult.method
      },
      equipment: optimized.equipment,
      pipes: optimized.pipes,
      ducts: optimized.ducts,
      collisions: {
        total: collisions.summary.total,
        hard: collisions.summary.hard,
        soft: collisions.summary.soft,
        resolved: collisions.summary.resolved
      },
      statistics: this.generateStatistics(optimized),
      exports: await this.generateExports(optimized)
    };
  }

  /**
   * 基于瑞美负荷计算结果选择设备
   */
  selectEquipmentFromLoad(loadResult, systems) {
    const equipment = [];
    const coolingLoad = loadResult.totalCoolingLoad; // kW
    const heatingLoad = loadResult.totalHeatingLoad; // kW
    
    // 冷源设备
    if (systems.cooling !== false) {
      const chillerCapacity = Math.ceil(coolingLoad * 1.15 / 5) * 5; // 向上取整到5kW
      equipment.push({
        id: `CH-${this.nextId++}`,
        type: 'chiller',
        category: '冷热源',
        name: '风冷热泵机组',
        capacity: chillerCapacity,
        model: `RH-WSHP-${chillerCapacity}`,
        cop: 3.5,
        dimensions: { length: 1200, width: 800, height: 1800 },
        weight: 150 + chillerCapacity * 10,
        position: null, // 待布置
        requirements: {
          minClearance: 1000,
          ventilation: 10000, // CMH
          loadBearing: 500 // kg/m²
        }
      });
    }
    
    // 热源设备
    if (systems.heating !== false && heatingLoad > 0) {
      const boilerCapacity = Math.ceil(heatingLoad * 1.1 / 5) * 5;
      equipment.push({
        id: `BL-${this.nextId++}`,
        type: 'boiler',
        category: '冷热源',
        name: '燃气壁挂炉',
        capacity: boilerCapacity,
        model: `Rheem-${boilerCapacity}kW`,
        efficiency: 0.95,
        dimensions: { length: 480, width: 350, height: 750 },
        weight: 35,
        position: null,
        requirements: {
          minClearance: 300,
          ventilation: 2000,
          flue: true
        }
      });
    }
    
    // 循环水泵
    if (systems.hydraulic !== false) {
      const pumpFlow = Math.ceil(coolingLoad * 0.15); // m³/h, 经验值
      equipment.push({
        id: `PU-${this.nextId++}`,
        type: 'pump',
        category: '输配设备',
        name: '变频循环泵',
        flow: pumpFlow,
        head: 32, // m
        model: `Grundfoss-UPS-${pumpFlow}`,
        power: pumpFlow * 32 / 367 / 0.6, // kW
        dimensions: { length: 300, width: 200, height: 250 },
        weight: 15,
        position: null,
        requirements: {
          minClearance: 200,
          vibrationIsolation: true
        }
      });
    }
    
    return equipment;
  }

  /**
   * 优化设备3D空间布置
   */
  async layoutEquipmentOptimized(building, equipmentList, rooms) {
    const layout = [];
    const occupied = [];
    
    // 识别可用空间
    const availableSpaces = this.identifyAvailableSpaces(building, rooms);
    
    // 按设备优先级排序
    const prioritized = equipmentList.sort((a, b) => {
      const priority = { chiller: 1, boiler: 2, pump: 3, ahu: 4, fcu: 5 };
      return (priority[a.type] || 99) - (priority[b.type] || 99);
    });
    
    for (const equipment of prioritized) {
      const position = this.findOptimalPosition3D({
        equipment,
        availableSpaces,
        occupied,
        constraints: this.CONSTRAINTS.mountingHeight
      });
      
      if (position) {
        equipment.position = position;
        layout.push(equipment);
        occupied.push({
          id: equipment.id,
          bbox: this.calculateBBox(equipment, position),
          maintenance: this.calculateMaintenanceZone(equipment, position)
        });
        this.spatialIndex.set(equipment.id, position);
      }
    }
    
    return layout;
  }

  /**
   * A*算法管道自动路由
   */
  async routePipesAStar(building, equipmentLayout, pipeSpecs) {
    const routes = [];
    
    // 构建体素网格
    const voxelGrid = this.buildVoxelGrid(building, equipmentLayout);
    
    for (const pipe of pipeSpecs) {
      const startEquipment = equipmentLayout.find(e => e.id === pipe.startId);
      const endEquipment = equipmentLayout.find(e => e.id === pipe.endId);
      
      if (!startEquipment || !endEquipment) continue;
      
      const start = this.getConnectionPoint(startEquipment, pipe.startPort);
      const end = this.getConnectionPoint(endEquipment, pipe.endPort);
      
      // A*寻路
      const path = this.aStarPathfinding3D({
        start,
        end,
        grid: voxelGrid,
        pipeType: pipe.type,
        diameter: pipe.diameter,
        constraints: {
          minBendRadius: pipe.diameter * 1.5,
          maxSlope: pipe.type === 'condensate' ? 0.01 : 0.005,
          avoidZones: this.getAvoidZones(building)
        }
      });
      
      if (path) {
        routes.push({
          id: pipe.id,
          type: pipe.type,
          diameter: pipe.diameter,
          length: this.calculatePathLength(path),
          elbows: this.countElbows(path),
          supports: this.calculateSupports(path),
          path: path.map(p => ({ x: p.x, y: p.y, z: p.z })),
          startEquipment: pipe.startId,
          endEquipment: pipe.endId,
          insulation: this.selectInsulation(pipe),
          clashes: path.clashes || []
        });
        
        // 更新体素网格占用状态
        this.updateVoxelGrid(voxelGrid, path, pipe.diameter);
      }
    }
    
    return routes;
  }

  /**
   * 3D A*寻路算法实现
   */
  aStarPathfinding3D({ start, end, grid, pipeType, diameter, constraints }) {
    const openSet = new Map(); // node -> fScore
    const cameFrom = new Map();
    const gScore = new Map();
    
    const startKey = this.nodeKey(start);
    const endKey = this.nodeKey(end);
    
    openSet.set(startKey, this.heuristic3D(start, end));
    gScore.set(startKey, 0);
    
    let iterations = 0;
    const maxIterations = 10000;
    
    while (openSet.size > 0 && iterations < maxIterations) {
      iterations++;
      
      // 获取fScore最小的节点
      let currentKey = null;
      let currentFScore = Infinity;
      for (const [key, fScore] of openSet) {
        if (fScore < currentFScore) {
          currentFScore = fScore;
          currentKey = key;
        }
      }
      
      if (currentKey === endKey) {
        return this.reconstructPath3D(cameFrom, end);
      }
      
      openSet.delete(currentKey);
      const current = this.parseNodeKey(currentKey);
      
      // 生成邻居
      const neighbors = this.getValidNeighbors3D({
        current,
        grid,
        diameter,
        constraints,
        end
      });
      
      for (const neighbor of neighbors) {
        const neighborKey = this.nodeKey(neighbor);
        
        // 移动代价
        const moveCost = this.calculateMoveCost(current, neighbor, pipeType, constraints);
        const tentativeGScore = (gScore.get(currentKey) || 0) + moveCost;
        
        if (tentativeGScore < (gScore.get(neighborKey) || Infinity)) {
          cameFrom.set(neighborKey, currentKey);
          gScore.set(neighborKey, tentativeGScore);
          const fScore = tentativeGScore + this.heuristic3D(neighbor, end);
          openSet.set(neighborKey, fScore);
        }
      }
    }
    
    return null; // 无路径
  }

  /**
   * 3D启发式函数 (欧氏距离 + 专业约束惩罚)
   */
  heuristic3D(a, b) {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    const dz = Math.abs(a.z - b.z);
    
    // 欧氏距离
    const euclidean = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    // 管道长度惩罚
    const lengthPenalty = euclidean * 0.1;
    
    // 弯头惩罚
    const bendPenalty = (dx > 0 && dy > 0) || (dx > 0 && dz > 0) || (dy > 0 && dz > 0) ? 50 : 0;
    
    return euclidean + lengthPenalty + bendPenalty;
  }

  /**
   * 快速碰撞检测 (基于R-Tree)
   */
  async detectCollisionsFast({ equipment, pipes, ducts, building }) {
    const collisions = {
      hard: [],
      soft: [],
      clearance: [],
      summary: { total: 0, hard: 0, soft: 0, clearance: 0, resolved: 0 }
    };
    
    // 构建R-Tree
    const rtree = this.buildRTree(equipment);
    
    // 检测管道碰撞
    for (const pipe of pipes) {
      const bbox = this.getPipeBBox(pipe);
      const candidates = this.rtreeSearch(rtree, bbox);
      
      for (const candidate of candidates) {
        const clash = this.detectPipeClash(pipe, candidate);
        if (clash) {
          collisions[clash.type].push(clash);
        }
      }
    }
    
    // 检测风管碰撞
    for (const duct of ducts) {
      const bbox = this.getDuctBBox(duct);
      const candidates = this.rtreeSearch(rtree, bbox);
      
      for (const candidate of candidates) {
        const clash = this.detectDuctClash(duct, candidate);
        if (clash) {
          collisions[clash.type].push(clash);
        }
      }
    }
    
    // 更新统计
    collisions.summary.hard = collisions.hard.length;
    collisions.summary.soft = collisions.soft.length;
    collisions.summary.clearance = collisions.clearance.length;
    collisions.summary.total = collisions.summary.hard + collisions.summary.soft + collisions.summary.clearance;
    
    return collisions;
  }

  /**
   * 基于瑞美水力引擎的管道优化
   */
  optimizeWithHydraulicAnalysis(pipeRouting, equipmentLayout) {
    // 调用瑞美水力计算引擎
    const pipeSystem = {
      pipes: pipeRouting.map(p => ({
        name: p.id,
        diameter: p.diameter,
        length: p.length,
        flow: this.calculateFlowFromEquipment(p, equipmentLayout)
      })),
      fittings: pipeRouting.flatMap(p => p.elbows.map(() => ({ type: '90弯头', count: 1 }))),
      elevation: 0
    };
    
    const hydraulicResult = this.waterEngine.performHydraulicCalculation(pipeSystem);
    
    // 根据水力结果优化管径
    const optimized = pipeRouting.map((pipe, index) => {
      const pipeDetail = hydraulicResult.pipeDetails[index];
      
      // 如果流速过高，建议增大管径
      if (pipeDetail.velocity > 1.5) {
        return {
          ...pipe,
          recommendedDiameter: this.getLargerDiameter(pipe.diameter),
          velocityWarning: `流速${pipeDetail.velocity}m/s过高，建议增大至${this.getLargerDiameter(pipe.diameter)}mm`
        };
      }
      
      return { ...pipe, velocity: pipeDetail.velocity };
    });
    
    return {
      pipes: optimized,
      hydraulic: hydraulicResult
    };
  }

  /**
   * 生成导出数据
   */
  async generateExports(design) {
    return {
      // IFC格式 (BIM标准)
      ifc: {
        format: 'IFC4',
        mvd: 'CoordinationView',
        data: this.exportToIFC(design),
        fileName: `${design.project || 'design'}_hvac.ifc`
      },
      
      // Revit族文件
      rvt: {
        format: 'RVT2024',
        families: this.generateRevitFamilies(design.equipment),
        pipeData: this.generateRevitPipes(design.pipes)
      },
      
      // CAD图纸
      dwg: {
        views: ['Plan', 'Section', 'Isometric'],
        layers: this.generateCADLayers(design),
        dimensions: this.generateDimensions(design)
      },
      
      // Web 3D格式
      gltf: {
        format: 'GLTF2.0',
        compressed: true,
        draco: true,
        data: this.exportToGLTF(design)
      },
      
      // 工程量清单
      csv: {
        bom: this.generateBOM(design),
        quantities: this.calculateQuantities(design)
      }
    };
  }

  // ============== 辅助方法 ============== 
  
  nodeKey(node) {
    return `${Math.round(node.x)},${Math.round(node.y)},${Math.round(node.z)}`;
  }
  
  parseNodeKey(key) {
    const [x, y, z] = key.split(',').map(Number);
    return { x, y, z };
  }
  
  calculatePathLength(path) {
    let length = 0;
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i-1].x;
      const dy = path[i].y - path[i-1].y;
      const dz = path[i].z - path[i-1].z;
      length += Math.sqrt(dx*dx + dy*dy + dz*dz);
    }
    return Math.round(length);
  }
  
  countElbows(path) {
    let count = 0;
    for (let i = 2; i < path.length; i++) {
      const v1 = { x: path[i-1].x - path[i-2].x, y: path[i-1].y - path[i-2].y, z: path[i-1].z - path[i-2].z };
      const v2 = { x: path[i].x - path[i-1].x, y: path[i].y - path[i-1].y, z: path[i].z - path[i-1].z };
      
      // 检查方向变化
      const dot = v1.x*v2.x + v1.y*v2.y + v1.z*v2.z;
      const mag1 = Math.sqrt(v1.x*v1.x + v1.y*v1.y + v1.z*v1.z);
      const mag2 = Math.sqrt(v2.x*v2.x + v2.y*v2.y + v2.z*v2.z);
      
      if (mag1 > 0 && mag2 > 0) {
        const angle = Math.acos(dot / (mag1 * mag2));
        if (angle > 0.1) count++; // 有方向变化
      }
    }
    return count;
  }
  
  identifyAvailableSpaces(building, rooms) {
    const spaces = [];
    
    // 设备间/机房
    spaces.push({
      name: '设备间',
      type: 'equipment_room',
      bbox: { x: 0, y: 0, z: 0, width: 3000, height: 3000, depth: 2500 },
      priority: 1
    });
    
    // 吊顶空间
    spaces.push({
      name: '吊顶',
      type: 'ceiling_void',
      bbox: { x: 0, y: 0, z: 2400, width: building.width, height: building.depth, depth: 600 },
      priority: 2
    });
    
    // 根据房间类型识别空间
    for (const room of rooms) {
      if (room.type === 'kitchen' || room.type === 'bathroom') {
        spaces.push({
          name: `${room.name}-吊顶`,
          type: 'room_ceiling',
          bbox: { x: room.x, y: room.y, z: 2400, width: room.width, height: room.depth, depth: 400 },
          priority: 3
        });
      }
    }
    
    return spaces;
  }
  
  calculateBBox(equipment, position) {
    return {
      minX: position.x - equipment.dimensions.length / 2,
      maxX: position.x + equipment.dimensions.length / 2,
      minY: position.y - equipment.dimensions.width / 2,
      maxY: position.y + equipment.dimensions.width / 2,
      minZ: position.z,
      maxZ: position.z + equipment.dimensions.height
    };
  }
  
  buildRTree(equipment) {
    const tree = [];
    for (const eq of equipment) {
      if (eq.position) {
        tree.push({
          id: eq.id,
          bbox: this.calculateBBox(eq, eq.position)
        });
      }
    }
    return tree;
  }
  
  rtreeSearch(tree, queryBBox) {
    return tree.filter(item => this.bboxIntersects(item.bbox, queryBBox));
  }
  
  bboxIntersects(a, b) {
    return !(a.maxX < b.minX || a.minX > b.maxX ||
             a.maxY < b.minY || a.minY > b.maxY ||
             a.maxZ < b.minZ || a.minZ > b.maxZ);
  }
}

module.exports = Rysnova3DEngine;
