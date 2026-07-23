const BaseRepository = require('../../repositories/BaseRepository');
const ContractV2 = require('../../models/ContractV2');
const QuotationV2 = require('../../models/QuotationV2');
const AuditService = require('../audit/audit.service');
const OutboxService = require('../outbox/outbox.service');

const DEFAULT_PAYMENT_PLAN = [
  { key: 'deposit', label: '签约首付款', ratio: 0.3, dueStage: 'contract_signed' },
  { key: 'mobilization', label: '进场/设备到场款', ratio: 0.5, dueStage: 'construction_planning' },
  { key: 'acceptance', label: '验收尾款', ratio: 0.2, dueStage: 'acceptance' }
];

class ContractsService {
  constructor(options = {}) {
    this.contractRepo = options.contractRepo || new BaseRepository(ContractV2);
    this.quotationRepo = options.quotationRepo || new BaseRepository(QuotationV2);
    this.auditService = options.auditService || new AuditService(options);
    this.outboxService = options.outboxService || new OutboxService(options);
    // Lifecycle is now owned by the NestJS/PostgreSQL module. A caller may inject
    // a test adapter during the delivery migration, but legacy contracts never
    // recreate the retired Express lifecycle service.
    this.lifecycleService = options.lifecycleService || null;
    this.now = options.now || (() => new Date());
  }

  ensureScope(scope = {}) {
    if (!scope.tenantId) {
      const err = new Error('tenantId is required for contract operations');
      err.status = 400;
      throw err;
    }
    return scope;
  }

  normalizeObjectId(value, label) {
    if (!value) {
      const err = new Error(`${label} is required for contract operations`);
      err.status = 400;
      throw err;
    }
    return value;
  }

  getRecordId(record = {}) {
    return record._id || record.id;
  }

  async resolveQuotation(scope, payload = {}) {
    if (payload.quote || payload.quotation) return payload.quote || payload.quotation;
    if (payload.quotationId) {
      const found = await this.quotationRepo.findById(scope, payload.quotationId);
      if (found) return found;
    }
    if (payload.quotationNo) {
      const found = await this.quotationRepo.findOne(scope, { quotationNo: payload.quotationNo });
      if (found) return found;
    }

    const err = new Error('quotationId, quotationNo or quote payload is required for contract creation');
    err.status = 400;
    throw err;
  }

  createContractNo(scope, quote = {}) {
    const tenantPart = String(scope.tenantId).slice(-6).toUpperCase();
    const timePart = this.now().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const quotePart = String(quote.quotationNo || quote.quoteId || this.getRecordId(quote) || '')
      .replace(/\W/g, '')
      .slice(-6)
      .toUpperCase();
    return `CT-${tenantPart}-${timePart}${quotePart ? `-${quotePart}` : ''}`;
  }

  pricingSnapshotFromQuote(quote = {}) {
    const cost = quote.costBreakdown || quote.summary || {};
    return {
      quotationNo: quote.quotationNo,
      quoteId: String(this.getRecordId(quote) || quote.quoteId || ''),
      revision: Number(quote.revision || 1),
      source: quote.source || 'quotation-v2',
      currency: quote.currency || 'CNY',
      customerTotal: Number(cost.customerTotal || cost.finalTotal || cost.total || cost.totalAmount || 0),
      directCost: Number(cost.directCost || 0),
      dealerMargin: Number(cost.dealerMargin || 0),
      monthlyPayment: Number(cost.monthlyPayment || 0),
      marginGuard: {
        status: quote.marginGuard?.status || 'not_checked',
        minMarginRate: Number(quote.marginGuard?.minMarginRate || 0),
        targetMarginRate: Number(quote.marginGuard?.targetMarginRate || 0),
        quoteFloor: Number(quote.marginGuard?.quoteFloor || 0),
        adjustment: Number(quote.marginGuard?.adjustment || 0)
      }
    };
  }

