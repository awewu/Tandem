import { withErrorHandler } from "@/lib/api/error-middleware";

const rooms = [
  { id: "room-a", name: "小会议室 A", capacity: 6, status: "available" as const, nextBooking: undefined },
  { id: "room-b", name: "大会议室 B", capacity: 20, status: "reserved" as const, nextBooking: { title: "周会", start: new Date(Date.now() + 3600000).toISOString(), end: new Date(Date.now() + 7200000).toISOString() } },
  { id: "room-c", name: "视频会议室 C", capacity: 8, status: "available" as const },
];

export const GET = withErrorHandler(async () => {
  return Response.json({ rooms });
});
