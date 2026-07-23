/**
 * 瑞美极致系统API - Supreme API
 * 统一暴露6大核心引擎能力
 */

const { errorResponse } = require('../utils/sanitize-error');
const express = require('express');
const router = express.Router();
const { getRuntimeEngine } = require('../modules/runtimeEngineAccess');

let supremeEngines = null;
let supremeEnginesPromise = null;

async function initializeSupremeEngines() {
  const engines = {
    smartBrain: getRuntimeEngine('smartBrain'),
    ioTPlatform: getRuntimeEngine('iotPlatform'),
    digitalTwin: getRuntimeEngine('digitalTwin'),
    triEnergy: getRuntimeEngine('triEnergy'),
    aiScene: getRuntimeEngine('aiScene')
  };

  await engines.smartBrain.initialize();
  await engines.ioTPlatform.initialize();
  await engines.digitalTwin.initialize();
  await engines.triEnergy.initialize();
  console.log('[SupremeAPI] 所有引擎初始化完成');
  return engines;
}

async function getSupremeEngines() {
  if (supremeEngines) return supremeEngines;
  if (!supremeEnginesPromise) {
    supremeEnginesPromise = initializeSupremeEngines()
      .then(engines => {
        supremeEngines = engines;
        return engines;
      })
      .catch(error => {
        supremeEnginesPromise = null;
        throw error;
      });
  }
  return supremeEnginesPromise;
}

function getSupremeEngineStatus() {
  return {
    smartBrain: Boolean(supremeEngines?.smartBrain?.initialized),
    ioTPlatform: Boolean(supremeEngines?.ioTPlatform?.initialized),
    digitalTwin: Boolean(supremeEngines?.digitalTwin?.initialized),
    triEnergy: Boolean(supremeEngines?.triEnergy?.initialized),
    aiScene: Boolean(supremeEngines?.aiScene)
  };
}

// ============================================================
// 1. 智慧大脑 API
// ============================================================

/**
 * POST /api/supreme/energy/optimize
 * 能源优化调度
 */
