/**
 * Auth M1 · Legacy auth 行为契约冻结（NestJS 合同测试）
 *
 * 背景：auth 是迁移第一域。本测试把 legacy Express /api/auth 的契约冻结到
 * NestJS /api/v2/auth，确保后续 shadow run（M2）有稳定基线：
 *   ① 所有 legacy auth 路由在 NestJS v2 有对应路径；
 *   ② 公开端点必须 @Public()，受保护端点必须 @UseGuards(AuthGuard)；
 *   ③ NestJS auth 服务复现 legacy 行为：密码规则、账号锁定、JWT 载荷、PII 处理；
 *   ④ register 按当前产品契约创建隔离租户及 dealer_admin；
 *   ⑤ 无 000000 SMS 后门（H1），无未验证租户范围（H2）。
 *
 * 运行时行为由 staging 手动验收；此处为静态契约冻结。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const NEST_MODULES = 'services/api/src/modules';
const OPENAPI = 'contracts/openapi/rhautt-nexus-v2.openapi.json';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/** 从 NestJS controller 源码提取路由表（复用 flow1 逻辑） */
function extractNestRoutes(controllerSource) {
  const controllerMatch = controllerSource.match(/@Controller\(\s*['"`]([^'"`]*)['"`]\s*\)/);
  if (!controllerMatch) return [];
  const prefix = controllerMatch[1].replace(/^\/|\/$/g, '');
  const classPublic = /@Public\(\)\s*(?:@\w+(\([^)]*\))?\s*)*export class/.test(controllerSource.replace(/\n/g, ' '));

  const routes = [];
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
      hasAuthGuard: /@UseGuards\([^)]*AuthGuard\)/.test(decorators),
    });
  }
  return routes;
}

function legacyToV2(legacyPath) {
  return legacyPath.replace(/^\/api\/auth/, '/api/v2/auth');
}

const legacyRouteSet = [
  { method: 'POST', path: '/api/auth/login', public: true },
  { method: 'POST', path: '/api/auth/login-sms', public: true },
  { method: 'POST', path: '/api/auth/register', public: true },
  { method: 'POST', path: '/api/auth/send-sms', public: true },
  { method: 'GET', path: '/api/auth/me', public: false },
  { method: 'GET', path: '/api/auth/user', public: false },
  { method: 'PUT', path: '/api/auth/user', public: false },
  { method: 'PUT', path: '/api/auth/password', public: false },
  { method: 'POST', path: '/api/auth/logout', public: false },
  { method: 'POST', path: '/api/auth/refresh-token', public: false },
];

const nestOnlyRouteSet = [
  { method: 'GET', path: '/api/v2/auth/admin/users' },
  { method: 'POST', path: '/api/v2/auth/admin/users' },
  { method: 'PATCH', path: '/api/v2/auth/admin/users/:id' },
  { method: 'POST', path: '/api/v2/auth/admin/users/:id/reset-password' },
];

describe('Auth M1 · Legacy auth 行为契约冻结', () => {
  const controller = read(`${NEST_MODULES}/auth/auth.controller.ts`);
  const service = read(`${NEST_MODULES}/auth/auth.service.ts`);
  const guard = read(`${NEST_MODULES}/auth/auth.guard.ts`);
  const entity = read(`${NEST_MODULES}/auth/auth.entity.ts`);
  const nestRoutes = extractNestRoutes(controller);
  const spec = JSON.parse(read(OPENAPI));

  test('legacy auth 路由在 NestJS v2 全部有对应路径', () => {
    const missing = [];
    for (const lr of legacyRouteSet) {
      const v2 = legacyToV2(lr.path);
      const found = nestRoutes.find((r) => r.path === v2 && r.method === lr.method);
      if (!found) missing.push(`${lr.method} ${v2}`);
    }
    expect(missing).toEqual([]);
  });

  test('公开端点必须 @Public()，受保护端点必须 @UseGuards(AuthGuard)', () => {
    for (const lr of legacyRouteSet) {
      const v2 = legacyToV2(lr.path);
      const route = nestRoutes.find((r) => r.path === v2 && r.method === lr.method);
      expect(route).toBeDefined();
      if (lr.public) {
        expect({ path: v2, isPublic: route.isPublic }).toEqual({ path: v2, isPublic: true });
      } else {
        expect({ path: v2, hasAuthGuard: route.hasAuthGuard }).toEqual({ path: v2, hasAuthGuard: true });
      }
    }
  });

  test('auth 端点全部进 OpenAPI 契约（v2 路由表覆盖）', () => {
    const contractPaths = [
      ...legacyRouteSet.map((lr) => legacyToV2(lr.path)),
      ...nestOnlyRouteSet.map((route) => route.path.replace(/:([^/]+)/g, '{$1}')),
    ];
    const missing = contractPaths.filter((v2) => !spec.paths[v2]);
    expect(missing).toEqual([]);
  });

  test('register 创建隔离租户及受限 dealer_admin（品牌员工仍须后台开户）', () => {
    expect(controller).toMatch(/@Public\(\)\s*@Post\('register'\)/);
    expect(service).toMatch(/SELF_REGISTER_ROLE/);
    expect(service).toMatch(/assertIdentifierForRole\(SELF_REGISTER_ROLE, identifier\)/);
    expect(service).toMatch(/type:\s*'dealer_group'/);
    expect(service).toMatch(/role:\s*SELF_REGISTER_ROLE/);
    expect(service).toMatch(/permissions:\s*\[\]/);
    expect(spec.paths['/api/v2/auth/register'].post.responses['201']).toBeDefined();
    expect(spec.paths['/api/v2/auth/register'].post.responses['501']).toBeUndefined();
  });

  test('管理员账号接口全部受 AuthGuard + Roles 保护', () => {
    for (const route of nestOnlyRouteSet) {
      const found = nestRoutes.find((item) => item.path === route.path && item.method === route.method);
      expect(found).toBeDefined();
      expect(found.hasAuthGuard).toBe(true);
    }
    expect(controller).toMatch(/@Roles\('platform_admin', 'hq_admin', 'dealer_admin'\)/);
  });

  test('PUT /user 更新姓名并返回用户对象（与 legacy 行为一致）', () => {
    expect(controller).toMatch(/@Put\('user'\)/);
    expect(service).toMatch(/async updateUser\(/);
    expect(service).toMatch(/payload\.name !== undefined/);
    expect(service).toMatch(/return \{ user: this\.toPublic\(user, access\) \}/);
  });

  test('密码修改契约：必填旧密码、新密码至少8位', () => {
    expect(service).toMatch(/旧密码和新密码必填/);
    expect(service).toMatch(/新密码至少8位/);
    expect(service).toMatch(/newPwd\.length < 8/);
    expect(controller).toMatch(/@Put\('password'\)/);
  });

  test('账号锁定策略一致：5 次失败锁定 30 分钟', () => {
    expect(service).toMatch(/loginAttempts\s*>=\s*5/);
    expect(service).toMatch(/Date\.now\(\)\s*\+\s*30\s*\*\s*60\s*\*\s*1000/);
  });

  test('JWT 载荷包含完整租户范围字段（与 legacy 签名一致）', () => {
    const requiredFields = ['userId', 'tenantId', 'dealerId', 'storeId', 'customerId', 'role', 'roles', 'permissions'];
    for (const field of requiredFields) {
      expect(service).toMatch(new RegExp(`${field}:`));
    }
  });

  test('登录后返回 token + user 对象，且 toPublic 不含明文手机号（PIPL）', () => {
    expect(service).toMatch(/return \{ token: this\.sign\(user, modules, access\), user: this\.toPublic\(user, access\) \}/);
    const toPublicBlock = service.slice(service.indexOf('private toPublic'));
    expect(toPublicBlock).toMatch(/id:\s*u\.id/);
    expect(toPublicBlock).toMatch(/tenantId:\s*u\.tenantId/);
    expect(toPublicBlock).toMatch(/roles:\s*resolved\.roles/);
    expect(toPublicBlock).toMatch(/permissions:\s*resolved\.permissions/);
    expect(toPublicBlock).not.toMatch(/phone:\s*u\.phone/);
    // 实体层不存明文手机号
    expect(entity).toMatch(/phoneHash/);
    expect(entity).toMatch(/phoneEncrypted/);
    expect(entity).not.toMatch(/phone:\s*string/);
  });

  test('AuthGuard deny-by-default 且校验租户范围（H2）', () => {
    expect(guard).toMatch(/const isPublic\s*=\s*this\.reflector\.getAllAndOverride<boolean>\(IS_PUBLIC_KEY/);
    expect(guard).toMatch(/if \(isPublic\) return true;/);
    expect(guard).toMatch(/function isValidScope/);
    expect(guard).toMatch(/tenantId/);
    expect(guard).toMatch(/userId/);
    expect(guard).toMatch(/throw new ForbiddenException\('访问令牌租户范围无效'\)/);
  });

  test('SMS 验证码无 000000 后门（H1），且 OTP 服务有真实实现', () => {
    const otp = read(`${NEST_MODULES}/auth/otp.service.ts`);
    expect(otp).toMatch(/String\(Math\.floor\(100000\s*\+\s*Math\.random\(\)\s*\*\s*900000\)\)/);
    expect(otp).toMatch(/await bcrypt\.compare\(code, challenge\.codeHash\)/);
  });

  test('M4 已退役 Express auth 实现，生产身份真相源只剩 NestJS', () => {
    expect(fs.existsSync(path.join(ROOT, 'server/modules/auth/auth.routes.js'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'server/modules/auth/auth.service.js'))).toBe(false);
    expect(read('server/modules/v2.router.js')).not.toContain("router.use('/auth'");
    expect(read('server/routes/core-api.js')).not.toMatch(/router\.(post|get|put|patch|delete)\('\/api\/auth/);
  });
});
