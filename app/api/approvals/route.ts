import { NextResponse, type NextRequest } from "next/server";
import { boot } from "@/lib/boot";
import { getStore } from "@/lib/storage/repository";
import { withErrorHandler } from "@/lib/api/error-middleware";
import { requireAuth } from "@/lib/auth/require-auth";
import { audit } from "@/lib/audit/log";
import type { Approval } from "@/lib/types/approval";

export const GET = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  // 租户隔离: 仅返回本租户审批单 (filter 下推到 KvStore tenantId 列).
  const scoped = await getStore().approvals.list({ tenantId: auth.tenantId } as Partial<Approval>);
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
  // P0-A: 身份字段 (requester/tenantId) 取自鉴权上下文, 不接受 body 注入 (防伪造申请人/跨租户写).
  const apv = await getStore().approvals.create({
    title,
    type: String(body.type ?? "generic"),
    approver,
    requester: auth.userId,
    status: "pending",
    createdAt: new Date().toISOString(),
    tenantId: auth.tenantId,
  });
  await audit("approval.created", auth.userId, {
    targetId: apv.id,
    targetType: "approval",
    tenantId: auth.tenantId,
    metadata: { type: apv.type, approver },
  });
  return Response.json(apv, { status: 201 });
});
