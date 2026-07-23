const crypto = require('crypto');
const mongoose = require('mongoose');
const BaseRepository = require('../../repositories/BaseRepository');
const CustomerV2 = require('../../models/CustomerV2');
const Opportunity = require('../../models/Opportunity');
const Interaction = require('../../models/Interaction');
const CryptoService = require('../security/crypto.service');
const dbLayer = require('../../db');
const {
  MODULE_IDS,
  productModuleContext
} = require('../productModules/product-module-registry');

// Legacy compatibility service. It no longer owns or mounts /api/v2/crm.
// Diagnosis was retired to NestJS; remove this residue only with the remaining
// non-v2 compatibility consumers and their dedicated retirement evidence.
class CrmService {
  constructor(options = {}) {
    this.memoryDb = options.db || options.memoryDb || null;
    this.customerRepo = options.customerRepo || new BaseRepository(CustomerV2);
    this.opportunityRepo = options.opportunityRepo || new BaseRepository(Opportunity);
    this.interactionRepo = options.interactionRepo || new BaseRepository(Interaction);
    this.phoneSecret = options.phoneSecret || process.env.PHONE_HASH_SECRET || 'rhautt-phone-dev-secret';
    this.cryptoService = options.cryptoService || new CryptoService({
      secret: options.piiEncryptionSecret
    });
  }

  shouldUseMemoryMode() {
    return Boolean(this.memoryDb && !process.env.MONGODB_URI);
  }

  hashPhone(phone) {
    return crypto
      .createHmac('sha256', this.phoneSecret)
      .update(String(phone).replace(/\D/g, ''))
      .digest('hex');
  }

  encryptPhoneForNow(phone) {
    return this.cryptoService.encryptText(String(phone).replace(/\D/g, ''));
  }

  normalizeProductContext(data = {}) {
    return productModuleContext(data);
  }

  maskPhone(phoneEncrypted) {
    const encrypted = String(phoneEncrypted || '');
    const raw = this.cryptoService.isEncryptedValue(encrypted)
      ? this.cryptoService.decryptText(encrypted)
      : Buffer.from(encrypted, 'base64').toString('utf8');
    if (!raw) return '';
    return raw.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  }

  async createLead(scope, data, options = {}) {
    if (this.shouldUseMemoryMode()) {
      dbLayer.requirePersistence('crm.createLead');
      return this.createMemoryLead(scope, data);
    }

    const phoneHash = this.hashPhone(data.phone);
    const existing = await CustomerV2.findOne({ tenantId: scope.tenantId, phoneHash }).lean();
    if (existing) return { customer: existing, duplicate: true };

    const session = options.session;
    const productContext = this.normalizeProductContext(data);
    const customerPayload = {
      tenantId: scope.tenantId,
      dealerId: scope.dealerId,
      storeId: scope.storeId,
      ownerUserId: data.ownerUserId || scope.userId,
      phoneHash,
      phoneEncrypted: this.encryptPhoneForNow(data.phone),
      name: data.name,
      city: data.city,
      address: data.address,
      source: data.source || 'unknown',
      ...productContext,
      tags: data.tags || [],
      profile: data.profile || {},
      createdBy: scope.userId,
      updatedBy: scope.userId,
      lastInteractionAt: new Date()
    };

    const create = async (txSession) => {
      const customer = await CustomerV2.create([customerPayload], { session: txSession }).then(items => items[0]);
      const opportunity = await Opportunity.create([{
        tenantId: scope.tenantId,
        dealerId: scope.dealerId,
        storeId: scope.storeId,
        customerId: customer._id,
        ownerUserId: customer.ownerUserId,
        ...productContext,
        stage: 'lead',
        estimatedValue: data.estimatedValue || 0,
        createdBy: scope.userId,
        updatedBy: scope.userId
      }], { session: txSession }).then(items => items[0]);
      const interaction = await Interaction.create([{
        tenantId: scope.tenantId,
        customerId: customer._id,
        opportunityId: opportunity._id,
        actorUserId: scope.userId,
        type: 'note',
        content: data.initialNote || '客户线索创建'
      }], { session: txSession }).then(items => items[0]);
      return { customer, opportunity, interaction, duplicate: false };
    };

    if (session) return create(session);
    if (mongoose.connection.readyState === 1) {
      const txSession = await mongoose.startSession();
      try {
        let result;
        await txSession.withTransaction(async () => { result = await create(txSession); });
        return result;
      } finally {
        await txSession.endSession();
      }
    }

    return create(undefined);
  }

