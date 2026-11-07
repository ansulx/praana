"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setLocale } from "@/server/actions/patient";

/** Always-visible EN | हिन्दी control — Dr. Bhavna: language must not be buried in Settings. */
export function LocaleSwitch({ locale }: { locale: "en" | "hi" }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function pick(next: "en" | "hi") {
    if (next === locale || pending) return;
    start(async () => {
      const r = await setLocale(next);
      if (!r.ok) {
        toast.error(r.error ?? (locale === "hi" ? "भाषा नहीं बदली" : "Couldn't change language"));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div
      className="flex shrink-0 rounded-full border border-border bg-card p-0.5 text-xs font-semibold"
      role="group"
      aria-label={locale === "hi" ? "भाषा चुनें" : "Choose language"}
    >
      {(["en", "hi"] as const).map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          aria-pressed={locale === l}
          onClick={() => pick(l)}
          className={cn(
            "h-8 min-w-9 rounded-full px-2.5 transition",
            locale === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-navy",
          )}
        >
          {l === "en" ? "EN" : "हि"}
        </button>
      ))}
    </div>
  );
}
