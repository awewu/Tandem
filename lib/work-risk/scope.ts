import type { AuthContext } from '@/lib/auth/require-auth';
import type { AuthUser } from '@/lib/storage/repository';
import { hasDataPrivilege } from '@/lib/auth/data-scope';
import type { WorkRiskPerson, WorkRiskScope } from './types';

function userToPerson(user: AuthUser): WorkRiskPerson {
  return {
    id: user.id,
    name: user.name || user.email || user.id,
    departmentId: user.departmentId ?? null,
    managerId: user.managerId ?? null,
  };
}

export function allowedWorkRiskScopes(auth: AuthContext, users: AuthUser[]): WorkRiskScope[] {
  const scopes: WorkRiskScope[] = ['self'];
  const hasDirectReports = users.some((u) => u.managerId === auth.userId);
  if (auth.roles.includes('manager') || hasDirectReports || hasDataPrivilege(auth.roles)) {
    scopes.push('team');
  }
  if (hasDataPrivilege(auth.roles)) {
    scopes.push('organization');
  }
  return scopes;
}

export function resolveWorkRiskPeople(input: {
  auth: AuthContext;
  users: AuthUser[];
  requestedScope?: string | null;
}): { ok: true; scope: WorkRiskScope; allowedScopes: WorkRiskScope[]; people: WorkRiskPerson[] } | { ok: false; status: number; error: string; allowedScopes: WorkRiskScope[] } {
  const { auth, users } = input;
  const allowedScopes = allowedWorkRiskScopes(auth, users);
  const requested = (input.requestedScope || 'self') as WorkRiskScope;
  if (!allowedScopes.includes(requested)) {
    return {
      ok: false,
      status: 403,
      error: `当前账号无权查看 ${requested} 范围的工作风险`,
      allowedScopes,
    };
  }

  const activeUsers = users.filter((u) => !u.disabled);
  const me = activeUsers.find((u) => u.id === auth.userId);
  const people =
    requested === 'organization'
      ? activeUsers.map(userToPerson)
      : requested === 'team'
      ? activeUsers.filter((u) => u.id === auth.userId || u.managerId === auth.userId).map(userToPerson)
      : me
      ? [userToPerson(me)]
      : [{ id: auth.userId, name: auth.userId }];

  return { ok: true, scope: requested, allowedScopes, people };
}
