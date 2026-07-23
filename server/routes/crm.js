/**
 * CRM 销售管理 API 路由
 * ─────────────────────────────────────────
 * 客户360°视图、跟进记录、商机漏斗管理
 * 
 * 包含:
 * - 客户管理 CRUD
 * - 跟进记录管理
 * - 商机漏斗管理
 * - 销售阶段推进
 * - 智能提醒
 * 
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const { errorResponse } = require('../utils/sanitize-error');
const { auth } = require('../middleware/auth');

// 内存存储（生产环境应使用数据库）
const customers = new Map();
const interactions = new Map();
const opportunities = new Map();
let customerIdCounter = 1;

// 销售阶段定义
const SALES_STAGES = [
  { id: 'prospecting', name: '线索挖掘', probability: 0.1, order: 1 },
  { id: 'qualification', name: '需求确认', probability: 0.2, order: 2 },
  { id: 'proposal', name: '方案报价', probability: 0.4, order: 3 },
  { id: 'negotiation', name: '商务谈判', probability: 0.6, order: 4 },
  { id: 'contract', name: '合同签署', probability: 0.8, order: 5 },
  { id: 'won', name: '成交赢单', probability: 1.0, order: 6 },
  { id: 'lost', name: '流失归档', probability: 0, order: 7 }
];

/**
 * 生成客户RFM评分
 * @param {Object} customer - 客户对象
 * @param {Array} interactions - 互动记录
 * @returns {Object} RFM评分
 */
function calculateRFM(customer, interactions) {
  const now = Date.now();
  
  // 计算Recency (最近互动天数)
  const lastInteraction = interactions.length > 0 
    ? Math.max(...interactions.map(i => new Date(i.timestamp).getTime()))
    : new Date(customer.createdAt).getTime();
  const recencyDays = Math.floor((now - lastInteraction) / (1000 * 60 * 60 * 24));
  
  // 计算Frequency (互动频率)
  const frequency = interactions.length;
  
  // 计算Monetary (预估价值)
  const monetary = customer.estimatedValue || 0;
  
  return {
    recency: recencyDays,
    frequency,
    monetary,
    score: Math.floor((frequency * 10 + (100 - recencyDays) * 5 + monetary / 1000) / 100)
  };
}

/**
 * GET /api/crm/customers
 * 获取客户列表（支持分页、筛选、搜索）
 */
