"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Status = "connecting" | "live" | "reconnecting";

/**
 * Listens to /api/clinic/stream. On any event the page re-fetches from the server (the
 * database is the source of truth); urgent and review alerts also raise a toast.
 */
export function LiveUpdates({ patientNames = {} }: { patientNames?: Record<string, string> }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("connecting");
  const names = useRef(patientNames);
  useEffect(() => {
    names.current = patientNames;
  }, [patientNames]);

  useEffect(() => {
    let es: EventSource | null = null;
    let retry = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const refresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 1000);
    };

    const connect = () => {
      if (stopped) return;
      es = new EventSource("/api/clinic/stream");
      es.onopen = () => {
        retry = 0;
        setStatus("live");
      };
      es.onerror = () => {
        es?.close();
        if (stopped) return;
        setStatus("reconnecting");
        const delay = Math.min(30_000, 1000 * 2 ** retry++) + Math.random() * 500;
        retryTimer = setTimeout(connect, delay);
      };
      es.addEventListener("alert", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data) as { patientId: string; level: "review" | "urgent" };
          const who = names.current[data.patientId] ?? "A patient";
          if (data.level === "urgent") toast.error(`Urgent: ${who} needs attention now`, { duration: 15_000 });
          else toast.warning(`${who}'s check-in needs review`);
        } catch {
          /* ignore malformed */
        }
        refresh();
      });
      for (const type of ["checkin", "question", "alert-updated"]) es.addEventListener(type, refresh);
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      clearTimeout(refreshTimer);
      es?.close();
    };
  }, [router]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground" aria-live="polite">
      <span
        className={cn(
          "size-2 rounded-full",
          status === "live" ? "bg-primary motion-safe:animate-pulse" : status === "reconnecting" ? "bg-amber" : "bg-muted-foreground/40",
        )}
      />
      {status === "live" ? "Live" : status === "reconnecting" ? "Reconnecting…" : "Connecting…"}
    </span>
  );
}
