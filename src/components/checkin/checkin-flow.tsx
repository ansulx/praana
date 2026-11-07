"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, ClipboardList, Loader2, RotateCcw, Send, Sparkles, Stethoscope, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { EMPTY_FIELDS, hasAnyContent, type CheckinFields, type StructuredDraft } from "@/lib/checkin";
import { triage, type PreviousCheckin, type TriageResult } from "@/lib/safety/red-flags";
import { TRIAGE_STYLE } from "@/lib/labels";
import { api, ApiError } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLocale, useT } from "@/components/providers/locale-provider";
import type { HelpContacts } from "@/components/patient/help-now";
import { UrgentPanel } from "./urgent-panel";
import { VoiceInput } from "./voice-input";
import { PhotoPicker, type PendingPhoto } from "./photo-picker";
import { MedsPicker, PainPicker, ScalePicker, TemperatureInput, WoundPicker } from "./domain-pickers";

type Draft = {
  freeText: string;
  fields: CheckinFields;
  photos: PendingPhoto[];
  usedVoice: boolean;
  idempotencyKey: string;
  savedAt: number;
};

type PreviewResponse = { draft: StructuredDraft; fields: CheckinFields; prefilled: (keyof CheckinFields)[]; triage: TriageResult };
type SubmitResponse = { checkin: { id: string; createdAt: string; triage: TriageResult["level"]; dayOffset: number | null }; triage: TriageResult; duplicate: boolean };

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`.replace(/\./g, ""));

function freshDraft(): Draft {
  return { freeText: "", fields: { ...EMPTY_FIELDS }, photos: [], usedVoice: false, idempotencyKey: newKey(), savedAt: Date.now() };
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function CheckinFlow({
  storageKey,
  previous,
  contacts,
  caregiverFor,
  serverVoice,
  aiOn,
}: {
  storageKey: string;
  previous: PreviousCheckin[];
  contacts: HelpContacts;
  caregiverFor: string | null;
  serverVoice: boolean;
  aiOn: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();

  const [draft, setDraft] = useState<Draft>(freshDraft);
  const [restored, setRestored] = useState(false);
  const [interim, setInterim] = useState("");
  const [voiceLang, setVoiceLang] = useState<"en" | "hi">(locale);
  const [step, setStep] = useState<"compose" | "review" | "done">("compose");
  const [busy, setBusy] = useState<"preview" | "send" | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [reviewFields, setReviewFields] = useState<CheckinFields>(EMPTY_FIELDS);
  const [sendError, setSendError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [online, setOnline] = useState(true);
  /** Extra domains stay collapsed so first paint is speak + pain. */
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  // ── Draft persistence: survives refresh, a dead battery, or a lost connection ──
  useEffect(() => {
    const raw = storage()?.getItem(storageKey);
    if (raw) {
      try {
        const saved = JSON.parse(raw) as Draft;
        if (Date.now() - saved.savedAt < 24 * 3600_000 && hasAnyContent(saved.freeText, saved.fields, saved.photos.length)) {
          // Blob URLs don't survive a reload; re-point at the stored copies.
          setDraft({ ...saved, photos: saved.photos.map((p) => ({ ...p, url: `/api/photos/${p.id}` })) });
          const f = saved.fields;
          if (
            f.appetite != null ||
            f.nausea != null ||
            f.mobility != null ||
            f.sleep != null ||
            f.mood != null ||
            f.anxiety != null ||
            f.wound != null ||
            f.temperatureC != null ||
            f.medsTaken != null
          ) {
            setShowMoreDetails(true);
          }
          setRestored(true);
        } else storage()?.removeItem(storageKey);
      } catch {
        storage()?.removeItem(storageKey);
      }
    }
  }, [storageKey]);

  useEffect(() => {
    if (step === "done") return;
    const id = setTimeout(() => {
      if (hasAnyContent(draft.freeText, draft.fields, draft.photos.length)) storage()?.setItem(storageKey, JSON.stringify({ ...draft, savedAt: Date.now() }));
    }, 400);
    return () => clearTimeout(id);
  }, [draft, step, storageKey]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const setField = useCallback(<K extends keyof CheckinFields>(k: K, v: CheckinFields[K]) => setDraft((d) => ({ ...d, fields: { ...d.fields, [k]: v } })), []);
  const setReviewField = <K extends keyof CheckinFields>(k: K, v: CheckinFields[K]) => setReviewFields((f) => ({ ...f, [k]: v }));

  const appendVoice = useCallback((text: string) => {
    if (!text) return;
    setDraft((d) => ({ ...d, usedVoice: true, freeText: (d.freeText ? `${d.freeText.trimEnd()} ` : "") + text }));
  }, []);

  // ── Live safety check: runs on-device as they type, no network needed ──
  const liveTriage = useMemo(() => triage({ ...draft.fields, freeText: draft.freeText }, previous), [draft.fields, draft.freeText, previous]);
  const reviewTriage = useMemo(() => {
    const local = triage({ ...reviewFields, freeText: draft.freeText }, previous);
    // Never show less than the server found.
    if (preview && rank(preview.triage.level) > rank(local.level)) return { ...local, level: preview.triage.level, reasons: mergeReasons(local, preview.triage), actions: [...new Set([...local.actions, ...preview.triage.actions])] };
    return local;
  }, [reviewFields, draft.freeText, previous, preview]);

  const canReview = hasAnyContent(draft.freeText, draft.fields, draft.photos.length);

  async function goReview() {
    if (!canReview) {
      toast.message(locale === "hi" ? "कुछ लिखें, जवाब चुनें या फ़ोटो जोड़ें।" : "Write something, tap an answer, or add a photo first.");
      return;
    }
    setBusy("preview");
    setPreviewFailed(false);
    try {
      const res = await api<PreviewResponse>("/api/checkins/preview", { method: "POST", json: { freeText: draft.freeText, fields: draft.fields }, timeoutMs: 30_000 });
      setPreview(res);
      setReviewFields(res.fields);
    } catch (err) {
      // Review still works without the server: the patient fills in what they can.
      setPreview(null);
      setPreviewFailed(true);
      setReviewFields(draft.fields);
      if (err instanceof ApiError && err.code === "offline") toast.error(err.message);
    } finally {
      setBusy(null);
      setStep("review");
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function send(retry = 0): Promise<void> {
    setBusy("send");
    setSendError(null);
    try {
      const prefilled = (preview?.prefilled ?? []).filter((k) => reviewFields[k] === preview?.fields[k]);
      const res = await api<SubmitResponse>("/api/checkins", {
        method: "POST",
        timeoutMs: 45_000,
        json: {
          freeText: draft.freeText,
          fields: reviewFields,
          inputMode: draft.usedVoice ? "voice" : draft.freeText.trim() ? "text" : "form",
          idempotencyKey: draft.idempotencyKey,
          photoIds: draft.photos.map((p) => p.id),
          prefilled,
        },
      });
      storage()?.removeItem(storageKey);
      setResult(res);
      setStep("done");
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === "duplicate_inflight" && retry < 2) {
        await new Promise((r) => setTimeout(r, 1500));
        return send(retry + 1);
      }
      setSendError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function startOver() {
    storage()?.removeItem(storageKey);
    setDraft(freshDraft());
    setPreview(null);
    setResult(null);
    setRestored(false);
    setStep("compose");
  }

  const showUrgentLive = step === "compose" && (liveTriage.level === "urgent" || liveTriage.actions.includes("mental_health"));

  return (
    <div ref={topRef} className="mx-auto grid max-w-2xl scroll-mt-20 gap-6">
      {!online && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber/50 bg-amber-soft p-4 text-sm">
          <WifiOff className="mt-0.5 size-4 shrink-0" />
          {t("common.offline")}
        </div>
      )}

      {step === "compose" && (
        <>
          <header>
            <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{t("checkin.title")}</h1>
            <p className="mt-1 text-muted-foreground">{t("checkin.subtitle")}</p>
            {caregiverFor && (
              <p className="mt-3 rounded-xl bg-mint px-3 py-2 text-sm text-primary">
                {t("checkin.asCaregiver")} <b>{caregiverFor}</b>
              </p>
            )}
            {restored && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm">
                <span>{locale === "hi" ? "आपका न भेजा गया ड्राफ़्ट वापस लाया गया।" : "We restored your unsent draft."}</span>
                <button type="button" onClick={startOver} className="font-medium text-muted-foreground hover:underline">
                  {locale === "hi" ? "हटाएं" : "Discard"}
                </button>
              </div>
            )}
          </header>

          {showUrgentLive && <UrgentPanel reasons={liveTriage.reasons} actions={liveTriage.actions} contacts={contacts} />}

          <section className="rounded-3xl border bg-card p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <VoiceInput lang={voiceLang} serverFallback={serverVoice} onText={appendVoice} onInterim={setInterim} />
              <div className="flex rounded-xl border p-1 text-xs">
                {(["en", "hi"] as const).map((l) => (
                  <button key={l} type="button" onClick={() => setVoiceLang(l)} aria-pressed={voiceLang === l} className={cn("h-8 rounded-lg px-2.5 font-semibold", voiceLang === l ? "bg-secondary text-secondary-foreground" : "text-muted-foreground")}>
                    {l === "en" ? "EN" : "हि"}
                  </button>
                ))}
              </div>
            </div>
            {interim && <p className="mb-2 px-1 text-sm text-muted-foreground italic">{interim}…</p>}
            <Textarea
              value={draft.freeText}
              onChange={(e) => setDraft((d) => ({ ...d, freeText: e.target.value.slice(0, 4000) }))}
              placeholder={t("checkin.placeholder")}
              rows={3}
              className="min-h-24 resize-y border-0 bg-transparent p-1 text-base shadow-none focus-visible:ring-0"
              aria-label={t("checkin.title")}
              lang={locale}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <PhotoPicker photos={draft.photos} onChange={(photos) => setDraft((d) => ({ ...d, photos }))} disabled={!online} />
              <span className="text-xs text-muted-foreground tabular-nums">{draft.freeText.length}/4000</span>
            </div>
          </section>

          <section className="grid gap-3">
            <h2 className="font-heading text-lg font-semibold">{t("checkin.quick")}</h2>
            <PainPicker value={draft.fields.pain} onChange={(v) => setField("pain", v)} />
            {showMoreDetails ? (
              <>
                <ScalePicker domain="appetite" value={draft.fields.appetite} onChange={(v) => setField("appetite", v)} />
                <ScalePicker domain="nausea" value={draft.fields.nausea} onChange={(v) => setField("nausea", v)} />
                <ScalePicker domain="mobility" value={draft.fields.mobility} onChange={(v) => setField("mobility", v)} />
                <ScalePicker domain="sleep" value={draft.fields.sleep} onChange={(v) => setField("sleep", v)} />
                <ScalePicker domain="mood" value={draft.fields.mood} onChange={(v) => setField("mood", v)} />
                <ScalePicker domain="anxiety" value={draft.fields.anxiety} onChange={(v) => setField("anxiety", v)} />
                <WoundPicker value={draft.fields.wound} onChange={(v) => setField("wound", v)} />
                <TemperatureInput value={draft.fields.temperatureC} onChange={(v) => setField("temperatureC", v)} />
                <MedsPicker value={draft.fields.medsTaken} onChange={(v) => setField("medsTaken", v)} />
                <button
                  type="button"
                  onClick={() => setShowMoreDetails(false)}
                  className="justify-self-start text-sm font-medium text-muted-foreground hover:underline"
                >
                  {t("checkin.hideDetails")}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowMoreDetails(true)}
                className="rounded-2xl border border-dashed px-4 py-3 text-left text-sm font-medium text-primary hover:bg-mint/40"
              >
                {t("checkin.moreDetails")}
              </button>
            )}
          </section>

          <div className="safe-bottom sticky bottom-20 z-20 -mx-1 lg:bottom-4">
            <Button size="lg" className="w-full shadow-lg shadow-primary/20" onClick={goReview} disabled={busy !== null || !online}>
              {busy === "preview" ? <Loader2 className="animate-spin" /> : <ClipboardList />}
              {busy === "preview" ? (locale === "hi" ? "पढ़ रहे हैं…" : "Reading your words…") : t("checkin.review")}
            </Button>
          </div>
        </>
      )}

      {step === "review" && (
        <>
          <header className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={() => setStep("compose")} aria-label={t("common.back")}>
              <ArrowLeft />
            </Button>
            <div>
              <h1 className="font-heading text-2xl font-bold text-navy">{t("checkin.reviewTitle")}</h1>
              <p className="mt-1 text-muted-foreground">{t("checkin.reviewBody")}</p>
            </div>
          </header>

          {(reviewTriage.level === "urgent" || reviewTriage.actions.includes("mental_health")) && (
            <UrgentPanel reasons={reviewTriage.reasons} actions={reviewTriage.actions} contacts={contacts} />
          )}

          {draft.freeText.trim() && (
            <section className="rounded-3xl border bg-card p-5">
              <p className="text-sm font-medium text-muted-foreground">{locale === "hi" ? "आपने लिखा" : "You wrote"}</p>
              <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-wrap" lang={locale}>
                {draft.freeText}
              </p>
              {preview?.draft.summary && (
                <div className="mt-4 flex gap-3 rounded-2xl bg-mint p-4 text-sm">
                  <Stethoscope className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <p className="font-semibold text-primary">{locale === "hi" ? "केयर टीम के लिए सार" : "Summary for your care team"}</p>
                    <p className="mt-1">{preview.draft.summary}</p>
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Sparkles className="size-3" />
                      {preview.draft.source === "ai" ? (locale === "hi" ? "AI द्वारा व्यवस्थित" : "Organised by AI") : locale === "hi" ? "स्वचालित रूप से व्यवस्थित" : "Organised automatically"} · {t("ai.disclaimer")}
                    </p>
                  </div>
                </div>
              )}
              {previewFailed && (
                <p className="mt-4 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                  {locale === "hi"
                    ? "अभी आपके शब्द अपने-आप नहीं पढ़े जा सके। कृपया नीचे जो हो सके वह भरें। आपका लिखा हुआ टीम तक पहुँचेगा।"
                    : "We couldn't read your words automatically just now. Please fill in what you can below. Your own words will still reach your team."}
                </p>
              )}
            </section>
          )}

          <section className="grid gap-3">
            <PainPicker value={reviewFields.pain} onChange={(v) => setReviewField("pain", v)} prefilled={preview?.prefilled.includes("pain")} />
            {(["appetite", "nausea", "mobility", "sleep", "mood", "anxiety"] as const).map((d) => (
              <ScalePicker key={d} domain={d} value={reviewFields[d]} onChange={(v) => setReviewField(d, v)} prefilled={preview?.prefilled.includes(d)} />
            ))}
            <WoundPicker value={reviewFields.wound} onChange={(v) => setReviewField("wound", v)} prefilled={preview?.prefilled.includes("wound")} />
            <TemperatureInput key={`temp-${preview?.fields.temperatureC ?? "x"}`} value={reviewFields.temperatureC} onChange={(v) => setReviewField("temperatureC", v)} prefilled={preview?.prefilled.includes("temperatureC")} />
            <MedsPicker value={reviewFields.medsTaken} onChange={(v) => setReviewField("medsTaken", v)} prefilled={preview?.prefilled.includes("medsTaken")} />
          </section>

          {draft.photos.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {draft.photos.length} {locale === "hi" ? "फ़ोटो साथ भेजी जाएंगी" : draft.photos.length === 1 ? "photo will be sent" : "photos will be sent"}
            </p>
          )}

          {sendError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <span>{sendError}</span>
              <Button size="sm" variant="outline" onClick={() => send()}>
                <RotateCcw /> {t("common.retry")}
              </Button>
            </div>
          )}

          <div className="safe-bottom sticky bottom-20 z-20 grid gap-2 lg:bottom-4">
            <Button size="lg" className="w-full shadow-lg shadow-primary/20" onClick={() => send()} disabled={busy !== null || !online}>
              {busy === "send" ? <Loader2 className="animate-spin" /> : <Send />}
              {busy === "send" ? t("checkin.sending") : t("checkin.send")}
            </Button>
          </div>
          {!aiOn && (
            <p className="text-center text-xs text-muted-foreground">
              {locale === "hi" ? "AI बंद है, सेटिंग्स में बदल सकते हैं।" : "AI organising is off. You can change this in Settings."}
            </p>
          )}
        </>
      )}

      {step === "done" && result && (
        <section className="grid gap-5">
          <div className="rounded-3xl border bg-card p-6 text-center">
            <CheckCircle2 className="mx-auto size-14 text-primary" />
            <h1 className="mt-4 font-heading text-2xl font-bold text-navy">{t("checkin.sentTitle")}</h1>
            <p className="mt-2 text-muted-foreground">{t("checkin.sentBody")}</p>
            <span className={cn("mt-4 inline-block rounded-full border px-3 py-1 text-sm font-medium", TRIAGE_STYLE[result.triage.level].className)}>
              {TRIAGE_STYLE[result.triage.level][locale]}
            </span>
            {result.triage.level === "review" && <p className="mx-auto mt-4 max-w-md text-[15px]">{t("checkin.reviewSent")}</p>}
          </div>

          {(result.triage.level === "urgent" || result.triage.actions.includes("mental_health")) && (
            <UrgentPanel reasons={result.triage.reasons} actions={result.triage.actions} contacts={contacts} />
          )}

          <div className="grid gap-3">
            <Button asChild size="lg" className="w-full">
              <Link href="/timeline">{t("home.seeStory")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full">
              <Link href="/home">{t("nav.home")}</Link>
            </Button>
          </div>
          <button type="button" onClick={startOver} className="text-sm font-medium text-primary hover:underline">
            {t("home.checkinAgain")}
          </button>
        </section>
      )}
    </div>
  );
}

const rank = (l: TriageResult["level"]) => ({ none: 0, watch: 1, review: 2, urgent: 3 })[l];

function mergeReasons(a: TriageResult, b: TriageResult) {
  const seen = new Set(a.reasons.map((r) => r.code));
  return [...a.reasons, ...b.reasons.filter((r) => !seen.has(r.code))].sort((x, y) => rank(y.level) - rank(x.level));
}
