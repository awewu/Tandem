import { NextResponse, type NextRequest } from "next/server";
import { boot } from "@/lib/boot";
import { getStore } from "@/lib/storage/repository";
import { withErrorHandler } from "@/lib/api/error-middleware";
import { requireAuth } from "@/lib/auth/require-auth";
import type { MeetingBooking } from "@/lib/types/meeting-booking";

export const GET = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const list = await getStore().meetingBookings.list({ tenantId: auth.tenantId } as Partial<MeetingBooking>);
  list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return Response.json({ bookings: list });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const title = String(body.title ?? "").trim();
  if (!title) return Response.json({ error: "title required" }, { status: 400 });
  const attendees = Array.isArray(body.attendees)
    ? body.attendees.filter((x: unknown): x is string => typeof x === "string")
    : undefined;
  // 字段白名单 + 身份字段取自鉴权上下文 (防伪造归属/越权字段).
  const booking = await getStore().meetingBookings.create({
    title,
    room: typeof body.room === "string" ? body.room : undefined,
    startAt: typeof body.startAt === "string" ? body.startAt : undefined,
    endAt: typeof body.endAt === "string" ? body.endAt : undefined,
    attendees,
    notes: typeof body.notes === "string" ? body.notes : undefined,
    createdBy: auth.userId,
    tenantId: auth.tenantId,
    createdAt: new Date().toISOString(),
  });
  return Response.json(booking, { status: 201 });
});
