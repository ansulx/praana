"use client";

import { useEffect, useState } from "react";
import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/providers/locale-provider";

const EARLY_MS = 10 * 60_000;

/** Join link that only becomes active from 10 minutes before the start until the session ends. */
export function JoinButton({ startsAt, durationMin, joinUrl }: { startsAt: string; durationMin: number; joinUrl: string | null }) {
  const locale = useLocale();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const start = new Date(startsAt).getTime();
  const end = start + durationMin * 60_000;
  const safeUrl = joinUrl && /^https:\/\//i.test(joinUrl) ? joinUrl : null;

  if (!safeUrl) {
    return <span className="text-xs text-muted-foreground">{locale === "hi" ? "लिंक जल्द भेजा जाएगा" : "Link will be shared by your team"}</span>;
  }
  if (now === null) return <Button size="sm" disabled><Video />{locale === "hi" ? "जुड़ें" : "Join"}</Button>;
  if (now > end) return <span className="text-xs text-muted-foreground">{locale === "hi" ? "सत्र समाप्त" : "Session ended"}</span>;

  const open = now >= start - EARLY_MS;
  if (!open) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button size="sm" variant="outline" disabled>
          <Video />
          {locale === "hi" ? "जुड़ें" : "Join"}
        </Button>
        <span className="text-[11px] text-muted-foreground">{locale === "hi" ? "शुरू होने से 10 मिनट पहले खुलेगा" : "Opens 10 min before"}</span>
      </div>
    );
  }
  return (
    <Button size="sm" asChild>
      <a href={safeUrl} target="_blank" rel="noopener noreferrer">
        <Video />
        {locale === "hi" ? "अभी जुड़ें" : "Join now"}
      </a>
    </Button>
  );
}