  normalizePaymentSchedule(total, schedule = DEFAULT_PAYMENT_PLAN) {
    const source = Array.isArray(schedule) && schedule.length ? schedule : DEFAULT_PAYMENT_PLAN;
    const normalized = source.map((item, index) => {
      const ratio = Number(item.ratio ?? item.percent ?? 0);
      const explicitAmount = item.amount ?? item.dueAmount;
      const amount = Number.isFinite(Number(explicitAmount))
        ? Math.round(Number(explicitAmount))
        : Math.round(Number(total || 0) * ratio);
      return {
        key: item.key || `payment-${index + 1}`,
        label: item.label || `第 ${index + 1} 笔款项`,
        ratio,
        amount,
        dueStage: item.dueStage,
        dueDate: item.dueDate ? new Date(item.dueDate) : null,
        status: item.status || 'pending',
        paidAmount: Number(item.paidAmount || 0),
        paidAt: item.paidAt ? new Date(item.paidAt) : null,
        method: item.method,
        receiptNo: item.receiptNo,
        note: item.note
      };
    });

    const diff = Math.round(Number(total || 0) - normalized.reduce((sum, item) => sum + item.amount, 0));
    if (normalized.length && diff !== 0) {
      normalized[normalized.length - 1].amount += diff;
    }
    return normalized;
  }

  approvalFromQuote(quote = {}, payload = {}) {
    const guardStatus = quote.marginGuard?.status || 'not_checked';
    const required = Boolean(payload.approval?.required || guardStatus === 'blocked');
    return {
      required,
      status: required ? 'pending' : 'not_required',
      reason: payload.approval?.reason || (guardStatus === 'blocked' ? '报价毛利护栏阻断，需要总部审批' : null)
    };
  }

  initialStatusForApproval(approval) {
    return approval.required ? 'pending_approval' : 'pending_signature';
  }

  async createFromQuotation(scope, payload = {}, options = {}) {
    this.ensureScope(scope);
    const quote = await this.resolveQuotation(scope, payload);
    const customerId = this.normalizeObjectId(payload.customerId || quote.customerId, 'customerId');
    const pricingSnapshot = this.pricingSnapshotFromQuote(quote);
    const approval = this.approvalFromQuote(quote, payload);
    const contractNo = payload.contractNo || this.createContractNo(scope, quote);
    const record = await this.contractRepo.create(scope, {
      tenantId: scope.tenantId,
      dealerId: payload.dealerId || quote.dealerId || scope.dealerId,
      storeId: payload.storeId || quote.storeId || scope.storeId,
      customerId,
      opportunityId: payload.opportunityId || quote.opportunityId,
      quotationId: String(payload.quotationId || this.getRecordId(quote) || quote.quoteId || ''),
      contractNo,
      source: 'quotation-v2',
      status: payload.status || this.initialStatusForApproval(approval),
      paymentStatus: 'not_started',
      project: payload.project || quote.project || {},
      systemFamilies: payload.systemFamilies || quote.systemFamilies || [],
      pricingSnapshot,
      paymentSchedule: this.normalizePaymentSchedule(
        pricingSnapshot.customerTotal,
        payload.paymentSchedule || payload.paymentPlan
      ),
      approval,
      signature: {
        method: 'none',
        status: approval.required ? 'not_started' : 'pending',
        termsVersion: payload.terms?.version || payload.termsVersion || 'rhautt-nexus-contract-v1'
      },
      lifecycleHandoff: {
        required: payload.lifecycleHandoff?.required !== false,
        status: 'not_started',
        iotBridgeKey: payload.lifecycleHandoff?.iotBridgeKey || quote.lifecycleHandoff?.iotBridgeKey,
        servicePlanCode: payload.lifecycleHandoff?.servicePlanCode || quote.lifecycleHandoff?.servicePlanCode,
        handoffBoundary: 'lifecycle_handoff_only'
      },
      deliverables: payload.deliverables || {
        quotePdfUrl: quote.deliverables?.quotePdfUrl
      },
      terms: {
        version: payload.terms?.version || payload.termsVersion || 'rhautt-nexus-contract-v1',
        paymentTerms: payload.terms?.paymentTerms || '30%签约首付款 / 50%进场或设备到场款 / 20%验收尾款',
        warrantyTerms: payload.terms?.warrantyTerms || '设备质保与施工质保按合同附件及品牌政策执行',
        changeOrderPolicy: payload.terms?.changeOrderPolicy || '现场变更需形成变更单并经客户确认',
        cancellationPolicy: payload.terms?.cancellationPolicy || '未履行部分按合同约定结算'
      },
      createdBy: scope.userId,
      updatedBy: scope.userId
    }, options);

    await this.recordAudit(scope, {
      action: 'contract.created_from_quotation',
      resourceType: 'ContractV2',
      resourceId: record.contractNo || contractNo,
      after: this.auditSnapshot(record)
    });
    await this.publishOutbox(scope, this.contractOutboxEvent('contract.created', record));

    return { contract: record, quote, created: true };
  }

