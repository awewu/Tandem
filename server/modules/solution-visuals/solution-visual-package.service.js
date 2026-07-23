const crypto = require('crypto');

const TIER_KEYS = ['essential', 'balanced', 'premium'];
const TIER_ALIASES = {
  essential: ['essential', 'basic'],
  balanced: ['balanced', 'comfort'],
  premium: ['premium']
};
const TIER_CANONICAL = {
  basic: 'essential',
  comfort: 'balanced',
  premium: 'premium',
  essential: 'essential',
  balanced: 'balanced'
};
const SYSTEM_MAP = {
  hot_water: { type: 'water', name: '中央热水' },
  heating: { type: 'heating', name: '采暖' },
  water_treatment: { type: 'purification', name: '净水' },
  fresh_air: { type: 'fresh_air', name: '新风' },
  air: { type: 'ac', name: '空调 / 全空气' },
  smart_control: { type: 'control', name: '智能控制' }
};

class SolutionVisualPackageService {
  constructor(options = {}) {
    this.drawingRenderer = options.drawingRenderer || null;
    this.renderer3D = options.renderer3D || null;
    this.now = options.now || (() => new Date());
  }

  ensureResult(result) {
    if (!result || (!result.solutions && !result.tiers)) {
      const err = new Error('solutions result is required for visual package generation');
      err.status = 400;
      throw err;
    }
    return result;
  }

  canonicalTierKey(tierKey) {
    return TIER_CANONICAL[tierKey] || tierKey;
  }

  aliasesForTier(tierKey) {
    const canonical = this.canonicalTierKey(tierKey);
    return TIER_ALIASES[canonical] || [canonical];
  }

  readTier(source, tierKey) {
    const aliases = this.aliasesForTier(tierKey);
    if (Array.isArray(source)) {
      return source.find(item => aliases.includes(item.id) || aliases.includes(item.tier));
    }
    for (const alias of aliases) {
      if (source && source[alias]) return source[alias];
    }
    return null;
  }

  normalizeResult(result = {}) {
    const source = result.tiers || result.solutions || {};
    const tiers = {};
    for (const tierKey of TIER_KEYS) {
      const tier = this.readTier(source, tierKey);
      if (tier) tiers[tierKey] = this.normalizeSolution(tier, tierKey);
    }
    return {
      ...result,
      tiers,
      solutions: tiers,
      recommendation: this.normalizeRecommendation(result.recommendation, result.recommendedTierId)
    };
  }

  normalizeRecommendation(recommendation = {}, recommendedTierId) {
    const recommendedTier = this.canonicalTierKey(
      recommendation.recommendedTier ||
      recommendation.recommendedTierId ||
      recommendedTierId ||
      'balanced'
    );
    return {
      ...recommendation,
      recommendedTier
    };
  }

  normalizeSolution(solution = {}, tierKey) {
    return {
      ...solution,
      id: tierKey,
      tier: tierKey,
      name: solution.name || tierName(tierKey),
      systems: this.normalizeSystems(solution.systems || solution.systemLabels || []),
      totalPrice: Number(solution.totalPrice || solution.estimatedTotal || 0),
      estimatedTotal: Number(solution.estimatedTotal || solution.totalPrice || 0)
    };
  }

  normalizeSystems(systems = []) {
    return systems.map((system, index) => this.normalizeSystem(system, index));
  }

  normalizeSystem(system, index) {
    if (typeof system === 'string') {
      const mapped = SYSTEM_MAP[system] || { type: system, name: system };
      return {
        ...mapped,
        sourceSystemId: system
      };
    }
    const rawType = String(system.type || system.systemFamily || system.category || system.id || system.sourceSystemId || '').toLowerCase();
    const mapped = SYSTEM_MAP[rawType] || SYSTEM_MAP[system.system] || null;
    return {
      ...system,
      type: mapped?.type || rawType || `system-${index + 1}`,
      name: system.name || system.label || mapped?.name || system.system || `系统 ${index + 1}`
    };
  }

