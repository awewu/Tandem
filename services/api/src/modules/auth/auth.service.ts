import { Injectable, UnauthorizedException, ForbiddenException, NotFoundException, BadRequestException, HttpException, ConflictException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { UserEntity, UserRole } from './auth.entity';
import { TenantEntity } from '../tenant/tenant.entity';
import { withRlsTransaction } from '../common/rls';
import { hashPII, encryptPII, decryptPII } from '../compliance/compliance.pii';
import { assertIdentifierForRole, SELF_REGISTER_ROLE } from './identity-policy';
import { EntitlementService } from '../entitlement/entitlement.service';
import { OtpService } from './otp.service';
import { RbacService, type RbacAccess } from './rbac.service';

export interface JwtPayload {
  userId: string; tenantId: string;
  dealerId: string | null; storeId: string | null; customerId: string | null;
  role: string; permissions: string[];
  roles?: string[];
  modules?: string[];
}

export interface ResolvedLoginUser {
  id: string;
  tenantId: string;
  dealerId: string | null;
  storeId: string | null;
  customerId: string | null;
  name: string;
  role: string;
  permissions: string[];
}

@Injectable()
export class AuthService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly jwt: JwtService,
    private readonly entitlement: EntitlementService,
    private readonly otp: OtpService,
    private readonly rbac: RbacService,
  ) {}

  // PIPL：登录标识规范化后取检索哈希（与用户开通时写入的 phone_hash 同源，compliance.pii.hashPII）。
  // 兼容两类标识：含字母/@ 视为邮箱/用户名（trim+小写）；否则按手机号（仅保留数字）。
  // 纯数字手机号的规范化结果与旧逻辑一致，向后兼容既有账号。
  private phoneHash(phone: string): string {
    return hashPII(AuthService.normalizeIdentifier(phone));
  }

  static normalizeIdentifier(raw: string): string {
    const s = String(raw ?? '').trim();
    return /[a-zA-Z@]/.test(s) ? s.toLowerCase() : s.replace(/\D/g, '');
  }

  // SECURITY DEFINER 函数返回的 snake_case 原始行 → 实体实例（启用 isLocked 等 getter）。
  private hydrate(r: Record<string, any>): UserEntity {
    return this.users.create({
      id: r.id, tenantId: r.tenant_id,
      dealerId: r.dealer_id ?? null, storeId: r.store_id ?? null, customerId: r.customer_id ?? null,
      phoneHash: r.phone_hash, phoneEncrypted: r.phone_encrypted, passwordHash: r.password_hash,
      name: r.display_name, role: r.role, permissions: r.permissions ?? [],
      status: r.status, loginAttempts: r.login_attempts ?? 0,
      lockUntil: r.lock_until ? new Date(r.lock_until) : null,
      lastLoginAt: r.last_login_at ? new Date(r.last_login_at) : null,
    });
  }

  async login(phone: string, password: string) {
    if (!phone || !password) throw new BadRequestException('手机号和密码必填');

    // 预认证发生在租户上下文之前：按 phone_hash 经 SECURITY DEFINER 函数跨租户命中（绕 FORCE RLS）。
    // 注：001 的 UNIQUE(tenant_id, phone_hash) 允许同号跨租户；此处取首个 active 命中——
    //     多租户同号的登录消歧（按品牌/租户提示）为已知 V1 限制。TODO(P1)。
    const rows: Record<string, any>[] = await this.ds.query(
      'SELECT * FROM rhautt_nexus.auth_lookup_user_by_phone_hash($1)',
      [this.phoneHash(phone)],
    );
    const row = rows.find((r) => r.status === 'active') ?? rows[0];
    if (!row) throw new UnauthorizedException('手机号或密码错误');
    const user = this.hydrate(row);
    if (user.status !== 'active') throw new ForbiddenException('账号不可用');
    if (user.isLocked) throw new HttpException('账号已锁定', 423);

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) { await this.recordFail(user); throw new UnauthorizedException('手机号或密码错误'); }

    // 命中后已知 tenantId：登录态写回走租户绑定事务（满足 FORCE RLS WITH CHECK）。
    user.loginAttempts = 0; user.lockUntil = null; user.lastLoginAt = new Date();
    await withRlsTransaction(this.ds, (em) =>
      em.getRepository(UserEntity).update(
        { id: user.id },
        { loginAttempts: 0, lockUntil: null, lastLoginAt: user.lastLoginAt },
      ),
    { tenantId: user.tenantId });
    const modules = await this.resolveModules(user.tenantId);
    const access = await this.rbac.resolveUserAccess(user);
    return { token: this.sign(user, modules, access), user: this.toPublic(user, access) };
  }

  async sendSmsCode(phone: string) {
    return this.otp.sendCode(phone);
  }

  // 短信验证码登录：真实 OTP 校验，SMS 路径同样走账号锁定（H1 修复：不再有 000000 后门）。
  async loginWithSms(phone: string, smsCode: string) {
    if (!phone || !smsCode) throw new BadRequestException('手机号和验证码必填');
    const rows: Record<string, any>[] = await this.ds.query(
      'SELECT * FROM rhautt_nexus.auth_lookup_user_by_phone_hash($1)',
      [this.phoneHash(phone)],
    );
    const row = rows.find((r) => r.status === 'active') ?? rows[0];
    if (!row) throw new UnauthorizedException('手机号或验证码错误');
    const user = this.hydrate(row);
    if (user.status !== 'active') throw new ForbiddenException('账号不可用');
    if (user.isLocked) throw new HttpException('账号已锁定', 423);

    const ok = await this.otp.verifyCode(phone, smsCode);
    if (!ok) { await this.recordFail(user); throw new UnauthorizedException('手机号或验证码错误'); }

    user.loginAttempts = 0; user.lockUntil = null; user.lastLoginAt = new Date();
    await withRlsTransaction(this.ds, (em) =>
      em.getRepository(UserEntity).update(
        { id: user.id },
        { loginAttempts: 0, lockUntil: null, lastLoginAt: user.lastLoginAt },
      ),
    { tenantId: user.tenantId });
    const modules = await this.resolveModules(user.tenantId);
    const access = await this.rbac.resolveUserAccess(user);
    return { token: this.sign(user, modules, access), user: this.toPublic(user, access) };
  }

  async changePassword(userId: string, oldPwd: string, newPwd: string) {
    if (!oldPwd || !newPwd) throw new BadRequestException('旧密码和新密码必填');
    if (newPwd.length < 8) throw new BadRequestException('新密码至少8位');

    // 已认证请求：复用环境租户上下文（拦截器自 JWT 注入）做租户绑定事务。
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(UserEntity);
      const user = await repo.findOne({ where: { id: userId }, select: ['id','passwordHash'] });
      if (!user) throw new NotFoundException('用户不存在');
      if (!await bcrypt.compare(oldPwd, user.passwordHash)) throw new UnauthorizedException('旧密码错误');
      await repo.update({ id: userId }, { passwordHash: await bcrypt.hash(newPwd, 10) });
      return { changed: true };
    });
  }

  async refreshToken(payload: JwtPayload) {
    // payload 携带 tenantId：以其作 scopeOverride 绑定租户事务。
    const user = await withRlsTransaction(this.ds, (em) =>
      em.getRepository(UserEntity).findOne({ where: { id: payload.userId } }),
    { tenantId: payload.tenantId });
    if (!user || user.status !== 'active') throw new UnauthorizedException('账号不可用');
    const modules = await this.resolveModules(user.tenantId);
    const access = await this.rbac.resolveUserAccess(user);
    return { token: this.sign(user, modules, access), user: this.toPublic(user, access) };
  }

  async getMe(payload: JwtPayload) {
    const user = await withRlsTransaction(this.ds, (em) =>
      em.getRepository(UserEntity).findOne({ where: { id: payload.userId } }),
    { tenantId: payload.tenantId });
    if (!user || user.status !== 'active') throw new UnauthorizedException('账号不可用');
    const access = await this.rbac.resolveUserAccess(user);
    return this.toPublic(user, access);
  }

  logout() { return { revoked: false, tokenMode: 'stateless-jwt' }; }

  async issueLoginForResolvedUser(user: ResolvedLoginUser) {
    const modules = await this.resolveModules(user.tenantId);
    const localUser = this.users.create({
      id: user.id,
      tenantId: user.tenantId,
      dealerId: user.dealerId,
      storeId: user.storeId,
      customerId: user.customerId,
      name: user.name,
      role: user.role as UserRole,
      permissions: user.permissions ?? [],
    });
    const access = await this.rbac.resolveUserAccess(localUser);
    return { token: this.sign(localUser, modules, access), user: this.toPublic(localUser, access) };
  }

  /**
   * 经销商自助注册（注册即用 + 事后限权）。
   *
   * - 标识：邮箱或手机号皆可，企业白名单域名保留给品牌员工（identity-policy 校验）。
   * - 隔离：每个注册者获得独立租户，RLS 天然隔离其（空）工作区。
   * - 限权：初始 permissions=[]，新租户无模块订阅 → EntitlementGuard 拦截所有付费模块，
   *         正式权限/订阅由管理员后台后续开通。
   * - 品牌员工账号仍不可自助注册，须走后台开户流程。
   */
  async register(dto: {
    identifier?: string; phone?: string; email?: string;
    password: string; name?: string; companyName?: string;
  }) {
    const identifier = String(dto?.identifier || dto?.email || dto?.phone || '').trim();
    const password = dto?.password;
    if (!identifier || !password) throw new BadRequestException('账号与密码必填');
    if (password.length < 8) throw new BadRequestException('密码至少8位');

    // 自助注册仅开放经销商侧角色；企业邮箱域名会被拒（防冒充品牌员工）。
    assertIdentifierForRole(SELF_REGISTER_ROLE, identifier);

    const normalized = AuthService.normalizeIdentifier(identifier);
    const phoneHash = hashPII(normalized);

    // 全局唯一性：跨租户按 phone_hash 命中（SECURITY DEFINER 绕 RLS）。
    const existing: Record<string, any>[] = await this.ds.query(
      'SELECT id FROM rhautt_nexus.auth_lookup_user_by_phone_hash($1)',
      [phoneHash],
    );
    if (existing.length) throw new ConflictException('该手机号/邮箱已注册');

    const tenantId = randomUUID();
    const displayName = String(dto?.name || '').trim() || normalized;
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await withRlsTransaction(this.ds, async (em) => {
      // tenants 表无 RLS：直接创建独立租户注册记录。
      const tenantRepo = em.getRepository(TenantEntity);
      await tenantRepo.save(tenantRepo.create({
        id: tenantId,
        code: 'self-' + tenantId.slice(0, 8),
        name: String(dto?.companyName || displayName) + ' · 经销商',
        type: 'dealer_group',
        status: 'active',
        settings: { source: 'self-register', provisioned: false },
      }));
      // users 表 FORCE RLS：本事务已绑定 tenantId，WITH CHECK 通过。
      const repo = em.getRepository(UserEntity);
      return repo.save(repo.create({
        tenantId,
        dealerId: null, storeId: null, customerId: null,
        phoneHash, phoneEncrypted: encryptPII(normalized),
        passwordHash,
        name: displayName,
        role: SELF_REGISTER_ROLE,
        permissions: [],       // 事后限权：初始无附加权限点
        status: 'active',      // 注册即用
        loginAttempts: 0,
      }));
    }, { tenantId });

    const modules = await this.resolveModules(tenantId); // 新租户无订阅 → []
    const access = await this.rbac.resolveUserAccess(user);
    return { token: this.sign(user, modules, access), user: this.toPublic(user, access) };
  }

  async updateUser(userId: string, payload: { name?: string }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(UserEntity);
      const user = await repo.findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException('用户不存在');
      if (payload.name !== undefined) user.name = payload.name;
      await repo.save(user);
      const access = await this.rbac.resolveUserAccess(user);
      return { user: this.toPublic(user, access) };
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 管理员账号管理（租户内）。所有操作绑定 actor.tenantId 的 RLS 事务，
  // 天然隔离到管理员所属租户；dealer_admin 进一步限制到本经销商与非管理员角色。
  // ─────────────────────────────────────────────────────────────
  private static readonly BRAND_ADMIN: ReadonlySet<string> = new Set(['platform_admin', 'hq_admin', 'brand_admin']);
  private static readonly DEALER_MANAGEABLE: ReadonlySet<UserRole> = new Set<UserRole>([
    'store_manager', 'sales', 'designer', 'engineer', 'installer',
  ]);

  /** actor 是否有权把某人设/建为指定角色。 */
  private assertCanManageRole(actor: JwtPayload, role: UserRole): void {
    if (AuthService.BRAND_ADMIN.has(actor.role)) return;
    if (actor.role === 'dealer_admin') {
      if (!AuthService.DEALER_MANAGEABLE.has(role)) {
        throw new ForbiddenException('经销商管理员仅可管理 门店/销售/设计/工程/安装 角色');
      }
      return;
    }
    throw new ForbiddenException('无权管理账号');
  }

  /** actor 是否有权操作目标用户。 */
  private assertActorOverTarget(actor: JwtPayload, target: UserEntity): void {
    if (AuthService.BRAND_ADMIN.has(actor.role)) return;
    if (actor.role === 'dealer_admin') {
      if (!AuthService.DEALER_MANAGEABLE.has(target.role)) {
        throw new ForbiddenException('无权管理该账号');
      }
      if (actor.dealerId && target.dealerId && actor.dealerId !== target.dealerId) {
        throw new ForbiddenException('只能管理本经销商账号');
      }
      return;
    }
    throw new ForbiddenException('无权管理账号');
  }

  /** 管理视图：脱敏标识 + 状态，绝不返回 passwordHash。 */
  private toAdminView(u: UserEntity) {
    let identifierMasked = '';
    let identifierKind: 'email' | 'phone' | 'unknown' = 'unknown';
    try {
      const raw = decryptPII(u.phoneEncrypted);
      if (raw.includes('@')) {
        identifierKind = 'email';
        identifierMasked = raw;
      } else {
        identifierKind = 'phone';
        identifierMasked = raw;
      }
    } catch { identifierMasked = '***'; }
    return {
      id: u.id, name: u.name, role: u.role, status: u.status,
      dealerId: u.dealerId, storeId: u.storeId,
      identifierMasked, identifierKind, isLocked: u.isLocked,
      lastLoginAt: u.lastLoginAt ?? null, createdAt: u.createdAt ?? null,
    };
  }

  async adminListUsers(actor: JwtPayload, q: { search?: string; role?: string; status?: string }) {
    return withRlsTransaction(this.ds, async (em) => {
      const qb = em.getRepository(UserEntity).createQueryBuilder('u')
        .where('u.tenantId = :t', { t: actor.tenantId });
      if (q.role) qb.andWhere('u.role = :r', { r: q.role });
      if (q.status) qb.andWhere('u.status = :s', { s: q.status });
      if (actor.role === 'dealer_admin' && actor.dealerId) {
        qb.andWhere('u.dealerId = :d', { d: actor.dealerId });
      }
      const rows = await qb.orderBy('u.createdAt', 'DESC').limit(300).getMany();
      let list = rows.map((u) => this.toAdminView(u));
      const s = (q.search || '').trim().toLowerCase();
      if (s) list = list.filter((x) => x.name.toLowerCase().includes(s) || x.identifierMasked.includes(s));
      return { users: list, total: list.length };
    }, { tenantId: actor.tenantId });
  }

  async adminCreateUser(actor: JwtPayload, dto: {
    identifier: string; password: string; name?: string; role: UserRole;
    dealerId?: string | null; storeId?: string | null;
  }) {
    if (!dto?.identifier || !dto?.password || !dto?.role) throw new BadRequestException('账号、密码、角色必填');
    if (dto.password.length < 8) throw new BadRequestException('密码至少8位');
    this.assertCanManageRole(actor, dto.role);
    assertIdentifierForRole(dto.role, dto.identifier);

    const normalized = AuthService.normalizeIdentifier(dto.identifier);
    const phoneHash = hashPII(normalized);
    const existing: Record<string, any>[] = await this.ds.query(
      'SELECT id FROM rhautt_nexus.auth_lookup_user_by_phone_hash($1)', [phoneHash],
    );
    if (existing.length) throw new ConflictException('该手机号/邮箱已注册');

    const dealerId = dto.dealerId ?? (actor.role === 'dealer_admin' ? actor.dealerId : null) ?? null;
    const user = await withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(UserEntity);
      return repo.save(repo.create({
        tenantId: actor.tenantId,
        dealerId, storeId: dto.storeId ?? null, customerId: null,
        phoneHash, phoneEncrypted: encryptPII(normalized),
        passwordHash: await bcrypt.hash(dto.password, 10),
        name: (dto.name || '').trim() || normalized,
        role: dto.role, permissions: [], status: 'active', loginAttempts: 0,
      }));
    }, { tenantId: actor.tenantId });
    return { user: this.toAdminView(user) };
  }

  async adminUpdateUser(actor: JwtPayload, targetId: string, patch: {
    role?: UserRole; status?: 'active' | 'inactive' | 'suspended'; name?: string;
    dealerId?: string | null; storeId?: string | null;
  }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(UserEntity);
      const user = await repo.findOne({ where: { id: targetId } });
      if (!user) throw new NotFoundException('用户不存在');
      this.assertActorOverTarget(actor, user);
      if (patch.role) { this.assertCanManageRole(actor, patch.role); user.role = patch.role; }
      if (patch.status) user.status = patch.status;
      if (patch.name !== undefined) user.name = patch.name;
      if (patch.dealerId !== undefined) user.dealerId = patch.dealerId;
      if (patch.storeId !== undefined) user.storeId = patch.storeId;
      if (patch.status === 'active') { user.loginAttempts = 0; user.lockUntil = null; }
      await repo.save(user);
      return { user: this.toAdminView(user) };
    }, { tenantId: actor.tenantId });
  }

  async adminResetPassword(actor: JwtPayload, targetId: string, newPwd: string) {
    if (!newPwd || newPwd.length < 8) throw new BadRequestException('新密码至少8位');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(UserEntity);
      const user = await repo.findOne({ where: { id: targetId } });
      if (!user) throw new NotFoundException('用户不存在');
      this.assertActorOverTarget(actor, user);
      await repo.update({ id: targetId }, {
        passwordHash: await bcrypt.hash(newPwd, 10), loginAttempts: 0, lockUntil: null,
      });
      return { reset: true };
    }, { tenantId: actor.tenantId });
  }

  async adminDeleteUser(actor: JwtPayload, targetId: string) {
    if (actor.userId === targetId) throw new BadRequestException('不能删除当前登录账号');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(UserEntity);
      const user = await repo.findOne({ where: { id: targetId } });
      if (!user) throw new NotFoundException('用户不存在');
      this.assertActorOverTarget(actor, user);
      await repo.delete({ id: targetId });
      return { deleted: true };
    }, { tenantId: actor.tenantId });
  }

  adminListPermissions(actor: JwtPayload) {
    return this.rbac.listPermissions(actor);
  }

  adminListRoles(actor: JwtPayload) {
    return this.rbac.listRoles(actor);
  }

  adminCreateRole(actor: JwtPayload, body: { code?: string; name?: string; description?: string; permissions?: string[] }) {
    return this.rbac.createRole(actor, body);
  }

  adminUpdateRole(actor: JwtPayload, id: string, body: { name?: string; description?: string; status?: 'active' | 'inactive' }) {
    return this.rbac.updateRole(actor, id, body);
  }

  adminSetRolePermissions(actor: JwtPayload, id: string, body: { permissions?: string[] }) {
    return this.rbac.setRolePermissions(actor, id, body.permissions ?? []);
  }

  adminSetUserRoles(actor: JwtPayload, id: string, body: { roleIds?: string[]; primaryRoleId?: string }) {
    return this.rbac.setUserRoles(actor, id, body);
  }

  adminEffectivePermissions(actor: JwtPayload, id: string) {
    return this.rbac.effectivePermissions(actor, id);
  }

  private sign(user: UserEntity, modules: string[] = [], access?: RbacAccess): string {
    const resolved = access ?? { role: user.role, roles: [user.role], permissions: user.permissions ?? [] };
    const payload: JwtPayload = {
      userId: user.id, tenantId: user.tenantId,
      dealerId: user.dealerId ?? null, storeId: user.storeId ?? null,
      customerId: user.customerId ?? null,
      role: resolved.role, roles: resolved.roles, permissions: resolved.permissions,
      modules,
    };
    return this.jwt.sign(payload);
  }

  // 解析租户有效订阅模块写入 JWT，仅供前端渲染能力开关；访问控制由 EntitlementGuard 实时查库（不信任 token）。
  private async resolveModules(tenantId: string): Promise<string[]> {
    try {
      return [...await this.entitlement.activeModuleIds(tenantId)];
    } catch {
      return [];
    }
  }

  private toPublic(u: UserEntity, access?: RbacAccess) {
    const resolved = access ?? { role: u.role, roles: [u.role], permissions: u.permissions ?? [] };
    let identifierMasked = '';
    let identifierKind: 'email' | 'phone' | 'unknown' = 'unknown';
    try {
      const raw = decryptPII(u.phoneEncrypted);
      if (raw.includes('@')) {
        identifierKind = 'email';
        identifierMasked = raw;
      } else if (raw) {
        identifierKind = 'phone';
        identifierMasked = raw;
      }
    } catch {
      identifierMasked = '';
    }
    return {
      id: u.id, userId: u.id, tenantId: u.tenantId, dealerId: u.dealerId, storeId: u.storeId, name: u.name,
      role: resolved.role, roles: resolved.roles, permissions: resolved.permissions,
      identifierMasked, identifierKind,
    };
  }

  private async recordFail(user: UserEntity) {
    user.loginAttempts = (user.loginAttempts ?? 0) + 1;
    if (user.loginAttempts >= 5) user.lockUntil = new Date(Date.now() + 30 * 60 * 1000);
    await withRlsTransaction(this.ds, (em) =>
      em.getRepository(UserEntity).update(
        { id: user.id },
        { loginAttempts: user.loginAttempts, lockUntil: user.lockUntil },
      ),
    { tenantId: user.tenantId });
  }
}
