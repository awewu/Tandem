const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const spec = JSON.parse(read('contracts/openapi/rhautt-nexus-v2.openapi.json'));
const client = read('packages/generated-client/src/rhauttNexusClient.ts');

const MODULE_DIR = 'services/api/src/modules/product-catalog';

describe('product-catalog D2 事实基座 + L7 营销供给层 · 契约与接线', () => {
  test('OpenAPI 暴露全部受保护事实基座端点（operationId/tags/security 完整）', () => {
    const protectedPaths = {
      '/api/v2/product-catalog/taxonomy': ['get', 'getProductTaxonomy'],
      '/api/v2/product-catalog/dedupe-candidates': ['get', 'getProductDedupeCandidates'],
      '/api/v2/product-catalog/devices': ['get', 'listProductDevices'],
      '/api/v2/product-catalog/recommend': ['post', 'recommendProducts'],
      '/api/v2/product-catalog/devices/{id}': ['get', 'getProductDevice'],
    };
    for (const [routePath, [method, operationId]] of Object.entries(protectedPaths)) {
      const op = spec.paths[routePath]?.[method];
      expect(op).toBeTruthy();
      expect(op.operationId).toBe(operationId);
      expect(op.tags).toContain('ProductCatalog');
      expect(op.security).toEqual([{ bearerAuth: [] }]);
      expect(Object.keys(op.responses).length).toBeGreaterThan(0);
    }
    // upsert 写入端点
    const upsert = spec.paths['/api/v2/product-catalog/devices']?.post;
    expect(upsert.operationId).toBe('upsertProductDevice');
    expect(upsert.security).toEqual([{ bearerAuth: [] }]);
    const update = spec.paths['/api/v2/product-catalog/devices/{id}']?.patch;
    const archive = spec.paths['/api/v2/product-catalog/devices/{id}']?.delete;
    expect(update.operationId).toBe('updateProductDevice');
    expect(archive.operationId).toBe('archiveProductDevice');
    expect(update.security).toEqual([{ bearerAuth: [] }]);
    expect(archive.security).toEqual([{ bearerAuth: [] }]);
  });

  test('OpenAPI 暴露 L7 营销内容端点（受保护写/读）', () => {
    const listContent = spec.paths['/api/v2/product-catalog/devices/{id}/content']?.get;
    const upsertContent = spec.paths['/api/v2/product-catalog/devices/{id}/content']?.post;
    expect(listContent.operationId).toBe('listProductContent');
    expect(upsertContent.operationId).toBe('upsertProductContent');
    expect(upsertContent.security).toEqual([{ bearerAuth: [] }]);
    // 请求体含 locale + seo + marketing + gtin/mpn 结构
    const props = upsertContent.requestBody.content['application/json'].schema.properties;
    for (const k of ['tenantId', 'locale', 'seo', 'marketing', 'gtin', 'mpn', 'status']) {
      expect(props[k]).toBeTruthy();
    }
    expect(props.seo.properties.metaTitle).toBeTruthy();
    expect(props.marketing.properties.headline).toBeTruthy();
  });

  test('OpenAPI 暴露公开品牌本地化端点（无鉴权、含 locale 参数）', () => {
    const list = spec.paths['/api/v2/brand/{slug}/products']?.get;
    const single = spec.paths['/api/v2/brand/{slug}/products/{sku}']?.get;
    const rec = spec.paths['/api/v2/brand/{slug}/recommend']?.post;
    expect(list.operationId).toBe('listBrandProducts');
    expect(single.operationId).toBe('getBrandProduct');
    expect(rec.operationId).toBe('recommendBrandProducts');
    for (const op of [list, single, rec]) {
      expect(op.tags).toContain('Brand');
      expect(op.security).toBeUndefined(); // 公开端点无 bearerAuth
    }
    expect(list.parameters.some((p) => p.name === 'locale')).toBe(true);
    expect(single.parameters.some((p) => p.name === 'locale')).toBe(true);
  });

  test('生成客户端暴露全部 11 个 product-catalog / brand 方法', () => {
    for (const method of [
      'getProductTaxonomy', 'getProductDedupeCandidates', 'listProductDevices', 'upsertProductDevice',
      'recommendProducts', 'getProductDevice', 'updateProductDevice', 'archiveProductDevice',
      'listProductContent', 'upsertProductContent',
      'listBrandProducts', 'getBrandProduct', 'recommendBrandProducts',
    ]) {
      expect(client).toContain(`async ${method}`);
    }
  });

  test('模块源文件齐备（事实基座 + L7）', () => {
    for (const f of [
      'product-catalog.entity.ts', 'product-taxonomy.ts', 'product-catalog.service.ts',
      'product-catalog.controller.ts', 'product-catalog.public.controller.ts', 'product-catalog.module.ts',
    ]) {
      expect(fs.existsSync(path.join(ROOT, MODULE_DIR, f))).toBe(true);
    }
  });

  test('L7 实体 ProductContentEntity 定义（product_content 表 + locale 唯一）', () => {
    const entity = read(`${MODULE_DIR}/product-catalog.entity.ts`);
    expect(entity).toContain("@Entity('product_content')");
    expect(entity).toContain('ProductContentEntity');
    expect(entity).toContain('locale');
    expect(entity).toContain("['tenantId', 'productId', 'locale']");
    expect(entity).toContain('publishedAt');
  });

  test('L7 taxonomy 提供 locale 词表 + SEO/marketing 类型与归一', () => {
    const tax = read(`${MODULE_DIR}/product-taxonomy.ts`);
    expect(tax).toContain('LOCALES');
    expect(tax).toContain('DEFAULT_LOCALE');
    expect(tax).toContain('sanitizeSeo');
    expect(tax).toContain('sanitizeMarketing');
    expect(tax).toContain('sanitizeLocale');
    expect(tax).toContain('ProductSeo');
    expect(tax).toContain('ProductMarketing');
  });

  test('服务：L7 写/读走 RLS 事务 + locale 回退 + schema.org JSON-LD 计算', () => {
    const service = read(`${MODULE_DIR}/product-catalog.service.ts`);
    expect(service).toContain('upsertContent');
    expect(service).toContain('fetchContentForLocale');
    expect(service).toContain('buildJsonLd');
    expect(service).toContain('listBrandPublicLocalized');
    expect(service).toContain('getBrandProductLocalized');
    expect(service).toContain('withRlsTransaction');
    expect(service).toContain('https://schema.org');
    expect(service).toContain("'@type': 'Product'");
    // locale 回退到默认
    expect(service).toContain('DEFAULT_LOCALE');
  });

  test('模型B 第1律写闸：content 写入强校验品牌运营租户 UUID', () => {
    const service = read(`${MODULE_DIR}/product-catalog.service.ts`);
    expect(service).toContain('requireWriteTenant');
    // upsertContent 调用写闸
    const idx = service.indexOf('async upsertContent');
    expect(idx).toBeGreaterThan(-1);
    expect(service.slice(idx, idx + 400)).toContain('requireWriteTenant');
  });

  test('公开控制器：本地化读带 locale + 无写动词（延续脱敏红线）', () => {
    const pub = read(`${MODULE_DIR}/product-catalog.public.controller.ts`);
    expect(pub).toContain('listBrandPublicLocalized');
    expect(pub).toContain('getBrandProductLocalized');
    expect(pub).toContain("@Query('locale')");
    expect(pub).not.toMatch(/@(Put|Patch|Delete)\b/);
  });

  test('迁移 021 建 product_content 表并启用强 RLS', () => {
    const migration = read('database/postgres/migrations/021_product_content_l7.sql');
    expect(migration).toContain('product_content');
    expect(migration).toContain('FORCE ROW LEVEL SECURITY');
    expect(migration).toContain('tenant_id = rhautt_nexus.current_tenant_id()');
    expect(migration).toContain('UNIQUE (tenant_id, product_id, locale)');
  });

  test('模块被 AppModule 装配 + boot-smoke 桩注入 ProductContentEntity', () => {
    const app = read('services/api/src/modules/app.module.ts');
    expect(app).toContain('ProductCatalogModule');
    const mod = read(`${MODULE_DIR}/product-catalog.module.ts`);
    expect(mod).toContain('ProductContentEntity');
    expect(mod).toContain('bootSmokeRepositoryProvider(ProductContentEntity)');
  });

  test('product-catalog 登记进模块边界契约', () => {
    const boundary = read('services/api/src/modules/module-boundary.ts');
    expect(boundary).toContain("'product-catalog'");
  });
});