router.get('/customers', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, stage, tag, search } = req.query;
    
    let customerList = Array.from(customers.values());
    
    // 按销售阶段筛选
    if (stage) {
      customerList = customerList.filter(c => c.stage === stage);
    }
    
    // 按标签筛选
    if (tag) {
      customerList = customerList.filter(c => c.tags?.includes(tag));
    }
    
    // 搜索
    if (search) {
      const searchLower = search.toLowerCase();
      customerList = customerList.filter(c => 
        c.name?.toLowerCase().includes(searchLower) ||
        c.phone?.includes(searchLower) ||
        c.company?.toLowerCase().includes(searchLower)
      );
    }
    
    // 分页
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginated = customerList.slice(skip, skip + parseInt(limit));
    
    // 补充RFM和互动统计
    const enriched = paginated.map(c => {
      const customerInteractions = Array.from(interactions.values())
        .filter(i => i.customerId === c.id);
      const rfm = calculateRFM(c, customerInteractions);
      
      return {
        ...c,
        rfm,
        interactionCount: customerInteractions.length,
        lastContact: customerInteractions.length > 0 
          ? customerInteractions[customerInteractions.length - 1].timestamp
          : c.createdAt
      };
    });
    
    res.json({
      success: true,
      data: {
        customers: enriched,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: customerList.length,
          pages: Math.ceil(customerList.length / parseInt(limit))
        }
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/crm/customers
 * 创建新客户
 */
router.post('/customers', auth, async (req, res) => {
  try {
    const { name, phone, company, address, estimatedValue, tags, source } = req.body;
    
    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: '客户姓名和电话必填'
      });
    }
    
    // 检查电话是否已存在
    const existing = Array.from(customers.values()).find(c => c.phone === phone);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: '该手机号已存在'
      });
    }
    
    const customer = {
      id: `CUST-${Date.now()}-${customerIdCounter++}`,
      name,
      phone,
      company: company || '',
      address: address || '',
      estimatedValue: estimatedValue || 0,
      tags: tags || [],
      source: source || 'manual',
      stage: 'prospecting',
      assignedTo: req.user?.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    customers.set(customer.id, customer);
    
    res.status(201).json({
      success: true,
      data: customer
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/crm/customers/:id
 * 获取客户详情（360°视图）
 */
router.get('/customers/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const customer = customers.get(id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: '客户不存在'
      });
    }
    
    // 获取客户互动记录
    const customerInteractions = Array.from(interactions.values())
      .filter(i => i.customerId === id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // 获取客户商机
    const customerOpportunities = Array.from(opportunities.values())
      .filter(o => o.customerId === id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // 计算RFM
    const rfm = calculateRFM(customer, customerInteractions);
    
    // 生成跟进建议
    const lastInteraction = customerInteractions[0];
    const daysSinceLastContact = lastInteraction 
      ? Math.floor((Date.now() - new Date(lastInteraction.timestamp).getTime()) / (1000 * 60 * 60 * 24))
      : Math.floor((Date.now() - new Date(customer.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    
    let followUpRecommendation = '';
    if (daysSinceLastContact > 7) {
      followUpRecommendation = '已超过7天未联系，建议立即跟进';
    } else if (customer.stage === 'proposal' && daysSinceLastContact > 3) {
      followUpRecommendation = '报价后3天未联系，建议询问客户反馈';
    } else if (customer.stage === 'negotiation') {
      followUpRecommendation = '商务谈判阶段，建议推动签约';
    }
    
    res.json({
      success: true,
      data: {
        customer,
        rfm,
        interactions: customerInteractions,
        opportunities: customerOpportunities,
        summary: {
          totalValue: customerOpportunities.reduce((sum, o) => sum + (o.expectedValue || 0), 0),
          interactionCount: customerInteractions.length,
          opportunityCount: customerOpportunities.length,
          daysSinceLastContact,
          followUpRecommendation
        }
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * PUT /api/crm/customers/:id
 * 更新客户信息
 */
router.put('/customers/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const customer = customers.get(id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: '客户不存在'
      });
    }
    
    // 不允许修改的字段
    delete updates.id;
    delete updates.createdAt;
    
    const updated = {
      ...customer,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    customers.set(id, updated);
    
    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/crm/customers/:id/interactions
 * 添加跟进记录
 */
router.post('/customers/:id/interactions', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, content, nextAction, nextFollowUpDate } = req.body;
    
    const customer = customers.get(id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: '客户不存在'
      });
    }
    
    if (!type || !content) {
      return res.status(400).json({
        success: false,
        message: '互动类型和内容必填'
      });
    }
    
    const interaction = {
      id: `INT-${Date.now()}`,
      customerId: id,
      type, // phone, visit, wechat, email, meeting
      content,
      nextAction: nextAction || '',
      nextFollowUpDate: nextFollowUpDate || null,
      createdBy: req.user?.userId,
      createdAt: new Date().toISOString()
    };
    
    interactions.set(interaction.id, interaction);
    
    // 更新客户最后联系时间
    customer.updatedAt = new Date().toISOString();
    customers.set(id, customer);
    
    res.status(201).json({
      success: true,
      data: interaction
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/crm/customers/:id/interactions
 * 获取客户跟进记录
 */
router.get('/customers/:id/interactions', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const customerInteractions = Array.from(interactions.values())
      .filter(i => i.customerId === id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginated = customerInteractions.slice(skip, skip + parseInt(limit));
    
    res.json({
      success: true,
      data: {
        interactions: paginated,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: customerInteractions.length
        }
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/crm/opportunities
 * 创建商机
 */
router.post('/opportunities', auth, async (req, res) => {
  try {
    const { customerId, name, expectedValue, expectedCloseDate, products, painPoints, competitors, notes } = req.body;
    
    const customer = customers.get(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: '客户不存在'
      });
    }
    
    const opportunity = {
      id: `OPP-${Date.now()}`,
      customerId,
      name: name || `${customer.name}的商机`,
      stage: 'prospecting',
      probability: 0.1,
      expectedValue: expectedValue || 0,
      expectedCloseDate: expectedCloseDate || null,
      products: products || [],
      painPoints: painPoints || [],
      competitors: competitors || [],
      notes: notes || '',
      stageHistory: [{
        from: null,
        to: 'prospecting',
        timestamp: new Date().toISOString(),
        changedBy: req.user?.userId
      }],
      createdBy: req.user?.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    opportunities.set(opportunity.id, opportunity);
    
    res.status(201).json({
      success: true,
      data: opportunity
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/crm/opportunities
 * 获取商机列表
 */
router.get('/opportunities', auth, async (req, res) => {
  try {
    const { stage, customerId, page = 1, limit = 20 } = req.query;
    
    let opportunityList = Array.from(opportunities.values());
    
    if (stage) {
      opportunityList = opportunityList.filter(o => o.stage === stage);
    }
    
    if (customerId) {
      opportunityList = opportunityList.filter(o => o.customerId === customerId);
    }
    
    // 补充客户信息
    const enriched = opportunityList.map(o => ({
      ...o,
      customer: customers.get(o.customerId)
    }));
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginated = enriched.slice(skip, skip + parseInt(limit));
    
    res.json({
      success: true,
      data: {
        opportunities: paginated,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: enriched.length
        }
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * PUT /api/crm/opportunities/:id/stage
 * 推进商机阶段
 */
router.put('/opportunities/:id/stage', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { stage, note } = req.body;
    
    const opportunity = opportunities.get(id);
    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: '商机不存在'
      });
    }
    
    const stageConfig = SALES_STAGES.find(s => s.id === stage);
    if (!stageConfig) {
      return res.status(400).json({
        success: false,
        message: '无效的销售阶段'
      });
    }
    
    const oldStage = opportunity.stage;
    opportunity.stage = stage;
    opportunity.probability = stageConfig.probability;
    opportunity.updatedAt = new Date().toISOString();
    
    // 记录阶段历史
    opportunity.stageHistory.push({
      from: oldStage,
      to: stage,
      note: note || '',
      timestamp: new Date().toISOString(),
      changedBy: req.user?.userId
    });
    
    opportunities.set(id, opportunity);
    
    res.json({
      success: true,
      data: opportunity
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/crm/funnel
 * 获取销售漏斗统计
 */
router.get('/funnel', auth, async (req, res) => {
  try {
    const allOpportunities = Array.from(opportunities.values());
    
    const funnelData = SALES_STAGES.filter(s => s.id !== 'lost').map(stage => {
      const stageOpps = allOpportunities.filter(o => o.stage === stage.id);
      const totalValue = stageOpps.reduce((sum, o) => sum + (o.expectedValue || 0), 0);
      
      return {
        stage: stage.id,
        name: stage.name,
        count: stageOpps.length,
        totalValue,
        probability: stage.probability,
        weightedValue: totalValue * stage.probability
      };
    });
    
    const totalWeightedValue = funnelData.reduce((sum, s) => sum + s.weightedValue, 0);
    
    res.json({
      success: true,
      data: {
        stages: funnelData,
        totalWeightedValue,
        totalOpportunities: allOpportunities.filter(o => o.stage !== 'lost').length
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/crm/dashboard
 * CRM仪表盘数据
 */
router.get('/dashboard', auth, async (req, res) => {
  try {
    const allCustomers = Array.from(customers.values());
    const allOpportunities = Array.from(opportunities.values());
    const today = new Date().toISOString().split('T')[0];
    
    // 今日待跟进（nextFollowUpDate为今天）
    const todayFollowUps = Array.from(interactions.values())
      .filter(i => i.nextFollowUpDate && i.nextFollowUpDate.startsWith(today))
      .length;
    
    // 超过7天未联系的客户
    const overdueCustomers = allCustomers.filter(c => {
      const customerInteractions = Array.from(interactions.values())
        .filter(i => i.customerId === c.id);
      const lastContact = customerInteractions.length > 0
        ? Math.max(...customerInteractions.map(i => new Date(i.timestamp).getTime()))
        : new Date(c.createdAt).getTime();
      const daysSince = Math.floor((Date.now() - lastContact) / (1000 * 60 * 60 * 24));
      return daysSince > 7 && c.stage !== 'won' && c.stage !== 'lost';
    }).length;
    
    // 本月新增
    const thisMonth = new Date().toISOString().slice(0, 7);
    const newCustomersThisMonth = allCustomers.filter(c => 
      c.createdAt.startsWith(thisMonth)
    ).length;
    
    const newOppsThisMonth = allOpportunities.filter(o => 
      o.createdAt.startsWith(thisMonth)
    ).length;
    
    res.json({
      success: true,
      data: {
        overview: {
          totalCustomers: allCustomers.length,
          totalOpportunities: allOpportunities.filter(o => o.stage !== 'lost').length,
          wonDeals: allOpportunities.filter(o => o.stage === 'won').length,
          totalPipelineValue: allOpportunities
            .filter(o => o.stage !== 'won' && o.stage !== 'lost')
            .reduce((sum, o) => sum + (o.expectedValue || 0) * (o.probability || 0), 0)
        },
        alerts: {
          todayFollowUps,
          overdueCustomers,
          pendingProposals: allOpportunities.filter(o => o.stage === 'proposal').length
        },
        thisMonth: {
          newCustomers: newCustomersThisMonth,
          newOpportunities: newOppsThisMonth
        },
        stages: SALES_STAGES.map(s => ({
          id: s.id,
          name: s.name,
          count: allOpportunities.filter(o => o.stage === s.id).length
        }))
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

module.exports = router;