  async getByContractId(scope, contractId) {
    this.ensureScope(scope);
    return this.contractRepo.findOne(scope, { contractNo: contractId });
  }

  async requireContract(scope, contractId) {
    const contract = await this.getByContractId(scope, contractId);
    if (!contract) {
      const err = new Error('contract not found');
      err.status = 404;
      throw err;
    }
    return contract;
  }

  async markSigned(scope, contractId, data = {}, options = {}) {
    this.ensureScope(scope);
    const before = await this.requireContract(scope, contractId);
    if (before.status === 'pending_approval' && before.approval?.status !== 'approved') {
      const err = new Error('contract approval is required before signature');
      err.status = 409;
      throw err;
    }
    if (['cancelled', 'voided'].includes(before.status)) {
      const err = new Error('cancelled or voided contract cannot be signed');
      err.status = 409;
      throw err;
    }

    const signedAt = data.signedAt ? new Date(data.signedAt) : this.now();
    const update = {
      status: 'signed',
      signedAt,
      signature: {
        ...(before.signature || {}),
        method: data.method || data.signatureMethod || 'customer_portal_confirmation',
        status: 'signed',
        customerSigner: data.customerSigner || before.signature?.customerSigner,
        companySigner: data.companySigner || before.signature?.companySigner || scope.userId,
        signedAt,
        evidenceUrl: data.evidenceUrl || data.eSignatureEvidenceUrl || before.signature?.evidenceUrl,
        termsVersion: data.termsVersion || before.signature?.termsVersion || before.terms?.version,
        customerIp: data.customerIp || before.signature?.customerIp
      },
      lifecycleHandoff: {
        ...(before.lifecycleHandoff || {}),
        status: before.lifecycleHandoff?.required === false ? 'not_started' : 'ready',
        handoffBoundary: 'lifecycle_handoff_only'
      },
      deliverables: {
        ...(before.deliverables || {}),
        eSignatureEvidenceUrl: data.evidenceUrl || before.deliverables?.eSignatureEvidenceUrl,
        contractPdfUrl: data.contractPdfUrl || before.deliverables?.contractPdfUrl
      },
      updatedBy: scope.userId
    };

    const updated = await this.contractRepo.updateById(scope, this.getRecordId(before), update, options);
    if (before.quotationId && this.quotationRepo.updateById) {
      await this.quotationRepo.updateById(scope, before.quotationId, {
        status: 'contracted',
        updatedBy: scope.userId
      }, options).catch(() => null);
    }
    await this.recordAudit(scope, {
      action: 'contract.signature.marked',
      resourceType: 'ContractV2',
      resourceId: contractId,
      before: this.auditSnapshot(before),
      after: this.auditSnapshot(updated)
    });
    await this.publishOutbox(scope, this.contractOutboxEvent('contract.signed', updated));

    return updated;
  }

