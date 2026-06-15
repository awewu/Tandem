import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/api/error-middleware";
import { requireAuth } from "@/lib/auth/require-auth";

interface Approval { id: string; title: string; status: string; requester: string; approver: string; type: string; createdAt: string; tenantId?: string; }

const approvals: Approval[] = [
  { id: "apv-1", title: "Q2 采购申请", status: "pending", requester: "colleague-li", approver: "demo-user", type: "expense", createdAt: new Date().toISOString(), tenantId: "default" },
  { id: "apv-2", title: "请假 3 天", status: "approved", requester: "demo-user", approver: "colleague-wang", type: "leave", createdAt: new Date(Date.now() - 86400000).toISOString(), tenantId: "default" },
];

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  // Tenant isolation: scope to caller's tenant.
  const scoped = approvals.filter((a) => (a.tenantId ?? "default") === auth.tenantId);
  return Response.json({ approvals: scoped });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  // P0-A: 身份字段 (requester/tenantId) 取自鉴权上下文, 不接受 body 注入 (防伪造申请人/跨租户写).
  const apv: Approval = {
    id: `apv-${Date.now()}`,
    title: String(body.title ?? ""),
    type: String(body.type ?? "generic"),
    approver: String(body.approver ?? ""),
    requester: auth.userId,
    status: "pending",
    createdAt: new Date().toISOString(),
    tenantId: auth.tenantId,
  };
  approvals.push(apv);
  return Response.json(apv, { status: 201 });
});
