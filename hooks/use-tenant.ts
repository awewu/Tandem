"use client";

/**
 * useTenant — 当前 workspace 上下文 hook.
 *
 * V1 (单租户): 始终返回 default workspace.
 * V2 (SaaS): 从 useCurrentUser 读取 workspaceId.
 */

import { useCurrentUser } from "@/lib/hooks/use-current-user";

export function useTenant() {
  const { user } = useCurrentUser();
  return {
    workspaceId: user?.workspaceId ?? "default",
    tenantId: user?.tenantId ?? "default",
  };
}