describe('product-catalog P1 · 发布工作流 + 产品关系', () => {
  test('OpenAPI 暴露工作流端点（状态流转 + 定时发布结算）', () => {
    const transition = spec.paths['/api/v2/product-catalog/devices/{id}/content/{locale}/transition']?.post;
    const publishDue = spec.paths['/api/v2/product-catalog/content/publish-due']?.post;
    expect(transition.operationId).toBe('transitionProductContent');
    expect(publishDue.operationId).toBe('publishDueProductContent');
    const actions = transition.requestBody.content['application/json'].schema.properties.action.enum;
    expect(actions).toEqual(['submit', 'approve', 'schedule', 'reject', 'unpublish']);
    expect(transition.security).toEqual([{ bearerAuth: [] }]);
  });

  test('OpenAPI 暴露产品关系端点（列/写/删，类型受控枚举）', () => {
    const list = spec.paths['/api/v2/product-catalog/devices/{id}/relations']?.get;
    const upsert = spec.paths['/api/v2/product-catalog/devices/{id}/relations']?.post;
    const del = spec.paths['/api/v2/product-catalog/relations/{relId}']?.delete;
    expect(list.operationId).toBe('listProductRelations');
    expect(upsert.operationId).toBe('upsertProductRelation');
    expect(del.operationId).toBe('deleteProductRelation');
    const types = upsert.requestBody.content['application/json'].schema.properties.relationType.enum;
    expect(types).toEqual(['accessory', 'compatible', 'replaces', 'replaced_by', 'cross_sell', 'up_sell', 'compare']);
  });

  test('生成客户端暴露 5 个 P1 方法', () => {
    for (const m of [
      'transitionProductContent', 'publishDueProductContent',
      'listProductRelations', 'upsertProductRelation', 'deleteProductRelation',
    ]) {
      expect(client).toContain(`async ${m}`);
    }
  });

  test('实体新增 ProductContentEventEntity + ProductRelationEntity', () => {
    const entity = read(`${MODULE_DIR}/product-catalog.entity.ts`);
    expect(entity).toContain("@Entity('product_content_events')");
    expect(entity).toContain('ProductContentEventEntity');
    expect(entity).toContain("@Entity('product_relations')");
    expect(entity).toContain('ProductRelationEntity');
    expect(entity).toContain('scheduledAt');
    expect(entity).toContain('reviewedBy');
  });

  test('taxonomy 提供状态机 + 关系类型受控词表', () => {
    const tax = read(`${MODULE_DIR}/product-taxonomy.ts`);
    expect(tax).toContain('WORKFLOW_TRANSITIONS');
    expect(tax).toContain('resolveTransition');
    expect(tax).toContain('CONTENT_STATUSES');
    expect(tax).toContain('RELATION_TYPES');
    expect(tax).toContain('isValidRelationType');
    // 状态机合法流转覆盖 5 动作
    for (const action of ['submit', 'approve', 'schedule', 'reject', 'unpublish']) {
      expect(tax).toContain(`${action}:`);
    }
  });

  test('服务：工作流流转 + 定时结算 + 关系 CRUD + 公开投影内联 related', () => {
    const service = read(`${MODULE_DIR}/product-catalog.service.ts`);
    expect(service).toContain('transitionContent');
    expect(service).toContain('publishDueContent');
    expect(service).toContain('upsertRelation');
    expect(service).toContain('listRelations');
    expect(service).toContain('deleteRelation');
    expect(service).toContain('fetchRelatedForPublic');
    // 发布门：published 且 publishedAt<=now（未来定时不外泄）
    expect(service).toContain('publishedAt.getTime() <= Date.now()');
    // 流转写审计事件
    expect(service).toContain('ProductContentEventEntity');
    // 单品公开投影内联 related
    expect(service).toContain('related');
  });

  test('工作流/关系写入均经模型B写闸 + RLS 事务', () => {
    const service = read(`${MODULE_DIR}/product-catalog.service.ts`);
    for (const fn of ['transitionContent', 'publishDueContent', 'upsertRelation', 'deleteRelation']) {
      const idx = service.indexOf(`async ${fn}(`); // 加括号避免误配 upsertRelationRow
      expect(idx).toBeGreaterThan(-1);
      expect(service.slice(idx, idx + 500)).toContain('requireWriteTenant');
    }
  });

  test('迁移 022 工作流状态机 + 023 产品关系，均强 RLS', () => {
    const m022 = read('database/postgres/migrations/022_product_content_workflow.sql');
    expect(m022).toContain('product_content_events');
    expect(m022).toContain("'draft', 'review', 'scheduled', 'published'");
    expect(m022).toContain('FORCE ROW LEVEL SECURITY');
    const m023 = read('database/postgres/migrations/023_product_relations.sql');
    expect(m023).toContain('product_relations');
    expect(m023).toContain('accessory');
    expect(m023).toContain('FORCE ROW LEVEL SECURITY');
    expect(m023).toContain('product_id <> related_product_id');
  });

  test('模块注册工作流/关系实体（forFeature + boot-smoke 桩）', () => {
    const mod = read(`${MODULE_DIR}/product-catalog.module.ts`);
    expect(mod).toContain('ProductContentEventEntity');
    expect(mod).toContain('ProductRelationEntity');
    expect(mod).toContain('bootSmokeRepositoryProvider(ProductRelationEntity)');
  });

  test('公开控制器仍无变更动词（DELETE 仅在受保护控制器）', () => {
    const pub = read(`${MODULE_DIR}/product-catalog.public.controller.ts`);
    expect(pub).not.toMatch(/@(Put|Patch|Delete)\b/);
    const priv = read(`${MODULE_DIR}/product-catalog.controller.ts`);
    expect(priv).toContain('@Delete');
  });
});

