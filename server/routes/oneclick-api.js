/**
 * 6大系统一键计算API路由
 * /api/oneclick/calculate - 完整项目计算
 */

const { errorResponse } = require('../utils/sanitize-error');
const express = require('express');
const router = express.Router();
const { getRuntimeEngine } = require('../modules/runtimeEngineAccess');

const engine = getRuntimeEngine('oneClickCalculation');
const cache = getRuntimeEngine('calculationCache');
const monitor = getRuntimeEngine('calculationPerformanceMonitor');

/**
 * POST /api/oneclick/calculate
 * 6大系统一键计算 (带缓存、监控、RFC 7807错误处理)
 */
router.post('/calculate', async (req, res) => {
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  // 添加请求ID到响应头
  res.setHeader('X-Request-ID', requestId);
  
  try {
    console.log(`[OneClick API] [${requestId}] 收到计算请求:`, req.body.projectName || '未命名');
    
    // 检查缓存
    const cached = await cache.get('oneclick', req.body);
    if (cached.hit) {
      console.log(`[OneClick API] [${requestId}] 缓存命中`);
      monitor.recordCalculation('oneclick', startTime, true);
      return res.json({
        success: true,
        data: cached.data,
        message: '计算完成(缓存)',
        cached: true,
        requestId
      });
    }
    
    // 执行计算
    const result = await engine.calculateAll(req.body);
    
    if (result.success) {
      // 保存到缓存
      await cache.set('oneclick', req.body, result.data);
      
      // 记录性能
      monitor.recordCalculation('oneclick', startTime, true);
      
      res.json({
        success: true,
        data: result.data,
        message: '计算完成',
        cached: false,
        requestId
      });
    } else {
      monitor.recordCalculation('oneclick', startTime, false, new Error(result.error));
      // RFC 7807 标准错误响应
      res.status(400).json({
        success: false,
        type: '/errors/calculation-failed',
        title: '计算失败',
        status: 400,
        detail: result.error,
        instance: `/api/oneclick/calculate/${requestId}`,
        requestId
      });
    }
  } catch (error) {
    console.error(`[OneClick API] [${requestId}] 错误:`, error);
    monitor.recordCalculation('oneclick', startTime, false, error);
    
    // RFC 7807 标准错误响应
    const statusCode = error.message.includes('参数验证失败') ? 400 : 500;
    const errorType = statusCode === 400 ? '/errors/validation-failed' : '/errors/internal-error';
    const title = statusCode === 400 ? '参数验证失败' : '内部服务器错误';
    
    res.status(statusCode).json({
      success: false,
      type: errorType,
      title: title,
      status: statusCode,
      detail: error.message,
      instance: `/api/oneclick/calculate/${requestId}`,
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/oneclick/quick
 * 快速计算 (简化版)
 */
router.post('/quick', async (req, res) => {
  try {
    const { area, city, buildingType } = req.body;
    
    // 快速估算
    const quickResult = {
      area: parseInt(area) || 120,
      city: city || '北京',
      buildingType: buildingType || '普通住宅',
      estimate: {
        hotwater: { cost: 12000, type: '24kW两用炉' },
        water: { cost: 7000, type: '4级过滤' },
        freshair: { cost: 10000, type: '350m³/h' },
        cooling: { cost: 25000, type: '10kW多联机' },
        heating: { cost: 20000, type: '地暖+壁挂炉' },
        control: { cost: 6000, type: '智能控制' }
      },
      total: {
        equipment: 80000,
        installation: 15000,
        total: 95000
      }
    };
    
    res.json({
      success: true,
      data: quickResult,
      message: '快速估算完成'
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/oneclick/status
 * 引擎状态检查
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      version: engine.version,
      buildDate: engine.buildDate,
      systems: engine.systems,
      status: 'running',
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * GET /api/oneclick/cache/stats
 * 缓存统计
 */
router.get('/cache/stats', (req, res) => {
  res.json({
    success: true,
    data: cache.getStats()
  });
});

/**
 * POST /api/oneclick/cache/clear
 * 清除缓存
 */
router.post('/cache/clear', async (req, res) => {
  try {
    const { system = 'all' } = req.body;
    
    if (system === 'all') {
      await cache.clearSystem('oneclick');
      await cache.clearSystem('hotwater');
      await cache.clearSystem('water');
      await cache.clearSystem('freshair');
      await cache.clearSystem('cooling');
      await cache.clearSystem('doas');
      await cache.clearSystem('heating');
      await cache.clearSystem('control');
    } else {
      await cache.clearSystem(system);
    }
    
    res.json({
      success: true,
      message: `已清除 ${system} 缓存`
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/oneclick/cache/warmup
 * 预热缓存
 */
router.post('/cache/warmup', async (req, res) => {
  try {
    await cache.warmup();
    res.json({
      success: true,
      message: '缓存预热完成'
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/oneclick/monitor/stats
 * 性能监控统计
 */
router.get('/monitor/stats', (req, res) => {
  res.json({
    success: true,
    data: monitor.getAllStats()
  });
});

/**
 * GET /api/oneclick/monitor/report
 * 性能报告
 */
router.get('/monitor/report', (req, res) => {
  const timeRange = parseInt(req.query.timeRange) || 3600000;
  res.json({
    success: true,
    data: monitor.getReport(timeRange)
  });
});

/**
 * GET /api/oneclick/health
 * 健康检查
 */
router.get('/health', (req, res) => {
  const health = monitor.healthCheck();
  const statusCode = health.status === 'healthy' ? 200 : 503;
  
  res.status(statusCode).json({
    success: health.status === 'healthy',
    data: {
      ...health,
      version: engine.version,
      uptime: process.uptime()
    }
  });
});

module.exports = router;
