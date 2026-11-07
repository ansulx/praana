"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PatientError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-md rounded-3xl border bg-card p-8 text-center">
      <h1 className="font-heading text-xl font-bold text-navy">This page didn&apos;t load</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your recovery record is safe. Please try again. If you feel unwell, use “Need help now?” at the top. It always works.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw /> Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/home">Go to Today</Link>
        </Button>
      </div>
    </div>
  );
}