  normalizeThreeTierResult(result, tierKey) {
    return {
      version: result.version || 'legacy-ai-consultant',
      generatedAt: result.timestamp || result.generatedAt || this.now().toISOString(),
      input: result.input || {},
      tiers: result.tiers || result.solutions,
      recommendation: result.recommendation || { recommendedTier: tierKey }
    };
  }

  buildProject(result = {}) {
    const input = result.input || {};
    return {
      name: input.projectName || `瑞诺瓦${input.area || 120}㎡舒适家方案`,
      customer: input.customerName,
      address: input.address,
      area: input.area,
      city: input.city,
      houseType: input.houseType
    };
  }

  selectDrawing(drawings = [], type) {
    return drawings.find(item => item.type === type) || null;
  }

  generateDrawingPackage(result, tierKey) {
    if (!this.drawingRenderer || typeof this.drawingRenderer.generate !== 'function') {
      return this.generateInlineDrawingPackage(result, tierKey);
    }

    const drawingResult = this.drawingRenderer.generate({
      result: this.normalizeThreeTierResult(result, tierKey),
      tier: tierKey,
      project: this.buildProject(result)
    });

    const schematic = this.selectDrawing(drawingResult.drawings, 'schematic');
    const layout = this.selectDrawing(drawingResult.drawings, 'layout');

    return {
      drawingSetId: drawingResult.id,
      manifestUrl: `/api/drawings/${drawingResult.id}`,
      schematic,
      layout,
      allDrawings: drawingResult.drawings || []
    };
  }

  generateInlineDrawingPackage(result, tierKey) {
    const solution = result.solutions[tierKey] || {};
    const drawingSetId = `inline-${tierKey}-${crypto.createHash('sha1').update(JSON.stringify({
      tierKey,
      area: result.input?.area,
      systems: (solution.systems || []).map(item => item.name)
    })).digest('hex').slice(0, 10)}`;
    const schematic = {
      type: 'schematic',
      name: '设计原理图',
      status: 'generated-inline-svg',
      url: null,
      inlineSvg: this.generatePrincipleDiagramSvg(result, tierKey, solution)
    };
    const layout = {
      type: 'layout',
      name: '2D布局图',
      status: 'generated-inline-svg',
      url: null,
      inlineSvg: this.generateLayout2dSvg(result, tierKey, solution)
    };
    return {
      drawingSetId,
      manifestUrl: null,
      schematic,
      layout,
      allDrawings: [schematic, layout]
    };
  }

  systemToDevice(system = {}, index) {
    const type = String(system.type || '').toLowerCase();
    const config = system.config || {};
    const mainConfig = config.heater || config.boiler || config.outdoor || config.unit || config.filter || {};
    const model = mainConfig.model || system.name || `设备-${index + 1}`;
    const placement = type.includes('fresh') || type.includes('ac') ? 'ceiling' : 'utility';
    return {
      id: `${system.type || 'system'}-${index + 1}`,
      name: system.name || model,
      model,
      type: 'device',
      deviceType: this.deviceTypeForSystem(system),
      placement,
      position: {
        x: 1.5 + index * 1.8,
        y: placement === 'ceiling' ? 2.6 : 0.4,
        z: 1.2 + (index % 2) * 1.6
      },
      dimensions: {
        width: type.includes('fresh') ? 0.7 : 0.9,
        height: placement === 'ceiling' ? 0.25 : 0.6,
        depth: 0.45
      },
      system: system.name,
      price: system.price
    };
  }

  deviceTypeForSystem(system = {}) {
    const type = String(system.type || '').toLowerCase();
    const name = String(system.name || '').toLowerCase();
    if (type.includes('fresh') || name.includes('新风')) return 'freshAirUnit';
    if (type.includes('water') || name.includes('热水')) return 'hotWaterTank';
    if (type.includes('heat') || name.includes('采暖')) return 'heatingManifold';
    if (type.includes('ac') || name.includes('空调')) return 'outdoorUnit';
    return 'indoorUnit';
  }

