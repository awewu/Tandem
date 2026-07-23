const express = require('express');
const { errorResponse } = require('../utils/sanitize-error');

function groupDevicesByCategory(devices, category) {
  const filtered = category ? devices.filter(d => d.category === category) : devices;
  const categories = {};

  filtered.forEach(d => {
    if (!categories[d.category]) categories[d.category] = [];
    categories[d.category].push({
      type: d.type,
      name: d.name,
      brand: d.brand,
      category: d.category,
      protocols: d.protocols,
      power: d.power,
      capabilities: d.capabilities,
      energyClass: d.energyClass,
      mqttTopic: d.mqttTopic
    });
  });

  return { filtered, categories };
}

function buildProtocolIndex(devices) {
  const protocols = {};

  devices.forEach(d => {
    d.protocols.forEach(p => {
      if (!protocols[p]) protocols[p] = [];
      protocols[p].push({ type: d.type, name: d.name, category: d.category });
    });
  });

  return protocols;
}

function createEconetRouter(engines, { authenticateToken } = {}) {
  const router = express.Router();
  const auth = authenticateToken || ((req, res, next) => next());

  router.get('/api/econet/devices', auth, (req, res) => {
    res.json({
      success: true,
      data: engines.mqttBroker.getDevices()
    });
  });

  router.post('/api/econet/device/:id/control', auth, (req, res) => {
    const { id } = req.params;
    const { command } = req.body;

    try {
      engines.mqttBroker.sendControlCommand(id, command);
      res.json({
        success: true,
        message: `命令已发送至设备 ${id}`
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/econet/stats', auth, (req, res) => {
    res.json({
      success: true,
      data: engines.mqttBroker.getStats()
    });
  });

  router.get('/api/econet/catalog', (req, res) => {
    try {
      const allDevices = Array.from(engines.econetSystem.devices.values());
      const { filtered, categories } = groupDevicesByCategory(allDevices, req.query.category);

      res.json({
        success: true,
        total: filtered.length,
        categories: Object.keys(categories).length,
        data: categories
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/econet/catalog/:type', (req, res) => {
    try {
      const device = engines.econetSystem.devices.get(req.params.type);
      if (!device) {
        return res.status(404).json({ success: false, error: '设备型号不存在' });
      }
      res.json({ success: true, data: device });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/econet/scenes', (req, res) => {
    try {
      const scenes = Array.from(engines.econetSystem.scenes.values());
      res.json({ success: true, total: scenes.length, data: scenes });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/econet/scenes/:id/trigger', auth, (req, res) => {
    try {
      const scene = engines.econetSystem.scenes.get(req.params.id);
      if (!scene) {
        return res.status(404).json({ success: false, error: '场景不存在' });
      }
      res.json({
        success: true,
        message: `场景 "${scene.name}" 已触发`,
        actions: scene.actions.length,
        data: scene
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/econet/automations', auth, (req, res) => {
    try {
      const automations = Array.from(engines.econetSystem.automations.values());
      res.json({ success: true, total: automations.length, data: automations });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/econet/protocols', (req, res) => {
    try {
      const allDevices = Array.from(engines.econetSystem.devices.values());
      const protocols = buildProtocolIndex(allDevices);
      res.json({
        success: true,
        supportedProtocols: Object.keys(protocols),
        data: protocols
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/econet/premium', (req, res) => {
    try {
      const result = engines.econetPricing.calculateEconetPremium(req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/econet/device-types', (req, res) => {
    const deviceTypes = engines.econetPricing.getDeviceTypes();
    res.json({ success: true, data: deviceTypes });
  });

  router.get('/api/econet/device-types/:type', (req, res) => {
    const deviceType = engines.econetPricing.getDeviceType(req.params.type);
    if (!deviceType) {
      return res.status(404).json({ success: false, error: 'Device type not found' });
    }
    res.json({ success: true, data: deviceType });
  });

  router.get('/api/econet/pricing-rules', (req, res) => {
    const rules = engines.econetPricing.getPricingRules();
    res.json({ success: true, data: rules });
  });

  return router;
}

module.exports = createEconetRouter;
