/**
 * Agent-1: 管理员后台管理系统API (精简版)
 * 一小时冲刺开发 - 核心功能框架
 * 
 * 覆盖PRD新增P0需求：
 * - 产品参数配置
 * - 价格管理配置  
 * - 系统参数管理
 * - 账号管理
 * - 数据管控
 * - 安全管控
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class AdminSystem {
  constructor(db, JWT_SECRET) {
    this.db = db;
    this.JWT_SECRET = JWT_SECRET;
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // 管理员权限检查中间件
    const requireAdmin = (req, res, next) => {
      if (req.user.role !== 'rheem_admin') {
        return res.status(403).json({ success: false, error: '仅管理员可访问' });
      }
      next();
    };

    // ========== 1. 产品参数配置 ==========
    // 获取所有产品
    this.router.get('/products', this.authenticate.bind(this), requireAdmin, (req, res) => {
      res.json({
        success: true,
        data: this.db.products || [],
        total: (this.db.products || []).length
      });
    });

    // 单个产品配置
    this.router.post('/products', this.authenticate.bind(this), requireAdmin, (req, res) => {
      const { model, specs, scenario, system, price, image } = req.body;
      
      const product = {
        id: `PROD-${Date.now()}`,
        model,
        specs,
        scenario,
        system, // 五恒/热水/新风/净水等
        price,
        image,
        updatedAt: new Date().toISOString(),
        updatedBy: req.user.id
      };
      
      if (!this.db.products) this.db.products = [];
      this.db.products.push(product);
      
      res.json({ success: true, data: product, message: '产品配置成功' });
    });

    // 批量导入产品
    this.router.post('/products/batch', this.authenticate.bind(this), requireAdmin, (req, res) => {
      const { products } = req.body;
      let success = 0;
      let failed = 0;
      const errors = [];

      products.forEach((prod, index) => {
        if (!prod.model || !prod.system) {
          failed++;
          errors.push({ index, reason: '型号或系统类型缺失' });
        } else {
          if (!this.db.products) this.db.products = [];
          this.db.products.push({
            id: `PROD-${Date.now()}-${index}`,
            ...prod,
            updatedAt: new Date().toISOString()
          });
          success++;
        }
      });

      res.json({
        success: true,
        data: { success, failed, errors },
        message: `批量导入完成：${success}成功, ${failed}失败`
      });
    });

    // ========== 2. 价格管理配置 ==========
    this.router.get('/pricing', this.authenticate.bind(this), requireAdmin, (req, res) => {
      res.json({
        success: true,
        data: this.db.pricing || {
          baseDiscount: { min: 0.85, max: 0.95 },
          minMargin: 0.15,
          regionalPricing: {}
        }
      });
    });

    this.router.post('/pricing', this.authenticate.bind(this), requireAdmin, (req, res) => {
      const { baseDiscount, minMargin, regionalPricing } = req.body;
      
      this.db.pricing = {
        baseDiscount,
        minMargin,
        regionalPricing,
        updatedAt: new Date().toISOString(),
        updatedBy: req.user.id
      };
      
      res.json({ success: true, data: this.db.pricing, message: '价格配置成功' });
    });

    // ========== 3. 系统参数管理 ==========
    this.router.get('/settings', this.authenticate.bind(this), requireAdmin, (req, res) => {
      res.json({
        success: true,
        data: this.db.settings || {
          systemName: '瑞美舒适家居系统设计平台',
          logo: '/assets/rheem-logo.png',
          version: 'V1.0',
          docNumber: 'RHEEM-SD-PRD-2026001',
          colors: { primary: '#C41230', secondary: '#4A4A4A' },
          fonts: { title: '瑞美标题字体', body: '瑞美正文字体' },
          logRetentionDays: 180,
          syncFrequency: '1h'
        }
      });
    });

    this.router.post('/settings', this.authenticate.bind(this), requireAdmin, (req, res) => {
      const settings = req.body;
      this.db.settings = { ...this.db.settings, ...settings, updatedAt: new Date().toISOString() };
      res.json({ success: true, data: this.db.settings, message: '系统参数配置成功' });
    });

    // ========== 4. 账号管理 ==========
    this.router.get('/users', this.authenticate.bind(this), requireAdmin, (req, res) => {
      const { role, region } = req.query;
      let users = this.db.users || [];
      
      if (role) users = users.filter(u => u.role === role);
      if (region) users = users.filter(u => u.region === region);
      
      res.json({
        success: true,
        data: users.map(u => ({
          id: u.id,
          name: u.name,
          phone: u.phone,
          role: u.role,
          region: u.region,
          status: u.status,
          createdAt: u.createdAt
        })),
        total: users.length
      });
    });

    this.router.post('/users/:id/reset-password', this.authenticate.bind(this), requireAdmin, (req, res) => {
      const tempPassword = Math.random().toString(36).substring(2, 10);
      const user = this.db.users.find(u => u.id === parseInt(req.params.id));
      
      if (!user) {
        return res.status(404).json({ success: false, error: '用户不存在' });
      }
      
      user.password = bcrypt.hashSync(tempPassword, 8);
      user.passwordExpired = true;
      user.tempPasswordExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      
      // 记录操作日志
      this.logAction(req.user.id, 'reset_password', `重置用户${user.name}密码`);
      
      res.json({
        success: true,
        data: { tempPassword },
        message: '密码重置成功，临时密码24小时内有效，首次登录需修改密码'
      });
    });

    this.router.post('/users/:id/toggle', this.authenticate.bind(this), requireAdmin, (req, res) => {
      const user = this.db.users.find(u => u.id === parseInt(req.params.id));
      if (!user) return res.status(404).json({ success: false, error: '用户不存在' });
      
      user.status = user.status === 'active' ? 'disabled' : 'active';
      user.updatedAt = new Date().toISOString();
      
      this.logAction(req.user.id, 'toggle_user', `${user.status === 'active' ? '启用' : '禁用'}用户${user.name}`);
      
      res.json({ success: true, data: user, message: `账号已${user.status === 'active' ? '启用' : '禁用'}` });
    });

    // ========== 5. 数据管控 ==========
    this.router.get('/data/projects', this.authenticate.bind(this), requireAdmin, (req, res) => {
      const { startDate, endDate } = req.query;
      let projects = this.db.projects || [];
      
      if (startDate) projects = projects.filter(p => new Date(p.createdAt) >= new Date(startDate));
      if (endDate) projects = projects.filter(p => new Date(p.createdAt) <= new Date(endDate));
      
      res.json({ success: true, data: projects, total: projects.length });
    });

    this.router.get('/data/export', this.authenticate.bind(this), requireAdmin, (req, res) => {
      const { type, format = 'excel' } = req.query;
      
      // 模拟数据导出
      const exportData = {
        type,
        format,
        generatedAt: new Date().toISOString(),
        recordCount: (this.db[type] || []).length,
        downloadUrl: `/admin/exports/export-${Date.now()}.${format}`
      };
      
      res.json({ success: true, data: exportData, message: '数据导出成功' });
    });

    this.router.post('/data/backup', this.authenticate.bind(this), requireAdmin, (req, res) => {
      const backup = {
        id: `BK-${Date.now()}`,
        timestamp: new Date().toISOString(),
        data: JSON.stringify(this.db),
        size: JSON.stringify(this.db).length,
        createdBy: req.user.id
      };
      
      if (!this.db.backups) this.db.backups = [];
      this.db.backups.push(backup);
      
      res.json({ success: true, data: backup, message: '数据备份成功，保留365天' });
    });

    // ========== 6. 安全管控 ==========
    this.router.get('/security/settings', this.authenticate.bind(this), requireAdmin, (req, res) => {
      res.json({
        success: true,
        data: this.db.securitySettings || {
          passwordComplexity: { minLength: 8, requireUpper: true, requireLower: true, requireNumber: true, requireSpecial: true },
          sessionTimeout: 60,
          allowedIPs: [],
          loginAttempts: 5
        }
      });
    });

    this.router.post('/security/settings', this.authenticate.bind(this), requireAdmin, (req, res) => {
      this.db.securitySettings = { ...req.body, updatedAt: new Date().toISOString() };
      res.json({ success: true, data: this.db.securitySettings, message: '安全设置已更新' });
    });

    this.router.get('/security/alerts', this.authenticate.bind(this), requireAdmin, (req, res) => {
      const alerts = this.db.securityAlerts || [
        { id: 1, type: '异地登录', user: '张三', ip: '192.168.1.100', time: new Date().toISOString(), status: 'pending' }
      ];
      res.json({ success: true, data: alerts });
    });

    // 操作日志查询
    this.router.get('/logs', this.authenticate.bind(this), requireAdmin, (req, res) => {
      const { userId, operation, startDate, endDate } = req.query;
      let logs = this.db.adminLogs || [];
      
      if (userId) logs = logs.filter(l => l.userId === parseInt(userId));
      if (operation) logs = logs.filter(l => l.operation === operation);
      if (startDate) logs = logs.filter(l => new Date(l.timestamp) >= new Date(startDate));
      if (endDate) logs = logs.filter(l => new Date(l.timestamp) <= new Date(endDate));
      
      res.json({ success: true, data: logs.slice(-1000), total: logs.length });
    });

    // 统计信息
    this.router.get('/stats', this.authenticate.bind(this), requireAdmin, (req, res) => {
      res.json({
        success: true,
        data: {
          users: {
            total: (this.db.users || []).length,
            byRole: {
              admin: (this.db.users || []).filter(u => u.role === 'rheem_admin').length,
              designer: (this.db.users || []).filter(u => u.role === 'designer').length,
              sales: (this.db.users || []).filter(u => u.role === 'sales').length
            }
          },
          products: { total: (this.db.products || []).length },
          projects: { total: (this.db.projects || []).length },
          backups: { total: (this.db.backups || []).length }
        }
      });
    });
  }

  authenticate(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, error: '未提供访问令牌' });
    }

    jwt.verify(token, this.JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ success: false, error: '令牌无效' });
      req.user = user;
      next();
    });
  }

  logAction(userId, operation, details) {
    if (!this.db.adminLogs) this.db.adminLogs = [];
    this.db.adminLogs.push({
      userId,
      operation,
      details,
      timestamp: new Date().toISOString(),
      ip: 'admin-system'
    });
  }

  getRouter() {
    return this.router;
  }
}

module.exports = AdminSystem;
