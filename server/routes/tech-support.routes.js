const express = require('express');

const SUPPORT_ROLES = ['sales', 'designer', 'store_admin', 'rheem_admin'];
const ADMIN_ROLES = ['store_admin', 'rheem_admin'];

function createNoopMiddleware() {
  return (req, res, next) => next();
}

function createTechSupportRouter({
  db,
  maskSensitiveData = data => data,
  authenticateToken = createNoopMiddleware(),
  checkRole = () => createNoopMiddleware()
}) {
  const router = express.Router();
  const supportAuth = [authenticateToken, checkRole(SUPPORT_ROLES)];
  const adminAuth = [authenticateToken, checkRole(ADMIN_ROLES)];

  router.get('/api/tech-support/contracts/search', supportAuth, (req, res) => {
    const { contractNumber, phone } = req.query;

    if (!contractNumber && !phone) {
      return res.status(400).json({ success: false, error: '请提供合同号或手机号' });
    }

    let contracts = db.contracts || [];

    if (contractNumber) {
      contracts = contracts.filter(c =>
        c.contractNumber.toLowerCase().includes(contractNumber.toLowerCase())
      );
    }

    if (phone) {
      contracts = contracts.filter(c => c.customerPhone.includes(phone));
    }

    res.json({
      success: true,
      total: contracts.length,
      data: contracts.map(c => ({
        id: c.id,
        contractNumber: c.contractNumber,
        customerName: c.customerName,
        customerPhone: maskSensitiveData(c.customerPhone, 'phone'),
        projectAddress: c.projectAddress,
        houseType: c.houseType,
        area: c.area,
        systems: c.systems,
        totalPrice: c.totalPrice,
        status: c.status,
        signedAt: c.signedAt,
        expectedCompletion: c.expectedCompletion
      }))
    });
  });

  router.get('/api/tech-support/contracts/:id', supportAuth, (req, res) => {
    const contract = db.contracts?.find(c => c.id === req.params.id || c.contractNumber === req.params.id);

    if (!contract) {
      return res.status(404).json({ success: false, error: '合同不存在' });
    }

    const materialCost = contract.materials?.reduce((sum, category) => {
      return sum + category.items.reduce((catSum, item) => catSum + (item.totalPrice || 0), 0);
    }, 0) || 0;

    res.json({
      success: true,
      data: {
        ...contract,
        customerPhone: maskSensitiveData(contract.customerPhone, 'phone'),
        materialCost,
        profit: contract.totalPrice - materialCost,
        profitMargin: ((contract.totalPrice - materialCost) / contract.totalPrice * 100).toFixed(1)
      }
    });
  });

  router.get('/api/tech-support/contracts/:id/materials', supportAuth, (req, res) => {
    const contract = db.contracts?.find(c => c.id === req.params.id || c.contractNumber === req.params.id);

    if (!contract) {
      return res.status(404).json({ success: false, error: '合同不存在' });
    }

    res.json({
      success: true,
      contractNumber: contract.contractNumber,
      customerName: contract.customerName,
      data: contract.materials || []
    });
  });

  router.get('/api/tech-support/contracts/:id/drawings', supportAuth, (req, res) => {
    const contract = db.contracts?.find(c => c.id === req.params.id || c.contractNumber === req.params.id);

    if (!contract) {
      return res.status(404).json({ success: false, error: '合同不存在' });
    }

    res.json({
      success: true,
      contractNumber: contract.contractNumber,
      data: contract.drawings || []
    });
  });

  router.get('/api/tech-support/materials', supportAuth, (req, res) => {
    const { category, warning } = req.query;
    let materials = db.techMaterials || [];

    if (category) {
      materials = materials.filter(m => m.category === category);
    }

    if (warning === 'true') {
      materials = materials.filter(m => m.stock < m.safetyStock);
    }

    res.json({
      success: true,
      total: materials.length,
      data: materials
    });
  });

  router.post('/api/tech-support/materials/:id/stock', adminAuth, (req, res) => {
    const { id } = req.params;
    const { stock, operation } = req.body;

    const material = db.techMaterials?.find(m => m.id === id);
    if (!material) {
      return res.status(404).json({ success: false, error: '材料不存在' });
    }

    if (operation === 'in') {
      material.stock += stock;
    } else if (operation === 'out') {
      if (material.stock < stock) {
        return res.status(400).json({ success: false, error: '库存不足' });
      }
      material.stock -= stock;
    } else {
      material.stock = stock;
    }

    material.updatedAt = new Date().toISOString();

    if (material.stock < material.safetyStock) {
      material.warning = '库存不足';
    } else if (material.stock < material.safetyStock * 1.5) {
      material.warning = '库存偏低';
    } else {
      delete material.warning;
    }

    res.json({
      success: true,
      message: '库存已更新',
      data: material
    });
  });

  router.get('/api/tech-support/teams', supportAuth, (req, res) => {
    const { status, specialty } = req.query;
    let teams = db.constructionTeams || [];

    if (status) {
      teams = teams.filter(t => t.status === status);
    }

    if (specialty) {
      teams = teams.filter(t => t.specialty.includes(specialty));
    }

    res.json({
      success: true,
      total: teams.length,
      data: teams.map(t => ({
        ...t,
        leaderPhone: maskSensitiveData(t.leaderPhone, 'phone')
      }))
    });
  });

  router.get('/api/tech-support/teams/:id', supportAuth, (req, res) => {
    const team = db.constructionTeams?.find(t => t.id === req.params.id);

    if (!team) {
      return res.status(404).json({ success: false, error: '施工班组不存在' });
    }

    const settlements = db.settlementRecords?.filter(s => s.teamId === team.id) || [];

    res.json({
      success: true,
      data: {
        ...team,
        leaderPhone: maskSensitiveData(team.leaderPhone, 'phone'),
        settlementHistory: settlements
      }
    });
  });

  router.post('/api/tech-support/contracts/:id/assign-team', adminAuth, (req, res) => {
    const { teamId, estimatedWorkDays, tasks } = req.body;

    const contract = db.contracts?.find(c => c.id === req.params.id || c.contractNumber === req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, error: '合同不存在' });
    }

    const team = db.constructionTeams?.find(t => t.id === teamId);
    if (!team) {
      return res.status(404).json({ success: false, error: '施工班组不存在' });
    }

    team.status = 'busy';
    team.currentContract = contract.id;

    const taskRecord = {
      id: `TASK-${Date.now()}`,
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      teamId: team.id,
      teamName: team.name,
      tasks: tasks || [],
      totalWorkDays: estimatedWorkDays || 0,
      estimatedLaborCost: (estimatedWorkDays || 0) * team.members * team.unitPrice.standard,
      createdAt: new Date().toISOString()
    };

    if (!db.constructionTasks) db.constructionTasks = [];
    db.constructionTasks.push(taskRecord);

    res.json({
      success: true,
      message: `施工班组 ${team.name} 已成功分配至合同 ${contract.contractNumber}`,
      data: {
        task: taskRecord,
        team: {
          id: team.id,
          name: team.name,
          leader: team.leader,
          members: team.members,
          unitPrice: team.unitPrice
        }
      }
    });
  });

  router.get('/api/tech-support/settlements', supportAuth, (req, res) => {
    const { contractId, teamId, status } = req.query;
    let records = db.settlementRecords || [];

    if (contractId) {
      records = records.filter(r => r.contractId === contractId);
    }

    if (teamId) {
      records = records.filter(r => r.teamId === teamId);
    }

    if (status) {
      records = records.filter(r => r.status === status);
    }

    res.json({
      success: true,
      total: records.length,
      data: records
    });
  });

  router.post('/api/tech-support/settlements', adminAuth, (req, res) => {
    const { contractId, teamId, settlementType, workDays, dailyRate, materialCost, remarks } = req.body;

    const contract = db.contracts?.find(c => c.id === contractId || c.contractNumber === contractId);
    if (!contract) {
      return res.status(404).json({ success: false, error: '合同不存在' });
    }

    const team = db.constructionTeams?.find(t => t.id === teamId);
    if (!team) {
      return res.status(404).json({ success: false, error: '施工班组不存在' });
    }

    const totalAmount = workDays * team.members * dailyRate;
    const totalSettlement = totalAmount + (materialCost || 0);

    const settlement = {
      id: `SET-${Date.now()}`,
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      teamId: team.id,
      teamName: team.name,
      settlementType,
      workDays,
      dailyRate,
      totalAmount,
      materialCost: materialCost || 0,
      totalSettlement,
      status: 'pending',
      paymentDate: null,
      paymentMethod: null,
      invoiceNumber: null,
      remarks,
      createdAt: new Date().toISOString()
    };

    if (!db.settlementRecords) db.settlementRecords = [];
    db.settlementRecords.push(settlement);

    res.json({
      success: true,
      message: '结算记录已创建',
      data: settlement
    });
  });

  router.put('/api/tech-support/settlements/:id/pay', adminAuth, (req, res) => {
    const { paymentMethod, paymentDate, invoiceNumber } = req.body;

    const settlement = db.settlementRecords?.find(s => s.id === req.params.id);
    if (!settlement) {
      return res.status(404).json({ success: false, error: '结算记录不存在' });
    }

    settlement.status = 'paid';
    settlement.paymentMethod = paymentMethod;
    settlement.paymentDate = paymentDate || new Date().toISOString().split('T')[0];
    settlement.invoiceNumber = invoiceNumber;
    settlement.updatedAt = new Date().toISOString();

    res.json({
      success: true,
      message: '付款完成',
      data: settlement
    });
  });

  router.get('/api/tech-support/contracts/:id/settlements/summary', supportAuth, (req, res) => {
    const contract = db.contracts?.find(c => c.id === req.params.id || c.contractNumber === req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, error: '合同不存在' });
    }

    const settlements = db.settlementRecords?.filter(s => s.contractId === contract.id) || [];

    const summary = {
      totalSettlements: settlements.length,
      totalLaborCost: settlements.reduce((sum, s) => sum + s.totalAmount, 0),
      totalMaterialCost: settlements.reduce((sum, s) => sum + s.materialCost, 0),
      totalPaid: settlements.filter(s => s.status === 'paid').reduce((sum, s) => sum + s.totalSettlement, 0),
      totalPending: settlements.filter(s => s.status === 'pending').reduce((sum, s) => sum + s.totalSettlement, 0),
      paidCount: settlements.filter(s => s.status === 'paid').length,
      pendingCount: settlements.filter(s => s.status === 'pending').length
    };

    res.json({
      success: true,
      contractNumber: contract.contractNumber,
      data: {
        summary,
        settlements
      }
    });
  });

  return router;
}

module.exports = createTechSupportRouter;
