const express = require('express');
const { errorResponse } = require('../utils/sanitize-error');

function createPlatformRuntimeRouter(engines) {
  const router = express.Router();

  router.get('/api/system/health', (req, res) => {
    try {
      const health = {
        timestamp: new Date().toISOString(),
        engines: {}
      };

      for (const [name, engine] of Object.entries(engines)) {
        if (engine && typeof engine.healthCheck === 'function') {
          try {
            health.engines[name] = engine.healthCheck();
          } catch (e) {
            health.engines[name] = { status: 'error', message: e.message };
          }
        } else {
          health.engines[name] = { status: 'ok', note: 'no healthCheck method' };
        }
      }

      res.json({ success: true, data: health });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/performance/report', (req, res) => {
    try {
      const { timeRange = '1h' } = req.query;
      const report = engines.performanceMonitor.getPerformanceReport(timeRange);
      res.json({ success: true, data: report });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/performance/reset', (req, res) => {
    try {
      engines.performanceMonitor.resetMetrics();
      res.json({ success: true, message: '性能指标已重置' });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/performance/health', (req, res) => {
    try {
      const result = engines.performanceMonitor.healthCheck();
      res.json(result);
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/cache/get', async (req, res) => {
    try {
      const { key, namespace } = req.query;
      if (!key) {
        return res.status(400).json({ success: false, error: '缺少key参数' });
      }
      const value = await engines.cache.get(key, { namespace });
      res.json({ success: true, key, value, hit: value !== null });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/cache/set', async (req, res) => {
    try {
      const { key, value, ttl, namespace } = req.body || {};
      if (!key || value === undefined) {
        return res.status(400).json({ success: false, error: '缺少key或value参数' });
      }
      await engines.cache.set(key, value, { ttl, namespace });
      res.json({ success: true, message: '缓存已设置' });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.delete('/api/cache/delete', async (req, res) => {
    try {
      const { key, namespace } = req.body || {};
      if (!key) {
        return res.status(400).json({ success: false, error: '缺少key参数' });
      }
      await engines.cache.delete(key, { namespace });
      res.json({ success: true, message: '缓存已删除' });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.delete('/api/cache/clear', async (req, res) => {
    try {
      const { namespace } = req.body || {};
      await engines.cache.clear(namespace);
      res.json({
        success: true,
        message: namespace ? `命名空间 ${namespace} 缓存已清空` : '所有缓存已清空'
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/cache/stats', async (req, res) => {
    try {
      const stats = engines.cache.getStats();
      const health = await engines.cache.healthCheck();
      res.json({ success: true, data: { stats, health } });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/agent/execute', async (req, res) => {
    try {
      const { task, options = {} } = req.body || {};
      if (!task) {
        return res.status(400).json({ success: false, error: '缺少task参数' });
      }
      console.log(`[API] Agency Agent执行任务: ${task}`);
      const result = await engines.agencyAgent.executeTask(task, options);
      res.json({ success: result.success, data: result });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/agent/status', (req, res) => {
    try {
      const status = engines.agencyAgent.getAgentStatus();
      res.json({ success: true, data: status });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/agent/tasks', (req, res) => {
    try {
      const { limit = 10 } = req.query;
      const history = engines.agencyAgent.getTaskHistory(parseInt(limit, 10));
      res.json({ success: true, data: history });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  return router;
}

module.exports = createPlatformRuntimeRouter;
