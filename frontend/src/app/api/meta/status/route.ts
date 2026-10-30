export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const apiUrl = process.env.BACKEND_API_URL ?? "http://localhost:8081";

export async function GET(request: Request) {
  try {
    const response = await fetch(`${apiUrl}/api/meta/test-connection`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: request.signal,
    });

    if (response.ok) {
      const data = (await response.json()) as {
        connected?: boolean;
        phoneNumber?: {
          display_phone_number?: string;
          verified_name?: string;
          id?: string;
        };
      };
      return Response.json({
        status: "ACTIVE",
        connected: true,
        isExpired: false,
        phoneNumber: data.phoneNumber ?? null,
        checkedAt: new Date().toISOString(),
      });
    }

    const errorPayload = (await response.json().catch(() => null)) as { message?: string } | null;
    const errorMessage = errorPayload?.message ?? "Meta API connection failed";

    const isTokenIssue =
      errorMessage.toLowerCase().includes("expired") ||
      errorMessage.includes("190") ||
      errorMessage.toLowerCase().includes("access token") ||
      errorMessage.toLowerCase().includes("oauthexception");

    return Response.json({
      status: isTokenIssue ? "EXPIRED" : "ERROR",
      connected: false,
      isExpired: isTokenIssue,
      error: errorMessage,
      statusCode: response.status,
      checkedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to connect to backend";
    return Response.json({
      status: "BACKEND_UNAVAILABLE",
      connected: false,
      isExpired: false,
      error: `Backend unreachable: ${errorMsg}`,
      checkedAt: new Date().toISOString(),
    });
  }
}
