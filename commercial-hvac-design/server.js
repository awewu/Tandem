/**
 * 瑞美商用HVAC系统 - 独立入口
 * Commercial HVAC System Entry Point
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

// 商用核心引擎
const SmartBrainEngine = require('../server/core/SmartBrainEngine');
const IoTPlatform = require('../server/core/IoTPlatform');
const DigitalTwinEngine = require('../server/core/DigitalTwinEngine');
const TriEnergySystem = require('../server/core/TriEnergySystem');
const AISceneGenerator = require('../server/core/AISceneGenerator');
const ExportEngine = require('../server/core/ExportEngine');
const AnalyticsEngine = require('../server/core/AnalyticsEngine');

// 初始化引擎
const engines = {
  smartBrain: new SmartBrainEngine(),
  ioT: new IoTPlatform(),
  digitalTwin: new DigitalTwinEngine(),
  triEnergy: new TriEnergySystem(),
  aiScene: new AISceneGenerator(),
  export: new ExportEngine(),
  analytics: new AnalyticsEngine()
});

// 初始化
(async () => {
  console.log('[Commercial] 初始化商用HVAC系统...');
  await Promise.all([
    engines.smartBrain.initialize(),
    engines.ioT.initialize(),
    engines.digitalTwin.initialize(),
    engines.triEnergy.initialize()
  ]);
  console.log('[Commercial] 所有引擎初始化完成');
})();

const app = express();
const PORT = process.env.PORT || 5050;

// 中间件
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件
app.use('/public', express.static(path.join(__dirname, '../public')));

// ============================================================
// 商用HVAC API 路由
// ============================================================

// 健康检查
app.get('/api/commercial/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: '瑞美商用HVAC',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    engines: Object.keys(engines).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {})
  });
});

// ==================== 1. 项目设计 API ====================

/**
 * POST /api/commercial/projects
 * 创建商用项目
 */
