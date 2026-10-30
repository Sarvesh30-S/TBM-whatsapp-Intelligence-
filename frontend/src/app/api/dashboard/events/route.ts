import { adminFetch } from "@/lib/admin-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const brandId = new URL(request.url).searchParams.get("brandId");
  if (!brandId || !/^[0-9a-f-]{36}$/i.test(brandId)) {
    return Response.json({ message: "A valid brandId is required." }, { status: 400 });
  }

  try {
    const upstream = await adminFetch(`/api/admin/events?brandId=${encodeURIComponent(brandId)}`, {
      signal: request.signal,
    });
    if (!upstream.ok || !upstream.body) {
      return Response.json({ message: "The dashboard event stream is unavailable." }, { status: upstream.status || 502 });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return Response.json({ message: "The dashboard event stream is unavailable." }, { status: 503 });
  }
}
