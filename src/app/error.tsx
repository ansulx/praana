"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-md">
        <h1 className="font-heading text-2xl font-bold text-navy">Something went wrong</h1>
        <p className="mt-2 text-muted-foreground">
          Your information is safe. Please try again. If you feel unwell, don&apos;t wait. Call your care team or 112.
        </p>
        <Button className="mt-6" onClick={reset}>
          Try again
        </Button>
        {error.digest && <p className="mt-4 text-xs text-muted-foreground">Reference: {error.digest}</p>}
      </div>
    </div>
  );
}