describe('product-catalog 遗憾补齐 · 调度器 / 双向关系 / i18n 覆盖率 / N+1', () => {
  const service = read(`${MODULE_DIR}/product-catalog.service.ts`);
  const tax = read(`${MODULE_DIR}/product-taxonomy.ts`);
  const controller = read(`${MODULE_DIR}/product-catalog.controller.ts`);

  test('A1 定时发布调度器：OnModuleInit/Destroy + 周期扫描 + 桩/测试不启动 + unref', () => {
    expect(service).toContain('implements OnModuleInit, OnModuleDestroy');
    expect(service).toContain('onModuleInit');
    expect(service).toContain('onModuleDestroy');
    expect(service).toContain('runDuePublishSweep');
    expect(service).toContain('discoverBrandTenants');
    expect(service).toContain('setInterval');
    expect(service).toContain('clearInterval');
    // 桩/测试环境不启定时器（避免副作用与句柄泄漏）
    expect(service).toContain('TARGET_API_BOOT_SMOKE');
    expect(service).toContain("process.env.NODE_ENV === 'test'");
    expect(service).toContain('.unref');
  });

  test('A3 双向关系：inverse 映射 + 写入自动补反向边 + 删除同步反向', () => {
    expect(tax).toContain('INVERSE_RELATION');
    expect(tax).toContain('inverseRelationType');
    // replaces ↔ replaced_by 互逆；对称类型自反
    expect(tax).toMatch(/replaces:\s*'replaced_by'/);
    expect(tax).toMatch(/replaced_by:\s*'replaces'/);
    expect(tax).toMatch(/compatible:\s*'compatible'/);
    // 服务写入/删除均调用 inverse 逻辑
    expect(service).toContain('inverseRelationType');
    const up = service.indexOf('async upsertRelation');
    expect(service.slice(up, up + 700)).toContain('upsertRelationRow');
    const del = service.indexOf('async deleteRelation');
    expect(service.slice(del, del + 700)).toContain('inverseRelationType');
  });

  test('A4 i18n 覆盖率：服务方法 + 受保护端点 + OpenAPI + 生成客户端', () => {
    expect(service).toContain('async contentCoverage');
    expect(service).toContain('supportedLocales');
    expect(service).toContain('coverage');
    expect(controller).toContain("@Get('content/coverage')");
    const op = spec.paths['/api/v2/product-catalog/content/coverage']?.get;
    expect(op).toBeTruthy();
    expect(op.operationId).toBe('getProductContentCoverage');
    expect(op.security).toEqual([{ bearerAuth: [] }]);
    expect(op.parameters.some((p) => p.name === 'tenantId' && p.required)).toBe(true);
    expect(client).toContain('async getProductContentCoverage');
  });

  test('B2 消除 N+1：本地化目录批量预加载 content（batchLiveContent + In）', () => {
    expect(service).toContain('batchLiveContent');
    expect(service).toContain('pickLocale');
    // 使用 TypeORM In 做批量查询
    expect(service).toMatch(/import\s*\{[^}]*\bIn\b[^}]*\}\s*from\s*'typeorm'/);
    // listBrandPublicLocalized 的 UUID 分支不再逐产品调用 fetchContentForLocale
    const idx = service.indexOf('async listBrandPublicLocalized');
    const body = service.slice(idx, idx + 900);
    expect(body).toContain('batchLiveContent');
  });

  test('B1 输入校验：模块自带零依赖校验层并接线进所有写入方法（不引 class-validator）', () => {
    // 不得引入 class-validator / 全局 ValidationPipe（平台级外溢风险）
    const pkg = JSON.parse(read('package.json'));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    expect(deps['class-validator']).toBeUndefined();
    expect(deps['class-transformer']).toBeUndefined();
    // 校验模块存在并导出全部校验器
    const val = read(`${MODULE_DIR}/product-catalog.validation.ts`);
    for (const fn of ['validateContentInput', 'validateTransitionInput', 'validateRelationInput', 'validateProductUpsertInput']) {
      expect(val).toContain(`export function ${fn}`);
    }
    // 服务在每个写入方法开头接线校验
    expect(service).toMatch(/async upsert\([\s\S]{0,120}validateProductUpsertInput/);
    expect(service).toMatch(/async upsertContent\([\s\S]{0,120}validateContentInput/);
    expect(service).toMatch(/async transitionContent\([\s\S]{0,320}validateTransitionInput/);
    expect(service).toMatch(/async upsertRelation\([\s\S]{0,120}validateRelationInput/);
  });

  test('B1 输入校验：错误类型硬失败、合法输入透明放行（functional，运行时转译）', () => {
    const ts = require('typescript');
    const src = read(`${MODULE_DIR}/product-catalog.validation.ts`);
    const out = ts.transpileModule(src, { compilerOptions: { module: 'commonjs', target: 'es2019' } }).outputText;
    const mod = { exports: {} };
    // eslint-disable-next-line no-new-func
    new Function('module', 'exports', 'require', out)(mod, mod.exports, require);
    const V = mod.exports;

    // 合法输入透明放行
    expect(() => V.validateContentInput({ locale: 'zh-CN', seo: {}, marketing: {}, gtin: 'x' })).not.toThrow();
    expect(() => V.validateRelationInput({ relatedProductId: 'p2', relationType: 'accessory', sortOrder: 3 })).not.toThrow();
    expect(() => V.validateTransitionInput({ action: 'submit' })).not.toThrow();
    expect(() => V.validateProductUpsertInput({ sku: 'S1', listPrice: 100 })).not.toThrow();
    expect(() => V.validateProductUpsertInput({
      sku: 'S1',
      meta: {
        everhot: {
          specs: [{ k: 'capacity', v: '200 L' }],
          badges: ['energy-saving'],
          features: [{ title: 'stable', desc: 'wide range' }],
          highlights: [{ label: 'COP', value: '4.2' }],
        },
      },
    })).not.toThrow();

    // 错误类型硬失败（400）
    expect(() => V.validateContentInput({ seo: [] })).toThrow();          // seo 传数组
    expect(() => V.validateContentInput({ locale: 123 })).toThrow();       // locale 非字符串
    expect(() => V.validateRelationInput({ relatedProductId: 'p2', relationType: 'accessory', sortOrder: 'abc' })).toThrow();
    expect(() => V.validateRelationInput({ relationType: 'accessory' })).toThrow(); // 缺 relatedProductId
    expect(() => V.validateTransitionInput({ action: '' })).toThrow();     // action 空
    expect(() => V.validateProductUpsertInput({ listPrice: 'notnum' })).toThrow();
    expect(() => V.validateProductUpsertInput({ meta: { everhot: { specs: 'bad' } } })).toThrow();
    expect(() => V.validateProductUpsertInput({ meta: { everhot: { badges: [{}] } } })).toThrow();
    expect(() => V.validateProductUpsertInput([])).toThrow();              // body 非对象
  });

  test('B4 OpenAPI 无重复对象键（真正的 tokenizer 级去重校验）', () => {
    const raw = read('contracts/openapi/rhautt-nexus-v2.openapi.json');
    // JSON.parse 会静默丢弃重复键，无法检出。用最小 tokenizer 逐 object frame 追踪键，
    // 精确检测「同一对象内重复键」（含此前 RysnovaArtifact.customerId 回归）。
    const findDuplicateKeys = (text) => {
      const dups = [];
      const stack = [];
      let i = 0;
      const n = text.length;
      while (i < n) {
        const ch = text[i];
        if (ch === '"') {
          let j = i + 1;
          while (j < n) {
            if (text[j] === '\\') { j += 2; continue; }
            if (text[j] === '"') break;
            j += 1;
          }
          const str = text.slice(i + 1, j);
          i = j + 1;
          const frame = stack[stack.length - 1];
          if (frame && frame.isObject && frame.expectKey) {
            if (frame.keys.has(str)) dups.push(str);
            frame.keys.add(str);
            frame.expectKey = false;
          }
          continue;
        }
        if (ch === '{') { stack.push({ isObject: true, keys: new Set(), expectKey: true }); i += 1; continue; }
        if (ch === '[') { stack.push({ isObject: false }); i += 1; continue; }
        if (ch === '}' || ch === ']') { stack.pop(); i += 1; continue; }
        if (ch === ',') { const f = stack[stack.length - 1]; if (f && f.isObject) f.expectKey = true; i += 1; continue; }
        i += 1;
      }
      return dups;
    };
    expect(findDuplicateKeys(raw)).toEqual([]);
  });
});

describe('Issue 07 - Everhot runtime product consumers and E2E readiness', () => {
  const catalog = read('apps/everhot-cn/public/js/catalog.js');
  const search = read('apps/everhot-cn/public/js/search.js');
  const selector = read('apps/everhot-cn/public/js/selector.js');
  const pro = read('apps/everhot-cn/public/js/pro.js');
  const service = read(`${MODULE_DIR}/product-catalog.service.ts`);

  test('catalog.js owns a single same-origin runtime loader with loading/fallback/empty states', () => {
    expect(catalog).toContain("RUNTIME_PRODUCTS_API = '/api/v2/brand/everhot/products?locale=zh-CN'");
    expect(catalog).toContain('window.EVERHOT_PRODUCTS_READY');
    expect(catalog).toContain('window.EVERHOT_LOAD_PRODUCTS');
    expect(catalog).toContain('window.EVERHOT_LOAD_PRODUCT');
    expect(catalog).toContain('setRuntimeStatus');
    expect(catalog).toContain('loadingState');
    expect(catalog).toContain('runtimeNotice');
    expect(catalog).not.toContain('setTimeout(run,1000)');
  });

  test('search, selector, and professional lookup wait for the shared runtime product loader', () => {
    for (const src of [search, selector, pro]) {
      expect(src).toContain('productsReady');
      expect(src).toContain('EVERHOT_LOAD_PRODUCTS');
    }
  });

  test('consumer pages load catalog.js before their product consumers', () => {
    for (const rel of [
      'apps/everhot-cn/public/search/index.html',
      'apps/everhot-cn/public/products/selector/index.html',
      'apps/everhot-cn/public/professionals/residential/product-lookup/index.html',
      'apps/everhot-cn/public/professionals/commercial/product-lookup/index.html',
    ]) {
      const html = read(rel);
      expect(html.indexOf('/js/catalog.js')).toBeGreaterThan(-1);
      expect(html.indexOf('/js/catalog.js')).toBeLessThan(
        Math.max(html.indexOf('/js/search.js'), html.indexOf('/js/selector.js'), html.indexOf('/js/pro.js')),
      );
    }
  });

  test('public detail recommendations expose configured cards that the website can render', () => {
    expect(service).toContain('fetchRelatedForPublic');
    expect(service).toContain('slug: projected.slug');
    expect(service).toContain('mainImage: projected.mainImage');
    expect(service).toContain('tags: projected.tags');
    expect(service).toContain('summary: projected.tagline');
    expect(service).toContain('detailUrl: `/products/detail/?model=${encodeURIComponent(String(projected.slug))}`');
    expect(catalog).toContain('configuredRelated');
    expect(catalog).toContain('r.summary || r.tagline || r.headline');
  });
});

describe('Issue 05 - Everhot specifications and highlights', () => {
  const service = read(`${MODULE_DIR}/product-catalog.service.ts`);
  const validation = read(`${MODULE_DIR}/product-catalog.validation.ts`);
  const route = read('apps/brand-console/src/app/api/products/route.ts');
  const consoleUi = read('apps/brand-console/src/components/Console.tsx');

  test('product upsert validates the public structured list shapes', () => {
    for (const token of [
      'validateEverhotStructuredLists',
      'meta.everhot.specs',
      'meta.everhot.badges',
      'meta.everhot.features',
      'meta.everhot.highlights',
    ]) {
      expect(validation).toContain(token);
    }
  });

  test('brand console reads and writes specs, badges, features, and highlights without replacing other metadata', () => {
    for (const token of ['specs', 'badges', 'features', 'highlights']) {
      expect(route).toContain(token);
      expect(consoleUi).toContain(token);
    }
    expect(route).toContain('toObjectList');
    expect(route).toContain('Array.isArray(prevEverhot.specs)');
    expect(route).toContain('Array.isArray(prevEverhot.highlights)');
    expect(consoleUi).toContain('ProductContentListsEditor');
    expect(consoleUi).toContain('onSpecs');
    expect(consoleUi).toContain('onHighlights');
  });

  test('public brand projection preserves the current website contract for specs, badges, features, and highlights', () => {
    const projection = service.slice(service.indexOf('private publicProductProjection'), service.indexOf('private async assertBrandSlugUnique'));
    expect(projection).toContain('specs: Array.isArray(meta.specs)');
    expect(projection).toContain('badges: Array.isArray(meta.badges)');
    expect(projection).toContain('features: Array.isArray(meta.features)');
    expect(projection).toContain('highlights: Array.isArray(meta.highlights)');
  });
});

describe('Issue 03 - Everhot product status and website order', () => {
  const service = read(`${MODULE_DIR}/product-catalog.service.ts`);
  const validation = read(`${MODULE_DIR}/product-catalog.validation.ts`);
  const route = read('apps/brand-console/src/app/api/products/route.ts');
  const consoleUi = read('apps/brand-console/src/components/Console.tsx');

  test('product-catalog supports active/inactive/archived and keeps archived out of default management lists', () => {
    expect(validation).toContain("['active', 'inactive', 'archived']");
    expect(service).toContain("p.status <> 'archived'");
    expect(service).toContain("where: { tenantId, brand, status: 'active' }");
    expect(service).toContain(".andWhere('p.status = :status', { status: 'active' })");
  });

  test('public product projections expose stable website order and lists sort by displayOrder', () => {
    expect(service).toContain('private displayOrder');
    expect(service).toContain('private sortForWebsite');
    expect(service).toContain('displayOrder: this.displayOrder(product)');
    expect(service).toContain('.sort((a, b) => this.sortForWebsite(a, b))');
  });

  test('brand console edits non-negative display order, toggles inactive, and archives only on delete', () => {
    expect(route).toContain('displayOrder');
    expect(route).toContain('展示顺序必须是非负整数');
    expect(route).toContain('a.displayOrder - b.displayOrder');
    expect(consoleUi).toContain("const next = val(r, 'status') === 'active' ? 'inactive' : 'active'");
    expect(consoleUi).toContain('type="number"');
    expect(consoleUi).toContain('min={0}');
    expect(consoleUi).toContain('DELETE');
  });
});

describe('Issue 01 · Everhot 基础产品 CRUD 闭环', () => {
  const service = read(`${MODULE_DIR}/product-catalog.service.ts`);
  const route = read('apps/brand-console/src/app/api/products/route.ts');
  const consoleUi = read('apps/brand-console/src/components/Console.tsx');
  const catalog = read('apps/everhot-cn/public/js/catalog.js');

  test('后端以 product-catalog 为唯一产品事实源，并校验 Everhot 公开 slug 唯一', () => {
    expect(service).toContain('assertBrandSlugUnique');
    expect(service).toContain("COALESCE(NULLIF(p.meta->'everhot'->>'slug', ''), p.sku) = :slug");
    expect(service).toContain('Everhot 产品 slug 已存在');
    expect(route).toContain("nexus('/product-catalog/devices'");
    expect(route).toContain('method: \'DELETE\'');
    expect(route).not.toContain('/brand-content/');
  });

  test('管理端支持分页搜索和基础字段编辑：名称、型号、slug、分类、系统、系列、简介、标签', () => {
    for (const token of ['q', 'page', 'pageSize', 'slug', 'model', 'category', 'sys', 'series', 'tagline', 'tags']) {
      expect(route).toContain(token);
      expect(consoleUi).toContain(token);
    }
    expect(consoleUi).toContain('搜索名称 / slug / 系列');
    expect(consoleUi).toContain('上一页');
    expect(consoleUi).toContain('下一页');
    expect(consoleUi).toContain('deleteProduct');
  });

  test('公开品牌接口按白名单投影，详情支持公开 slug，且不返回成本/管理字段', () => {
    expect(service).toContain('publicProductProjection');
    expect(service).toContain('model: meta.model');
    expect(service).toContain('tags: Array.isArray(meta.tags)');
    expect(service).toContain('getBrandProductLocalized');
    expect(service).toContain("p.sku = :sku OR COALESCE(NULLIF(p.meta->'everhot'->>'slug', ''), p.sku) = :slug");
    const projection = service.slice(service.indexOf('private publicProductProjection'), service.indexOf('private async assertBrandSlugUnique'));
    expect(projection).not.toContain('costPrice');
    expect(projection).not.toContain('listPrice');
    expect(projection).not.toContain('imageArtifactId');
    const recommend = service.slice(service.indexOf('async recommend'), service.indexOf('async priceBandsForSystems'));
    expect(recommend).toContain('this.publicProductProjection');
    expect(recommend).not.toContain('tenantId: p.tenantId');
    expect(recommend).not.toContain('listPrice: Number');
  });

  test('Everhot 官网 catalog 运行时读取公开 API，失败时保留 products-data 静态兜底', () => {
    expect(catalog).toContain('/api/v2/brand/everhot/products?locale=zh-CN');
    expect(catalog).toContain('loadRuntimeProducts');
    expect(catalog).toContain('installCatalog');
    expect(catalog).toContain('loadingState');
    expect(catalog).toContain('runtimeNotice');
    expect(catalog).toContain('window.EVERHOT_PRODUCTS');
  });
});

describe('Issue 04 · Everhot 产品主图与详情图片闭环', () => {
  const taxonomy = read(`${MODULE_DIR}/product-taxonomy.ts`);
  const service = read(`${MODULE_DIR}/product-catalog.service.ts`);
  const pub = read(`${MODULE_DIR}/product-catalog.public.controller.ts`);
  const fileSvc = read('services/api/src/modules/file-artifact/file-artifact.service.ts');
  const route = read('apps/brand-console/src/app/api/images/route.ts');
  const consoleUi = read('apps/brand-console/src/components/Console.tsx');
  const catalog = read('apps/everhot-cn/public/js/catalog.js');

  test('AssetRef 支持一张主图与多张有序详情图', () => {
    expect(taxonomy).toContain("{ code: 'main'");
    expect(taxonomy).toContain("{ code: 'detail'");
    expect(taxonomy).toContain('sortOrder?: number');
    expect(taxonomy).toContain("ref.role === 'detail'");
    expect(taxonomy).toContain('sortedDetails');
  });

  test('公开图片读取是品牌产品窄路由，且只允许 active 产品关联图', () => {
    expect(pub).toContain("@Get(':slug/products/:sku/images/:artifactId')");
    expect(pub).toContain('StreamableFile');
    expect(service).toContain('getPublicProductImage');
    expect(service).toContain("p.status = :status");
    expect(service).toContain("['main', 'detail', 'card'].includes(r.role)");
    expect(fileSvc).toContain('getPublicActiveArtifact');
    expect(fileSvc).toContain("status: 'active'");
  });

  test('管理端支持上传预览、替换主图、删除和详情图排序', () => {
    for (const token of ['PendingUpload', 'confirmUpload', 'deleteImage', 'moveDetail', 'detailArtifactIds']) {
      expect(consoleUi).toContain(token);
    }
    for (const token of ['dataBase64', 'detailArtifactIds', 'imageRefs', 'saveImageRefs']) {
      expect(route).toContain(token);
    }
    expect(route).toContain('nonImageRefs');
    expect(route).toContain("role === 'main'");
    expect(route).toContain("role === 'detail'");
    expect(route).toContain('export async function PATCH');
    expect(route).toContain('export async function DELETE');
  });

  test('官网优先消费公开主图与有序 gallery，并保留旧图片映射 fallback', () => {
    expect(service).toContain('mainImage: imageRefs.main');
    expect(service).toContain('gallery: imageRefs.gallery');
    expect(catalog).toContain('function imgSrc');
    expect(catalog).toContain('window.EVERHOT_PRODUCT_IMAGES');
    expect(catalog).toContain('function galleryImgs');
    expect(catalog).toContain('pd-gallery');
  });
});
