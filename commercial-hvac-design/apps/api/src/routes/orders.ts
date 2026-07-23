import { Router } from 'express';
import { dealManagementEngine } from '../engines/DealManagementEngine.js';

const router = Router();

/**
 * POST /api/orders
 * 创建订单
 */
router.post('/', (req, res) => {
  try {
    const orderData = req.body;
    const createdBy = req.body.createdBy || 'system';
    
    const result = dealManagementEngine.createOrder(orderData, createdBy);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.status(201).json({
      success: true,
      data: result.order,
    });
  } catch (error: any) {
    console.error('Order creation error:', error);
    res.status(500).json({
      error: 'Order creation failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/orders
 * 获取订单列表
 */
router.get('/', (req, res) => {
  try {
    const { dealerId, status, paymentStatus, startDate, endDate } = req.query;
    
    const orders = dealManagementEngine.getOrders({
      dealerId: dealerId as string,
      status: status as any,
      paymentStatus: paymentStatus as any,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    
    res.json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to fetch orders',
      message: error.message,
    });
  }
});

/**
 * GET /api/orders/:id
 * 获取订单详情
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const order = dealManagementEngine.getOrder(id);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({
      success: true,
      data: order,
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to fetch order',
      message: error.message,
    });
  }
});

/**
 * PUT /api/orders/:id/status
 * 更新订单状态
 */
router.put('/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status, operator, reason } = req.body;
    
    const result = dealManagementEngine.updateStatus(
      id,
      status,
      operator || 'system',
      reason
    );
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Status updated successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to update status',
      message: error.message,
    });
  }
});

/**
 * POST /api/orders/:id/payment
 * 记录付款
 */
router.post('/:id/payment', (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, date, method } = req.body;
    
    const result = dealManagementEngine.recordPayment(id, {
      type,
      amount: Number(amount),
      date: date || new Date().toISOString(),
      method: method || 'bank_transfer',
    });
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Payment recorded successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to record payment',
      message: error.message,
    });
  }
});

/**
 * PUT /api/orders/:id/installation
 * 设置安装信息
 */
router.put('/:id/installation', (req, res) => {
  try {
    const { id } = req.params;
    const { plannedDate, actualDate, installer, completionReport } = req.body;
    
    const result = dealManagementEngine.setInstallationInfo(id, {
      plannedDate,
      actualDate,
      installer,
      completionReport,
    });
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Installation info updated successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to update installation info',
      message: error.message,
    });
  }
});

/**
 * POST /api/orders/:id/commission
 * 计算佣金
 */
router.post('/:id/commission', (req, res) => {
  try {
    const { id } = req.params;
    const { rate } = req.body;
    
    const result = dealManagementEngine.calculateCommission(
      id,
      Number(rate) || 0.05
    );
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({
      success: true,
      data: {
        commissionAmount: result.commission,
        rate,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to calculate commission',
      message: error.message,
    });
  }
});

/**
 * POST /api/orders/:id/commission/pay
 * 支付佣金
 */
router.post('/:id/commission/pay', (req, res) => {
  try {
    const { id } = req.params;
    const { paymentDate } = req.body;
    
    const result = dealManagementEngine.payCommission(
      id,
      paymentDate || new Date().toISOString()
    );
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Commission paid successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to pay commission',
      message: error.message,
    });
  }
});

/**
 * GET /api/orders/stats/performance
 * 获取业绩统计
 */
router.get('/stats/performance', (req, res) => {
  try {
    const { period, dealerId } = req.query;
    
    if (!period) {
      return res.status(400).json({ error: 'Period is required (e.g., 2024-01 or 2024-Q1)' });
    }
    
    const stats = dealManagementEngine.getPerformanceStats(
      period as string,
      dealerId as string
    );
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to fetch performance stats',
      message: error.message,
    });
  }
});

/**
 * GET /api/orders/rankings/dealers
 * 获取经销商排名
 */
router.get('/rankings/dealers', (req, res) => {
  try {
    const { period, limit } = req.query;
    
    if (!period) {
      return res.status(400).json({ error: 'Period is required' });
    }
    
    const rankings = dealManagementEngine.getDealerRanking(
      period as string,
      Number(limit) || 10
    );
    
    res.json({
      success: true,
      data: rankings,
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to fetch rankings',
      message: error.message,
    });
  }
});

export { router as orderRoutes };