  async decideApproval(scope, contractId, data = {}, options = {}) {
    this.ensureScope(scope);
    const before = await this.requireContract(scope, contractId);
    if (!before.approval?.required) {
      const err = new Error('contract approval is not required');
      err.status = 409;
      throw err;
    }
    if (before.approval.status !== 'pending') {
      const err = new Error('contract approval has already been decided');
      err.status = 409;
      throw err;
    }

    const decision = data.decision || data.status || (data.approved === false ? 'rejected' : 'approved');
    if (!['approved', 'rejected'].includes(decision)) {
      const err = new Error('approval decision must be approved or rejected');
      err.status = 400;
      throw err;
    }

    const decidedAt = data.decidedAt ? new Date(data.decidedAt) : this.now();
    const approval = {
      ...(before.approval || {}),
      status: decision,
      reason: data.reason || before.approval?.reason,
      approvedBy: decision === 'approved' ? (data.approvedBy || scope.userId) : before.approval?.approvedBy,
      approvedAt: decision === 'approved' ? decidedAt : before.approval?.approvedAt,
      rejectedBy: decision === 'rejected' ? (data.rejectedBy || scope.userId) : before.approval?.rejectedBy,
      rejectedAt: decision === 'rejected' ? decidedAt : before.approval?.rejectedAt
    };
    const update = {
      approval,
      status: decision === 'approved' ? 'pending_signature' : 'voided',
      updatedBy: scope.userId
    };

    const updated = await this.contractRepo.updateById(scope, this.getRecordId(before), update, options);
    await this.recordAudit(scope, {
      action: `contract.approval.${decision}`,
      resourceType: 'ContractV2',
      resourceId: contractId,
      before: this.auditSnapshot(before),
      after: this.auditSnapshot(updated)
    });
    await this.publishOutbox(scope, this.contractOutboxEvent(`contract.approval.${decision}`, updated, {
      approvalStatus: approval.status,
      approvalReason: approval.reason,
      decidedAt
    }));

    return updated;
  }

  async recordPayment(scope, contractId, data = {}, options = {}) {
    this.ensureScope(scope);
    const before = await this.requireContract(scope, contractId);
    const key = data.key || data.paymentKey || data.stage;
    const index = Number.isFinite(Number(data.index)) ? Number(data.index) : -1;
    const paidAt = data.paidAt ? new Date(data.paidAt) : this.now();
    const amount = Number(data.amount || data.paidAmount || 0);
    if (!key && index < 0) {
      const err = new Error('payment key or index is required');
      err.status = 400;
      throw err;
    }
    if (amount <= 0) {
      const err = new Error('payment amount must be greater than zero');
      err.status = 400;
      throw err;
    }

    let matched = false;
    const paymentSchedule = (before.paymentSchedule || []).map((item, itemIndex) => {
      const hit = key ? item.key === key : itemIndex === index;
      if (!hit) return item;
      matched = true;
      const paidAmount = Number(item.paidAmount || 0) + amount;
      return {
        ...item,
        paidAmount,
        paidAt,
        status: paidAmount >= Number(item.amount || 0) ? 'paid' : 'invoiced',
        method: data.method || item.method,
        receiptNo: data.receiptNo || item.receiptNo,
        note: data.note || item.note
      };
    });
    if (!matched) {
      const err = new Error('payment schedule item not found');
      err.status = 404;
      throw err;
    }

    const paidItems = paymentSchedule.filter(item => item.status === 'paid').length;
    const paymentStatus = paidItems === paymentSchedule.length ? 'paid' : 'partial';
    const updated = await this.contractRepo.updateById(scope, this.getRecordId(before), {
      paymentSchedule,
      paymentStatus,
      updatedBy: scope.userId
    }, options);

    await this.recordAudit(scope, {
      action: 'contract.payment.recorded',
      resourceType: 'ContractV2',
      resourceId: contractId,
      before: this.auditSnapshot(before),
      after: this.auditSnapshot(updated)
    });
    await this.publishOutbox(scope, this.contractOutboxEvent('contract.payment.recorded', updated, {
      paymentKey: key || paymentSchedule[index]?.key,
      amount,
      paymentStatus
    }));

    return updated;
  }

