const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const spec = JSON.parse(read('contracts/openapi/rhautt-nexus-v2.openapi.json'));
const client = read('packages/generated-client/src/rhauttNexusClient.ts');

const MODULE_DIR = 'services/api/src/modules/quote';

describe('套间二 · quote 报价模块 · 契约与接线', () => {
  test('OpenAPI 暴露全部 8 个报价端点（operationId/tag/security 正确）', () => {
    const publicPosts = {
      '/api/v2/quotation/generate': 'generateQuotation',
      '/api/v2/quotation/load-calc': 'quotationLoadCalc',
      '/api/v2/quotation/econet-premium': 'quotationEconetPremium',
      '/api/v2/quotation/export': 'exportQuotation',
      '/api/v2/quotation/guardrail-check': 'quotationGuardrailCheck',
    };
    for (const [route, opId] of Object.entries(publicPosts)) {
      const op = spec.paths[route]?.post;
      expect(op).toBeTruthy();
      expect(op.operationId).toBe(opId);
      expect(op.tags).toContain('Quote');
      expect(op.security).toBeUndefined(); // 公开计算端点：无 bearerAuth（有意公开）
    }
    // 受保护端点
    expect(spec.paths['/api/v2/quotation']?.post?.operationId).toBe('persistQuotation');
    expect(spec.paths['/api/v2/quotation']?.post?.security).toEqual([{ bearerAuth: [] }]);
    expect(spec.paths['/api/v2/quotation']?.get?.operationId).toBe('listQuotations');
    expect(spec.paths['/api/v2/quotation']?.get?.security).toEqual([{ bearerAuth: [] }]);
    const lock = spec.paths['/api/v2/quotation/{id}/lock']?.post;
    expect(lock.operationId).toBe('lockQuotation');
    expect(lock.security).toEqual([{ bearerAuth: [] }]);
  });

  test('load-calc / econet / persist 请求体的必填契约', () => {
    const loadCalc = spec.paths['/api/v2/quotation/load-calc'].post.requestBody.content['application/json'].schema;
    expect(loadCalc.required).toContain('area');
    const econet = spec.paths['/api/v2/quotation/econet-premium'].post.requestBody.content['application/json'].schema;
    expect(econet.required).toContain('devices');
    const persist = spec.paths['/api/v2/quotation'].post.requestBody.content['application/json'].schema;
    expect(persist.required).toContain('customerId');
    expect(persist.additionalProperties).toBe(false);
    expect(spec.paths['/api/v2/quotation'].post.responses['201']).toBeTruthy();
    expect(spec.paths['/api/v2/quotation'].post.responses['404']).toBeTruthy();
    expect(spec.paths['/api/v2/quotation/{id}/lock'].post.responses['404']).toBeTruthy();
    expect(spec.paths['/api/v2/quotation'].get.parameters.some((p) => p.name === 'opportunityId')).toBe(true);
  });

  test('生成客户端暴露 8 个报价方法', () => {
    for (const m of [
      'generateQuotation', 'quotationLoadCalc', 'quotationEconetPremium', 'exportQuotation',
      'quotationGuardrailCheck', 'persistQuotation', 'listQuotations', 'lockQuotation',
    ]) {
      expect(client).toContain(`async ${m}`);
    }
  });

  test('公开计算端点仍保持 @Public（不破坏 C 端直调），受保护写读仍挂 AuthGuard', () => {
    const ctrl = read(`${MODULE_DIR}/quote.controller.ts`);
    // 5 个公开计算端点
    for (const p of ['generate', 'load-calc', 'econet-premium', 'export', 'guardrail-check']) {
      expect(ctrl).toMatch(new RegExp(`@Public\\(\\)[^\\n]*'${p}'`));
    }
    // persist/list/lock 受 AuthGuard
    expect(ctrl).toMatch(/persist[\s\S]{0,40}UseGuards\(AuthGuard\)|UseGuards\(AuthGuard\)[\s\S]{0,40}persist/);
    expect(ctrl).toContain('lockQuotation');
  });

  test('B1 校验模块存在并接线进全部写入/计算方法（零依赖，不引 class-validator）', () => {
    const pkg = JSON.parse(read('package.json'));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    expect(deps['class-validator']).toBeUndefined();
    const val = read(`${MODULE_DIR}/quote.validation.ts`);
    for (const fn of [
      'validateGenerateInput', 'validateLoadCalcInput', 'validateEconetInput',
      'validateExportInput', 'validateGuardrailInput', 'validatePersistInput',
    ]) {
      expect(val).toContain(`export function ${fn}`);
    }
    const svc = read(`${MODULE_DIR}/quote.service.ts`);
    expect(svc).toMatch(/async generate\([\s\S]{0,160}validateGenerateInput/);
    expect(svc).toMatch(/async loadCalc\([\s\S]{0,200}validateLoadCalcInput/);
    expect(svc).toMatch(/async econetPremium\([\s\S]{0,160}validateEconetInput/);
    expect(svc).toMatch(/exportQuote\([\s\S]{0,120}validateExportInput/);
    expect(svc).toMatch(/async checkGuardrails\([\s\S]{0,160}validateGuardrailInput/);
    expect(svc).toMatch(/async persist\([\s\S]{0,160}validatePersistInput/);
  });

  test('B1 校验：错误类型硬失败、合法输入透明放行（functional，运行时转译）', () => {
    const ts = require('typescript');
    const src = read(`${MODULE_DIR}/quote.validation.ts`);
    const out = ts.transpileModule(src, { compilerOptions: { module: 'commonjs', target: 'es2019' } }).outputText;
    const mod = { exports: {} };
    // eslint-disable-next-line no-new-func
    new Function('module', 'exports', 'require', out)(mod, mod.exports, require);
    const V = mod.exports;

    // 合法输入透明放行
    expect(() => V.validateGenerateInput({ devices: [], services: ['install'] })).not.toThrow();
    expect(() => V.validateLoadCalcInput({ area: 120, buildingType: 'office' })).not.toThrow();
    expect(() => V.validateEconetInput({ devices: [{ type: 'ac', quantity: 2 }] })).not.toThrow();
    expect(() => V.validateGuardrailInput({ items: [], thresholds: {} })).not.toThrow();
    expect(() => V.validatePersistInput({ customerId: 'c1', items: [] })).not.toThrow();

    // 错误类型硬失败
    expect(() => V.validateGenerateInput({ devices: {} })).toThrow();       // devices 非数组
    expect(() => V.validateLoadCalcInput({ area: 0 })).toThrow();            // area 非正数
    expect(() => V.validateLoadCalcInput({ area: 'abc' })).toThrow();        // area 非数字
    expect(() => V.validateEconetInput({ devices: [{ quantity: 1 }] })).toThrow(); // 缺 type
    expect(() => V.validateEconetInput({})).toThrow();                       // 缺 devices
    expect(() => V.validateGuardrailInput({ items: 'x' })).toThrow();        // items 非数组
    expect(() => V.validatePersistInput({})).toThrow();                      // 缺 customerId
    expect(() => V.validatePersistInput({ customerId: 'c1', items: {} })).toThrow(); // items 非数组
  });
});