router.post('/energy/optimize', async (req, res) => {
  try {
    const { smartBrain } = await getSupremeEngines();
    const input = req.body;
    const result = smartBrain.optimizeEnergySchedule(input);
    res.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/supreme/maintenance/predict
 * 预测性维护
 */
router.post('/maintenance/predict', async (req, res) => {
  try {
    const { smartBrain } = await getSupremeEngines();
    const deviceData = req.body;
    const result = smartBrain.predictMaintenance(deviceData);
    res.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/supreme/scenario/switch
 * 场景自动切换
 */
router.post('/scenario/switch', async (req, res) => {
  try {
    const { smartBrain } = await getSupremeEngines();
    const context = req.body;
    const result = smartBrain.autoSwitchScenario(context);
    res.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
});

// ============================================================
// 2. 万物互联 API
// ============================================================

/**
 * POST /api/supreme/iot/devices/register
 * 设备注册
 */
router.post('/iot/devices/register', async (req, res) => {
  try {
    const { ioTPlatform } = await getSupremeEngines();
    const deviceInfo = req.body;
    const result = ioTPlatform.registerDevice(deviceInfo);
    res.json(result);
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/supreme/iot/devices/:deviceId/connect
 * 设备连接
 */
router.post('/iot/devices/:deviceId/connect', async (req, res) => {
  try {
    const { ioTPlatform } = await getSupremeEngines();
    const { deviceId } = req.params;
    const connectionInfo = req.body;
    const result = ioTPlatform.deviceConnect(deviceId, connectionInfo);
    res.json(result);
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/supreme/iot/devices/:deviceId/publish
 * 设备数据上报
 */
router.post('/iot/devices/:deviceId/publish', async (req, res) => {
  try {
    const { ioTPlatform } = await getSupremeEngines();
    const { deviceId } = req.params;
    const data = req.body;
    const result = ioTPlatform.publishData(deviceId, data);
    res.json(result);
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/supreme/iot/devices/:deviceId/command
 * 下发控制指令
 */
router.post('/iot/devices/:deviceId/command', async (req, res) => {
  try {
    const { ioTPlatform } = await getSupremeEngines();
    const { deviceId } = req.params;
    const command = req.body;
    const result = ioTPlatform.sendCommand(deviceId, command);
    res.json(result);
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/supreme/iot/devices/:deviceId/status
 * 获取设备状态
 */
router.get('/iot/devices/:deviceId/status', async (req, res) => {
  try {
    const { ioTPlatform } = await getSupremeEngines();
    const { deviceId } = req.params;
    const result = ioTPlatform.getDeviceStatus(deviceId);
    res.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/supreme/iot/stats
 * 平台统计
 */
router.get('/iot/stats', async (req, res) => {
  try {
    const { ioTPlatform } = await getSupremeEngines();
    const result = ioTPlatform.getStats();
    res.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
});

// ============================================================
// 3. 数字孪生 API
// ============================================================

/**
 * POST /api/supreme/twin/scenes
 * 创建3D场景
 */
router.post('/twin/scenes', async (req, res) => {
  try {
    const { digitalTwin } = await getSupremeEngines();
    const projectData = req.body;
    const result = digitalTwin.createScene(projectData);
    res.json(result);
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/supreme/twin/scenes/:projectId/sync
 * 实时数据同步
 */
router.post('/twin/scenes/:projectId/sync', async (req, res) => {
  try {
    const { digitalTwin } = await getSupremeEngines();
    const { projectId } = req.params;
    const deviceData = req.body;
    const result = digitalTwin.syncRealTimeData(projectId, deviceData);
    res.json(result);
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/supreme/twin/scenes/:projectId/view
 * 获取场景视图
 */
router.get('/twin/scenes/:projectId/view', async (req, res) => {
  try {
    const { digitalTwin } = await getSupremeEngines();
    const { projectId } = req.params;
    const options = req.query;
    const result = digitalTwin.getSceneView(projectId, options);
    res.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/supreme/twin/cameras
 * 接入摄像头
 */
router.post('/twin/cameras', async (req, res) => {
  try {
    const { digitalTwin } = await getSupremeEngines();
    const { projectId, cameraConfig } = req.body;
    const result = digitalTwin.connectCamera(projectId, cameraConfig);
    res.json(result);
  } catch (error) {
    return errorResponse(res, error);
  }
});

// ============================================================
// 4. 三能源系统 API
// ============================================================

/**
 * POST /api/supreme/energy/calculate
 * 计算最优能源组合
 */
router.post('/energy/calculate', async (req, res) => {
  try {
    const { triEnergy } = await getSupremeEngines();
    const input = req.body;
    const result = triEnergy.calculateOptimalMix(input);
    res.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/supreme/energy/rapid-heat
 * 快速制热
 */
router.post('/energy/rapid-heat', async (req, res) => {
  try {
    const { triEnergy } = await getSupremeEngines();
    const { targetTemp, currentTemp } = req.body;
    const result = triEnergy.rapidHeating(targetTemp, currentTemp);
    res.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/supreme/energy/valley-storage
 * 谷电蓄热
 */
router.post('/energy/valley-storage', async (req, res) => {
  try {
    const { triEnergy } = await getSupremeEngines();
    const { storageCapacity } = req.body;
    const result = triEnergy.valleyHeatStorage(storageCapacity);
    res.json(result);
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/supreme/energy/stats
 * 能耗统计
 */
router.get('/energy/stats', async (req, res) => {
  try {
    const { triEnergy } = await getSupremeEngines();
    const { period } = req.query;
    const result = triEnergy.getEnergyStats(period);
    res.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
});

// ============================================================
// 5. AI场景生成 API
// ============================================================

/**
 * POST /api/supreme/ai/understand
 * 自然语言理解
 */
router.post('/ai/understand', async (req, res) => {
  try {
    const { aiScene } = await getSupremeEngines();
    const { text } = req.body;
    const result = aiScene.understandIntent(text);
    res.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/supreme/ai/generate
 * 生成设计方案
 */
router.post('/ai/generate', async (req, res) => {
  try {
    const { aiScene } = await getSupremeEngines();
    const intentData = req.body;
    const result = aiScene.generateDesign(intentData);
    res.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/supreme/ai/recommend
 * 推荐场景方案
 */
router.post('/ai/recommend', async (req, res) => {
  try {
    const { aiScene } = await getSupremeEngines();
    const userProfile = req.body;
    const result = aiScene.recommendScenarios(userProfile);
    res.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/supreme/ai/chat
 * AI对话
 */
router.post('/ai/chat', async (req, res) => {
  try {
    const { aiScene } = await getSupremeEngines();
    const { message, context } = req.body;
    const result = aiScene.chat(message, context);
    res.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
});

// ============================================================
// 6. 系统状态 API
// ============================================================

/**
 * GET /api/supreme/health
 * 系统健康检查
 */
router.get('/health', async (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    runtime: supremeEngines ? 'initialized' : 'lazy',
    engines: {
      smartBrain: true,
      ioTPlatform: true,
      digitalTwin: true,
      triEnergy: true,
      aiScene: true
    },
    initialized: {
      ...getSupremeEngineStatus()
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/supreme/status
 * 系统状态详情
 */
router.get('/status', async (req, res) => {
  const { smartBrain, ioTPlatform, digitalTwin, triEnergy } = await getSupremeEngines();
  res.json({
    success: true,
    version: '1.0.0',
    engines: {
      smartBrain: smartBrain.initialized,
      ioTPlatform: ioTPlatform.initialized,
      digitalTwin: digitalTwin.initialized,
      triEnergy: true,
      aiScene: true
    },
    stats: {
      iot: ioTPlatform.getStats(),
      energy: triEnergy.getEnergyStats('day')
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
