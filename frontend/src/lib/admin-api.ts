import "server-only";

const apiUrl = process.env.BACKEND_API_URL ?? "http://localhost:8081";

export async function adminFetch(path: string, init: RequestInit = {}) {
  const adminKey = process.env.BACKEND_ADMIN_API_KEY;
  if (!adminKey) throw new Error("Local dashboard API key is not configured.");

  return fetch(`${apiUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...init.headers,
      "X-Dashboard-Admin-Key": adminKey,
    },
  });
}

export async function postAdminRecord(path: string, value: unknown) {
  const response = await adminFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? `The API rejected the request (${response.status}).`);
  }
}

export async function patchAdminRecord(path: string, value: unknown) {
  const response = await adminFetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? `The API rejected the request (${response.status}).`);
  }
}

export async function deleteAdminRecord(path: string) {
  const response = await adminFetch(path, {
    method: "DELETE",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? `The API rejected the request (${response.status}).`);
  }
}