app.post('/api/commercial/projects', async (req, res) => {
  try {
    const { name, type, area, floors, requirements } = req.body;
    
    const project = {
      id: `COMM-${Date.now()}`,
      name,
      type, // 'office', 'hotel', 'hospital', 'mall', 'factory'
      area,
      floors,
      requirements,
      createdAt: new Date().toISOString(),
      status: 'designing'
    };
    
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/commercial/design/generate
 * AI生成商用设计方案
 */
app.post('/api/commercial/design/generate', async (req, res) => {
  try {
    const { projectId, buildingType, area, occupancy, climate } = req.body;
    
    // 商用专用设计逻辑
    const design = engines.aiScene.generateDesign({
      intent: {
        houseType: buildingType,
        area,
        requirements: ['hvac', 'ventilation', 'energy_efficiency'],
        constraints: ['commercial_code', 'safety']
      },
      entities: { occupancy, climate }
    });
    
    // 商用增强
    design.commercial = {
      zoning: this.generateZones(area, buildingType),
      redundancy: this.calculateRedundancy(area),
      compliance: ['GB50189', 'ASHRAE90.1'],
      roi: this.calculateROI(area, design.quotation.total)
    };
    
    res.json({ success: true, data: design });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/commercial/load-calculation
 * 商用负荷计算
 */
app.post('/api/commercial/load-calculation', async (req, res) => {
  try {
    const { area, buildingType, orientation, envelope, occupancy } = req.body;
    
    // 商用负荷算法
    const coolingLoad = area * this.getLoadFactor(buildingType).cooling;
    const heatingLoad = area * this.getLoadFactor(buildingType).heating;
    const ventilationLoad = occupancy * 50; // W/person
    
    const result = {
      coolingLoad: Math.round(coolingLoad),
      heatingLoad: Math.round(heatingLoad),
      ventilationLoad: Math.round(ventilationLoad),
      totalLoad: Math.round(coolingLoad + heatingLoad + ventilationLoad),
      equipment: this.selectCommercialEquipment(coolingLoad, heatingLoad),
      energyEstimate: {
        annual: Math.round(totalLoad * 2000 / 1000), // kWh/year
        cost: Math.round(totalLoad * 2000 / 1000 * 0.8) // 元/year
      }
    };
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 2. 能源管理 API ====================

/**
 * POST /api/commercial/energy/optimize
 * 商用能源优化
 */
app.post('/api/commercial/energy/optimize', async (req, res) => {
  try {
    const { buildingId, area, occupancy, schedule } = req.body;
    
    // 商用多能源调度
    const result = engines.triEnergy.calculateOptimalMix({
      solarIrradiance: schedule === 'day' ? 600 : 0,
      outdoorTemp: 20,
      indoorTemp: 22,
      targetTemp: 22,
      heatLoad: area * 0.08, // 商用负荷密度
      electricityPrice: 0.8, // 商用电价
      gasPrice: 3.5,
      timeOfDay: schedule
    });
    
    // 商用增强分析
    result.commercial = {
      peakShaving: this.calculatePeakShaving(result),
      demandResponse: this.calculateDemandResponse(result),
      carbonFootprint: this.calculateCarbon(area, result),
      annualSaving: parseFloat(result.savings) * area * 0.1
    };
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/commercial/energy/monitor/:buildingId
 * 实时监控
 */
app.get('/api/commercial/energy/monitor/:buildingId', async (req, res) => {
  try {
    const { buildingId } = req.params;
    
    // 模拟实时监控数据
    const monitor = {
      buildingId,
      timestamp: new Date().toISOString(),
      realtime: {
        totalPower: Math.random() * 500 + 200, // kW
        coolingLoad: Math.random() * 300 + 100,
        heatingLoad: Math.random() * 100,
        ventilation: Math.random() * 50 + 20
      },
      efficiency: {
        cop: 3.2 + Math.random() * 0.5,
        eer: 11 + Math.random() * 2,
        utilization: 70 + Math.random() * 20
      },
      alarms: []
    };
    
    res.json({ success: true, data: monitor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 3. IoT设备管理 API ====================

/**
 * POST /api/commercial/devices/register
 * 注册商用设备
 */
app.post('/api/commercial/devices/register', async (req, res) => {
  try {
    const { buildingId, devices } = req.body;
    
    const results = devices.map(device => {
      return engines.ioT.registerDevice({
        deviceId: device.id,
        deviceType: device.type,
        capabilities: device.capabilities,
        metadata: { ...device.metadata, buildingId, zone: device.zone }
      });
    });
    
    res.json({ success: true, data: { registered: results.length, devices: results } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/commercial/devices/control
 * 分区控制
 */
app.post('/api/commercial/devices/control', async (req, res) => {
  try {
    const { buildingId, zone, command } = req.body;
    
    // 获取该分区所有设备
    const zoneDevices = Array.from(engines.ioT.devices.values())
      .filter(d => d.metadata?.zone === zone && d.metadata?.buildingId === buildingId);
    
    // 批量控制
    const results = engines.ioT.batchControl(
      zoneDevices.map(d => d.deviceId),
      command
    );
    
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 4. 数字孪生 API ====================

/**
 * POST /api/commercial/twin/create
 * 创建商用建筑数字孪生
 */
app.post('/api/commercial/twin/create', async (req, res) => {
  try {
    const { buildingId, bimModel, systems } = req.body;
    
    // 转换BIM并创建商用孪生
    const bimResult = engines.digitalTwin.convertBIMToScene({
      ifcData: bimModel,
      projectInfo: { id: buildingId, type: 'commercial' }
    });
    
    // 增强商用特性
    const commercialTwin = {
      ...bimResult,
      commercial: {
        zones: systems.map(s => ({ name: s.zone, area: s.area })),
        systems: systems.map(s => s.type),
        bmsIntegration: true,
        apiEndpoints: {
          realtime: `/api/commercial/twin/${buildingId}/realtime`,
          history: `/api/commercial/twin/${buildingId}/history`,
          control: `/api/commercial/twin/${buildingId}/control`
        }
      }
    };
    
    res.json({ success: true, data: commercialTwin });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/commercial/twin/:buildingId/realtime
 * 实时孪生数据
 */
app.get('/api/commercial/twin/:buildingId/realtime', async (req, res) => {
  try {
    const { buildingId } = req.params;
    
    const realtime = {
      buildingId,
      timestamp: new Date().toISOString(),
      occupancy: Math.floor(Math.random() * 500),
      zones: [
        { name: '大厅', temp: 22.5, humidity: 45, co2: 450 },
        { name: '办公区', temp: 23.0, humidity: 42, co2: 520 },
        { name: '会议室', temp: 21.8, humidity: 48, co2: 380 }
      ],
      equipment: {
        chillers: [{ id: 'CH-01', status: 'running', load: 75 }],
        pumps: [{ id: 'P-01', status: 'running', flow: 120 }],
        ahus: [{ id: 'AHU-01', status: 'running', airflow: 5000 }]
      }
    };
    
    res.json({ success: true, data: realtime });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 5. 预测维护 API ====================

/**
 * POST /api/commercial/maintenance/predict
 * 商用设备预测维护
 */
app.post('/api/commercial/maintenance/predict', async (req, res) => {
  try {
    const { devices } = req.body;
    
    const predictions = devices.map(device => {
      const prediction = engines.smartBrain.predictMaintenance({
        deviceId: device.id,
        runtime: device.runtime,
        temperature: device.temp,
        vibration: device.vibration || 2,
        energyConsumption: device.power
      });
      
      return {
        ...prediction,
        commercial: {
          downtimeCost: this.calculateDowntimeCost(device.type),
          maintenanceWindow: this.findMaintenanceWindow(device.zone),
          spareParts: this.checkSpareParts(device.model)
        }
      };
    });
    
    res.json({ success: true, data: predictions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/commercial/maintenance/schedule/:buildingId
 * 维护计划
 */
app.get('/api/commercial/maintenance/schedule/:buildingId', async (req, res) => {
  try {
    const { buildingId } = req.params;
    
    const schedule = {
      buildingId,
      upcoming: [
        { date: '2026-05-01', task: '冷却塔清洗', priority: 'medium' },
        { date: '2026-05-15', task: '过滤器更换', priority: 'low' },
        { date: '2026-06-01', task: '冷媒检测', priority: 'high' }
      ],
      compliance: {
        lastInspection: '2026-04-01',
        nextInspection: '2026-07-01',
        status: 'compliant'
      }
    };
    
    res.json({ success: true, data: schedule });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 6. 报表导出 API ====================

/**
 * POST /api/commercial/reports/energy
 * 能源报表导出
 */
app.post('/api/commercial/reports/energy', async (req, res) => {
  try {
    const { buildingId, period, format } = req.body;
    
    const report = engines.analytics.getBusinessDashboard(period);
    const exported = engines.export.exportAnalyticsReport(report, format);
    
    res.json({ success: true, data: exported });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/commercial/reports/design
 * 设计报告导出
 */
app.post('/api/commercial/reports/design', async (req, res) => {
  try {
    const { projectId, format } = req.body;
    
    const design = { id: projectId, name: '商用设计方案' };
    const exported = engines.export.exportDesign(design, format);
    
    res.json({ success: true, data: exported });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 辅助方法 ====================

function getLoadFactor(buildingType) {
  const factors = {
    office: { cooling: 120, heating: 80 },
    hotel: { cooling: 150, heating: 100 },
    hospital: { cooling: 200, heating: 120 },
    mall: { cooling: 250, heating: 100 },
    factory: { cooling: 100, heating: 150 }
  };
  return factors[buildingType] || { cooling: 120, heating: 80 };
}

function selectCommercialEquipment(coolingLoad, heatingLoad) {
  const chillers = Math.ceil(coolingLoad / 500); // 500kW per chiller
  const boilers = Math.ceil(heatingLoad / 300);
  
  return {
    chillers: Array(chillers).fill({ type: '离心式', capacity: 500, efficiency: 'COP 6.0' }),
    boilers: Array(boilers).fill({ type: '燃气', capacity: 300, efficiency: '95%' }),
    pumps: { chilled: chillers * 2, condenser: chillers * 2, hot: boilers * 2 },
    ahufcus: Math.ceil((coolingLoad + heatingLoad) / 50)
  };
}

function generateZones(area, type) {
  const zones = [];
  if (type === 'office') {
    zones.push({ name: '办公区', area: area * 0.6, system: 'VAV' });
    zones.push({ name: '公共区域', area: area * 0.2, system: 'FCU' });
    zones.push({ name: '机房', area: area * 0.1, system: 'CRAC' });
    zones.push({ name: '会议室', area: area * 0.1, system: 'FCU' });
  }
  return zones;
}

function calculateRedundancy(area) {
  return area > 5000 ? 'N+1' : 'N';
}

function calculateROI(area, cost) {
  const annualSaving = area * 50; // 50元/m²/year
  const roi = cost / annualSaving;
  return { years: roi.toFixed(1), annualSaving };
}

function calculatePeakShaving(result) {
  return { potential: '20%', capacity: '500kW' };
}

function calculateDemandResponse(result) {
  return { available: true, capacity: '200kW', incentive: '5万元/年' };
}

function calculateCarbon(area, result) {
  const baseline = area * 0.15; // tons CO2/year
  const optimized = baseline * (1 - parseFloat(result.savings) / 100);
  return { baseline, optimized, reduction: (baseline - optimized).toFixed(1) };
}

function calculateDowntimeCost(type) {
  const costs = { chiller: 10000, boiler: 5000, pump: 2000, ahu: 3000 };
  return costs[type] || 5000;
}

function findMaintenanceWindow(zone) {
  return zone === 'office' ? '周末' : '夜间';
}

function checkSpareParts(model) {
  return { available: true, delivery: '2天' };
}

// 启动服务器
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🏢 瑞美商用HVAC系统 v2.0.0');
  console.log('='.repeat(60));
  console.log(`🌐 API地址: http://localhost:${PORT}`);
  console.log(`📖 API文档: http://localhost:${PORT}/api/commercial/health`);
  console.log('='.repeat(60));
});

module.exports = app;
