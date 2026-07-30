import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { withRlsTransaction } from '../common/rls';
import { encryptPII, hashPII } from '../compliance/compliance.pii';
import { UserEntity, UserRole } from './auth.entity';
import { ExternalIdentityBindingEntity } from './external-identity-binding.entity';

export interface VerifiedExternalIdentity {
  provider: string;
  issuer: string;
  subject: string;
  profile?: Record<string, unknown> | null;
}

export interface SsoResolvedUser {
  id: string;
  tenantId: string;
  dealerId: string | null;
  storeId: string | null;
  customerId: string | null;
  name: string;
  role: string;
  permissions: string[];
}

export type SsoExternalIdentityResolution =
  | {
      status: 'authenticated';
      policy: 'active_binding';
      user: SsoResolvedUser;
      binding: ExternalIdentityBindingEntity;
    }
  | {
      status: 'pending_authorization';
      policy: 'pending_authorization';
      user: null;
      binding: ExternalIdentityBindingEntity;
    };

@Injectable()
export class SsoExternalIdentityService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(ExternalIdentityBindingEntity)
    private readonly bindings: Repository<ExternalIdentityBindingEntity>,
  ) {}

  async resolveVerifiedIdentity(
    input: VerifiedExternalIdentity,
  ): Promise<SsoExternalIdentityResolution> {
    const identity = this.normalizeIdentity(input);
    const profile = this.profileSnapshot(input.profile);
    const now = new Date();

    const binding = await this.bindings.findOne({
      where: {
        provider: identity.provider,
        issuer: identity.issuer,
        subject: identity.subject,
      },
    });

    if (!binding) {
      const autoProvisioned = await this.tryAutoProvision(identity, profile, now);
      if (autoProvisioned) return autoProvisioned;

      const pending = this.bindings.create({
        ...identity,
        tenantId: null,
        localUserId: null,
        status: 'pending_authorization',
        firstLoginAt: now,
        lastLoginAt: null,
        lastSeenProfile: profile,
      });
      return {
        status: 'pending_authorization',
        policy: 'pending_authorization',
        user: null,
        binding: await this.bindings.save(pending),
      };
    }

    binding.lastSeenProfile = profile;

    if (binding.status === 'pending_authorization') {
      const autoProvisioned = await this.tryAutoProvision(identity, profile, now, binding);
      if (autoProvisioned) return autoProvisioned;

      return {
        status: 'pending_authorization',
        policy: 'pending_authorization',
        user: null,
        binding: await this.bindings.save(binding),
      };
    }

    if (binding.status !== 'active') {
      throw new ForbiddenException('SSO external identity binding is not active');
    }
    if (!binding.tenantId || !binding.localUserId) {
      throw new ForbiddenException('SSO external identity binding is incomplete');
    }
    const tenantId = binding.tenantId;
    const localUserId = binding.localUserId;

    const user = await withRlsTransaction(
      this.ds,
      async (em) => {
        const repo = em.getRepository(UserEntity);
        const current = await repo.findOne({
          where: { id: localUserId, tenantId },
        });
        if (current && this.isRoleLikeDisplayName(current.name)) {
          const displayName = this.autoProvisionDisplayName(identity, profile);
          if (!this.isRoleLikeDisplayName(displayName) && displayName !== current.name) {
            current.name = displayName;
            await repo.save({ id: current.id, tenantId: current.tenantId, name: displayName } as UserEntity);
          }
        }
        return current;
      },
      { tenantId },
    );

    if (!user || user.status !== 'active') {
      throw new ForbiddenException('SSO local user is not active');
    }
    if (user.tenantId !== tenantId) {
      throw new ForbiddenException('SSO external identity tenant mismatch');
    }

    binding.lastLoginAt = now;
    binding.lastSeenProfile = profile;
    await this.bindings.save(binding);

    return {
      status: 'authenticated',
      policy: 'active_binding',
      user: this.toResolvedUser(user),
      binding,
    };
  }

  private async tryAutoProvision(
    identity: { provider: string; issuer: string; subject: string },
    profile: Record<string, unknown>,
    now: Date,
    pendingBinding?: ExternalIdentityBindingEntity,
  ): Promise<SsoExternalIdentityResolution | null> {
    if (!this.autoProvisionEnabled()) return null;
    if (!this.autoProvisionProfileAllowed(profile)) return null;

    const tenantId = await this.autoProvisionTenantId();
    if (!tenantId) return null;

    const identifier = this.autoProvisionIdentifier(identity, profile);
    const normalized = this.normalizeIdentifier(identifier);
    const role = this.autoProvisionRole(profile);
    const user = await withRlsTransaction(
      this.ds,
      async (em) => {
        const repo = em.getRepository(UserEntity);
        const existing = await repo.findOne({ where: { tenantId, phoneHash: hashPII(normalized) } });
        if (existing) {
          existing.status = 'active';
          existing.role = role;
          existing.permissions = [];
          existing.name = this.autoProvisionDisplayName(identity, profile);
          return repo.save(existing);
        }

        return repo.save(
          repo.create({
            tenantId,
            dealerId: null,
            storeId: null,
            customerId: null,
            phoneHash: hashPII(normalized),
            phoneEncrypted: encryptPII(normalized),
            passwordHash: await bcrypt.hash(randomUUID(), 10),
            name: this.autoProvisionDisplayName(identity, profile),
            role,
            permissions: [],
            status: 'active',
            loginAttempts: 0,
            lockUntil: null,
            lastLoginAt: now,
          }),
        );
      },
      { tenantId },
    );

    const binding = await this.bindings.save(
      this.bindings.create({
        ...(pendingBinding || {}),
        ...identity,
        tenantId,
        localUserId: user.id,
        status: 'active',
        firstLoginAt: now,
        lastLoginAt: now,
        lastSeenProfile: profile,
      }),
    );

    return {
      status: 'authenticated',
      policy: 'active_binding',
      user: this.toResolvedUser(user),
      binding,
    };
  }

  private normalizeIdentity(input: VerifiedExternalIdentity) {
    const provider = String(input.provider || '').trim().toLowerCase();
    const issuer = String(input.issuer || '').trim().replace(/\/+$/, '');
    const subject = String(input.subject || '').trim();
    if (!provider || !issuer || !subject) {
      throw new ForbiddenException('SSO external identity is incomplete');
    }
    return { provider, issuer, subject };
  }

  private autoProvisionEnabled() {
    if (process.env.OIDC_AUTO_PROVISION_ENABLED === 'true') return true;
    return process.env.NODE_ENV !== 'production' && process.env.OIDC_DEV_AUTO_PROVISION_PLATFORM_ADMIN === 'true';
  }

  private async autoProvisionTenantId() {
    const configured = String(
      process.env.OIDC_AUTO_PROVISION_TENANT_ID || process.env.OIDC_DEV_AUTO_PROVISION_TENANT_ID || '',
    ).trim();
    if (configured) return configured;
    const code = String(
      process.env.OIDC_AUTO_PROVISION_TENANT_CODE ||
        process.env.OIDC_DEV_AUTO_PROVISION_TENANT_CODE ||
        'DEFAULT',
    ).trim();
    const rows = await this.ds.query(
      'SELECT id FROM rhautt_nexus.tenants WHERE code = $1 AND status = $2 LIMIT 1',
      [code, 'active'],
    );
    return rows[0]?.id ? String(rows[0].id) : null;
  }

  private autoProvisionProfileAllowed(profile: Record<string, unknown>) {
    const allowedDomains = this.csv(process.env.OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS);
    if (!allowedDomains.length) return process.env.NODE_ENV !== 'production';

    const email = this.claimString(profile.email).toLowerCase();
    if (!email || !email.includes('@')) return false;
    const domain = email.split('@').pop() || '';
    return allowedDomains.includes(domain);
  }

  private autoProvisionRole(profile: Record<string, unknown>): UserRole {
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.OIDC_AUTO_PROVISION_ENABLED !== 'true' &&
      process.env.OIDC_DEV_AUTO_PROVISION_PLATFORM_ADMIN === 'true'
    ) {
      return 'platform_admin';
    }

    const upstreamRoles = this.claimArray(profile.roles).map((role) => role.toLowerCase());
    const roleMap = this.roleMap();
    for (const upstreamRole of upstreamRoles) {
      const localRole = roleMap.get(upstreamRole);
      if (localRole) return localRole;
    }
    return (process.env.OIDC_AUTO_PROVISION_DEFAULT_ROLE as UserRole) || 'hq_admin';
  }

  private roleMap(): Map<string, UserRole> {
    const configured = this.csv(process.env.OIDC_AUTO_PROVISION_ROLE_MAP);
    const entries = configured.length ? configured : ['owner:platform_admin', 'admin:platform_admin', 'employee:hq_admin'];
    const allowed: ReadonlySet<string> = new Set([
      'platform_admin',
      'hq_admin',
      'brand_admin',
      'regional_manager',
      'dealer_admin',
      'store_manager',
      'designer',
      'sales',
      'engineer',
      'installer',
      'customer',
    ]);
    return entries.reduce((map, entry) => {
      const [upstream, local] = entry.split(':').map((part) => part.trim());
      if (upstream && allowed.has(local)) map.set(upstream.toLowerCase(), local as UserRole);
      return map;
    }, new Map<string, UserRole>());
  }

  private autoProvisionIdentifier(
    identity: { provider: string; issuer: string; subject: string },
    profile: Record<string, unknown>,
  ) {
    const preferred = ['email', 'preferred_username', 'phone_number']
      .map((key) => profile[key])
      .find((value) => typeof value === 'string' && value.trim());
    if (preferred) return String(preferred).trim();
    const digest = createHash('sha256')
      .update(`${identity.issuer}:${identity.subject}`)
      .digest('hex')
      .slice(0, 16);
    return `sso-${digest}@rhautt.local`;
  }

  private autoProvisionDisplayName(
    identity: { provider: string; issuer: string; subject: string },
    profile: Record<string, unknown>,
  ) {
    const name = [profile.name, profile.nickname, profile.email, profile.preferred_username]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .find((value) => value && !this.isRoleLikeDisplayName(value));
    return name || `SSO ${identity.subject.slice(0, 12)}`;
  }

  private isRoleLikeDisplayName(value: unknown) {
    const text = typeof value === 'string' ? value.trim().replace(/\s+/g, '').toLowerCase() : '';
    if (!text) return false;
    return new Set([
      'platform_admin',
      'hq_admin',
      'brand_admin',
      'regional_manager',
      'dealer_admin',
      'store_manager',
      'designer',
      'sales',
      'engineer',
      'installer',
      'customer',
      '平台超管',
      '平台超级管理员',
      '超级管理员',
      '总部管理员',
      '品牌管理员',
      '区域经理',
      '经销商管理员',
      '门店经理',
      '设计师',
      '销售',
      '工程师',
      '安装工',
      '客户',
    ]).has(text);
  }

  private normalizeIdentifier(raw: string) {
    const s = String(raw ?? '').trim();
    return /[a-zA-Z@]/.test(s) ? s.toLowerCase() : s.replace(/\D/g, '');
  }

  private claimString(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private claimArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string');
    return typeof value === 'string' ? [value] : [];
  }

  private csv(value: string | undefined): string[] {
    return String(value || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }

  private profileSnapshot(profile: Record<string, unknown> | null | undefined) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return {};
    return { ...profile };
  }

  private toResolvedUser(user: UserEntity): SsoResolvedUser {
    return {
      id: user.id,
      tenantId: user.tenantId,
      dealerId: user.dealerId ?? null,
      storeId: user.storeId ?? null,
      customerId: user.customerId ?? null,
      name: user.name,
      role: user.role,
      permissions: user.permissions ?? [],
    };
  }
}
