import { NextResponse, type NextRequest } from "next/server";
import { boot } from "@/lib/boot";
import { getStore } from "@/lib/storage/repository";
import { withErrorHandler } from "@/lib/api/error-middleware";
import { requireAuth } from "@/lib/auth/require-auth";
import { audit } from "@/lib/audit/log";
import type { ApprovalStatus } from "@/lib/types/approval";

const ADMIN_ROLES = ["admin", "owner"];
const DECIDABLE: ApprovalStatus[] = ["approved", "rejected"];

export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    await boot();
    const auth = requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const status = String(body.status ?? "") as ApprovalStatus;
    if (!DECIDABLE.includes(status)) {
      return Response.json({ error: "status must be approved|rejected" }, { status: 400 });
    }

    const store = getStore();
    const apv = await store.approvals.get(params.id);
    // 租户隔离: 跨租户视为不存在.
    if (!apv || apv.tenantId !== auth.tenantId) {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    // 仅指定审批人或 admin/owner 可裁决.
    const isApprover = apv.approver === auth.userId;
    const isAdmin = auth.demo || auth.roles.some((r) => ADMIN_ROLES.includes(r));
    if (!isApprover && !isAdmin) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    if (apv.status !== "pending") {
      return Response.json({ error: `already ${apv.status}` }, { status: 409 });
    }

    const updated = await store.approvals.update(apv.id, {
      status,
      decidedAt: new Date().toISOString(),
      decidedBy: auth.userId,
      decisionNote: typeof body.note === "string" ? body.note : undefined,
    });
    await audit(status === "approved" ? "approval.approved" : "approval.rejected", auth.userId, {
      targetId: apv.id,
      targetType: "approval",
      tenantId: auth.tenantId,
      metadata: { type: apv.type, requester: apv.requester },
    });
    return Response.json(updated);
  },
);