  build3DDesignData(solution = {}) {
    const devices = (solution.systems || []).map((system, index) => this.systemToDevice(system, index));
    const pipes = devices.map((device, index) => ({
      id: `pipe-${index + 1}`,
      type: this.pipeTypeForDevice(device),
      from: { x: 0.4, y: 0.2, z: 0.4 + index },
      to: device.position,
      points: [
        { x: 0.4, y: 0.2, z: 0.4 + index },
        { x: device.position.x, y: device.position.y, z: device.position.z }
      ],
      diameter: 25,
      length: 4 + index
    }));

    return { devices, pipes };
  }

  visualTraceability(result = {}, tierKey, solution = {}) {
    const systems = solution.systems || [];
    const systemNodes = systems.map((system, index) => ({
      nodeId: `${system.type || 'system'}-${index + 1}`,
      sourceSystemId: system.sourceSystemId || system.id || system.type || `system-${index + 1}`,
      type: system.type || `system-${index + 1}`,
      name: system.name || system.label || `系统 ${index + 1}`,
      drawingRefs: {
        principleDiagramNode: `principle-node-${index + 1}`,
        layoutDeviceNode: `layout-device-${index + 1}`,
        scene3dDeviceNode: `scene3d-device-${index + 1}`
      }
    }));
    const sourceHash = crypto.createHash('sha256').update(JSON.stringify({
      tierKey,
      project: this.buildProject(result),
      systems: systemNodes.map(item => ({ type: item.type, name: item.name }))
    })).digest('hex');
    return {
      traceabilityId: `visual-trace-${tierKey}-${sourceHash.slice(0, 12)}`,
      sourceHash: `sha256:${sourceHash}`,
      tier: tierKey,
      project: this.buildProject(result),
      systemCount: systemNodes.length,
      systemNodes,
      visualArtifacts: {
        principleDiagram: 'principle-diagram',
        layout2d: 'construction-drawing',
        scene3d: 'bim-model'
      },
      standardsRefs: [
        'GB 55015-2021',
        'GB 55020-2021',
        'GB 50736-2012'
      ],
      handoffBoundary: 'lifecycle_handoff_only',
      realtimeControl: false
    };
  }

  pipeTypeForDevice(device = {}) {
    if (device.deviceType === 'freshAirUnit') return 'fresh_supply';
    if (device.deviceType === 'hotWaterTank') return 'water_hot';
    if (device.deviceType === 'heatingManifold') return 'heating_supply';
    return 'ac_liquid';
  }

  generate3DPreview(result, tierKey, solution = {}) {
    if (!this.renderer3D || typeof this.renderer3D.generateScene !== 'function') {
      return this.generateSvg3DPreview(result, tierKey, solution);
    }

    const input = result.input || {};
    const projectData = {
      name: this.buildProject(result).name,
      area: Number(input.area || 120),
      rooms: []
    };
    const designData = this.build3DDesignData(solution);
    const scene = this.renderer3D.generateScene(projectData, designData, { mode: 'preview' });
    const views = typeof this.renderer3D.generateViews === 'function'
      ? this.renderer3D.generateViews(scene)
      : [];

    return {
      type: 'scene3d',
      label: '3D示意图',
      status: 'generated-scene',
      scene,
      previewSvg: this.generateSvg3DPreview(result, tierKey, solution).inlineSvg,
      thumbnail: views[0]?.thumbnail || null,
      primaryView: views[0] || null,
      quality: 'conceptual-preview'
    };
  }

