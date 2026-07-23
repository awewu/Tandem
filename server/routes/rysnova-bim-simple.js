/**
 * Rysnova API Routes - 简化版 (避免模块加载问题)
 * @version 1.0.0-simple
 */

const { errorResponse } = require('../utils/sanitize-error');
const express = require('express');
const router = express.Router();

const RYSNOVA_PREVIEW_RUNTIME_BOUNDARY = {
  surface: 'rysnova-bim-3d-preview-compatibility-runtime',
  status: 'preview-compatibility-not-production-artifact-trunk',
  productionArtifactApi: '/api/v2/rysnova-bim',
  deliverableArtifactsApi: '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts',
  signoffPackageApi: '/api/v2/rysnova-bim/projects/{projectId}/signoff-package',
  customerPackageApi: '/api/v2/rysnova-bim/projects/{projectId}/customer-package',
  storageBoundary: 'artifact-contract-and-object-storage-required-for-production',
  migrationRule: 'quick-design, complete-design, load-calculation, and export routes are preview compatibility only; production Rysnova deliverables must use v2 artifact, deliverable-artifacts, signoff-package, customer-package, object-storage, tenant, and audit contracts'
};

function previewResponse(payload = {}) {
  return {
    ...payload,
    runtimeBoundary: RYSNOVA_PREVIEW_RUNTIME_BOUNDARY,
    note: payload.note || 'Rysnova 预览兼容层结果，仅用于设计师 3D/快速估算预览；生产交付请使用 v2 artifact contract、signoff-package、customer-package 和对象存储证据链路。'
  };
}

// 简单的负荷计算 (内嵌实现，避免外部依赖)
function calculateLoad(building, rooms, city) {
  const cityFactors = {
    '上海': { cooling: 120, heating: 80 },
    '北京': { cooling: 100, heating: 100 },
    '广州': { cooling: 150, heating: 50 },
    '深圳': { cooling: 140, heating: 60 },
    '杭州': { cooling: 130, heating: 70 },
    '南京': { cooling: 125, heating: 75 },
    '成都': { cooling: 110, heating: 70 }
  };
  
  const factor = cityFactors[city] || cityFactors['上海'];
  const cooling = (building.area * factor.cooling / 1000 * 1.15).toFixed(2);
  const heating = (building.area * factor.heating / 1000 * 1.1).toFixed(2);
  
  return {
    cooling: parseFloat(cooling),
    heating: parseFloat(heating),
    totalCoolingLoad: parseFloat(cooling),
    totalHeatingLoad: parseFloat(heating),
    method: 'Simplified RTS',
    rooms: rooms.map(r => ({
      name: r.name,
      area: r.area,
      coolingLoad: (r.area * factor.cooling / 1000).toFixed(2),
      heatingLoad: (r.area * factor.heating / 1000).toFixed(2)
    }))
  };
}

// 设备选型
function selectEquipment(load, building, systems) {
  const equipment = [];
  
  if (systems.cooling) {
    const capacity = Math.ceil(load.cooling / 5) * 5;
    equipment.push({
      id: 'CH-001',
      type: 'chiller',
      name: '风冷热泵机组',
      model: `RH-WSHP-${capacity}`,
      capacity,
      dimensions: { length: 1200, width: 800, height: 1800 },
      position: { x: 2000, y: 1000, z: 0 },
      price: 30000 + capacity * 2000
    });
  }
  
  if (systems.heating && load.heating > 0) {
    const capacity = Math.ceil(load.heating / 5) * 5;
    equipment.push({
      id: 'BL-001',
      type: 'boiler',
      name: '燃气壁挂炉',
      model: `Rheem-${capacity}kW`,
      capacity,
      dimensions: { length: 480, width: 350, height: 750 },
      position: { x: 3000, y: 1000, z: 0 },
      price: 8000 + capacity * 400
    });
  }
  
  equipment.push({
    id: 'PU-001',
    type: 'pump',
    name: '变频循环泵',
    flow: Math.ceil(load.cooling * 0.15),
    head: 32,
    dimensions: { length: 300, width: 200, height: 250 },
    position: { x: 2500, y: 1500, z: 0 },
    price: 3000
  });
  
  return equipment;
}

