/**
 * Thin wrapper around the Poppy backend's internal HTTP API.
 *
 * The backend gates every internal endpoint with `X-Internal-Secret`. This
 * helper reads the backend base URL and shared secret from env and throws with a
 * clear message if either is missing.
 *
 * Env vars: POPPY_BASE_URL + INTERNAL_SECRET are the app's canonical names
 * (already set in .env.local and Vercel). BACKEND_URL / INTERNAL_API_SECRET are
 * accepted as fallbacks so either naming works.
 */

const DEFAULT_TIMEOUT_MS = 15_000;

export interface BackendCallOptions {
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
  timeoutMs?: number;
  /** Verified admin email from the request session, forwarded to backend audit log. */
  adminEmail?: string | null;
}

export async function callBackend<T = unknown>(
  opts: BackendCallOptions,
): Promise<T> {
  const url = process.env.POPPY_BASE_URL || process.env.BACKEND_URL;
  const secret = process.env.INTERNAL_SECRET || process.env.INTERNAL_API_SECRET;
  if (!url) throw new Error("POPPY_BASE_URL (or BACKEND_URL) is not set");
  if (!secret)
    throw new Error("INTERNAL_SECRET (or INTERNAL_API_SECRET) is not set");

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Internal-Secret": secret,
    };
    if (opts.adminEmail) headers["X-Admin-Email"] = opts.adminEmail;
    const res = await fetch(`${url.replace(/\/$/, "")}${opts.path}`, {
      method: opts.method ?? "POST",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const errData = data as { error?: string } | null;
      // Always include the upstream status + path so a backend 401 is never
      // confused with the admin app's own middleware "Unauthorized".
      const detail = errData?.error ? `: ${errData.error}` : "";
      throw new Error(`backend ${opts.path} returned ${res.status}${detail}`);
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}
