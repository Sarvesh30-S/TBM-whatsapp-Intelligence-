import { adminFetch } from "@/lib/admin-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f-]{36}$/i;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaignId");
  const summaryId = url.searchParams.get("summaryId");
  const itemId = url.searchParams.get("itemId");
  if (!campaignId || !summaryId || !uuidPattern.test(campaignId) || !uuidPattern.test(summaryId)
      || (itemId && !uuidPattern.test(itemId))) {
    return Response.json({ message: "Valid campaign and summary IDs are required." }, { status: 400 });
  }

  const query = itemId ? `?itemId=${encodeURIComponent(itemId)}` : "";
  try {
    const upstream = await adminFetch(
      `/api/admin/campaigns/${encodeURIComponent(campaignId)}/summaries/${encodeURIComponent(summaryId)}/sources${query}`,
      { signal: request.signal },
    );
    const body = await upstream.json().catch(() => null);
    return Response.json(body ?? { message: "Source messages are unavailable." }, { status: upstream.status });
  } catch {
    return Response.json({ message: "Source messages are unavailable." }, { status: 503 });
  }
}