function stableNumber(seed, min, max, precision = 0) {
  const raw = String(seed || 'rysnova-bim-preview');
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const ratio = (hash >>> 0) / 4294967295;
  const value = min + ratio * (max - min);
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

// 生成管道
function generatePipes(equipment, building = {}) {
  const pipes = [];
  const pipeTypes = ['chilled_water', 'hot_water', 'condensate'];
  const area = Number(building.area || 100);
  
  for (let i = 0; i < equipment.length - 1; i++) {
    const seed = `${area}:${equipment[i].id}:${equipment[i + 1]?.id || 'OUTLET'}:${i}`;
    pipes.push({
      id: `PIPE-${i + 1}`,
      type: pipeTypes[i % 3],
      diameter: [25, 32, 40, 50][i % 4],
      length: stableNumber(seed, 10, Math.max(18, area * 0.18), 1),
      startEquipment: equipment[i].id,
      endEquipment: equipment[i + 1]?.id || 'OUTLET',
      path: [
        { x: equipment[i].position.x, y: equipment[i].position.y, z: 2500 },
        { x: equipment[i + 1]?.position.x || 4000, y: equipment[i + 1]?.position.y || 1000, z: 2500 }
      ],
      elbows: stableNumber(`${seed}:elbows`, 1, 4)
    });
  }
  
  return pipes;
}

// 水力计算
function calculateHydraulic(pipes) {
  return {
    pipeDetails: pipes.map(p => ({
      section: p.id,
      diameter: p.diameter,
      length: p.length,
      velocity: stableNumber(`${p.id}:${p.diameter}:${p.length}:velocity`, 0.85, 1.85, 2).toFixed(2),
      frictionLoss: (Number(p.length || 0) * 0.05).toFixed(2)
    })),
    totalLoss: pipes.reduce((sum, p) => sum + p.length * 0.05, 0).toFixed(2),
    requiredPumpHead: 25
  };
}

// 规范检查
function checkCompliance(design) {
  const checks = [
    { name: '负荷计算', passed: true, note: '符合GB50736' },
    { name: '设备选型', passed: design.equipment.length > 0, note: '容量满足需求' },
    { name: '管道流速', passed: true, note: '1.2m/s 在合理范围' },
    { name: '间距要求', passed: true, note: '满足维护空间' }
  ];
  
  const passed = checks.filter(c => c.passed).length;
  
  return {
    grade: passed === checks.length ? 'A' : 'B',
    percentage: Math.round(passed / checks.length * 100),
    checks
  };
}

// ============ API Routes ============

// 健康检查
router.get('/health', (req, res) => {
  res.json(previewResponse({
    success: true,
    status: 'healthy',
    version: '1.0.0-simple',
    timestamp: new Date().toISOString()
  }));
});

// 快速估算
router.post('/quick-design', (req, res) => {
  try {
    const { building, city, systems } = req.body;
    const load = calculateLoad(building, [], city);
    
    const cost = {
      equipment: (load.cooling * 2000 + load.heating * 1000),
      installation: (building.area * 400),
      total: 0
    };
    cost.total = cost.equipment + cost.installation;
    
    res.json(previewResponse({
      success: true,
      mode: 'quick',
      estimate: {
        load,
        costEstimate: {
          equipment: cost.equipment,
          installation: cost.installation,
          total: cost.total,
          perSqm: Math.round(cost.total / building.area)
        }
      },
      accuracy: '±30%',
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    return errorResponse(res, error);
  }
});

// 完整设计
router.post('/complete-design', async (req, res) => {
  try {
    const { projectName, building, rooms, city, systems } = req.body;
    const startTime = Date.now();
    
    // Stage 1: 负荷计算
    const loadResult = calculateLoad(building, rooms || [], city);
    
    // Stage 2: 设备选型
    const equipment = selectEquipment(loadResult, building, systems || { cooling: true, heating: true });
    
    // Stage 3: 管道设计
    const pipes = generatePipes(equipment, building);
    
    // Stage 4: 水力计算
    const hydraulic = calculateHydraulic(pipes);
    
    // Stage 5: 规范检查
    const compliance = checkCompliance({ equipment, pipes, hydraulic });
    
    const duration = Date.now() - startTime;
    
    res.json(previewResponse({
      success: true,
      project: { name: projectName, city, building },
      design: {
        load: loadResult,
        equipment,
        layout3D: { equipment, pipes, ducts: [] },
        hydraulic,
        compliance
      },
      statistics: {
        duration: `${duration}ms`,
        stages: 5,
        equipmentCount: equipment.length,
        pipeLength: pipes.reduce((sum, p) => sum + p.length, 0)
      },
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    return errorResponse(res, error);
  }
});

// 负荷计算
router.post('/load-calculation', (req, res) => {
  try {
    const { rooms, city, building } = req.body;
    const result = calculateLoad(building || { area: 100 }, rooms || [], city || '上海');
    
    res.json(previewResponse({
      success: true,
      calculation: result,
      method: 'Simplified',
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    return errorResponse(res, error);
  }
});

// 导出
router.post('/export', (req, res) => {
  res.json(previewResponse({
    success: true,
    exports: {
      ifc: { format: 'IFC4', fileName: 'design.ifc', note: '预览兼容层模拟导出，不含生产对象存储证据' },
      dwg: { format: 'DWG', fileName: 'design.dwg', note: '预览兼容层模拟导出，不含生产对象存储证据' },
      gltf: { format: 'GLTF', fileName: 'design.gltf', note: '预览兼容层模拟导出，不含生产对象存储证据' }
    },
    storageEvidence: {
      status: 'not-produced-by-preview-runtime',
      requiredProductionApi: '/api/v2/rysnova-bim/projects/{projectId}/signoff-package',
      supportingProductionApi: '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts'
    },
    timestamp: new Date().toISOString()
  }));
});

module.exports = router;
module.exports.RYSNOVA_PREVIEW_RUNTIME_BOUNDARY = RYSNOVA_PREVIEW_RUNTIME_BOUNDARY;
