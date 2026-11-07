import Link from "next/link";

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export function GoogleSignInButton({
  next,
  enabled,
  label = "Continue with Google",
}: {
  next?: string;
  enabled: boolean;
  label?: string;
}) {
  if (!enabled) return null;
  const href = next ? `/api/auth/google?next=${encodeURIComponent(next)}` : "/api/auth/google";
  return (
    <div className="mt-6 grid gap-4">
      <a
        href={href}
        className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card px-4 text-base font-semibold text-navy shadow-sm transition hover:bg-muted/60"
      >
        <GoogleGlyph className="size-5 shrink-0" />
        {label}
      </a>
      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span>or email</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

export function GoogleAuthError({ code }: { code?: string }) {
  if (!code) return null;
  const messages: Record<string, string> = {
    google_off: "Google Sign-In isn’t set up on this deploy yet. Use email and password for now.",
    google_denied: "Google sign-in was cancelled. You can try again or use email.",
    google_state: "That sign-in link expired. Please try Continue with Google again.",
    google_failed: "Google sign-in didn’t complete. Please try again or use email.",
    rate: "Too many sign-in attempts. Please wait a few minutes.",
  };
  const message = messages[code] ?? "Something went wrong signing in with Google.";
  return (
    <p role="alert" className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {message}{" "}
      {code === "google_off" && (
        <Link href="/register" className="font-semibold underline">
          Create an account
        </Link>
      )}
    </p>
  );
}
