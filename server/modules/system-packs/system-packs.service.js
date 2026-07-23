const {
  RHEEM_SYSTEM_PACKS,
  REQUIRED_STANDARDS_COVERAGE_DOMAINS
} = require('./rheemSystemPacks');

class SystemPacksService {
  constructor(options = {}) {
    this.packs = options.packs || RHEEM_SYSTEM_PACKS;
  }

  list(query = {}) {
    return this.packs.filter(pack => {
      if (query.category && pack.category !== query.category) return false;
      if (query.role && pack.plugAndPlayRole !== query.role) return false;
      return true;
    });
  }

  getPack(id) {
    return this.packs.find(pack => pack.id === id) || null;
  }

  compose({ selectedPackIds = [], context = {} } = {}) {
    const selected = selectedPackIds.length
      ? selectedPackIds.map(id => this.getPack(id)).filter(Boolean)
      : this.recommend(context).packs;

    const smartControl = this.getPack('rheem-smart-control');
    const packs = selected.some(pack => pack.id === smartControl.id)
      ? selected
      : [...selected, smartControl];

    const modules = [...new Set(packs.flatMap(pack => pack.modules))];
    const standards = this.mergeStandards(packs);
    const standardsCoverage = this.mergeStandardsCoverage(packs);
    const standardsEvidence = this.buildStandardsEvidence(standards, standardsCoverage);
    const deliverables = [...new Set(packs.flatMap(pack => pack.deliverables))];
    const iotCapabilities = [...new Set(packs.flatMap(pack => pack.iotCapabilities))];
    const quoteTags = [...new Set(packs.flatMap(pack => pack.quoteTags))];

    return {
      packs,
      modules,
      standards,
      standardsCoverage,
      standardsEvidence,
      deliverables,
      iot: {
        handoverRequired: true,
        lifecycleBridge: '/api/v2/lifecycle/handover',
        capabilities: iotCapabilities
      },
      quoteTags,
      implementationNotes: this.buildImplementationNotes(packs, context)
    };
  }

  recommend(context = {}) {
    const painPoints = context.painPoints || [];
    const houseType = String(context.houseType || '').toLowerCase();
    const area = Number(context.area || 0);
    const packs = [];

    if (
      area >= 120 ||
      context.bathrooms >= 2 ||
      context.hasBathtub ||
      painPoints.some(p => /热水|hot_water|等待|水温/.test(String(p)))
    ) {
      packs.push(this.getPack('rheem-central-hot-water'));
    }

    if (
      context.cityClimate === 'cold' ||
      context.hasElderly ||
      painPoints.some(p => /采暖|冷|温差|heating/.test(String(p)))
    ) {
      packs.push(this.getPack('rheem-heating'));
    }

    if (
      houseType.includes('villa') ||
      houseType.includes('别墅') ||
      area >= 180 ||
      painPoints.some(p => /空气|新风|湿|噪音|全空气|iaq|air/.test(String(p)))
    ) {
      packs.push(this.getPack('rheem-whole-air'));
    }

    const unique = [...new Map(packs.filter(Boolean).map(pack => [pack.id, pack])).values()];
    return {
      packs: unique.length ? unique : [this.getPack('rheem-central-hot-water')],
      reasons: this.buildRecommendationReasons(unique, context)
    };
  }

  mergeStandards(packs) {
    const byCode = new Map();
    for (const standard of packs.flatMap(pack => pack.standards)) {
      if (!byCode.has(standard.code)) byCode.set(standard.code, standard);
    }
    return [...byCode.values()];
  }

  mergeStandardsCoverage(packs) {
    const byDomain = new Map();

    for (const pack of packs) {
      for (const coverage of pack.standardsCoverage || []) {
        const existing = byDomain.get(coverage.domain) || {
          domain: coverage.domain,
          requiredFor: [],
          primaryStandards: [],
          softwareChecks: [],
          deliverableEvidence: [],
          quoteImpact: [],
          lifecycleHandoffImpact: [],
          packIds: []
        };

        for (const key of [
          'requiredFor',
          'primaryStandards',
          'softwareChecks',
          'deliverableEvidence',
          'quoteImpact',
          'lifecycleHandoffImpact'
        ]) {
          existing[key] = [...new Set(existing[key].concat(coverage[key] || []))];
        }
        existing.packIds = [...new Set(existing.packIds.concat(pack.id))];
        byDomain.set(coverage.domain, existing);
      }
    }

    return [...byDomain.values()].sort((a, b) => {
      const domainOrder = REQUIRED_STANDARDS_COVERAGE_DOMAINS.indexOf(a.domain)
        - REQUIRED_STANDARDS_COVERAGE_DOMAINS.indexOf(b.domain);
      return domainOrder === 0 ? a.domain.localeCompare(b.domain) : domainOrder;
    });
  }

  buildStandardsEvidence(standards, standardsCoverage = []) {
    const byLevel = standards.reduce((acc, standard) => {
      const level = standard.level || 'L2';
      if (!acc[level]) acc[level] = [];
      acc[level].push({
        code: standard.code,
        edition: standard.edition,
        name: standard.name,
        scope: standard.scope,
        softwareCheck: standard.softwareCheck || 'calculationRule'
      });
      return acc;
    }, {});
    const coveredDomains = standardsCoverage.map(item => item.domain);
    const missingRequiredDomains = REQUIRED_STANDARDS_COVERAGE_DOMAINS.filter(domain => !coveredDomains.includes(domain));

    return {
      hierarchy: [
        {
          level: 'L1',
          label: '中国强制/底线约束',
          enforcement: 'mandatoryBlocker',
          standards: byLevel.L1 || []
        },
        {
          level: 'L2',
          label: '国内设计/施工/验收细化',
          enforcement: 'calculationRule',
          standards: byLevel.L2 || []
        },
        {
          level: 'L3',
          label: '国际先进参考/产品差异化',
          enforcement: 'advisoryOptimization',
          standards: byLevel.L3 || []
        }
      ],
      mandatoryBlockers: standards.filter(s => s.softwareCheck === 'mandatoryBlocker').map(s => s.code),
      calculationRules: standards.filter(s => s.softwareCheck === 'calculationRule').map(s => s.code),
      advisoryOptimizations: standards.filter(s => s.softwareCheck === 'advisoryOptimization').map(s => s.code),
      coverage: {
        status: missingRequiredDomains.length ? 'incomplete' : 'complete',
        requiredDomains: REQUIRED_STANDARDS_COVERAGE_DOMAINS,
        coveredDomains,
        missingRequiredDomains,
        domains: standardsCoverage
      }
    };
  }

  buildRecommendationReasons(packs, context) {
    return packs.map(pack => ({
      packId: pack.id,
      name: pack.name,
      reason: `${pack.positioning}，匹配面积/户型/痛点上下文`
    }));
  }

  buildImplementationNotes(packs, context) {
    const notes = ['智能控制作为横向能力默认植入，确保后续 IoT 接管和售后运维不断链'];
    if (packs.some(pack => pack.id === 'rheem-central-hot-water')) {
      notes.push('中央热水包必须输出循环策略、热水点位和 IoT 热水设备绑定清单');
    }
    if (packs.some(pack => pack.id === 'rheem-heating')) {
      notes.push('采暖包必须输出热源、末端、分区温控和水力平衡校核');
    }
    if (packs.some(pack => pack.id === 'rheem-whole-air')) {
      notes.push('全空气包必须输出新风量、除湿、过滤、静压、噪音和空气质量控制点');
    }
    return notes;
  }
}

module.exports = SystemPacksService;
