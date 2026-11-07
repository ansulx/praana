"use client";

import { Sparkles, Thermometer } from "lucide-react";
import { useState } from "react";
import { DOMAIN_BY_KEY, MEDS_OPTIONS, PAIN_ANCHORS, WOUND_OPTIONS, type ScaleDomain } from "@/lib/domains";
import type { CheckinFields } from "@/lib/checkin";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useLocale, useT } from "@/components/providers/locale-provider";

function FromWords({ show }: { show?: boolean }) {
  const t = useT();
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-mint px-2 py-0.5 text-xs font-medium text-primary">
      <Sparkles className="size-3" /> {t("checkin.fromWords")}
    </span>
  );
}

function Header({ title, question, prefilled, onClear, hasValue }: { title: string; question: string; prefilled?: boolean; onClear?: () => void; hasValue: boolean }) {
  const t = useT();
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{title}</h3>
          <FromWords show={prefilled} />
        </div>
        <p className="text-sm text-muted-foreground">{question}</p>
      </div>
      {hasValue && onClear && (
        <button type="button" onClick={onClear} className="text-sm text-muted-foreground underline-offset-2 hover:underline">
          {t("checkin.notSure")}
        </button>
      )}
    </div>
  );
}

const painColor = (v: number) =>
  v >= 9 ? "bg-destructive text-white" : v >= 7 ? "bg-coral text-white" : v >= 4 ? "bg-amber text-navy" : "bg-primary text-primary-foreground";

export function PainPicker({ value, onChange, prefilled }: { value: number | null; onChange: (v: number | null) => void; prefilled?: boolean }) {
  const locale = useLocale();
  const def = DOMAIN_BY_KEY.pain;
  const anchor = value === null ? null : [...PAIN_ANCHORS].reverse().find((a) => a.value <= value);
  return (
    <div className="rounded-2xl border bg-card p-4">
      <Header title={locale === "hi" ? def.hi : def.en} question={locale === "hi" ? def.questionHi : def.questionEn} prefilled={prefilled} hasValue={value !== null} onClear={() => onChange(null)} />
      <div role="radiogroup" aria-label={def.en} className="grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            onClick={() => onChange(i)}
            className={cn(
              "h-11 rounded-lg border text-sm font-semibold transition",
              value === i ? cn(painColor(i), "border-transparent") : "bg-background hover:border-primary/50",
            )}
          >
            {i}
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{locale === "hi" ? "कोई दर्द नहीं" : "No pain"}</span>
        <span className="font-medium text-foreground">{anchor ? anchor[locale] : ""}</span>
        <span>{locale === "hi" ? "असहनीय" : "Worst"}</span>
      </div>
    </div>
  );
}

