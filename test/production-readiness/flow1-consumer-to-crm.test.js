/**
 * Flow 1 端到端契约测试（问诊 → CRM）· 源级三方一致性
 *
 * 背景（EXECUTION-ROADMAP-2026-07 P1）：C 端匿名问诊曾把留资打到带 AuthGuard 的
 * /api/v2/crm/leads（403），且 diagnosis/quote 端点口径漂移到 legacy。
 * 本测试锁死修复后的契约，防止回归：
 *   ① 前端 consumer-diagnosis 的每个 /api/v2 调用都能映射到 NestJS 实际路由；
 *   ② 匿名链路上的 NestJS 路由必须是 @Public()（无 JWT 不得 403）；
 *   ③ 上述路由必须进 OpenAPI 契约（guard:frontend-api-contract 同源）；
 *   ④ ingress 留资必须在同事务内落 CRM 线索 + PIPL 同意存证 + lead.captured 事件。
 *
 * NestJS 运行时行为由 staging 手动验收（Roadmap P1 验收门）；此处为静态契约冻结。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const FRONTEND_PAGE = 'archive/legacy-ui/public/pain-diagnosis.html';
const NEST_MODULES = 'services/api/src/modules';
const OPENAPI = 'contracts/openapi/rhautt-nexus-v2.openapi.json';

/** 提取前端页面里所有 fetch('/api/v2/...') 调用路径 */
function extractFrontendApiCalls(source) {
  const calls = [];
  const regex = /fetch\(\s*['"`](\/api\/v2\/[^'"`?]+)['"`]/g;
  let match;
  while ((match = regex.exec(source))) calls.push(match[1]);
  return [...new Set(calls)];
}

/** 从 NestJS controller 源码提取 { fullPath, isPublic } 路由表 */
function extractNestRoutes(controllerSource) {
  const controllerMatch = controllerSource.match(/@Controller\(\s*['"`]([^'"`]*)['"`]\s*\)/);
  if (!controllerMatch) return [];
  const prefix = controllerMatch[1].replace(/^\/|\/$/g, '');
  const classPublic = /@Controller\([^)]*\)\s*(?:@\w+\([^)]*\)\s*)*/.test(controllerSource)
    && /@Public\(\)\s*(?:@\w+(\([^)]*\))?\s*)*export class/.test(controllerSource.replace(/\n/g, ' '));

  const routes = [];
  // 逐个方法装饰块解析：捕获方法装饰器组（含 @Public/@UseGuards/@Post 等）
  const methodRegex = /((?:@\w+\((?:[^()]|\([^()]*\))*\)\s*)+)(?:async\s+)?\w+\s*\(/g;
  let m;
  while ((m = methodRegex.exec(controllerSource))) {
    const decorators = m[1];
    const httpMatch = decorators.match(/@(Get|Post|Put|Patch|Delete)\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/);
    if (!httpMatch) continue;
    const sub = (httpMatch[2] || '').replace(/^\/|\/$/g, '');
    const fullPath = '/api/v2/' + [prefix, sub].filter(Boolean).join('/');
    routes.push({
      method: httpMatch[1].toUpperCase(),
      path: fullPath,
      isPublic: classPublic || /@Public\(\)/.test(decorators),
    });
  }
  return routes;
}

function allNestRoutes() {
  const routes = [];
  const dir = path.join(ROOT, NEST_MODULES);
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith('.controller.ts')) {
        routes.push(...extractNestRoutes(fs.readFileSync(full, 'utf8')));
      }
    }
  }
  return routes;
}

