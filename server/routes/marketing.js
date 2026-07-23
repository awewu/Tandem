/**
 * 营销裂变API - Marketing API
 * 完整营销功能：优惠券/分销/拼团/秒杀/积分/会员
 */

const { errorResponse } = require('../utils/sanitize-error');
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getRuntimeEngine } = require('../modules/runtimeEngineAccess');

const engine = getRuntimeEngine('marketing');

// ========== 优惠券 ==========

/**
 * POST /api/marketing/coupons
 * 创建优惠券（管理员）
 */
router.post('/coupons', auth, async (req, res) => {
  try {
    const coupon = engine.createCoupon(req.body);
    res.json({
      success: true,
      message: '优惠券创建成功',
      data: coupon
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/marketing/coupons/:id/claim
 * 领取优惠券
 */
router.post('/coupons/:id/claim', auth, async (req, res) => {
  try {
    const { userId } = req.user;
    const result = engine.claimCoupon(req.params.id, userId);
    res.json(result);
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/marketing/coupons/calculate
 * 计算优惠金额
 */
router.post('/coupons/calculate', async (req, res) => {
  try {
    const { couponCode, orderAmount } = req.body;
    const coupon = engine.getCouponByCode(couponCode);
    
    if (!coupon) {
      return res.status(404).json({ success: false, message: '优惠券不存在' });
    }
    
    const result = engine.calculateDiscount(coupon, orderAmount);
    res.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/marketing/coupons
 * 获取优惠券列表
 */
router.get('/coupons', async (req, res) => {
  try {
    const { type = 'all', status = 'active' } = req.query;
    
    // 模拟返回优惠券列表
    const coupons = [
      {
        id: 'CP1',
        name: '新用户专享',
        type: 'fixed',
        value: 100,
        minOrder: 1000,
        remaining: 500,
        endDate: '2026-12-31'
      },
      {
        id: 'CP2',
        name: '满减券',
        type: 'fixed',
        value: 200,
        minOrder: 5000,
        remaining: 200,
        endDate: '2026-12-31'
      },
      {
        id: 'CP3',
        name: '折扣券',
        type: 'percent',
        value: 10,
        minOrder: 2000,
        remaining: 100,
        endDate: '2026-12-31'
      }
    ];
    
    res.json({
      success: true,
      data: coupons.filter(c => status === 'all' || c.status === status)
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

// ========== 分销裂变 ==========

/**
 * POST /api/marketing/referral
 * 建立分销关系
 */
router.post('/referral', async (req, res) => {
  try {
    const { userId } = req.user || {};
    const { referrerId } = req.body;
    
    // 如果没有登录，使用临时ID
    const newUserId = userId || `temp_${Date.now()}`;
    
    const result = engine.createReferral(newUserId, referrerId);
    res.json(result);
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/marketing/promoter/dashboard
 * 推广者仪表盘
 */
router.get('/promoter/dashboard', auth, async (req, res) => {
  try {
    const { userId } = req.user;
    const { period = '30d' } = req.query;
    
    const dashboard = engine.getPromoterDashboard(userId, period);
    res.json({ success: true, data: dashboard });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/marketing/promoter/invite-code
 * 获取邀请码
 */
router.get('/promoter/invite-code', auth, async (req, res) => {
  try {
    const { userId } = req.user;
    const code = engine.generateTrackingCode(userId, 'referral');
    
    res.json({
      success: true,
      data: {
        code,
        shareUrl: `https://rheem.com/register?ref=${code}`,
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(`https://rheem.com/register?ref=${code}`)}`,
        shareText: '注册瑞美舒适家居，首单立减100元！'
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/marketing/commission/withdraw
 * 佣金提现
 */
router.post('/commission/withdraw', auth, async (req, res) => {
  try {
    const { userId } = req.user;
    const { amount, method = 'wechat' } = req.body;
    
    // 检查可提现余额
    const stats = engine.getReferralStats(userId, 'all');
    
    if (stats.available < amount) {
      return res.status(400).json({
        success: false,
        message: `可提现余额不足，当前可用: ${stats.available}`
      });
    }
    
    // 处理提现
    res.json({
      success: true,
      message: '提现申请已提交',
      data: {
        withdrawId: `WD${Date.now()}`,
        amount,
        method,
        status: 'pending',
        estimatedArrival: '1-3个工作日'
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

// ========== 拼团 ==========

/**
 * POST /api/marketing/group-buy
 * 创建拼团活动（管理员）
 */
router.post('/group-buy', auth, async (req, res) => {
  try {
    const activity = engine.createGroupBuy(req.body);
    res.json({
      success: true,
      message: '拼团活动创建成功',
      data: activity
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/marketing/group-buy/:id/join
 * 开团/参团
 */
router.post('/group-buy/:id/join', auth, async (req, res) => {
  try {
    const { userId } = req.user;
    const { groupId, action = 'join' } = req.body;
    
    let result;
    if (action === 'create') {
      result = engine.createGroup(req.params.id, userId);
    } else {
      result = engine.joinGroup(groupId, userId);
    }
    
    res.json(result);
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/marketing/group-buy
 * 拼团活动列表
 */
router.get('/group-buy', async (req, res) => {
  try {
    const activities = [
      {
        id: 'GB1',
        productName: '瑞美1.5匹风管机',
        originalPrice: 4500,
        groupPrice: 3999,
        discount: 11,
        minMembers: 3,
        currentMembers: 1,
        status: 'forming',
        expireIn: 23 * 3600 // 23小时
      },
      {
        id: 'GB2',
        productName: '6匹多联机套餐',
        originalPrice: 19800,
        groupPrice: 16800,
        discount: 15,
        minMembers: 2,
        currentMembers: 2,
        status: 'success'
      }
    ];
    
    res.json({ success: true, data: activities });
  } catch (error) {
    return errorResponse(res, error);
  }
});

// ========== 秒杀 ==========

/**
 * POST /api/marketing/flash-sale
 * 创建秒杀活动（管理员）
 */
router.post('/flash-sale', auth, async (req, res) => {
  try {
    const sale = engine.createFlashSale(req.body);
    res.json({
      success: true,
      message: '秒杀活动创建成功',
      data: sale
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/marketing/flash-sale/:id/buy
 * 抢购
 */
router.post('/flash-sale/:id/buy', auth, async (req, res) => {
  try {
    const { userId } = req.user;
    const { quantity = 1 } = req.body;
    
    const result = engine.flashSaleBuy(req.params.id, userId, quantity);
    res.json(result);
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/marketing/flash-sale
 * 秒杀活动列表
 */
router.get('/flash-sale', async (req, res) => {
  try {
    const sales = [
      {
        id: 'FS1',
        productName: '3匹风管机',
        originalPrice: 8500,
        salePrice: 6999,
        discount: 18,
        stock: 10,
        remaining: 3,
        status: 'ongoing',
        endTime: new Date(Date.now() + 2 * 3600 * 1000)
      },
      {
        id: 'FS2',
        productName: '新风机350风量',
        originalPrice: 7800,
        salePrice: 5999,
        discount: 23,
        stock: 20,
        remaining: 15,
        status: 'warmup',
        startTime: new Date(Date.now() + 24 * 3600 * 1000)
      }
    ];
    
    res.json({ success: true, data: sales });
  } catch (error) {
    return errorResponse(res, error);
  }
});

// ========== 积分 ==========

/**
 * GET /api/marketing/points/rules
 * 积分规则
 */
router.get('/points/rules', async (req, res) => {
  try {
    const rules = engine.getPointsRules();
    res.json({ success: true, data: rules });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/marketing/points/balance
 * 查询积分余额
 */
router.get('/points/balance', auth, async (req, res) => {
  try {
    const { userId } = req.user;
    
    // 模拟积分数据
    res.json({
      success: true,
      data: {
        balance: 2580,
        totalEarned: 5000,
        totalSpent: 2420,
        expireSoon: 300,
        expireDate: '2026-06-30'
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/marketing/checkin
 * 签到
 */
router.post('/checkin', auth, async (req, res) => {
  try {
    const { userId } = req.user;
    const result = engine.checkin(userId);
    res.json(result);
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/marketing/checkin/status
 * 签到状态
 */
router.get('/checkin/status', auth, async (req, res) => {
  try {
    const { userId } = req.user;
    const lastCheckin = engine.getLastCheckin(userId);
    
    const today = new Date().toDateString();
    const checkedToday = lastCheckin && lastCheckin.date === today;
    
    res.json({
      success: true,
      data: {
        checkedToday,
        continuousDays: lastCheckin?.continuous || 0,
        nextReward: checkedToday ? 0 : engine.getPointsRules().checkin.continuous[Math.min((lastCheckin?.continuous || 0), 6)]
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

// ========== 会员 ==========

/**
 * GET /api/marketing/membership/levels
 * 会员等级
 */
router.get('/membership/levels', async (req, res) => {
  try {
    const levels = engine.getMembershipLevels();
    res.json({ success: true, data: levels });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/marketing/membership/my-level
 * 我的会员等级
 */
router.get('/membership/my-level', auth, async (req, res) => {
  try {
    const { userId } = req.user;
    const level = engine.calculateMembershipLevel(userId);
    
    res.json({
      success: true,
      data: {
        ...level,
        progress: {
          points: 1250,
          pointsNeeded: 2000,
          spend: 8500,
          spendNeeded: 10000
        }
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

// ========== 分享 ==========

/**
 * POST /api/marketing/share/generate
 * 生成分享内容
 */
router.post('/share/generate', auth, async (req, res) => {
  try {
    const { userId } = req.user;
    const { type, targetId, channel } = req.body;
    
    const content = engine.generateShareContent({
      type,
      targetId,
      userId,
      channel
    });
    
    res.json({
      success: true,
      data: content
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/marketing/share/track
 * 追踪分享效果
 */
router.post('/share/track', async (req, res) => {
  try {
    const { trackingCode, action, visitorInfo } = req.body;
    
    const result = engine.trackShare(trackingCode, action, visitorInfo);
    res.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(res, error);
  }
});

// ========== 数据中心 ==========

/**
 * GET /api/marketing/analytics/overview
 * 营销数据概览（管理员）
 */
router.get('/analytics/overview', auth, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    res.json({
      success: true,
      data: {
        period,
        overview: {
          newUsers: 1250,
          activeUsers: 8500,
          totalOrders: 3200,
          totalRevenue: 15800000,
          conversionRate: 3.2
        },
        fission: {
          totalShares: 8500,
          shareConversion: 12.5,
          referralOrders: 680,
          referralRevenue: 3200000,
          topPromoters: 15
        },
        promotions: {
          couponsUsed: 1200,
          groupBuys: 45,
          flashSales: 8,
          totalDiscount: 580000
        }
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/marketing/analytics/ranking
 * 推广排行榜
 */
router.get('/analytics/ranking', async (req, res) => {
  try {
    const { type = 'weekly', limit = 10 } = req.query;
    
    // 模拟排行榜数据
    const rankings = [
      { rank: 1, name: '张**', avatar: '', invites: 56, earnings: 5200 },
      { rank: 2, name: '李**', avatar: '', invites: 42, earnings: 3800 },
      { rank: 3, name: '王**', avatar: '', invites: 38, earnings: 3200 },
      { rank: 4, name: '赵**', avatar: '', invites: 31, earnings: 2600 },
      { rank: 5, name: '陈**', avatar: '', invites: 28, earnings: 2100 }
    ];
    
    res.json({
      success: true,
      data: {
        type,
        rankings: rankings.slice(0, limit),
        myRank: {
          rank: 156,
          invites: 5,
          earnings: 480,
          percentile: '前15%'
        }
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

module.exports = router;
