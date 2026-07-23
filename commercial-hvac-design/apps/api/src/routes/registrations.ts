import { Router } from 'express';
import { registrationEngine } from '../engines/ProjectRegistrationEngine.js';

const router = Router();

/**
 * POST /api/registrations
 * 提交项目报备
 */
router.post('/', (req, res) => {
  try {
    const {
      dealerId,
      dealerName,
      projectName,
      customerName,
      customerPhone,
      customerCompany,
      projectAddress,
      projectType,
      estimatedAmount,
      estimatedUnits,
      salesRep,
    } = req.body;

    // 参数验证
    if (!dealerId || !projectName || !customerName || !customerPhone) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['dealerId', 'projectName', 'customerName', 'customerPhone'],
      });
    }

    const result = registrationEngine.submitRegistration(
      dealerId,
      dealerName || '未知经销商',
      {
        projectName,
        customerName,
        customerPhone,
        customerCompany,
        projectAddress: projectAddress || '',
        projectType: projectType || 'hotel',
        estimatedAmount: Number(estimatedAmount) || 0,
        estimatedUnits: Number(estimatedUnits) || 0,
        salesRep: salesRep || '',
      }
    );

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
      });
    }

    res.status(201).json({
      success: true,
      data: result.registration,
    });
  } catch (error: any) {
    console.error('Registration submission error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/registrations
 * 获取报备列表
 */
router.get('/', (req, res) => {
  try {
    const { dealerId, status } = req.query;
    
    const registrations = registrationEngine.getRegistrations(
      dealerId as string,
      status as any
    );
    
    res.json({
      success: true,
      count: registrations.length,
      data: registrations,
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to fetch registrations',
      message: error.message,
    });
  }
});

/**
 * GET /api/registrations/:id
 * 获取报备详情
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const registration = registrationEngine.getRegistration(id);
    
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }
    
    res.json({
      success: true,
      data: registration,
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to fetch registration',
      message: error.message,
    });
  }
});

/**
 * POST /api/registrations/:id/follow-up
 * 添加跟进记录
 */
router.post('/:id/follow-up', (req, res) => {
  try {
    const { id } = req.params;
    const { type, content, result, nextAction, nextDate, createdBy } = req.body;
    
    const addResult = registrationEngine.addFollowUpLog(id, {
      type,
      content,
      result,
      nextAction,
      nextDate,
      createdBy: createdBy || 'system',
    });
    
    if (!addResult.success) {
      return res.status(400).json({ error: addResult.error });
    }
    
    res.json({
      success: true,
      message: 'Follow-up log added successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to add follow-up log',
      message: error.message,
    });
  }
});

/**
 * POST /api/registrations/:id/extend
 * 延期保护期
 */
router.post('/:id/extend', (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const result = registrationEngine.extendProtection(id, reason || '申请延期');
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({
      success: true,
      data: {
        newExpiry: result.newExpiry,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to extend protection',
      message: error.message,
    });
  }
});

/**
 * POST /api/registrations/:id/convert
 * 标记为已成交
 */
router.post('/:id/convert', (req, res) => {
  try {
    const { id } = req.params;
    const { orderAmount, orderDate, contractNo } = req.body;
    
    const result = registrationEngine.markAsConverted(id, {
      orderAmount: Number(orderAmount) || 0,
      orderDate: orderDate || new Date().toISOString(),
      contractNo,
    });
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Registration marked as converted',
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to convert registration',
      message: error.message,
    });
  }
});

/**
 * POST /api/registrations/:id/lost
 * 标记为已丢单
 */
router.post('/:id/lost', (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const result = registrationEngine.markAsLost(id, reason || '未中标');
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Registration marked as lost',
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to mark as lost',
      message: error.message,
    });
  }
});

/**
 * GET /api/registrations/stats/overview
 * 获取报备统计概览
 */
router.get('/stats/overview', (req, res) => {
  try {
    const { dealerId } = req.query;
    
    const stats = registrationEngine.getRegistrationStats(dealerId as string);
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to fetch stats',
      message: error.message,
    });
  }
});

/**
 * GET /api/registrations/alerts/expiring
 * 获取即将过期的报备
 */
router.get('/alerts/expiring', (req, res) => {
  try {
    const { days } = req.query;
    
    const expiring = registrationEngine.getExpiringRegistrations(
      Number(days) || 7
    );
    
    res.json({
      success: true,
      count: expiring.length,
      data: expiring,
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to fetch expiring registrations',
      message: error.message,
    });
  }
});

export { router as registrationRoutes };