  async startDelivery(scope, contractId, data = {}, options = {}) {
    this.ensureScope(scope);
    const before = await this.requireContract(scope, contractId);
    if (!['signed', 'delivery_started'].includes(before.status)) {
      const err = new Error('contract must be signed before delivery can start');
      err.status = 409;
      throw err;
    }

    const handoverPayload = {
      customerId: before.customerId,
      opportunityId: before.opportunityId,
      contractId: before.contractNo || contractId,
      quoteId: before.quotationId,
      projectAddress: data.projectAddress || before.project?.address,
      systems: data.systems || before.systemFamilies,
      projectState: data.projectState || 'construction-planning',
      lifecycleHandoff: { handoffBoundary: 'lifecycle_handoff_only' },
      iot: {
        platform: data.iot?.platform || 'rhautt-iot',
        accountId: data.iot?.accountId,
        handoffBoundary: 'lifecycle_handoff_only'
      },
      servicePlan: {
        code: before.lifecycleHandoff?.servicePlanCode,
        ...(data.servicePlan || {})
      },
      devices: data.devices || [],
      installedAssets: data.installedAssets || []
    };
    if (!this.lifecycleService || typeof this.lifecycleService.createOrUpdateHandover !== 'function') {
      const err = new Error('lifecycle handover is owned by the NestJS API');
      err.status = 503;
      throw err;
    }
    const lifecycleLink = await this.lifecycleService.createOrUpdateHandover(scope, handoverPayload);
    const updated = await this.contractRepo.updateById(scope, this.getRecordId(before), {
      status: 'delivery_started',
      deliveryStartedAt: this.now(),
      lifecycleLinkId: String(lifecycleLink._id || lifecycleLink.id || lifecycleLink.contractId || ''),
      lifecycleHandoff: {
        ...(before.lifecycleHandoff || {}),
        status: 'linked',
        handoffBoundary: 'lifecycle_handoff_only'
      },
      updatedBy: scope.userId
    }, options);

    await this.recordAudit(scope, {
      action: 'contract.delivery.started',
      resourceType: 'ContractV2',
      resourceId: contractId,
      before: this.auditSnapshot(before),
      after: this.auditSnapshot(updated)
    });
    await this.publishOutbox(scope, this.contractOutboxEvent('contract.delivery.started', updated, {
      lifecycleLinkId: updated.lifecycleLinkId,
      handoffBoundary: 'lifecycle_handoff_only'
    }));

    return { contract: updated, lifecycleLink };
  }

  list(scope, query = {}, options = {}) {
    this.ensureScope(scope);
    const filters = {};
    if (query.customerId) filters.customerId = query.customerId;
    if (query.status) filters.status = query.status;
    if (query.paymentStatus) filters.paymentStatus = query.paymentStatus;
    if (query.dealerId) filters.dealerId = query.dealerId;
    if (query.storeId) filters.storeId = query.storeId;
    return this.contractRepo.list(scope, filters, {
      page: options.page || query.page,
      limit: options.limit || query.limit,
      sort: { updatedAt: -1 }
    });
  }

  async recordAudit(scope, entry) {
    if (!this.auditService || typeof this.auditService.record !== 'function') return null;
    return this.auditService.record(scope, entry);
  }

  async publishOutbox(scope, event) {
    if (!this.outboxService || typeof this.outboxService.publish !== 'function') return null;
    return this.outboxService.publish(scope, event);
  }

  auditSnapshot(contract = {}) {
    if (!contract) return null;
    return {
      contractNo: contract.contractNo,
      customerId: contract.customerId,
      quotationId: contract.quotationId,
      status: contract.status,
      paymentStatus: contract.paymentStatus,
      signatureStatus: contract.signature?.status,
      approvalStatus: contract.approval?.status,
      customerTotal: contract.pricingSnapshot?.customerTotal,
      lifecycleHandoffStatus: contract.lifecycleHandoff?.status,
      handoffBoundary: contract.lifecycleHandoff?.handoffBoundary || 'lifecycle_handoff_only'
    };
  }

  contractOutboxEvent(eventType, contract = {}, extraPayload = {}) {
    const contractNo = contract.contractNo || 'unknown-contract';
    const tenantId = contract.tenantId || 'unknown-tenant';
    return {
      aggregateType: 'contract',
      aggregateId: contractNo,
      eventType,
      idempotencyKey: `${tenantId}:contract:${contractNo}:${eventType}:${contract.status || 'state'}:${contract.paymentStatus || 'payment'}`,
      payload: {
        contractNo,
        customerId: contract.customerId,
        quotationId: contract.quotationId,
        status: contract.status,
        paymentStatus: contract.paymentStatus,
        customerTotal: contract.pricingSnapshot?.customerTotal,
        lifecycleHandoff: contract.lifecycleHandoff,
        handoffBoundary: 'lifecycle_handoff_only',
        ...extraPayload
      }
    };
  }
}

module.exports = ContractsService;
