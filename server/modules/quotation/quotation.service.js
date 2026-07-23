const BaseRepository = require('../../repositories/BaseRepository');
const QuotationV2 = require('../../models/QuotationV2');
const OutboxService = require('../outbox/outbox.service');
const {
  productModuleContext
} = require('../productModules/product-module-registry');
const { getRuntimeEngine } = require('../runtimeEngineAccess');
const EconetPricingEngine = require('../../engines/EconetPricingEngine');
const LoadCalculationEngineV3 = require('../../core/LoadCalculationEngineV3');

const _econetEngine = new EconetPricingEngine();
const _loadEngine = new LoadCalculationEngineV3();

const CATEGORY_TO_SYSTEM_FAMILY = {
  hotwater: 'hot_water',
  hot_water: 'hot_water',
  boiler: 'heating',
  heating: 'heating',
  hvac: 'air',
  ac: 'air',
  air: 'air',
  fresh_air: 'fresh_air',
  ventilation: 'fresh_air',
  water_treatment: 'water_treatment',
  purifier: 'water_treatment',
  control: 'smart_control',
  smart_control: 'smart_control',
  service: 'service'
};

const COMMERCIAL_TAX_RATES = {
  vat: {
    general: 0.13,
    small: 0.03,
    construction: 0.09,
    equipment: 0.13
  },
  surcharge: {
    educationSurcharge: 0.03,
    localEducation: 0.02
  },
  stampDuty: {
    constructionContract: 0.0003,
    salesContract: 0.0003
  }
};

const STANDARD_SERVICE_PRICES = {
  design: 3000,
  consulting: 1000,
  maintenance_1y: 2000,
  maintenance_3y: 5000
};

function firstFinite(...values) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function formatRate(rate) {
  return `${Number(rate * 100).toFixed(rate < 0.01 ? 2 : 0).replace(/\.00$/, '')}%`;
}

function createDefaultQuotationEngine() {
  return getRuntimeEngine('quotationV2');
}

class QuotationService {
  constructor(options = {}) {
    this.quoteRepo = options.quoteRepo || new BaseRepository(QuotationV2);
    this.engine = options.engine || createDefaultQuotationEngine();
    this.now = options.now || (() => new Date());
    this.outboxService = options.outboxService || new OutboxService(options);
  }

  ensureScope(scope = {}) {
    if (!scope.tenantId) throw new Error('tenantId is required for quotation persistence');
    return scope;
  }

  normalizeObjectId(value, label) {
    if (!value) throw new Error(`${label} is required for quotation persistence`);
    return value;
  }

  normalizeProductContext(payload = {}) {
    return productModuleContext(payload);
  }

