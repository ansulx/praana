"use client";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

/** fetch + JSON + timeout + friendly errors. Distinguishes offline/timeout from server errors. */
export async function api<T>(url: string, init: RequestInit & { timeoutMs?: number; json?: unknown } = {}): Promise<T> {
  const { timeoutMs = 30_000, json, ...rest } = init;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ApiError("You're offline. We'll keep your draft. Try again when you're connected.", 0, "offline");
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...rest,
      signal: rest.signal ?? ctrl.signal,
      headers: json !== undefined ? { "Content-Type": "application/json", ...(rest.headers ?? {}) } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && typeof window !== "undefined") {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      }
      throw new ApiError((data as { error?: string }).error ?? "Something went wrong. Please try again.", res.status, (data as { code?: string }).code);
    }
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === "AbortError") throw new ApiError("This is taking longer than usual. Please check your connection and try again.", 0, "timeout");
    throw new ApiError("We couldn't reach PRAANA. Please check your connection and try again.", 0, "network");
  } finally {
    clearTimeout(timer);
  }
}
