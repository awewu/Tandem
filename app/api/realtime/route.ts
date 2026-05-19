import { NextRequest } from "next/server";
import { createSSEStream, broadcast } from "@/lib/realtime/sse-channel";

export function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel");
  if (!channel) return new Response("Missing channel", { status: 400 });

  const stream = createSSEStream(channel);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function POST(req: NextRequest) {
  const { channel, payload } = await req.json();
  broadcast(channel, payload);
  return Response.json({ ok: true });
}