export function ScalePicker({ domain, value, onChange, prefilled }: { domain: Exclude<ScaleDomain, "pain">; value: number | null; onChange: (v: number | null) => void; prefilled?: boolean }) {
  const locale = useLocale();
  const def = DOMAIN_BY_KEY[domain];
  return (
    <div className="rounded-2xl border bg-card p-4">
      <Header title={locale === "hi" ? def.hi : def.en} question={locale === "hi" ? def.questionHi : def.questionEn} prefilled={prefilled} hasValue={value !== null} onClear={() => onChange(null)} />
      <div role="radiogroup" aria-label={def.en} className="flex flex-wrap gap-2">
        {def.options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-11 rounded-xl border px-3.5 py-2 text-left text-sm transition",
              value === o.value
                ? o.value >= 3
                  ? "border-coral bg-coral-soft font-semibold text-coral"
                  : "border-primary bg-mint font-semibold text-primary"
                : "bg-background hover:border-primary/50",
            )}
          >
            {o[locale]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function WoundPicker({ value, onChange, prefilled }: { value: CheckinFields["wound"]; onChange: (v: CheckinFields["wound"]) => void; prefilled?: boolean }) {
  const locale = useLocale();
  const t = useT();
  return (
    <div className="rounded-2xl border bg-card p-4">
      <Header title={t("checkin.wound")} question={locale === "hi" ? "घाव कैसा दिख रहा है?" : "How does the wound look?"} prefilled={prefilled} hasValue={value !== null} onClear={() => onChange(null)} />
      <div className="flex flex-wrap gap-2">
        {WOUND_OPTIONS.map((o) => {
          const concern = !["no_wound", "healing_well"].includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={value === o.value}
              onClick={() => onChange(o.value)}
              className={cn(
                "min-h-11 rounded-xl border px-3.5 py-2 text-sm transition",
                value === o.value ? (concern ? "border-coral bg-coral-soft font-semibold text-coral" : "border-primary bg-mint font-semibold text-primary") : "bg-background hover:border-primary/50",
              )}
            >
              {o[locale]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MedsPicker({ value, onChange, prefilled }: { value: CheckinFields["medsTaken"]; onChange: (v: CheckinFields["medsTaken"]) => void; prefilled?: boolean }) {
  const locale = useLocale();
  const t = useT();
  return (
    <div className="rounded-2xl border bg-card p-4">
      <Header title={t("checkin.meds")} question={locale === "hi" ? "आज की दवाइयाँ लीं?" : "Did you take today's medicines?"} prefilled={prefilled} hasValue={value !== null} onClear={() => onChange(null)} />
      <div className="flex flex-wrap gap-2">
        {MEDS_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-11 rounded-xl border px-3.5 py-2 text-sm transition",
              value === o.value ? (o.value === "none" ? "border-coral bg-coral-soft font-semibold text-coral" : "border-primary bg-mint font-semibold text-primary") : "bg-background hover:border-primary/50",
            )}
          >
            {o[locale]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Accepts °C or °F; shows the °C equivalent so families using Fahrenheit thermometers aren't confused. */
export function TemperatureInput({ value, onChange, prefilled }: { value: number | null; onChange: (v: number | null) => void; prefilled?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const [unit, setUnit] = useState<"c" | "f">(value !== null && value > 50 ? "f" : "c");
  const [text, setText] = useState(value === null ? "" : String(value));

  const commit = (raw: string, u = unit) => {
    setText(raw);
    const n = Number(raw.replace(",", "."));
    if (!raw.trim() || !Number.isFinite(n)) return onChange(null);
    const celsius = u === "f" ? Math.round((((n - 32) * 5) / 9) * 10) / 10 : n;
    // Don't send a reading that can't be real (e.g. "3.8"); the warning below asks to re-measure.
    onChange(celsius < 33 || celsius > 43.5 ? null : celsius);
  };

  const n = Number(text);
  const c = text && Number.isFinite(n) ? (unit === "f" ? ((n - 32) * 5) / 9 : n) : null;
  const implausible = c !== null && (c < 33 || c > 43.5);

  return (
    <div className="rounded-2xl border bg-card p-4">
      <Header title={t("checkin.temperature")} question={locale === "hi" ? "थर्मामीटर से नापा तापमान" : "Measured with a thermometer"} prefilled={prefilled} hasValue={value !== null} onClear={() => commit("")} />
      <div className="flex items-center gap-2">
        <div className="relative max-w-40 flex-1">
          <Thermometer className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input inputMode="decimal" value={text} onChange={(e) => commit(e.target.value)} placeholder={unit === "c" ? "37.0" : "98.6"} className="pl-9" aria-label={t("checkin.temperature")} aria-invalid={implausible} />
        </div>
        <div className="flex rounded-xl border p-1">
          {(["c", "f"] as const).map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={unit === u}
              onClick={() => {
                setUnit(u);
                commit(text, u);
              }}
              className={cn("h-9 w-11 rounded-lg text-sm font-semibold", unit === u ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              °{u.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      {implausible ? (
        <p className="mt-2 text-sm text-coral">{locale === "hi" ? "यह तापमान असामान्य लगता है। कृपया फिर से नापें।" : "That reading looks unusual. Please measure again."}</p>
      ) : c !== null && unit === "f" ? (
        <p className="mt-2 text-sm text-muted-foreground">= {c.toFixed(1)}°C</p>
      ) : null}
    </div>
  );
}
