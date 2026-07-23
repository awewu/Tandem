/**
 * 合同电子签署 API 路由
 * ─────────────────────────────────────────
 * 合同管理、电子签章、审批流程
 * 
 * 包含:
 * - 合同模板管理
 * - 合同生成与编辑
 * - 电子签章流程
 * - 审批工作流
 * - 合同状态追踪
 * 
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const { errorResponse } = require('../utils/sanitize-error');
const { auth, authorize } = require('../middleware/auth');

// 内存存储（生产环境应使用数据库）
const contracts = new Map();
const templates = new Map();
const signatures = new Map();
const approvals = new Map();

// 合同状态
const CONTRACT_STATUS = {
  DRAFT: 'draft',           // 草稿
  PENDING: 'pending',       // 待签署
  SIGNING: 'signing',       // 签署中
  APPROVING: 'approving', // 审批中
  SIGNED: 'signed',         // 已签署
  COMPLETED: 'completed',   // 已完成
  REJECTED: 'rejected',     // 已驳回
  EXPIRED: 'expired'        // 已过期
};

// 签章类型
const SIGNATURE_TYPES = {
  COMPANY: 'company',       // 公司章
  LEGAL: 'legal',           // 法人章
  PERSONAL: 'personal',     // 个人签名
  SEAL: 'seal'              // 骑缝章
};

// 初始化合同模板
function initTemplates() {
  const defaultTemplates = [
    {
      id: 'tpl-sales-001',
      name: '设备销售合同',
      category: 'sales',
      description: '适用于设备产品销售',
      fields: [
        { key: 'customerName', label: '客户名称', type: 'text', required: true },
        { key: 'customerAddress', label: '客户地址', type: 'text', required: true },
        { key: 'productList', label: '产品清单', type: 'textarea', required: true },
        { key: 'totalAmount', label: '合同金额', type: 'number', required: true },
        { key: 'paymentTerms', label: '付款条款', type: 'textarea', required: true },
        { key: 'deliveryDate', label: '交付日期', type: 'date', required: true },
        { key: 'warrantyPeriod', label: '质保期限', type: 'text', required: true }
      ],
      content: `
<h2>设备销售合同</h2>
<p>甲方（买方）：{{customerName}}</p>
<p>地址：{{customerAddress}}</p>
<br>
<p>乙方（卖方）：瑞美（中国）热水器有限公司</p>
<p>地址：上海市浦东新区XX路XX号</p>
<br>
<h3>一、产品清单</h3>
<p>{{productList}}</p>
<br>
<h3>二、合同金额</h3>
<p>总价：人民币 {{totalAmount}} 元（大写：{{totalAmountChinese}}）</p>
<br>
<h3>三、付款条款</h3>
<p>{{paymentTerms}}</p>
<br>
<h3>四、交付与验收</h3>
<p>交付日期：{{deliveryDate}}</p>
<p>质保期限：{{warrantyPeriod}}</p>
<br>
<h3>五、签章</h3>
<div style="display: flex; justify-content: space-between; margin-top: 50px;">
  <div>
    <p>甲方（盖章）：</p>
    <p style="margin-top: 60px;">授权代表签字：_______________</p>
    <p>日期：_______________</p>
  </div>
  <div>
    <p>乙方（盖章）：</p>
    <p style="margin-top: 60px;">授权代表签字：_______________</p>
    <p>日期：_______________</p>
  </div>
</div>
      `
    },
    {
      id: 'tpl-install-001',
      name: '安装服务合同',
      category: 'install',
      description: '适用于安装服务',
      fields: [
        { key: 'customerName', label: '客户名称', type: 'text', required: true },
        { key: 'projectAddress', label: '项目地址', type: 'text', required: true },
        { key: 'installContent', label: '安装内容', type: 'textarea', required: true },
        { key: 'installFee', label: '安装费用', type: 'number', required: true },
        { key: 'schedule', label: '施工进度', type: 'textarea', required: true },
        { key: 'safetyClause', label: '安全条款', type: 'textarea', required: false }
      ],
      content: `
<h2>安装服务合同</h2>
<p>甲方（委托方）：{{customerName}}</p>
<p>项目地址：{{projectAddress}}</p>
<br>
<p>乙方（服务方）：瑞美（中国）热水器有限公司</p>
<br>
<h3>一、安装内容</h3>
<p>{{installContent}}</p>
<br>
<h3>二、服务费用</h3>
<p>安装费用：人民币 {{installFee}} 元</p>
<br>
<h3>三、施工进度</h3>
<p>{{schedule}}</p>
<br>
<h3>四、安全责任</h3>
<p>{{safetyClause}}</p>
      `
    },
    {
      id: 'tpl-maintain-001',
      name: '维保服务合同',
      category: 'maintain',
      description: '适用于维保服务',
      fields: [
        { key: 'customerName', label: '客户名称', type: 'text', required: true },
        { key: 'deviceList', label: '设备清单', type: 'textarea', required: true },
        { key: 'maintainPeriod', label: '维保期限', type: 'text', required: true },
        { key: 'maintainFee', label: '维保费用', type: 'number', required: true },
        { key: 'serviceContent', label: '服务内容', type: 'textarea', required: true }
      ],
      content: `
<h2>维保服务合同</h2>
<p>甲方（客户）：{{customerName}}</p>
<br>
<p>乙方（服务商）：瑞美（中国）热水器有限公司</p>
<br>
<h3>一、设备清单</h3>
<p>{{deviceList}}</p>
<br>
<h3>二、维保期限</h3>
<p>{{maintainPeriod}}</p>
<br>
<h3>三、服务费用</h3>
<p>维保费用：人民币 {{maintainFee}} 元/年</p>
<br>
<h3>四、服务内容</h3>
<p>{{serviceContent}}</p>
      `
    }
  ];

  defaultTemplates.forEach(tpl => templates.set(tpl.id, tpl));
}

// 数字转中文大写
function numberToChinese(num) {
  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const units = ['', '拾', '佰', '仟', '万', '拾', '佰', '仟', '亿'];
  
  let str = '';
  let n = Math.floor(num);
  let i = 0;
  
  while (n > 0) {
    const digit = n % 10;
    if (digit !== 0) {
      str = digits[digit] + units[i] + str;
    } else if (str && str[0] !== '零') {
      str = '零' + str;
    }
    n = Math.floor(n / 10);
    i++;
  }
  
  return str + '元整';
}

// 初始化模板
initTemplates();

// ========== 合同模板 ==========

/**
 * GET /api/contracts/templates
 * 获取合同模板列表
 */
