/**
 * 管理员 Router (factory pattern)
 * 挂载前缀: /api/admin
 * 2026-04-22 P1-Task3 从 server-production.js 抽出 (24 个路由)
 *
 * 注意:
 *   - 所有路由在挂载时已由 adminGuard (authenticateToken + checkRole) 前置保护
 *   - router 内部无需再声明 auth 中间件
 *   - 依赖通过 factory 注入
 */
const express = require('express');
const { asyncRoute, errorResponse } = require('../utils/sanitize-error');

/**
 * @param {Object} deps
 * @param {Object} deps.db - { users, projects, templates }
 * @param {Function} deps.maskSensitiveData - 敏感数据脱敏
 */
module.exports = function createAdminRouter({ db, maskSensitiveData }) {
  const router = express.Router();

  // ========== 用户管理 ==========
  router.get('/users', asyncRoute(async (req, res) => {
    res.json({
      success: true,
      data: db.users.map(u => ({
        id: u.id,
        name: u.name,
        phone: maskSensitiveData(u.phone, 'phone'),
        role: u.role,
        roleName: u.roleName
      }))
    });
  }));

  router.get('/stats', asyncRoute(async (req, res) => {
    res.json({
      success: true,
      data: {
        totalUsers: db.users.length,
        totalProjects: db.projects.length,
        totalTemplates: db.templates.length,
        byRole: {
          designers: db.users.filter(u => u.role === 'designer').length,
          sales: db.users.filter(u => u.role === 'sales').length
        }
      }
    });
  }));

  // ========== 产品管理 ==========
  router.get('/products', asyncRoute(async (req, res) => {
    const products = db.products || [];
    res.json({ success: true, data: products, total: products.length });
  }));

  router.post('/products', asyncRoute(async (req, res) => {
    const product = {
      id: `PROD-${Date.now()}`,
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!db.products) db.products = [];
    db.products.push(product);
    res.json({ success: true, data: product, message: '产品创建成功' });
  }));

  router.put('/products/:id', asyncRoute(async (req, res) => {
    const index = db.products?.findIndex(p => p.id === req.params.id);
    if (index === -1 || index === undefined) {
      return res.status(404).json({ success: false, error: '产品不存在' });
    }
    db.products[index] = { ...db.products[index], ...req.body, updatedAt: new Date().toISOString() };
    res.json({ success: true, data: db.products[index], message: '产品更新成功' });
  }));

  router.delete('/products/:id', asyncRoute(async (req, res) => {
    const index = db.products?.findIndex(p => p.id === req.params.id);
    if (index === -1 || index === undefined) {
      return res.status(404).json({ success: false, error: '产品不存在' });
    }
    const deleted = db.products.splice(index, 1)[0];
    res.json({ success: true, data: { id: req.params.id, deleted: true, name: deleted.name }, message: '产品删除成功' });
  }));

  // ========== 价格管理 ==========
  router.get('/pricing', asyncRoute(async (req, res) => {
    const pricing = db.pricing || {
      baseDiscount: 0.85,
      categoryDiscounts: { '五恒系统': 0.88, '净水系统': 0.9, '采暖系统': 0.87 },
      specialOffers: [],
      lastUpdated: new Date().toISOString()
    };
    res.json({ success: true, data: pricing });
  }));

  router.post('/pricing', asyncRoute(async (req, res) => {
    db.pricing = { ...req.body, lastUpdated: new Date().toISOString() };
    res.json({ success: true, data: db.pricing, message: '价格配置已保存' });
  }));

  // ========== 系统配置 ==========
  router.get('/system-config', asyncRoute(async (req, res) => {
    res.json({
      success: true,
      data: {
        logo: '/images/rheem-logo.png',
        companyName: '瑞美舒适家居',
        phone: '400-888-0000',
        email: 'info@rheem.cn',
        version: 'v1.0.0',
        featureFlags: {
          enableAI: true, enableCollaboration: true, enable3D: true, enableVoiceCommand: false
        },
        syncIntervalMinutes: 5
      }
    });
  }));

  router.post('/system-config', asyncRoute(async (req, res) => {
    res.json({ success: true, data: req.body });
  }));

  // ========== 账号权限管理 ==========
  router.post('/users/:id/disable', asyncRoute(async (req, res) => {
    res.json({ success: true, data: { id: req.params.id, status: 'disabled' } });
  }));

  router.post('/users/:id/enable', asyncRoute(async (req, res) => {
    res.json({ success: true, data: { id: req.params.id, status: 'active' } });
  }));

  router.post('/users/:id/reset-password', asyncRoute(async (req, res) => {
    res.json({ success: true, data: { id: req.params.id, newPassword: '123456' } });
  }));

  // ========== 日志管理 ==========
  router.get('/logs/login', asyncRoute(async (req, res) => {
    res.json({
      success: true,
      data: [
        { id: 1, userId: 1, phone: '13900000000', loginTime: '2026-04-10T08:00:00Z', ip: '192.168.1.100', status: 'success' },
        { id: 2, userId: 2, phone: '13800000000', loginTime: '2026-04-10T09:00:00Z', ip: '192.168.1.101', status: 'success' }
      ]
    });
  }));

  router.get('/logs/operations', asyncRoute(async (req, res) => {
    res.json({
      success: true,
      data: [
        { id: 1, userId: 1, operation: 'create_solution', details: '创建方案', timestamp: '2026-04-10T08:30:00Z' },
        { id: 2, userId: 2, operation: 'update_quotation', details: '更新报价', timestamp: '2026-04-10T09:30:00Z' }
      ]
    });
  }));

  router.get('/logs/errors', asyncRoute(async (req, res) => {
    res.json({
      success: true,
      data: [
        { id: 1, level: 'error', message: 'API timeout', timestamp: '2026-04-10T10:00:00Z', stack: '...' },
        { id: 2, level: 'warning', message: 'Slow query', timestamp: '2026-04-10T10:30:00Z', stack: '...' }
      ]
    });
  }));

  router.get('/logs/performance', asyncRoute(async (req, res) => {
    res.json({
      success: true,
      data: [
        { id: 1, endpoint: '/api/workflow/complete', responseTime: 150, timestamp: '2026-04-10T11:00:00Z' },
        { id: 2, endpoint: '/api/pain-diagnosis', responseTime: 80, timestamp: '2026-04-10T11:30:00Z' }
      ]
    });
  }));

  router.get('/logs/all', asyncRoute(async (req, res) => {
    res.json({
      success: true,
      data: { login: [], operations: [], errors: [], performance: [] }
    });
  }));

  return router;
};
