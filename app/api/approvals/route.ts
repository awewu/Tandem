import { NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/api/error-middleware";

const approvals: Record<string, unknown>[] = [
  { id: "apv-1", title: "Q2 采购申请", status: "pending", requester: "colleague-li", approver: "demo-user", type: "expense", createdAt: new Date().toISOString() },
  { id: "apv-2", title: "请假 3 天", status: "approved", requester: "demo-user", approver: "colleague-wang", type: "leave", createdAt: new Date(Date.now() - 86400000).toISOString() },
];

export const GET = withErrorHandler(async (_req: NextRequest) => {
  return Response.json({ approvals });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json();
  const apv = { id: `apv-${Date.now()}`, ...body, status: "pending", createdAt: new Date().toISOString() };
  approvals.push(apv);
  return Response.json(apv, { status: 201 });
});