router.get('/templates', auth, async (req, res) => {
  try {
    const { category } = req.query;
    let list = Array.from(templates.values());
    
    if (category) {
      list = list.filter(t => t.category === category);
    }
    
    res.json({
      success: true,
      data: list.map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
        description: t.description,
        fieldCount: t.fields.length
      }))
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/contracts/templates/:id
 * 获取模板详情
 */
router.get('/templates/:id', auth, async (req, res) => {
  try {
    const template = templates.get(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: '模板不存在' });
    }
    
    res.json({ success: true, data: template });
  } catch (error) {
    return errorResponse(res, error);
  }
});

// ========== 合同管理 ==========

/**
 * POST /api/contracts
 * 创建合同
 */
router.post('/', auth, async (req, res) => {
  try {
    const { templateId, title, customerId, data, signers } = req.body;
    
    const template = templates.get(templateId);
    if (!template) {
      return res.status(404).json({ success: false, message: '模板不存在' });
    }
    
    // 验证必填字段
    for (const field of template.fields) {
      if (field.required && !data[field.key]) {
        return res.status(400).json({
          success: false,
          message: `必填字段缺失: ${field.label}`
        });
      }
    }
    
    // 处理金额大写
    const processedData = { ...data };
    if (data.totalAmount) {
      processedData.totalAmountChinese = numberToChinese(data.totalAmount);
    }
    if (data.installFee) {
      processedData.installFeeChinese = numberToChinese(data.installFee);
    }
    if (data.maintainFee) {
      processedData.maintainFeeChinese = numberToChinese(data.maintainFee);
    }
    
    const contract = {
      id: `CT-${Date.now()}`,
      templateId,
      title: title || `${template.name}-${new Date().toLocaleDateString('zh-CN')}`,
      customerId,
      data: processedData,
      status: CONTRACT_STATUS.DRAFT,
      signers: signers || [],
      signatures: [],
      approvals: [],
      content: generateContractContent(template, processedData),
      createdBy: req.user.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    contracts.set(contract.id, contract);
    
    res.status(201).json({
      success: true,
      data: contract
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * 生成合同内容
 */
function generateContractContent(template, data) {
  let content = template.content;
  
  // 替换变量
  Object.keys(data).forEach(key => {
    content = content.replace(new RegExp(`{{${key}}}`, 'g'), data[key] || '');
  });
  
  return content;
}

/**
 * GET /api/contracts
 * 获取合同列表
 */
router.get('/', auth, async (req, res) => {
  try {
    const { status, customerId, page = 1, limit = 20 } = req.query;
    
    let list = Array.from(contracts.values());
    
    if (status) {
      list = list.filter(c => c.status === status);
    }
    
    if (customerId) {
      list = list.filter(c => c.customerId === customerId);
    }
    
    // 按时间倒序
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // 分页
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginated = list.slice(skip, skip + parseInt(limit));
    
    res.json({
      success: true,
      data: {
        contracts: paginated,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: list.length,
          pages: Math.ceil(list.length / parseInt(limit))
        }
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/contracts/:id
 * 获取合同详情
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const contract = contracts.get(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, message: '合同不存在' });
    }
    
    res.json({ success: true, data: contract });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * PUT /api/contracts/:id
 * 更新合同
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const contract = contracts.get(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, message: '合同不存在' });
    }
    
    if (contract.status !== CONTRACT_STATUS.DRAFT) {
      return res.status(400).json({
        success: false,
        message: '只有草稿状态的合同可以编辑'
      });
    }
    
    const { title, data, signers } = req.body;
    
    if (title) contract.title = title;
    if (signers) contract.signers = signers;
    
    if (data) {
      const template = templates.get(contract.templateId);
      
      // 处理金额大写
      const processedData = { ...contract.data, ...data };
      if (data.totalAmount) {
        processedData.totalAmountChinese = numberToChinese(data.totalAmount);
      }
      
      contract.data = processedData;
      contract.content = generateContractContent(template, processedData);
    }
    
    contract.updatedAt = new Date().toISOString();
    contracts.set(contract.id, contract);
    
    res.json({ success: true, data: contract });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/contracts/:id/submit
 * 提交合同（进入签署流程）
 */
router.post('/:id/submit', auth, async (req, res) => {
  try {
    const contract = contracts.get(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, message: '合同不存在' });
    }
    
    if (contract.status !== CONTRACT_STATUS.DRAFT) {
      return res.status(400).json({
        success: false,
        message: '合同已提交'
      });
    }
    
    if (!contract.signers || contract.signers.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请至少添加一个签署方'
      });
    }
    
    contract.status = CONTRACT_STATUS.PENDING;
    contract.updatedAt = new Date().toISOString();
    contracts.set(contract.id, contract);
    
    res.json({
      success: true,
      message: '合同已提交，等待签署',
      data: contract
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

// ========== 电子签章 ==========

/**
 * POST /api/contracts/:id/sign
 * 签署合同
 */
router.post('/:id/sign', auth, async (req, res) => {
  try {
    const { signatureType, signatureImage, signPosition } = req.body;
    const contract = contracts.get(req.params.id);
    
    if (!contract) {
      return res.status(404).json({ success: false, message: '合同不存在' });
    }
    
    if (![CONTRACT_STATUS.PENDING, CONTRACT_STATUS.SIGNING].includes(contract.status)) {
      return res.status(400).json({
        success: false,
        message: '合同不在签署状态'
      });
    }
    
    // 创建签章记录
    const signature = {
      id: `SIG-${Date.now()}`,
      contractId: req.params.id,
      signerId: req.user.userId,
      signerName: req.user.name,
      signatureType: signatureType || SIGNATURE_TYPES.PERSONAL,
      signatureImage,
      signPosition: signPosition || { x: 0, y: 0, page: 1 },
      signedAt: new Date().toISOString(),
      ip: req.ip,
      // 模拟数字签名
      digitalSignature: generateDigitalSignature(contract, req.user)
    };
    
    signatures.set(signature.id, signature);
    contract.signatures.push(signature);
    
    // 检查是否所有签署方都已完成
    const signedUsers = new Set(contract.signatures.map(s => s.signerId));
    const requiredSigners = contract.signers.map(s => s.userId);
    const allSigned = requiredSigners.every(id => signedUsers.has(id));
    
    if (allSigned) {
      contract.status = CONTRACT_STATUS.SIGNED;
    } else {
      contract.status = CONTRACT_STATUS.SIGNING;
    }
    
    contract.updatedAt = new Date().toISOString();
    contracts.set(contract.id, contract);
    
    res.json({
      success: true,
      message: '签署成功',
      data: { contract, signature }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * 生成数字签名（模拟）
 */
function generateDigitalSignature(contract, user) {
  const crypto = require('crypto');
  const data = `${contract.id}-${user.userId}-${Date.now()}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * GET /api/contracts/:id/sign-url
 * 获取签署链接
 */
router.get('/:id/sign-url', auth, async (req, res) => {
  try {
    const contract = contracts.get(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, message: '合同不存在' });
    }
    
    // 生成签署链接（实际应生成带token的安全链接）
    const signUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/contract-sign.html?id=${contract.id}&token=temp-token`;
    
    res.json({
      success: true,
      data: {
        signUrl,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

// ========== 审批流程 ==========

/**
 * POST /api/contracts/:id/approve
 * 审批合同
 */
router.post('/:id/approve', auth, authorize(['manager', 'admin']), async (req, res) => {
  try {
    const { action, comment } = req.body; // action: approve / reject
    const contract = contracts.get(req.params.id);
    
    if (!contract) {
      return res.status(404).json({ success: false, message: '合同不存在' });
    }
    
    const approval = {
      id: `APR-${Date.now()}`,
      contractId: req.params.id,
      approverId: req.user.userId,
      approverName: req.user.name,
      action,
      comment: comment || '',
      approvedAt: new Date().toISOString()
    };
    
    approvals.set(approval.id, approval);
    contract.approvals.push(approval);
    
    if (action === 'approve') {
      contract.status = CONTRACT_STATUS.COMPLETED;
    } else {
      contract.status = CONTRACT_STATUS.REJECTED;
    }
    
    contract.updatedAt = new Date().toISOString();
    contracts.set(contract.id, contract);
    
    res.json({
      success: true,
      message: action === 'approve' ? '审批通过' : '已驳回',
      data: contract
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/contracts/:id/pdf
 * 下载合同PDF
 */
router.get('/:id/pdf', auth, async (req, res) => {
  try {
    const contract = contracts.get(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, message: '合同不存在' });
    }
    
    // 生成HTML内容（含签章）
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: SimSun, serif; padding: 40px; line-height: 1.8; }
    h2 { text-align: center; font-size: 24px; margin-bottom: 30px; }
    h3 { font-size: 16px; margin-top: 20px; }
    p { margin: 10px 0; }
    .signature-box { 
      position: absolute; 
      border: 2px solid #2563eb; 
      padding: 10px; 
      background: rgba(37, 99, 235, 0.1);
    }
    .qr-code {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 100px;
      height: 100px;
      background: #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  ${contract.content}
  ${contract.signatures.map(sig => `
    <div class="signature-box" style="left: ${sig.signPosition?.x || 0}px; top: ${sig.signPosition?.y || 0}px;">
      <p style="margin: 0; font-size: 12px;">${sig.signerName}</p>
      <p style="margin: 0; font-size: 10px; color: #666;">${new Date(sig.signedAt).toLocaleDateString('zh-CN')}</p>
    </div>
  `).join('')}
  <div class="qr-code">
    验真二维码
  </div>
</body>
</html>
    `;
    
    // 这里应调用PDF生成服务
    // 简化返回HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlContent);
    
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/contracts/stats/overview
 * 合同统计概览
 */
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const allContracts = Array.from(contracts.values());
    
    const stats = {
      total: allContracts.length,
      byStatus: {},
      totalAmount: 0,
      thisMonth: {
        new: 0,
        signed: 0,
        amount: 0
      }
    };
    
    const thisMonth = new Date().toISOString().slice(0, 7);
    
    Object.values(CONTRACT_STATUS).forEach(status => {
      stats.byStatus[status] = allContracts.filter(c => c.status === status).length;
    });
    
    allContracts.forEach(c => {
      const amount = c.data?.totalAmount || c.data?.installFee || c.data?.maintainFee || 0;
      stats.totalAmount += amount;
      
      if (c.createdAt.startsWith(thisMonth)) {
        stats.thisMonth.new++;
        if (amount) stats.thisMonth.amount += amount;
      }
      if (c.status === CONTRACT_STATUS.SIGNED && c.updatedAt.startsWith(thisMonth)) {
        stats.thisMonth.signed++;
      }
    });
    
    res.json({ success: true, data: stats });
  } catch (error) {
    return errorResponse(res, error);
  }
});

module.exports = router;
