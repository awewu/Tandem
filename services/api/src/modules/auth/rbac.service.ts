import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { withRlsTransaction } from '../common/rls';
import type { UserEntity } from './auth.entity';
import type { JwtPayload } from './auth.service';

export type RbacAccess = {
  role: string;
  roles: string[];
  permissions: string[];
};

const ADMIN_ROLES = new Set(['platform_admin', 'hq_admin']);
const ROLE_CODE = /^[a-z][a-z0-9_:-]{1,63}$/;

@Injectable()
export class RbacService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async resolveUserAccess(user: Pick<UserEntity, 'id' | 'tenantId' | 'role' | 'permissions'>): Promise<RbacAccess> {
    try {
      return await withRlsTransaction(this.ds, async (em) => {
        const rows: Array<{ code: string; is_primary: boolean; permissions: string[] | null }> = await em.query(
          `SELECT r.code, ur.is_primary,
                  COALESCE(array_agg(rp.permission_code ORDER BY rp.permission_code)
                    FILTER (WHERE rp.permission_code IS NOT NULL), ARRAY[]::text[]) AS permissions
             FROM rhautt_nexus.rbac_user_roles ur
             JOIN rhautt_nexus.rbac_roles r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id
             LEFT JOIN rhautt_nexus.rbac_role_permissions rp ON rp.role_id = r.id AND rp.tenant_id = r.tenant_id
            WHERE ur.tenant_id = $1
              AND ur.user_id = $2
              AND r.status = 'active'
            GROUP BY r.code, ur.is_primary
            ORDER BY ur.is_primary DESC, r.code ASC`,
          [user.tenantId, user.id],
        );
        if (!rows.length) return { role: user.role, roles: [user.role], permissions: [] };
        const roles = rows.map((row) => row.code);
        const permissions = [...new Set(rows.flatMap((row) => row.permissions ?? []))].sort();
        const primary = rows.find((row) => row.is_primary)?.code ?? roles[0] ?? user.role;
        return { role: primary, roles, permissions };
      }, { tenantId: user.tenantId });
    } catch {
      return this.legacyAccess(user);
    }
  }

  async listPermissions(actor: JwtPayload) {
    this.assertCanReadRbac(actor);
    return withRlsTransaction(this.ds, async (em) => {
      const permissions = await em.query(
        `SELECT code, name, domain, action, description, sort_order AS "sortOrder"
           FROM rhautt_nexus.rbac_permissions
          ORDER BY sort_order ASC, code ASC`,
      );
      return { permissions };
    }, { tenantId: actor.tenantId, actorId: actor.userId, role: actor.role });
  }

  async listRoles(actor: JwtPayload) {
    this.assertCanReadRbac(actor);
    return withRlsTransaction(this.ds, async (em) => {
      const roles = await em.query(
        `SELECT r.id, r.code, r.name, r.description, r.status, r.is_system AS "isSystem",
                COALESCE(array_agg(rp.permission_code ORDER BY rp.permission_code)
                  FILTER (WHERE rp.permission_code IS NOT NULL), ARRAY[]::text[]) AS permissions,
                COUNT(DISTINCT ur.user_id)::int AS "userCount"
           FROM rhautt_nexus.rbac_roles r
           LEFT JOIN rhautt_nexus.rbac_role_permissions rp ON rp.role_id = r.id AND rp.tenant_id = r.tenant_id
           LEFT JOIN rhautt_nexus.rbac_user_roles ur ON ur.role_id = r.id AND ur.tenant_id = r.tenant_id
          WHERE r.tenant_id = $1
          GROUP BY r.id
          ORDER BY r.is_system DESC, r.code ASC`,
        [actor.tenantId],
      );
      return { roles };
    }, { tenantId: actor.tenantId, actorId: actor.userId, role: actor.role });
  }

  async createRole(actor: JwtPayload, dto: { code?: string; name?: string; description?: string; permissions?: string[] }) {
    this.assertCanManageRbac(actor, 'admin.roles.create');
    const code = this.normalizeRoleCode(dto.code);
    const name = String(dto.name || '').trim();
    if (!name) throw new BadRequestException('role name is required');
    return withRlsTransaction(this.ds, async (em) => {
      const rows = await em.query(
        `INSERT INTO rhautt_nexus.rbac_roles (tenant_id, code, name, description, status, is_system)
         VALUES ($1, $2, $3, $4, 'active', false)
         RETURNING id, code, name, description, status, is_system AS "isSystem"`,
        [actor.tenantId, code, name, String(dto.description || '').trim()],
      );
      const role = rows[0];
      if (dto.permissions) await this.replaceRolePermissions(em, actor.tenantId, role.id, dto.permissions);
      return { role: { ...role, permissions: dto.permissions ?? [] } };
    }, { tenantId: actor.tenantId, actorId: actor.userId, role: actor.role });
  }

  async updateRole(actor: JwtPayload, roleId: string, patch: { name?: string; description?: string; status?: 'active' | 'inactive' }) {
    this.assertCanManageRbac(actor, 'admin.roles.update');
    return withRlsTransaction(this.ds, async (em) => {
      const role = await this.requireRole(em, actor.tenantId, roleId);
      const next = {
        name: patch.name !== undefined ? String(patch.name).trim() : role.name,
        description: patch.description !== undefined ? String(patch.description).trim() : role.description,
        status: patch.status ?? role.status,
      };
      if (!next.name) throw new BadRequestException('role name is required');
      const rows = await em.query(
        `UPDATE rhautt_nexus.rbac_roles
            SET name = $3, description = $4, status = $5, updated_at = now()
          WHERE tenant_id = $1 AND id = $2
          RETURNING id, code, name, description, status, is_system AS "isSystem"`,
        [actor.tenantId, roleId, next.name, next.description, next.status],
      );
      return { role: rows[0] };
    }, { tenantId: actor.tenantId, actorId: actor.userId, role: actor.role });
  }

  async setRolePermissions(actor: JwtPayload, roleId: string, permissions: string[]) {
    this.assertCanManageRbac(actor, 'admin.roles.assign_permissions');
    return withRlsTransaction(this.ds, async (em) => {
      await this.requireRole(em, actor.tenantId, roleId);
      await this.replaceRolePermissions(em, actor.tenantId, roleId, permissions);
      return { roleId, permissions: await this.rolePermissions(em, roleId) };
    }, { tenantId: actor.tenantId, actorId: actor.userId, role: actor.role });
  }

  async setUserRoles(actor: JwtPayload, userId: string, dto: { roleIds?: string[]; primaryRoleId?: string }) {
    this.assertCanManageRbac(actor, 'admin.users.assign_roles');
    const roleIds = [...new Set((dto.roleIds ?? []).map(String).filter(Boolean))];
    if (!roleIds.length) throw new BadRequestException('at least one role is required');
    const primaryRoleId = dto.primaryRoleId && roleIds.includes(dto.primaryRoleId) ? dto.primaryRoleId : roleIds[0];
    return withRlsTransaction(this.ds, async (em) => {
      const users = await em.query('SELECT id FROM rhautt_nexus.users WHERE tenant_id = $1 AND id = $2', [actor.tenantId, userId]);
      if (!users.length) throw new NotFoundException('user not found');
      const validRoles: Array<{ id: string; code: string }> = await em.query(
        `SELECT id, code FROM rhautt_nexus.rbac_roles
          WHERE tenant_id = $1 AND id = ANY($2::uuid[]) AND status = 'active'`,
        [actor.tenantId, roleIds],
      );
      if (validRoles.length !== roleIds.length) throw new BadRequestException('selected roles include invalid role');
      await em.query('DELETE FROM rhautt_nexus.rbac_user_roles WHERE tenant_id = $1 AND user_id = $2', [actor.tenantId, userId]);
      for (const roleId of roleIds) {
        await em.query(
          `INSERT INTO rhautt_nexus.rbac_user_roles (tenant_id, user_id, role_id, is_primary)
           VALUES ($1, $2, $3, $4)`,
          [actor.tenantId, userId, roleId, roleId === primaryRoleId],
        );
      }
      const primary = validRoles.find((role: { id: string; code: string }) => role.id === primaryRoleId) ?? validRoles[0];
      await em.query('UPDATE rhautt_nexus.users SET role = $3, updated_at = now() WHERE tenant_id = $1 AND id = $2', [
        actor.tenantId,
        userId,
        primary.code,
      ]);
      return this.effectivePermissionsInTransaction(em, actor.tenantId, userId);
    }, { tenantId: actor.tenantId, actorId: actor.userId, role: actor.role });
  }

  async effectivePermissions(actor: JwtPayload, userId: string) {
    this.assertCanReadRbac(actor);
    return withRlsTransaction(this.ds, (em) =>
      this.effectivePermissionsInTransaction(em, actor.tenantId, userId),
    { tenantId: actor.tenantId, actorId: actor.userId, role: actor.role });
  }

  private async effectivePermissionsInTransaction(em: EntityManager, tenantId: string, userId: string) {
    const rows: Array<{ id: string; code: string; name: string; is_primary: boolean; permissions: string[] | null }> = await em.query(
      `SELECT r.id, r.code, r.name, ur.is_primary,
              COALESCE(array_agg(rp.permission_code ORDER BY rp.permission_code)
                FILTER (WHERE rp.permission_code IS NOT NULL), ARRAY[]::text[]) AS permissions
         FROM rhautt_nexus.rbac_user_roles ur
         JOIN rhautt_nexus.rbac_roles r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id
         LEFT JOIN rhautt_nexus.rbac_role_permissions rp ON rp.role_id = r.id AND rp.tenant_id = r.tenant_id
        WHERE ur.tenant_id = $1 AND ur.user_id = $2 AND r.status = 'active'
        GROUP BY r.id, ur.is_primary
        ORDER BY ur.is_primary DESC, r.code ASC`,
      [tenantId, userId],
    );
    const permissions = [...new Set(rows.flatMap((row) => row.permissions ?? []))].sort();
    return {
      userId,
      roles: rows.map((row) => ({ id: row.id, code: row.code, name: row.name, isPrimary: row.is_primary })),
      permissions,
    };
  }

  private legacyAccess(user: Pick<UserEntity, 'role' | 'permissions'>): RbacAccess {
    const permissions = user.permissions ?? [];
    return { role: user.role, roles: [user.role], permissions };
  }

  private normalizeRoleCode(raw?: string): string {
    const code = String(raw || '').trim().toLowerCase();
    if (!ROLE_CODE.test(code)) throw new BadRequestException('role code must be lowercase letters, numbers, underscore, colon or hyphen');
    return code;
  }

  private async requireRole(em: EntityManager, tenantId: string, roleId: string): Promise<{
    id: string;
    code: string;
    name: string;
    description: string;
    status: 'active' | 'inactive';
  }> {
    const rows: Array<{ id: string; code: string; name: string; description: string; status: 'active' | 'inactive' }> = await em.query(
      'SELECT id, code, name, description, status FROM rhautt_nexus.rbac_roles WHERE tenant_id = $1 AND id = $2',
      [tenantId, roleId],
    );
    if (!rows.length) throw new NotFoundException('role not found');
    return rows[0];
  }

  private async replaceRolePermissions(em: EntityManager, tenantId: string, roleId: string, permissions: string[]) {
    const unique = [...new Set(permissions.map(String).filter(Boolean))];
    if (unique.length) {
      const valid = await em.query('SELECT code FROM rhautt_nexus.rbac_permissions WHERE code = ANY($1::text[])', [unique]);
      if (valid.length !== unique.length) throw new BadRequestException('selected permissions include invalid permission');
    }
    await em.query('DELETE FROM rhautt_nexus.rbac_role_permissions WHERE tenant_id = $1 AND role_id = $2', [tenantId, roleId]);
    for (const permission of unique) {
      await em.query(
        `INSERT INTO rhautt_nexus.rbac_role_permissions (tenant_id, role_id, permission_code)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [tenantId, roleId, permission],
      );
    }
  }

  private async rolePermissions(em: EntityManager, roleId: string): Promise<string[]> {
    const rows: Array<{ permission_code: string }> = await em.query(
      'SELECT permission_code FROM rhautt_nexus.rbac_role_permissions WHERE role_id = $1 ORDER BY permission_code ASC',
      [roleId],
    );
    return rows.map((row) => row.permission_code);
  }

  private assertCanReadRbac(actor: JwtPayload) {
    if (this.hasAny(actor, ['admin.users.read', 'admin.roles.read', 'admin.permissions.read'])) return;
    if (ADMIN_ROLES.has(actor.role)) return;
    throw new ForbiddenException('current account cannot read permission settings');
  }

  private assertCanManageRbac(actor: JwtPayload, permission: string) {
    if (this.hasAny(actor, [permission])) return;
    if (ADMIN_ROLES.has(actor.role)) return;
    throw new ForbiddenException('current account cannot manage permission settings');
  }

  private hasAny(actor: JwtPayload, permissions: string[]) {
    const owned = new Set(actor.permissions ?? []);
    return owned.has('*') || permissions.some((permission) => owned.has(permission));
  }
}
