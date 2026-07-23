const fs = require('fs');
const path = require('path');
const SolutionVisualPackageService = require('../../server/modules/solution-visuals/solution-visual-package.service');

const ROOT = path.join(__dirname, '../..');

function read(relativePath) {
  if (relativePath.startsWith('public/')) {
    return fs.readFileSync(path.join(ROOT, 'archive', 'legacy-ui', relativePath), 'utf8');
  }
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('visual design surface contract', () => {
  test('solution visual package normalizes old and new three-tier keys into production diagnosis visual contract', () => {
    const service = new SolutionVisualPackageService({
      now: () => new Date('2026-06-06T09:00:00.000Z')
    });

    const result = service.generate({
      input: {
        area: 168,
        city: '上海'
      },
      recommendedTierId: 'balanced',
      solutions: {
        basic: {
          name: '基础舒适方案',
          systems: ['hot_water', 'fresh_air'],
          estimatedTotal: 260000
        },
        comfort: {
          name: '均衡推荐方案',
          systems: ['hot_water', 'heating', 'fresh_air', 'smart_control'],
          estimatedTotal: 320000
        },
        premium: {
          name: '墅级全生命周期方案',
          systems: ['hot_water', 'heating', 'water_treatment', 'fresh_air', 'air', 'smart_control'],
          estimatedTotal: 410000
        }
      }
    });

    expect(Object.keys(result.tiers)).toEqual(['essential', 'balanced', 'premium']);
    expect(result.status).toBe('ready');
    for (const tierId of ['essential', 'balanced', 'premium']) {
      expect(result.tiers[tierId]).toEqual(expect.objectContaining({
        tier: tierId,
        status: 'ready',
        visuals: expect.objectContaining({
          principleDiagram: expect.objectContaining({
            type: 'principle-diagram',
            label: '设计原理图',
            inlineSvg: expect.stringContaining('<svg'),
            traceability: expect.objectContaining({
              sourceHash: expect.stringMatching(/^sha256:/),
              handoffBoundary: 'lifecycle_handoff_only',
              realtimeControl: false
            })
          }),
          layout2d: expect.objectContaining({
            type: 'layout-2d',
            label: '2D布局图',
            inlineSvg: expect.stringContaining('<svg'),
            traceability: expect.objectContaining({
              visualArtifacts: expect.objectContaining({ layout2d: 'construction-drawing' })
            })
          }),
          scene3d: expect.objectContaining({
            type: 'scene3d',
            label: '3D示意图',
            traceability: expect.objectContaining({
              visualArtifacts: expect.objectContaining({ scene3d: 'bim-model' })
            })
          })
        })
      }));
      expect(result.tiers[tierId].traceability.systemNodes.length).toBeGreaterThan(0);
      expect(result.tiers[tierId].traceability.standardsRefs).toEqual(expect.arrayContaining([
        'GB 55015-2021',
        'GB 55020-2021',
        'GB 50736-2012'
      ]));
    }
  });

  test('Rysnova 3D legacy page redirects to the unified designer viewer', () => {
    const html = read('public/rysnova-bim-designer.html');

    expect(html).toContain("new URL('/viewer'");
    expect(html).toContain("target.port = '4003'");
    expect(html).toContain('window.location.replace(redirectUrl)');
    expect(html).toContain('projectId');
    expect(html).toContain('contractId');
    expect(html).toContain('opportunityId');
    expect(html).toContain('artifactId');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('/js/three.min.js');
    expect(html).not.toContain('new THREE.WebGLRenderer');
    expect(html).not.toContain('window.__rysnova-bimRenderProbe');
    expect(html).not.toContain('__rysnovaBimRenderProbe');
    expect(html).not.toContain('/api/rysnova-bim/complete-design');
    expect(html).not.toContain('/api/rysnova-bim/quick-design');
    expect(html).not.toContain('/api/rysnova-bim/export');

    /*
    expect(fs.existsSync(path.join(ROOT, 'archive', 'legacy-ui', 'public', 'js', 'three.min.js'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'archive', 'legacy-ui', 'public', 'images', 'ruud-logo.svg'))).toBe(true);
    expect(html).toContain('/images/ruud-logo.svg');
    expect(html).toContain('Powered by Rhautt Comfort');
    expect(html).toContain('<strong>Rysnova</strong>');
    expect(html).not.toContain('/images/rhautt-comfort-wordmark.svg');
    expect(html).toContain('/js/three.min.js');
    expect(html).toContain('new THREE.WebGLRenderer');
    expect(html).toContain('window.__rysnova-bimRenderProbe');
	    expect(html).toContain('objectCount: scene.children.length');
	    expect(html).toContain('if (controls && controls.update) controls.update();');
	    expect(html).toContain('/api/v2/rysnova-bim/projects/');
	    expect(html).toContain('/signoff-package');
	    expect(html).toContain("approvalMode: 'share-to-customer'");
	    expect(html).toContain("method: 'POST'");
	    expect(html).toContain("'Authorization': 'Bearer ' + token");
	    expect(html).toContain('未检测到员工/设计师登录 token');
	    expect(html).toContain('Rysnova v2 生产交付包');
	    expect(html).toContain('原理图 · 施工图 · BIM · BOM/报价成本包 · 工程量清单 · 标准校核 · 客户深化报告 · 对象存储证据');
	    expect(html).toContain('生成客户签核七件套');
	    expect(html).toContain('系统设计原理图');
	    expect(html).toContain('2D 施工布局图');
	    expect(html).toContain('3D / BIM 示意模型');
	    expect(html).toContain('Rysnova v2 signoff package contract');
	    expect(html).toContain('quoteCostSummary');
	    expect(html).toContain('customerReportSummary');
	    expect(html).toContain('quantityTakeoffSummary');
    expect(html).toContain('standardsSummary');
    expect(html).toContain("localStorage.getItem('token')");
    expect(html).toContain('Authorization');
    expect(html).toContain('/api/rysnova-bim/complete-design');
    expect(html).toContain('/api/rysnova-bim/quick-design');
    expect(html).toContain('/api/rysnova-bim/export');
    expect(html).toContain('rysnova-bimPreviewHeaders');
    expect(html).toContain('requireRysnovaPreviewAuth');
    expect(html).toContain('预览兼容层');
    expect(html).toContain('生产交付请走 v2 artifact contract');
    expect(html).toContain("headers: rysnova-bimPreviewHeaders({ 'Content-Type': 'application/json' })");
    expect(html).not.toContain('/api/rysnova-bim/generate-deliverables');
    expect(html).not.toContain('完整设计方案 PDF · 系统图纸 · 施工图纸 · 材料 BOM');
    */
  });

  test('Designer canvas keeps backend quote contract visible in customer output', () => {
    const html = read('public/designer.html');

    expect(html).toContain('Konva.Stage');
    expect(html).toContain('/api/quotation-v2/from-bom');
    expect(html).toContain('/api/quotation-v2/persist-from-bom');
    expect(html).toContain('/api/v2/design/projects/');
    expect(html).toContain('/workspace-state');
    expect(html).toContain('buildWorkspaceStatePayload');
    expect(html).toContain('persistWorkspaceState');
    expect(html).toContain('scheduleWorkspacePersist');
    expect(html).toContain('workspaceProjectId');
    expect(html).toContain('本地已保存 · 登录后同步工作台');
    expect(html).toContain('已保存到工作台 · v');
    expect(html).toContain('/api/v2/contracts/from-quotation');
    expect(html).toContain('/api/v2/contracts/{contractId}/signature');
    expect(html).toContain('/api/v2/contracts/{contractId}/payments');
    expect(html).toContain('/api/v2/contracts/{contractId}/delivery-start');
    expect(html).toContain("localStorage.getItem('token')");
    expect(html).toContain('Authorization: `Bearer ${token}`');
    expect(html).toContain('CustomerV2 ObjectId');
    expect(html).toContain('persistQuotationFromQuote');
    expect(html).toContain('quotationId');
    expect(html).toContain('不能创建生产合同');
    expect(html).toContain('createContractFromQuote');
    expect(html).toContain('markContractSignature');
    expect(html).toContain('recordContractDeposit');
    expect(html).toContain('startContractDelivery');
    expect(html).toContain('lifecycle_handoff_only');
    expect(html).toContain('正在调用后端成本模型');
    expect(html).toContain('由后端成本模型生成');
    expect(html).not.toContain('matTotal * 0.18');
    expect(html).not.toContain('matTotal * 0.08');
  });

  test('C-end diagnosis page binds v2 public report chain and solution visuals', () => {
    const diagnosisHtml = read('public/pain-diagnosis.html');

    expect(fs.existsSync(path.join(ROOT, 'archive', 'legacy-ui', 'public', 'images', 'rheem-logo.svg'))).toBe(true);
    expect(diagnosisHtml).toContain('diag-rheem-wordmark');
    expect(diagnosisHtml).toContain('Rheem equipment brand');
    expect(diagnosisHtml).not.toContain('/images/rheem-logo.svg');
    expect(diagnosisHtml).toContain('瑞诺瓦系统问诊');
    expect(diagnosisHtml).toContain('Powered by Rhautt Comfort');
    expect(diagnosisHtml).not.toContain('/images/rhautt-comfort-wordmark.svg');
    expect(diagnosisHtml).toContain('/api/v2/diagnosis/public/complete');
    expect(diagnosisHtml).toContain('rysnova-diagnosis-v2-result');
  });

  test('瑞诺瓦 and Rysnova preserve standalone-capable module boundaries without active portal deep links', () => {
    const contract = JSON.parse(read('contracts/product-modules/rysnova-rysnova-bim-module-boundary.json'));
    const home = read('public/index-ready.html');
    const diagnosisModel = read('server/models/DiagnosisReport.js');
    const rysnovaBimModel = read('server/models/RysnovaArtifact.js');
    const productModuleRegistry = read('server/modules/productModules/product-module-registry.js');
    const postgresTargetSchema = read('database/postgres/migrations/001_rhautt_nexus_core_ledger.sql');

    expect(home).not.toContain('/pain-diagnosis.html');
    expect(home).not.toContain('/rysnova-bim-designer.html');

    for (const module of contract.modules) {
      expect(module.embeddedInRhauttPortal).toBe(true);
      expect(module.standaloneLaunchable).toBe(true);
      expect(module.namespace).toBeTruthy();
      expect(module.dataNamespace).toBeTruthy();
      expect(module.apiNamespace).toBeTruthy();
      expect(module.logoPolicy.poweredBy).toBe('Powered by Rhautt Comfort');
      expect(module.dataDomain.standaloneKeys).toContain('moduleId');
      expect(module.dataDomain.standaloneKeys).toContain('moduleDeploymentMode');
      expect(module.dataDomain.standaloneKeys).toContain('moduleNamespace');
      expect(module.dataDomain.standaloneKeys).toContain('dataNamespace');
      expect(module.dataDomain.standaloneKeys).toContain('productNamespace');
      expect(module.dataDomain.standaloneKeys).toContain('productDataNamespace');
      expect(module.dataDomain.postgresRegistry).toBe('rhautt_nexus.product_modules');
      expect(module.dataDomain.deploymentRegistry).toBe('rhautt_nexus.product_module_deployments');
      expect(module.dataDomain.dataPartitionRegistry).toBe('rhautt_nexus.product_module_data_partitions');
      expect(module.dataDomain.futureDatabaseStrategy).toBe('namespace-extractable-shared-ledger');
      expect(module.dataDomain.currentDataMode).toBe('shared-foundation-product-domain-partitioned');
      expect(module.dataDomain.futureDataMode).toBe('standalone-database-extractable');
      expect(module.dataDomain.sharedFoundationTables).toEqual(expect.arrayContaining(['tenants', 'dealers', 'stores', 'users']));
      expect(module.dataDomain.ownedPostgresTables.length).toBeGreaterThan(0);
      expect(module.dataDomain.ownedMongoNamespaces.length).toBeGreaterThan(0);
      expect(module.dataDomain.standaloneDatabaseTarget).toBeTruthy();
      expect(module.dataDomain.extractionProofRequired).toBe(true);
      expect(module.dataDomain.futureStandaloneProductReady).toBe(true);
      expect(module.dataDomain.objectStoragePrefix).toBeTruthy();
      expect(module.dataDomain.analyticsNamespace).toBe(module.dataNamespace);
      expect(module.dataDomain.mongodbNamespace).toBeTruthy();
      expect(module.dataDomain.postgresPartitionKey).toBe('product_data_namespace');
      expect(module.dataDomain.independentDatabaseReady).toBe(true);
    }

    expect(diagnosisModel).toContain('moduleId');
    expect(diagnosisModel).toContain('moduleDeploymentMode');
    expect(diagnosisModel).toContain('moduleNamespace');
    expect(diagnosisModel).toContain('dataNamespace');
    expect(diagnosisModel).toContain('MODULES.rysnova.id');
    expect(productModuleRegistry).toContain('rysnova-consumer-system');
    expect(productModuleRegistry).toContain('rysnova-ai-diagnosis');
    expect(productModuleRegistry).toContain("namespace: 'rysnova'");
    expect(rysnovaBimModel).toContain('moduleId');
    expect(rysnovaBimModel).toContain('moduleDeploymentMode');
    expect(rysnovaBimModel).toContain('moduleNamespace');
    expect(rysnovaBimModel).toContain('dataNamespace');
    expect(rysnovaBimModel).toContain('MODULES.rysnovaBim.id');
    expect(productModuleRegistry).toContain('rysnova-bim-engineering-support');
    expect(productModuleRegistry).toContain("namespace: 'rysnova-bim'");
    expect(postgresTargetSchema).toContain('CREATE TABLE IF NOT EXISTS rhautt_nexus.product_modules');
    expect(postgresTargetSchema).toContain('CREATE TABLE IF NOT EXISTS rhautt_nexus.product_module_deployments');
    expect(postgresTargetSchema).toContain('CREATE TABLE IF NOT EXISTS rhautt_nexus.product_module_data_partitions');
    expect(postgresTargetSchema).toContain("'rysnova-consumer-system'");
    expect(postgresTargetSchema).toContain("'rysnova-bim-engineering-support'");
    expect(postgresTargetSchema).toContain("'namespace-extractable-shared-ledger'");
    expect(postgresTargetSchema).toContain("'rysnova/'");
    expect(postgresTargetSchema).toContain("'rysnova-bim/'");
    expect(postgresTargetSchema).toContain('external_domain_proof_required');
    expect(postgresTargetSchema).toContain('current_data_mode');
    expect(postgresTargetSchema).toContain('future_data_mode');
    expect(postgresTargetSchema).toContain('standalone_database_target');
    expect(postgresTargetSchema).toContain('extraction_proof_required');
    expect(postgresTargetSchema).toContain('future_standalone_product_ready');
    expect(postgresTargetSchema).toContain('shared-foundation-product-domain-partitioned');
    expect(postgresTargetSchema).toContain('standalone-database-extractable');
    expect(postgresTargetSchema).toContain('independent_database_ready');
  });

  test('Business console binds headquarters and dealer analytics to v2 tenant-scoped API before legacy fallback', () => {
    const html = read('public/business-console.html');

    expect(html).toContain('瑞诺瓦AI舒适家 · 多租户业务工作台');
    expect(html).toContain('/api/v2/analytics/overview');
    expect(html).toContain('/api/v2/governance/agent-progress');
    expect(html).toContain('开发组 Progress');
    expect(html).toContain('auditable-progress-not-production-completion-proof');
    expect(html).toContain('renderAgentProgress');
    expect(html).toContain('renderAgentProgressUnavailable');
    expect(html).toContain("localStorage.getItem('token')");
    expect(html).toContain('Authorization: `Bearer ${token}`');
    expect(html).toContain('tenant-wide');
    expect(html).toContain('dealer-scoped');
    expect(html).toContain('总部 tenant-wide 汇总视图');
    expect(html).toContain('经销商 dealer-scoped 视图');
    expect(html).toContain('renderAnalyticsOverview');
    expect(html).toContain('loadLegacyDashboard');
	    expect(html.indexOf('/api/v2/analytics/overview')).toBeLessThan(html.indexOf('/api/dashboard/stats'));
	    expect(html).not.toContain('<option value="rysnova">');
	    expect(html).toContain('/api/v2/rysnova-bim/projects/');
	    expect(html).toContain('/signoff-package');
	    expect(html).toContain("approvalMode: 'share-to-customer'");
	    expect(html).toContain('Rysnova v2 signoff package contract');
	    expect(html).toContain('系统设计原理图');
	    expect(html).toContain('2D 施工布局图');
	    expect(html).toContain('3D / BIM 示意模型');
	    expect(html).toContain('quoteCostSummary');
	    expect(html).toContain('customerReportSummary');
    expect(html).toContain('quantityTakeoffSummary');
    expect(html).toContain('standardsSummary');
    expect(html).toContain('未检测到员工/设计师登录 token');
    expect(html).not.toContain('/api/rysnova-bim/generate-deliverables');
  });

  test('browser visual acceptance script covers active pages and canvas probes', () => {
    const script = read('scripts/agent-guards/browser-visual-acceptance.js');

    for (const page of [
      '/index.html',
      '/index-ready.html'
    ]) {
      expect(script).toContain(page);
    }

    expect(script).toContain('designerProbe');
    expect(script).toContain('consoleErrors');
	    expect(script).toContain('VISUAL_BROWSER_WS_ENDPOINT');
	    expect(script).toContain('VISUAL_CDP_ENDPOINT');
	    expect(script).toContain('VISUAL_BROWSER_EXECUTABLE_PATH');
	    expect(script).toContain('findSystemBrowser');
	    expect(script).toContain('connectOverCDP');
	    expect(script).toContain('/api/v2/rysnova-bim/projects/');
	    expect(script).toContain('/signoff-package');
	    expect(script).not.toContain('/api/rysnova-bim/generate-deliverables');
	  });
});