  generateStandardQuote(params = {}) {
    const { design, devices, services = [] } = params;
    const issuedAt = this.now();
    const deviceCost = this.calculateStandardDeviceCost(devices);
    const installationCost = this.calculateStandardInstallationCost(design);
    const serviceCost = this.calculateStandardServiceCost(services);
    const subtotal = deviceCost + installationCost + serviceCost;
    const tax = subtotal * COMMERCIAL_TAX_RATES.vat.equipment;
    const total = subtotal + tax;

    return {
      quoteId: `QT${issuedAt.getTime()}`,
      timestamp: issuedAt.toISOString(),
      summary: {
        subtotal: Math.round(subtotal),
        tax: Math.round(tax),
        total: Math.round(total),
        currency: 'CNY'
      },
      details: {
        devices: {
          items: devices || [],
          total: Math.round(deviceCost)
        },
        installation: {
          description: design ? '标准安装' : '基础安装',
          total: Math.round(installationCost)
        },
        services: {
          items: services,
          total: Math.round(serviceCost)
        }
      },
      validUntil: new Date(issuedAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      terms: '报价有效期30天，最终价格以合同为准'
    };
  }

  calculateStandardDeviceCost(devices) {
    if (!Array.isArray(devices)) return 0;
    return devices.reduce((sum, device) => {
      return sum + Number(device.price || 0) * Number(device.quantity || 1);
    }, 0);
  }

  calculateStandardInstallationCost(design) {
    if (!design) return 5000;
    const area = Number(design.area || 100);
    return area * 150;
  }

  calculateStandardServiceCost(services) {
    if (!Array.isArray(services)) return 0;
    return services.reduce((sum, service) => {
      return sum + (STANDARD_SERVICE_PRICES[service] || 1000);
    }, 0);
  }

  createQuotationNo(scope, quote) {
    const tenantPart = String(scope.tenantId).slice(-6).toUpperCase();
    const timePart = this.now().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const quotePart = String(quote.quoteId || '').replace(/\W/g, '').slice(-6).toUpperCase();
    return `Q2-${tenantPart}-${timePart}${quotePart ? `-${quotePart}` : ''}`;
  }

  inferSystemFamily(item = {}) {
    const raw = String(item.systemFamily || item.system || item.category || '').toLowerCase();
    return CATEGORY_TO_SYSTEM_FAMILY[raw] || 'other';
  }

  normalizeItem(item = {}, index) {
    const quantity = Number(item.qty ?? item.quantity ?? 1);
    const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
    const total = Number(item.total ?? quantity * unitPrice);
    return {
      itemId: String(item.id || item.itemId || `BOM-${index + 1}`),
      name: String(item.name || item.materialName || `报价项 ${index + 1}`),
      model: item.model || item.materialModel,
      brand: item.brand || item.materialBrand,
      category: String(item.category || 'manual'),
      systemFamily: this.inferSystemFamily(item),
      unit: item.unit || '项',
      quantity,
      unitPrice,
      cost: Number(item.cost ?? item.directCost ?? 0),
      total,
      source: item.source || 'designer_bom'
    };
  }

  inferCommercialCityTier(city) {
    const tier1 = new Set(['北京', '上海', '广州', '深圳']);
    const tier2 = new Set(['杭州', '南京', '成都', '武汉', '西安', '重庆', '苏州', '天津']);
    if (tier1.has(city)) return '1';
    if (tier2.has(city)) return '2';
    return '3';
  }

  calculateCommercialTax(params = {}) {
    const equipmentAmount = firstFinite(params.equipmentAmount);
    const installationAmount = firstFinite(params.installationAmount);
    const designAmount = firstFinite(params.designAmount);
    const taxpayerType = params.taxpayerType === 'small' ? 'small' : 'general';
    const cityTier = String(params.cityTier || '1');
    const subtotal = roundMoney(equipmentAmount + installationAmount + designAmount);
    const vat = this.calculateCommercialVAT({
      equipmentAmount,
      installationAmount,
      designAmount,
      taxpayerType
    });
    const surcharge = this.calculateCommercialSurcharge(vat.totalVAT, cityTier);
    const stampDuty = this.calculateCommercialStampDuty({
      equipmentAmount,
      installationAmount,
      designAmount
    });
    const totalTax = roundMoney(vat.totalVAT + surcharge.total + stampDuty.total);
    const totalWithTax = roundMoney(subtotal + totalTax);

    return {
      mode: 'commercial',
      subtotal,
      tax: {
        vat,
        surcharge,
        stampDuty,
        total: totalTax,
        totalRate: subtotal > 0 ? `${((totalTax / subtotal) * 100).toFixed(2)}%` : '0%'
      },
      totalWithTax,
      summary: {
        preTaxAmount: subtotal,
        vatAmount: roundMoney(vat.totalVAT),
        surchargeAmount: roundMoney(surcharge.total),
        stampDutyAmount: roundMoney(stampDuty.total),
        taxTotal: totalTax,
        totalWithTax,
        totalRate: subtotal > 0 ? `${((totalTax / subtotal) * 100).toFixed(2)}%` : '0%'
      }
    };
  }

  calculateCommercialVAT({ equipmentAmount, installationAmount, designAmount, taxpayerType }) {
    if (taxpayerType === 'small') {
      const base = roundMoney(equipmentAmount + installationAmount + designAmount);
      const amount = roundMoney(base * COMMERCIAL_TAX_RATES.vat.small);
      return {
        taxpayerType: 'small',
        items: [
          { name: '增值税(小规模)', rate: formatRate(COMMERCIAL_TAX_RATES.vat.small), base, amount }
        ],
        totalVAT: amount
      };
    }

    const equipmentVAT = roundMoney(equipmentAmount * COMMERCIAL_TAX_RATES.vat.equipment);
    const installationVAT = roundMoney(installationAmount * COMMERCIAL_TAX_RATES.vat.construction);
    const designVAT = roundMoney(designAmount * COMMERCIAL_TAX_RATES.vat.general);
    return {
      taxpayerType: 'general',
      items: [
        { name: '设备增值税', rate: formatRate(COMMERCIAL_TAX_RATES.vat.equipment), base: equipmentAmount, amount: equipmentVAT },
        { name: '安装服务增值税', rate: formatRate(COMMERCIAL_TAX_RATES.vat.construction), base: installationAmount, amount: installationVAT },
        { name: '设计服务增值税', rate: formatRate(COMMERCIAL_TAX_RATES.vat.general), base: designAmount, amount: designVAT }
      ],
      totalVAT: roundMoney(equipmentVAT + installationVAT + designVAT)
    };
  }

  calculateCommercialSurcharge(vatAmount, cityTier) {
    const cityRate = cityTier === '1' ? 0.07 : cityTier === '2' ? 0.05 : 0.01;
    const cityMaintenance = roundMoney(vatAmount * cityRate);
    const educationSurcharge = roundMoney(vatAmount * COMMERCIAL_TAX_RATES.surcharge.educationSurcharge);
    const localEducation = roundMoney(vatAmount * COMMERCIAL_TAX_RATES.surcharge.localEducation);
    return {
      cityTier,
      items: [
        { name: '城市维护建设税', rate: formatRate(cityRate), amount: cityMaintenance },
        { name: '教育费附加', rate: formatRate(COMMERCIAL_TAX_RATES.surcharge.educationSurcharge), amount: educationSurcharge },
        { name: '地方教育附加', rate: formatRate(COMMERCIAL_TAX_RATES.surcharge.localEducation), amount: localEducation }
      ],
      total: roundMoney(cityMaintenance + educationSurcharge + localEducation)
    };
  }

  calculateCommercialStampDuty({ equipmentAmount, installationAmount, designAmount }) {
    const equipmentStamp = roundMoney(equipmentAmount * COMMERCIAL_TAX_RATES.stampDuty.salesContract);
    const constructionStamp = roundMoney((installationAmount + designAmount) * COMMERCIAL_TAX_RATES.stampDuty.constructionContract);
    return {
      items: [
        { name: '购销合同印花税', rate: formatRate(COMMERCIAL_TAX_RATES.stampDuty.salesContract), base: equipmentAmount, amount: equipmentStamp },
        { name: '建设合同印花税', rate: formatRate(COMMERCIAL_TAX_RATES.stampDuty.constructionContract), base: installationAmount + designAmount, amount: constructionStamp }
      ],
      total: roundMoney(equipmentStamp + constructionStamp)
    };
  }

  calculateResidentialTax(params = {}) {
    const totalAmount = firstFinite(params.totalAmount);
    const simpleVAT = roundMoney(totalAmount * 0.03);
    return {
      mode: 'residential-simple',
      subtotal: totalAmount,
      noInvoice: { total: totalAmount, note: '不开票价格' },
      withInvoice: { total: roundMoney(totalAmount + simpleVAT), tax: simpleVAT, note: '含3%简易增值税' }
    };
  }

  buildTaxProfile(payload = {}, quote = {}) {
    const options = payload.options || {};
    const explicit = payload.taxProfile || options.taxProfile || {};
    const summary = quote.summary || {};
    const commercialRequested = (
      explicit.mode === 'commercial' ||
      explicit.projectType === 'commercial' ||
      options.taxMode === 'commercial' ||
      options.projectType === 'commercial' ||
      Boolean(options.taxpayerType || explicit.taxpayerType)
    );

    if (commercialRequested) {
      const equipmentAmount = firstFinite(
        explicit.equipmentAmount,
        options.equipmentAmount,
        summary.materialSubtotal
      );
      const installationAmount = firstFinite(
        explicit.installationAmount,
        options.installationAmount,
        firstFinite(summary.labor) + firstFinite(summary.auxiliary) + firstFinite(summary.management) + firstFinite(summary.riskReserve)
      );
      const designAmount = firstFinite(explicit.designAmount, options.designAmount, payload.project?.designAmount);
      const cityTier = String(explicit.cityTier || options.cityTier || this.inferCommercialCityTier(payload.project?.city || quote.project?.city));
      const detail = this.calculateCommercialTax({
        equipmentAmount,
        installationAmount,
        designAmount,
        taxpayerType: explicit.taxpayerType || options.taxpayerType || 'general',
        cityTier
      });
      return {
        mode: 'commercial',
        amount: detail.tax.total,
        subtotal: detail.subtotal,
        totalWithTax: detail.totalWithTax,
        detail
      };
    }

    const taxAmount = firstFinite(summary.taxAmount, summary.tax);
    const taxRate = firstFinite(summary.taxRate, options.taxRate);
    return {
      mode: options.taxIncluded === false ? 'excluded-or-manual' : 'simple',
      amount: taxAmount,
      rate: taxRate,
      detail: null
    };
  }

  normalizeCostBreakdown(quote = {}, taxProfile = null) {
    const summary = quote.summary || {};
    const taxAmount = taxProfile?.mode === 'commercial'
      ? firstFinite(taxProfile.amount, summary.taxAmount, summary.tax)
      : firstFinite(summary.taxAmount, summary.tax, taxProfile?.amount);
    return {
      materialSubtotal: Number(summary.materialSubtotal || summary.materialTotal || 0),
      laborSubtotal: Number(summary.laborSubtotal || summary.laborTotal || 0),
      managementFee: Number(summary.managementFee || 0),
      warrantyReserve: Number(summary.warrantyReserve || 0),
      riskReserve: Number(summary.riskReserve || 0),
      directCost: Number(summary.directCost || 0),
      targetBeforeTax: Number(summary.targetBeforeTax || 0),
      taxAmount,
      customerTotal: Number(summary.customerTotal || summary.finalTotal || summary.total || 0),
      dealerMargin: Number(summary.dealerMargin || 0),
      monthlyPayment: Number(summary.monthlyPayment || 0)
    };
  }

  async persistFromBOM(scope, payload = {}, options = {}) {
    this.ensureScope(scope);
    const customerId = this.normalizeObjectId(payload.customerId, 'customerId');
    const quote = payload.quote || this.engine.generateQuoteFromBOM(payload);
    const items = (payload.items || quote.items || quote.details || []).map((item, index) => this.normalizeItem(item, index));
    const systemFamilies = [...new Set(items.map(item => item.systemFamily))];
    const quotationNo = payload.quotationNo || this.createQuotationNo(scope, quote);
    const productContext = this.normalizeProductContext(payload);
    const taxProfile = this.buildTaxProfile(payload, quote);

    const record = await this.quoteRepo.create(scope, {
      tenantId: scope.tenantId,
      dealerId: payload.dealerId || scope.dealerId,
      storeId: payload.storeId || scope.storeId,
      customerId,
      opportunityId: payload.opportunityId,
      lifecycleLinkId: payload.lifecycleLinkId,
      ownerUserId: payload.ownerUserId || scope.userId,
      createdBy: scope.userId,
      updatedBy: scope.userId,
      ...productContext,
      quotationNo,
      source: quote.source || 'designer-bom',
      status: payload.status || 'draft',
      project: payload.project || quote.project || {},
      systemFamilies,
      items,
      costBreakdown: this.normalizeCostBreakdown(quote, taxProfile),
      marginGuard: {
        status: quote.marginGuard?.status || 'not_checked',
        minMarginRate: Number(quote.marginGuard?.minMarginRate || payload.options?.minMarginRate || 0),
        targetMarginRate: Number(quote.marginGuard?.targetMarginRate || payload.options?.targetMarginRate || 0),
        quoteFloor: Number(quote.marginGuard?.quoteFloor || 0),
        adjustment: Number(quote.marginGuard?.adjustment || 0)
      },
      deliverables: payload.deliverables || {},
      lifecycleHandoff: {
        required: payload.lifecycleHandoff?.required !== false,
        status: payload.lifecycleHandoff?.status || 'ready',
        iotBridgeKey: payload.lifecycleHandoff?.iotBridgeKey,
        servicePlanCode: payload.lifecycleHandoff?.servicePlanCode
      },
      assumptions: [
        ...(quote.assumptions || []),
        taxProfile.mode === 'commercial'
          ? '商用税费由 quotation service 按设备/安装/设计/附加税/印花税模型计算'
          : null
      ].filter(Boolean)
    }, options);

    await this.publishOutbox(scope, {
      aggregateType: 'quotation',
      aggregateId: record._id || record.id || quotationNo,
      eventType: 'quotation.persisted',
      idempotencyKey: `${scope.tenantId}:${quotationNo}:quotation.persisted`,
      payload: {
        quotationId: record._id || record.id,
        quotationNo,
        customerId,
        ...productContext,
        status: record.status || payload.status || 'draft',
        systemFamilies,
        lifecycleHandoff: record.lifecycleHandoff,
        marginGuard: record.marginGuard,
        customerTotal: record.costBreakdown?.customerTotal,
        taxProfile: {
          mode: taxProfile.mode,
          amount: taxProfile.amount
        }
      }
    }, options);

    return {
      quotation: record,
      quote,
      persisted: true
    };
  }

  list(scope, query = {}, options = {}) {
    this.ensureScope(scope);
    const filters = {};
    if (query.customerId) filters.customerId = query.customerId;
    if (query.status) filters.status = query.status;
    if (query.dealerId) filters.dealerId = query.dealerId;
    if (query.storeId) filters.storeId = query.storeId;
    return this.quoteRepo.list(scope, filters, {
      page: options.page || query.page,
      limit: options.limit || query.limit,
      sort: { updatedAt: -1 }
    });
  }

  async publishOutbox(scope, event, options = {}) {
    if (!this.outboxService || typeof this.outboxService.publish !== 'function') return null;
    return this.outboxService.publish(scope, event, options);
  }

  // ─── Econet加成计算 (PRD M8-003-V2) ─────────────────────────────────────
  async calculateEconetPremium(solution = {}) {
    if (!_econetEngine.initialized) await _econetEngine.initialize();
    return _econetEngine.calculateEconetPremium(solution);
  }

  // ─── 负荷计算 ─────────────────────────────────────────────────────────────
  async calculateLoad(params = {}) {
    const { mode = 'quick', ...rest } = params;
    if (mode === 'quick') {
      const { area, city, buildingType } = rest;
      if (!area) throw new Error('area is required');
      return _loadEngine.quickEstimate(area, city, buildingType);
    }
    _loadEngine.validateParams(rest);
    return _loadEngine.calculateHybrid(rest, rest.city);
  }
}

module.exports = QuotationService;
