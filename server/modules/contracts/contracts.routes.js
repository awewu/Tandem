const express = require('express');
const ContractsService = require('./contracts.service');
const { authenticateV2 } = require('../../middleware/authenticateV2');
const { requireTenantScope } = require('../../middleware/tenantScope');

function createContractsRoutes(options = {}) {
  const router = express.Router();
  const service = options.service || new ContractsService(options);

  router.use(authenticateV2);
  router.use(requireTenantScope);

  router.post('/from-quotation', async (req, res, next) => {
    try {
      const result = await service.createFromQuotation(req.scope, req.body || {});
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.get('/', async (req, res, next) => {
    try {
      const result = await service.list(req.scope, req.query || {});
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:contractId', async (req, res, next) => {
    try {
      const result = await service.getByContractId(req.scope, req.params.contractId);
      if (!result) return res.status(404).json({ success: false, error: '合同不存在' });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:contractId/signature', async (req, res, next) => {
    try {
      const result = await service.markSigned(req.scope, req.params.contractId, req.body || {});
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:contractId/approval', async (req, res, next) => {
    try {
      const result = await service.decideApproval(req.scope, req.params.contractId, req.body || {});
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:contractId/payments', async (req, res, next) => {
    try {
      const result = await service.recordPayment(req.scope, req.params.contractId, req.body || {});
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:contractId/delivery-start', async (req, res, next) => {
    try {
      const result = await service.startDelivery(req.scope, req.params.contractId, req.body || {});
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createContractsRoutes;
