import { NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/api/error-middleware";

const bookings: Record<string, unknown>[] = [];

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json();
  const booking = { id: `bk-${Date.now()}`, ...body, createdAt: new Date().toISOString() };
  bookings.push(booking);
  return Response.json(booking, { status: 201 });
});
