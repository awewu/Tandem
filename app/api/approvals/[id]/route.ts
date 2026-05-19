import { NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/api/error-middleware";

const approvalsMap = new Map<string, { status: string }>();

export const PATCH = withErrorHandler(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const body = await _req.json();
  approvalsMap.set(params.id, { status: body.status });
  return Response.json({ id: params.id, status: body.status });
});
