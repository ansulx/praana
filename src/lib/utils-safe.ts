/** Only allow same-origin relative paths for post-login redirects (blocks open redirects). */
export function safeRedirectPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (next.startsWith("/api/")) return null;
  return next.slice(0, 300);
}