  generateSvg3DPreview(result, tierKey, solution = {}) {
    const id = `scene3d-${tierKey}-${crypto.createHash('sha1').update(JSON.stringify({
      tierKey,
      area: result.input?.area,
      systems: (solution.systems || []).map(item => item.name)
    })).digest('hex').slice(0, 10)}`;
    const colors = {
      basic: '#6b7280',
      comfort: '#0066cc',
      premium: '#b7791f'
    };
    const accent = colors[tierKey] || colors.comfort;
    const systems = solution.systems || [];
    const blocks = systems.map((system, index) => {
      const x = 96 + index * 86;
      const y = 148 - Math.min(index, 2) * 16;
      return `
        <g id="scene3d-device-${index + 1}">
          <polygon points="${x},${y} ${x + 54},${y - 22} ${x + 92},${y + 4} ${x + 38},${y + 28}" fill="#ffffff" stroke="${accent}" stroke-width="2"/>
          <polygon points="${x + 38},${y + 28} ${x + 92},${y + 4} ${x + 92},${y + 54} ${x + 38},${y + 78}" fill="#eef4f8" stroke="${accent}" stroke-width="2"/>
          <text x="${x + 48}" y="${y + 94}" font-size="11" fill="#24313f" text-anchor="middle">${escapeXml(system.name || '系统')}</text>
        </g>`;
    }).join('');
    const inlineSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="240" viewBox="0 0 420 240" role="img" aria-label="${tierName(tierKey)}3D示意图">
      <rect width="420" height="240" fill="#f7f9fb"/>
      <polygon points="40,178 180,92 378,146 220,216" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
      <polygon points="40,178 40,90 180,28 180,92" fill="#eef2f7" stroke="#cbd5e1" stroke-width="2"/>
      <polygon points="180,28 378,80 378,146 180,92" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
      ${blocks}
      <text x="24" y="28" font-size="15" font-weight="700" fill="#172033">${tierName(tierKey)} · 3D示意图</text>
      <text x="24" y="48" font-size="11" fill="#64748b">设备位置与空间关系概念预览</text>
    </svg>`;

    return {
      type: 'scene3d',
      label: '3D示意图',
      status: 'generated-svg-preview',
      id,
      inlineSvg,
      quality: 'conceptual-preview'
    };
  }

  generatePrincipleDiagramSvg(result, tierKey, solution = {}) {
    const systems = solution.systems || [];
    const accent = tierColor(tierKey);
    const rows = systems.length ? systems : [{ name: '舒适家系统', type: 'comfort' }];
    const blocks = rows.map((system, index) => {
      const y = 74 + index * 34;
      return `
        <g id="principle-node-${index + 1}">
          <rect x="26" y="${y}" width="110" height="24" rx="3" fill="#ffffff" stroke="${accent}" stroke-width="1.5"/>
          <text x="81" y="${y + 16}" font-size="10" fill="#24313f" text-anchor="middle">${escapeXml(system.name || system.type)}</text>
          <line x1="136" y1="${y + 12}" x2="226" y2="${y + 12}" stroke="${accent}" stroke-width="1.5"/>
          <polygon points="226,${y + 8} 236,${y + 12} 226,${y + 16}" fill="${accent}"/>
          <rect x="236" y="${y}" width="118" height="24" rx="3" fill="#f8fafc" stroke="#94a3b8" stroke-width="1"/>
          <text x="295" y="${y + 16}" font-size="10" fill="#334155" text-anchor="middle">末端 / 控制 / 监测</text>
        </g>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="240" viewBox="0 0 420 240" role="img" aria-label="${tierName(tierKey)}设计原理图">
      <rect width="420" height="240" fill="#f7f9fb"/>
      <text x="24" y="28" font-size="15" font-weight="700" fill="#172033">${tierName(tierKey)} · 设计原理图</text>
      <text x="24" y="48" font-size="11" fill="#64748b">系统源端、输配、末端与智能控制关系</text>
      ${blocks}
      <rect x="24" y="198" width="350" height="22" rx="3" fill="#fff7ed" stroke="#fed7aa"/>
      <text x="34" y="213" font-size="10" fill="#7c2d12">边界：IoT lifecycle handoff only，不承担实时设备控制</text>
    </svg>`;
  }

  generateLayout2dSvg(result, tierKey, solution = {}) {
    const systems = solution.systems || [];
    const accent = tierColor(tierKey);
    const area = Number(result.input?.area || 120);
    const devices = systems.map((system, index) => {
      const x = 60 + (index % 3) * 100;
      const y = 92 + Math.floor(index / 3) * 58;
      return `
        <g id="layout-device-${index + 1}">
          <rect x="${x}" y="${y}" width="74" height="34" rx="4" fill="#ffffff" stroke="${accent}" stroke-width="1.5"/>
          <text x="${x + 37}" y="${y + 21}" font-size="10" fill="#24313f" text-anchor="middle">${escapeXml(system.name || system.type)}</text>
        </g>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="240" viewBox="0 0 420 240" role="img" aria-label="${tierName(tierKey)}2D布局图">
      <rect width="420" height="240" fill="#f7f9fb"/>
      <text x="24" y="28" font-size="15" font-weight="700" fill="#172033">${tierName(tierKey)} · 2D布局图</text>
      <text x="24" y="48" font-size="11" fill="#64748b">${area}㎡户型设备与管线概念布置</text>
      <rect x="42" y="68" width="318" height="150" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
      <line x1="42" y1="118" x2="360" y2="118" stroke="#e2e8f0"/>
      <line x1="148" y1="68" x2="148" y2="218" stroke="#e2e8f0"/>
      <line x1="254" y1="68" x2="254" y2="218" stroke="#e2e8f0"/>
      ${devices}
      <text x="52" y="208" font-size="10" fill="#64748b">示意比例，深化阶段由 Rysnova 输出正式 CAD/BIM</text>
    </svg>`;
  }

  generateForTier(result, tierKey) {
    const solution = result.solutions[tierKey];
    if (!solution) return null;
    const drawingPackage = this.generateDrawingPackage(result, tierKey);
    const scene3d = this.generate3DPreview(result, tierKey, solution);
    const schematic = drawingPackage?.schematic || null;
    const layout2d = drawingPackage?.layout || null;
    const traceability = this.visualTraceability(result, tierKey, solution);

    return {
      tier: tierKey,
      tierName: solution.name || tierName(tierKey),
      generatedAt: this.now().toISOString(),
      status: schematic && layout2d && scene3d ? 'ready' : 'partial',
      traceability,
      visuals: {
        principleDiagram: {
          type: 'principle-diagram',
          label: '设计原理图',
          status: schematic?.status || (schematic ? 'generated-svg' : 'missing'),
          url: schematic?.url || null,
          inlineSvg: schematic?.inlineSvg || null,
          drawingSetId: drawingPackage?.drawingSetId || null,
          traceability
        },
        layout2d: {
          type: 'layout-2d',
          label: '2D布局图',
          status: layout2d?.status || (layout2d ? 'generated-svg' : 'missing'),
          url: layout2d?.url || null,
          inlineSvg: layout2d?.inlineSvg || null,
          drawingSetId: drawingPackage?.drawingSetId || null,
          traceability
        },
        scene3d: {
          ...scene3d,
          traceability
        }
      },
      drawingSet: drawingPackage ? {
        id: drawingPackage.drawingSetId,
        manifestUrl: drawingPackage.manifestUrl,
        allDrawings: drawingPackage.allDrawings
      } : null
    };
  }

  generate(result) {
    const normalized = this.normalizeResult(this.ensureResult(result));
    const tiers = {};
    for (const tierKey of TIER_KEYS) {
      const packageForTier = this.generateForTier(normalized, tierKey);
      if (packageForTier) tiers[tierKey] = packageForTier;
    }
    return {
      version: '1.0.0',
      generatedAt: this.now().toISOString(),
      status: Object.values(tiers).every(item => item.status === 'ready') ? 'ready' : 'partial',
      tiers
    };
  }
}

function tierName(tierKey) {
  return { essential: '基础方案', basic: '基础方案', balanced: '均衡方案', comfort: '均衡方案', premium: '尊享方案' }[tierKey] || tierKey;
}

function tierColor(tierKey) {
  return { essential: '#6b7280', basic: '#6b7280', balanced: '#0066cc', comfort: '#0066cc', premium: '#b7791f' }[tierKey] || '#0066cc';
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = SolutionVisualPackageService;
module.exports.TIER_KEYS = TIER_KEYS;
