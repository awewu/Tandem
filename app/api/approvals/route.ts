import { NextResponse, type NextRequest } from "next/server";
import { boot } from "@/lib/boot";
import { getStore } from "@/lib/storage/repository";
import { withErrorHandler } from "@/lib/api/error-middleware";
import { requireAuth } from "@/lib/auth/require-auth";
import { audit } from "@/lib/audit/log";
import { withTenantScope } from "@/lib/multi-tenant/with-tenant-scope";
import type { Approval } from "@/lib/types/approval";

export const GET = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  // 租户隔离: 经 withTenantScope 统一收敛 (§23 P2-A), 不再逐路由手写 tenantId 过滤.
  const approvals = withTenantScope(getStore().approvals, auth.tenantId);
  const scoped = await approvals.list();
  scoped.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return Response.json({ approvals: scoped });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const title = String(body.title ?? "").trim();
  const approver = String(body.approver ?? "").trim();
  if (!title) return Response.json({ error: "title required" }, { status: 400 });
  if (!approver) return Response.json({ error: "approver required" }, { status: 400 });
  // P0-A: 身份字段 (requester) 取自鉴权上下文, 不接受 body 注入; tenantId 由 withTenantScope 强制注入.
  const approvals = withTenantScope(getStore().approvals, auth.tenantId);
  const apv = await approvals.create({
    title,
    type: String(body.type ?? "generic"),
    approver,
    requester: auth.userId,
    status: "pending",
    createdAt: new Date().toISOString(),
  } as Omit<Approval, "id">);
  await audit("approval.created", auth.userId, {
    targetId: apv.id,
    targetType: "approval",
    tenantId: auth.tenantId,
    metadata: { type: apv.type, approver },
  });
  return Response.json(apv, { status: 201 });
});
