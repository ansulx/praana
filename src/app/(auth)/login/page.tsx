import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, homeFor } from "@/server/auth/session";
import { googleAuthEnabled } from "@/server/env";
import { GoogleAuthError, GoogleSignInButton } from "@/components/auth/google-sign-in";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.role));
  const { next, error } = await searchParams;
  return (
    <div>
      <h1 className="font-heading text-3xl font-bold text-navy">Welcome back</h1>
      <p className="mt-2 text-muted-foreground">Sign in to continue your recovery story.</p>
      <GoogleAuthError code={error} />
      <GoogleSignInButton next={next} enabled={googleAuthEnabled} />
      <LoginForm next={next} />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        New to PRAANA?{" "}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
      {process.env.NODE_ENV !== "production" && (
        <details className="mt-8 rounded-2xl border bg-card p-4 text-sm">
          <summary className="cursor-pointer font-medium">Demo accounts</summary>
          <p className="mt-3 text-muted-foreground">
            Password for all: <code className="rounded bg-muted px-1.5 py-0.5">praana123</code>
          </p>
          <ul className="mt-2 grid gap-1 text-muted-foreground">
            <li><b className="text-foreground">priya@demo.praana.care</b>: patient, day 6 after breast surgery</li>
            <li><b className="text-foreground">rohan@demo.praana.care</b>: Priya&apos;s son (caregiver)</li>
            <li><b className="text-foreground">sunita@demo.praana.care</b>: patient, before surgery (Hindi)</li>
            <li><b className="text-foreground">doctor@demo.praana.care</b>: surgeon (care team)</li>
            <li><b className="text-foreground">nurse@demo.praana.care</b>: nurse (care team)</li>
          </ul>
        </details>
      )}
    </div>
  );
}