describe('Flow 1 · 问诊 → CRM 端到端契约（P1）', () => {
  const page = read(FRONTEND_PAGE);
  const frontendCalls = extractFrontendApiCalls(page);
  const nestRoutes = allNestRoutes();
  const nestPaths = new Set(nestRoutes.map((r) => r.path));

  test('活跃 C 端问诊直接走匿名 Nest 完成接口，不再匿名调用带鉴权的 /crm/leads', () => {
    expect(frontendCalls).toContain('/api/v2/diagnosis/public/complete');
    expect(frontendCalls).not.toContain('/api/v2/crm/leads');
  });

  test('前端每个 /api/v2 调用都映射到 NestJS 实际路由（无口径漂移）', () => {
    const unmatched = frontendCalls.filter((c) => !nestPaths.has(c));
    expect(unmatched).toEqual([]);
  });

  test('匿名链路上的 NestJS 路由必须 @Public（C 端无 JWT 不得 403）', () => {
    for (const call of frontendCalls) {
      const route = nestRoutes.find((r) => r.path === call && r.method === 'POST');
      expect(route).toBeDefined();
      expect({ path: call, isPublic: route.isPublic }).toEqual({ path: call, isPublic: true });
    }
  });

  test('前端调用的路由全部进 OpenAPI 契约', () => {
    const spec = JSON.parse(read(OPENAPI));
    const missing = frontendCalls.filter((c) => !spec.paths[c]);
    expect(missing).toEqual([]);
  });

  test('diagnosis public/ai-analyze 在 NestJS 侧存在且限流（收割自 legacy，替代 Express 主干）', () => {
    const controller = read(`${NEST_MODULES}/diagnosis/diagnosis.controller.ts`);
    const block = controller.slice(0, controller.indexOf("@Post('public/ai-analyze')"));
    const tail = block.slice(block.lastIndexOf('/**'));
    expect(controller).toContain("@Post('public/ai-analyze')");
    expect(tail + controller.slice(controller.indexOf("@Post('public/ai-analyze')"))).toMatch(
      /@Public\(\)\s*(?:\n\s*)?@UseGuards\(PublicRateLimitGuard\)\s*(?:\n\s*)?@Post\('public\/ai-analyze'\)/,
    );
  });

  test('quotation load-calc 是公开纯计算端点（前端负荷计算口径归位 NestJS）', () => {
    const controller = read(`${NEST_MODULES}/quote/quote.controller.ts`);
    expect(controller).toMatch(/@Controller\('quotation'\)/);
    expect(controller).toMatch(/@Public\(\)\s*@Post\('load-calc'\)/);
  });

  test('ingress 留资同事务：CRM 线索 + PIPL 同意存证 + PII-free lead.captured 事件', () => {
    const svc = read(`${NEST_MODULES}/ingress/ingress.service.ts`);
    expect(svc).toMatch(/withRlsTransaction/);
    expect(svc).toMatch(/createLeadInTx/);
    expect(svc).toMatch(/recordConsentInTx/);
    expect(svc).toMatch(/lead\.captured/);
    // PIPL 硬闸：无同意不留资
    expect(svc).toMatch(/consent !== true.*BadRequestException|BadRequestException\('PIPL consent required'\)/s);
  });

  test('公开问诊完成在 Nest/PostgreSQL 事务内创建线索、保存报告并发出 diagnosis.completed', () => {
    const svc = read(`${NEST_MODULES}/diagnosis/diagnosis.service.ts`);
    expect(svc).toMatch(/async completePublicDiagnosis/);
    expect(svc).toMatch(/PUBLIC_DIAGNOSIS_TENANT_ID/);
    expect(svc).not.toMatch(/64f000000000000000000201/);
    expect(svc).toMatch(/withRlsTransaction/);
    expect(svc).toMatch(/createLeadInTx/);
    expect(svc).toMatch(/DiagnosisSessionEntity/);
    expect(svc).toMatch(/eventType:\s*'diagnosis\.completed'/);
  });

  test('ai-analyze 服务规则兜底不编造数字（诚实红线）', () => {
    const ai = read(`${NEST_MODULES}/diagnosis/diagnosis-ai.service.ts`);
    expect(ai).toMatch(/aiAnalyze/);
    expect(ai).toMatch(/ruleQuickAnalyze/);
    expect(ai).toMatch(/以现场勘测为准/);
  });
});