  async listCustomers(scope, query = {}, options = {}) {
    if (this.shouldUseMemoryMode()) {
      dbLayer.requirePersistence('crm.listCustomers');
      return this.listMemoryCustomers(scope, query, options);
    }

    const q = {};
    if (query.status) q.status = query.status;
    if (query.ownerUserId) q.ownerUserId = query.ownerUserId;
    if (query.storeId) q.storeId = query.storeId;
    return this.customerRepo.list(scope, q, {
      page: options.page || query.page,
      limit: options.limit || query.limit,
      sort: { updatedAt: -1 }
    });
  }

  async getCustomer360(scope, customerId) {
    if (this.shouldUseMemoryMode()) {
      dbLayer.requirePersistence('crm.getCustomer360');
      return this.getMemoryCustomer360(scope, customerId);
    }

    const customer = await this.customerRepo.findById(scope, customerId);
    if (!customer) return null;
    const [opportunities, interactions] = await Promise.all([
      Opportunity.find({ tenantId: scope.tenantId, customerId }).sort({ updatedAt: -1 }).lean(),
      Interaction.find({ tenantId: scope.tenantId, customerId }).sort({ createdAt: -1 }).limit(50).lean()
    ]);
    return {
      profile: {
        ...customer,
        phoneMasked: this.maskPhone(customer.phoneEncrypted),
        phoneEncrypted: undefined,
        phoneHash: undefined
      },
      opportunities,
      interactions,
      interactionCount: interactions.length,
      stage: opportunities[0] ? opportunities[0].stage : customer.status
    };
  }

  createMemoryLead(scope, data = {}) {
    const customer = {
      id: `C${String((this.memoryDb.customers || []).length + 1).padStart(3, '0')}`,
      tenantId: scope.tenantId,
      dealerId: scope.dealerId,
      storeId: scope.storeId,
      phone: data.phone,
      name: data.name,
      city: data.city,
      address: data.address,
      source: data.source || 'unknown',
      ...this.normalizeProductContext(data),
      status: 'lead',
      tags: data.tags || [],
      profile: data.profile || {},
      createdBy: scope.userId,
      createdAt: new Date().toISOString()
    };
    this.memoryDb.customers = this.memoryDb.customers || [];
    this.memoryDb.customers.push(customer);
    return {
      customer: this.toMemoryCustomer(customer, scope),
      duplicate: false,
      storageMode: 'memory'
    };
  }

  listMemoryCustomers(scope, query = {}, options = {}) {
    const page = Math.max(parseInt(options.page || query.page || 1, 10), 1);
    const limit = Math.min(Math.max(parseInt(options.limit || query.limit || 20, 10), 1), 100);
    const status = query.status;
    const all = (this.memoryDb.customers || [])
      .map(customer => this.toMemoryCustomer(customer, scope))
      .filter(customer => !status || customer.status === status);
    const start = (page - 1) * limit;
    const items = all.slice(start, start + limit);

    return {
      items,
      pagination: {
        page,
        limit,
        total: all.length,
        pages: Math.ceil(all.length / limit)
      },
      storageMode: 'memory'
    };
  }

  getMemoryCustomer360(scope, customerId) {
    const customer = (this.memoryDb.customers || []).find(item => String(item.id) === String(customerId));
    if (!customer) return null;
    const quotes = (this.memoryDb.quotes || []).filter(quote => String(quote.customerId) === String(customer.id));
    return {
      profile: this.toMemoryCustomer(customer, scope),
      opportunities: quotes.map(quote => ({
        id: quote.id,
        stage: quote.status === 'approved' ? 'quoted' : 'lead',
        estimatedValue: quote.totalPrice || 0,
        systems: quote.systems || []
      })),
      interactions: [],
      interactionCount: 0,
      stage: quotes[0] ? 'quoted' : customer.status || 'lead',
      storageMode: 'memory'
    };
  }

  toMemoryCustomer(customer, scope) {
    const phone = customer.phone || '';
    return {
      id: customer.id,
      tenantId: customer.tenantId || scope.tenantId,
      dealerId: customer.dealerId || scope.dealerId || null,
      storeId: customer.storeId || scope.storeId || null,
      ownerUserId: customer.salesId || customer.designerId || scope.userId || null,
      name: customer.name,
      phoneMasked: phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
      city: customer.city,
      address: customer.address,
      source: customer.source || 'demo',
      productModuleId: customer.productModuleId || MODULE_IDS.RHAUTT_SHARED_PLATFORM,
      productDeploymentMode: customer.productDeploymentMode || 'shared-platform',
      productNamespace: customer.productNamespace || 'rhautt-shared',
      productDataNamespace: customer.productDataNamespace || 'rhautt_shared',
      status: customer.status || 'lead',
      tags: customer.tags || [],
      profile: customer.profile || {
        houseType: customer.houseType,
        area: customer.area
      },
      updatedAt: customer.createdAt || new Date().toISOString()
    };
  }
}

module.exports = CrmService;
