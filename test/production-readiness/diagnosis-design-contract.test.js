const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const spec = JSON.parse(read('contracts/openapi/rhautt-nexus-v2.openapi.json'));
const client = read('packages/generated-client/src/rhauttNexusClient.ts');

describe('套间一 · diagnosis 问诊模块 · 全端点契约收口', () => {
  const publicOps = {
    '/api/v2/diagnosis/public/ai-analyze': ['post', 'publicDiagnosisAiAnalyze'],
    '/api/v2/diagnosis/painpoints': ['get', 'getDiagnosisPainpoints'],
    '/api/v2/diagnosis/painpoints/detect': ['post', 'detectDiagnosisPainpoints'],
    '/api/v2/diagnosis/consult': ['post', 'diagnosisConsult'],
    '/api/v2/diagnosis/quote': ['post', 'diagnosisIndicativeQuote'],
    '/api/v2/diagnosis/principle-diagram': ['post', 'diagnosisPrincipleDiagram'],
    '/api/v2/diagnosis/cases': ['post', 'diagnosisCases'],
    '/api/v2/diagnosis/deposit/intent': ['post', 'createDiagnosisDepositIntent'],
    '/api/v2/diagnosis/public/recommend': ['post', 'publicDiagnosisRecommend'],
    '/api/v2/diagnosis/reports/{reportId}/share-view': ['get', 'getDiagnosisShareView'],
  };
  const authOps = {
    '/api/v2/diagnosis/deposit/{depositId}/confirm': ['post', 'confirmDiagnosisDeposit'],
    '/api/v2/diagnosis/deposit/{depositId}/refund': ['post', 'refundDiagnosisDeposit'],
    '/api/v2/diagnosis/reports': ['get', 'listDiagnosisReports'],
    '/api/v2/diagnosis/reports/{reportId}': ['get', 'getDiagnosisReport'],
    '/api/v2/diagnosis/reports/{reportId}/revoke': ['post', 'revokeDiagnosisReport'],
  };

  test('公开 C 端问诊端点均无 bearerAuth（匿名可达）', () => {
    for (const [route, [method, opId]] of Object.entries(publicOps)) {
      const op = spec.paths[route]?.[method];
      expect(op).toBeTruthy();
      expect(op.operationId).toBe(opId);
      expect(op.tags).toContain('Diagnosis');
      expect(op.security).toBeUndefined();
    }
  });

  test('deposit config（POST+GET）与受保护报告端点均挂 bearerAuth', () => {
    const cfg = spec.paths['/api/v2/diagnosis/deposit/config'];
    expect(cfg.post.operationId).toBe('setDiagnosisDepositConfig');
    expect(cfg.post.security).toEqual([{ bearerAuth: [] }]);
    expect(cfg.get.operationId).toBe('getDiagnosisDepositConfig');
    expect(cfg.get.security).toEqual([{ bearerAuth: [] }]);
    for (const [route, [method, opId]] of Object.entries(authOps)) {
      const op = spec.paths[route]?.[method];
      expect(op).toBeTruthy();
      expect(op.operationId).toBe(opId);
      expect(op.security).toEqual([{ bearerAuth: [] }]);
    }
  });

  test('OpenAPI/@Public 与控制器一致：public 组标 @Public，deposit 写/报告读标 AuthGuard', () => {
    const ctrl = read('services/api/src/modules/diagnosis/diagnosis.controller.ts');
    // 公开组关键端点确有 @Public()
    for (const p of ["'consult'", "'quote'", "'painpoints'", "'cases'", "'public/recommend'"]) {
      expect(ctrl).toMatch(new RegExp(`@Public\\(\\)[\\s\\S]{0,120}${p.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`));
    }
    // 受保护组挂 AuthGuard
    expect(ctrl).toMatch(/UseGuards\(AuthGuard\)[\s\S]{0,80}'reports'/);
  });

  test('生成客户端暴露 17 个 diagnosis 新方法', () => {
    for (const [, [, opId]] of [...Object.entries(publicOps), ...Object.entries(authOps)]) {
      expect(client).toContain(`async ${opId}`);
    }
    expect(client).toContain('async setDiagnosisDepositConfig');
    expect(client).toContain('async getDiagnosisDepositConfig');
  });
});

describe('套间一 · design 设计模块（NestJS go-forward 面）· 契约收口', () => {
  const ops = {
    '/api/v2/design/load-calc': ['post', 'designLoadCalc'],
    '/api/v2/design/calc': ['post', 'designCalc'],
    '/api/v2/design/releases': ['post', 'createDesignRelease'],
    '/api/v2/design/releases/{id}': ['get', 'getDesignRelease'],
    '/api/v2/design/releases/{id}/review': ['post', 'reviewDesignRelease'],
    '/api/v2/design/releases/{id}/override': ['post', 'overrideDesignRelease'],
    '/api/v2/design/releases/{id}/release': ['post', 'releaseDesignRelease'],
    '/api/v2/design/floor-plans': ['post', 'saveDesignFloorPlan'],
    '/api/v2/design/projects': ['get', 'listDesignProjects'],
    '/api/v2/design/projects/{projectId}/floor-plan': ['get', 'getDesignLatestFloorPlan'],
  };

  test('OpenAPI 覆盖 NestJS design.controller 全部 10 个端点（均受保护）', () => {
    for (const [route, [method, opId]] of Object.entries(ops)) {
      const op = spec.paths[route]?.[method];
      expect(op).toBeTruthy();
      expect(op.operationId).toBe(opId);
      expect(op.tags).toContain('Design');
      expect(op.security).toEqual([{ bearerAuth: [] }]);
    }
  });

  test('load-calc 必填 area；override 必填 reason', () => {
    const lc = spec.paths['/api/v2/design/load-calc'].post.requestBody.content['application/json'].schema;
    expect(lc.required).toContain('area');
    const ov = spec.paths['/api/v2/design/releases/{id}/override'].post.requestBody.content['application/json'].schema;
    expect(ov.required).toContain('reason');
  });

  test('与 legacy ReactCandidate design 面并存（未误删 candidateDesign*）', () => {
    expect(spec.paths['/api/v2/design/3d/render'].post.operationId).toBe('candidateDesignRender3d');
    expect(spec.paths['/api/v2/design/load/calculation'].post.operationId).toBe('candidateDesignLoadCalculation');
  });

  test('生成客户端暴露 10 个 design 方法', () => {
    for (const [, [, opId]] of Object.entries(ops)) {
      expect(client).toContain(`async ${opId}`);
    }
  });
});
