const express = require('express');
const { errorResponse } = require('../utils/sanitize-error');

function createFieldServicesRouter(engines) {
  const router = express.Router();

  router.get('/api/location/provinces', (req, res) => {
    try {
      const provinces = engines.location.getProvinces();
      res.json({
        success: true,
        data: provinces,
        total: provinces.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/location/regions', (req, res) => {
    try {
      const provinces = engines.location.getProvinces();
      res.json({
        success: true,
        data: provinces,
        total: provinces.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/location/cities/:provinceCode', (req, res) => {
    try {
      const { provinceCode } = req.params;
      const cities = engines.location.getCities(provinceCode);
      res.json({
        success: true,
        data: cities,
        provinceCode,
        total: cities.length
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/location/districts/:provinceCode/:cityCode', (req, res) => {
    try {
      const { provinceCode, cityCode } = req.params;
      const districts = engines.location.getDistricts(provinceCode, cityCode);
      res.json({
        success: true,
        data: districts,
        provinceCode,
        cityCode,
        total: districts.length
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/location/reverse-geocode', (req, res) => {
    try {
      const { lat, lng } = req.query;
      if (!lat || !lng) {
        return res.status(400).json({ success: false, error: '缺少经纬度参数' });
      }

      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
        return res.status(400).json({ success: false, error: '无效的经纬度格式' });
      }

      const result = engines.location.reverseGeocode(latitude, longitude);
      res.json(result);
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/location/search', (req, res) => {
    try {
      const { keyword, city, limit = 10 } = req.query;
      if (!keyword) {
        return res.status(400).json({ success: false, error: '缺少搜索关键词' });
      }

      const result = engines.location.searchAddress(keyword, city, parseInt(limit, 10));
      res.json(result);
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/location/nearby', (req, res) => {
    try {
      const { lat, lng, radius = 1000, limit = 10 } = req.query;
      if (!lat || !lng) {
        return res.status(400).json({ success: false, error: '缺少经纬度参数' });
      }

      const result = engines.location.getNearbyAddresses(
        parseFloat(lat),
        parseFloat(lng),
        parseInt(radius, 10),
        parseInt(limit, 10)
      );
      res.json(result);
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/location/parse-address', (req, res) => {
    try {
      const { address } = req.body;
      if (!address) {
        return res.status(400).json({ success: false, error: '缺少地址参数' });
      }

      const result = engines.location.parseAddress(address);
      res.json(result);
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/location/health', (req, res) => {
    try {
      const result = engines.location.healthCheck();
      res.json(result);
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/device-positioning/validate', (req, res) => {
    try {
      const { devices, roomData } = req.body;
      if (!devices || !Array.isArray(devices)) {
        return res.status(400).json({ success: false, error: '缺少设备数据' });
      }

      const result = engines.devicePositioning.validateDevicePositions(devices, roomData || {});
      res.json(result);
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/device-positioning/recommend', (req, res) => {
    try {
      const { deviceType, roomData, existingDevices } = req.body;
      if (!deviceType) {
        return res.status(400).json({ success: false, error: '缺少设备类型' });
      }

      const result = engines.devicePositioning.recommendOptimalPosition(
        deviceType,
        roomData || {},
        existingDevices || []
      );
      res.json(result);
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/device-positioning/report', (req, res) => {
    try {
      const { devices, roomData } = req.body;
      if (!devices || !Array.isArray(devices)) {
        return res.status(400).json({ success: false, error: '缺少设备数据' });
      }

      const result = engines.devicePositioning.generateValidationReport(devices, roomData || {});
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/device-positioning/conflicts', (req, res) => {
    try {
      const { devices } = req.body;
      if (!devices || !Array.isArray(devices)) {
        return res.status(400).json({ success: false, error: '缺少设备数据' });
      }

      const conflicts = engines.devicePositioning.checkDeviceConflicts(devices);
      res.json({
        success: true,
        conflictCount: conflicts.length,
        conflicts
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/device-positioning/rules/:deviceType', (req, res) => {
    try {
      const { deviceType } = req.params;
      const rules = engines.devicePositioning.installationRules[deviceType];
      if (!rules) {
        return res.status(404).json({ success: false, error: '未知设备类型' });
      }

      const dimensions = engines.devicePositioning.deviceDimensions[deviceType];
      res.json({
        success: true,
        deviceType,
        rules,
        dimensions,
        supportedTypes: Object.keys(engines.devicePositioning.installationRules)
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/device-positioning/health', (req, res) => {
    try {
      const result = engines.devicePositioning.healthCheck();
      res.json(result);
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  return router;
}

module.exports = createFieldServicesRouter;
