"use client";

import { HeartHandshake, Phone, PhoneCall, Siren } from "lucide-react";
import type { Reason, UrgentAction } from "@/lib/safety/red-flags";
import { useLocale, useT } from "@/components/providers/locale-provider";
import type { HelpContacts } from "@/components/patient/help-now";

const tel = (n: string) => `tel:${n.replace(/[^\d+]/g, "")}`;

/**
 * Shown the moment the safety engine finds an urgent sign — while typing, on review, and
 * after sending. Plain instructions and one-tap calling; no diagnosis.
 */
export function UrgentPanel({ reasons, actions, contacts }: { reasons: Reason[]; actions: UrgentAction[]; contacts: HelpContacts }) {
  const t = useT();
  const locale = useLocale();
  const mental = actions.includes("mental_health");
  const emergency = actions.includes("emergency") || reasons.some((r) => r.level === "urgent" && r.action !== "mental_health");
  const shown = reasons.filter((r) => r.level === "urgent" || r.action === "mental_health").slice(0, 4);

  return (
    <div role="alert" aria-live="assertive" className="grid gap-4">
      {emergency && (
        <div className="rounded-3xl border-2 border-destructive/40 bg-destructive/5 p-5">
          <div className="flex items-start gap-3">
            <Siren className="mt-0.5 size-6 shrink-0 text-destructive" />
            <div>
              <h2 className="font-heading text-lg font-bold text-destructive">{t("urgent.title")}</h2>
              <p className="mt-1 text-[15px]">{t("urgent.body")}</p>
              {shown.length > 0 && (
                <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground">
                  {shown.filter((r) => r.action !== "mental_health").map((r) => (
                    <li key={r.code}>{locale === "hi" ? r.hi : r.en}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {contacts.primary && (
              <a href={tel(contacts.primary.phone)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground">
                <PhoneCall className="size-5" /> {t("urgent.callTeam")}
              </a>
            )}
            <a href={tel(contacts.emergency)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-destructive font-semibold text-white">
              <Phone className="size-5" /> {t("urgent.callEmergency")} · {contacts.emergency}
            </a>
          </div>
        </div>
      )}
      {mental && (
        <div className="rounded-3xl border-2 border-primary/30 bg-mint p-5">
          <div className="flex items-start gap-3">
            <HeartHandshake className="mt-0.5 size-6 shrink-0 text-primary" />
            <div>
              <h2 className="font-heading text-lg font-bold text-navy">{t("urgent.mhTitle")}</h2>
              <p className="mt-1 text-[15px]">{t("urgent.mhBody")}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <a href={tel(contacts.helpline)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground">
              <Phone className="size-5" /> {contacts.helplineName} · {contacts.helpline}
            </a>
            {contacts.primary && (
              <a href={tel(contacts.primary.phone)} className="flex h-12 items-center justify-center gap-2 rounded-xl border bg-card font-semibold">
                <PhoneCall className="size-5" /> {t("urgent.callTeam")}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
