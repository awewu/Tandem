/**
 * Workspace-scoped authorization guard.
 *
 * Wraps requireAuth and adds workspace membership validation.
 * Returns 403 if the user is not a member of the requested workspace.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import { resolveTenant } from './tenant-context';

export interface WorkspaceAuthContext {
  userId: string;
  tenantId: string;
  workspaceId?: string;
  roles: string[];
  demo: boolean;
}

/**
 * Validate that the authenticated user belongs to the resolved workspace.
 *
 * Usage in API routes:
 *   const auth = await requireWorkspaceAuth(req);
 *   if (auth instanceof NextResponse) return auth;
 *   const { userId, workspaceId } = auth;
 */
export async function requireWorkspaceAuth(
  req: NextRequest
): Promise<WorkspaceAuthContext | NextResponse> {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { tenantId, workspaceId } = resolveTenant(req);

  // If workspaceId is present, verify membership
  if (workspaceId) {
    const store = getStore();
    const user = await store.auth.users.findById(auth.userId);
    if (!user || user.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: 'forbidden', message: 'You are not a member of this workspace' },
        { status: 403 }
      );
    }
  }

  return {
    userId: auth.userId,
    tenantId,
    workspaceId,
    roles: auth.roles,
    demo: auth.demo,
  };
}
