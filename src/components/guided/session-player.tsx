"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, HeartPulse, Pause, Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { FOLLOW_TEAM_NOTE, type GuidedSession, type GuidedStep } from "@/content/guided";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLocale } from "@/components/providers/locale-provider";
import { logSessionCompletion } from "@/server/actions/guided";

type Phase = "intro" | "running" | "unwell" | "finished";
type Felt = "better" | "same" | "worse";

const T = {
  start: { en: "Start session", hi: "शुरू करें" },
  pause: { en: "Pause", hi: "रोकें" },
  resume: { en: "Resume", hi: "जारी रखें" },
  back: { en: "Previous", hi: "पिछला" },
  skip: { en: "Next", hi: "अगला" },
  unwell: { en: "Stop. I feel unwell", hi: "रोकें, तबीयत ठीक नहीं" },
  readAloud: { en: "Read aloud", hi: "पढ़कर सुनाएं" },
  step: { en: "Step", hi: "चरण" },
  of: { en: "of", hi: "में से" },
  reps: { en: "repeats", hi: "बार" },
  safety: { en: "Before you start", hi: "शुरू करने से पहले" },
  doneTitle: { en: "Well done", hi: "बहुत अच्छा" },
  doneBody: { en: "How do you feel now?", hi: "अब आप कैसा महसूस कर रहे हैं?" },
  better: { en: "Better", hi: "बेहतर" },
  same: { en: "About the same", hi: "पहले जैसा" },
  worse: { en: "Worse", hi: "ख़राब" },
  saved: { en: "Saved to your recovery story", hi: "आपकी रिकवरी कहानी में सेव हुआ" },
  worseHint: { en: "Sorry it didn't feel good. Tell your care team how you are in a quick check-in.", hi: "अफ़सोस, अच्छा नहीं लगा। एक छोटे हाल में केयर टीम को बताएं।" },
  checkin: { en: "Check in now", hi: "अभी हाल बताएं" },
  library: { en: "Back to sessions", hi: "अभ्यास पर वापस" },
  unwellTitle: { en: "Stopping was the right thing to do", hi: "रुकना सही फ़ैसला था" },
  unwellBody: {
    en: "Sit or lie down somewhere safe and breathe slowly. If you have chest pain, trouble breathing, heavy bleeding or feel faint, use “Need help now?” at the top of the screen. Otherwise, tell your team how you feel.",
    hi: "किसी सुरक्षित जगह बैठें या लेटें और धीरे सांस लें। सीने में दर्द, सांस में तकलीफ़, बहुत ख़ून या बेहोशी जैसा लगे तो स्क्रीन के ऊपर “अभी मदद चाहिए?” दबाएं। वरना टीम को बताएं कि आप कैसा महसूस कर रहे हैं।",
  },
  again: { en: "Do it again", hi: "फिर से करें" },
  inhale: { en: "Breathe in", hi: "सांस लें" },
  hold: { en: "Hold", hi: "रोकें" },
  exhale: { en: "Breathe out", hi: "सांस छोड़ें" },
  rest: { en: "Rest", hi: "रुकें" },
  retry: { en: "Couldn't save. Try again?", hi: "सेव नहीं हुआ। फिर कोशिश करें?" },
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, "0")}`;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** Keeps the screen on during a session where supported; silently does nothing elsewhere. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const l = await navigator.wakeLock.request("screen");
        if (cancelled) void l.release();
        else lock = l;
      } catch {
        /* battery saver or unsupported — fine */
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}

type BreathPhase = { key: "inhale" | "hold" | "exhale" | "rest"; length: number; remaining: number };

function breathPhase(step: GuidedStep, elapsed: number): BreathPhase | null {
  const br = step.breath;
  if (!br) return null;
  const parts: { key: BreathPhase["key"]; length: number }[] = [
    { key: "inhale", length: br.inhale },
    ...(br.hold ? [{ key: "hold" as const, length: br.hold }] : []),
    { key: "exhale", length: br.exhale },
    ...(br.holdAfter ? [{ key: "rest" as const, length: br.holdAfter }] : []),
  ];
  const cycle = parts.reduce((a, p) => a + p.length, 0);
  let t = elapsed % cycle;
  for (const p of parts) {
    if (t < p.length) return { key: p.key, length: p.length, remaining: p.length - t };
    t -= p.length;
  }
  return { ...parts[0], remaining: parts[0].length };
}

export function SessionPlayer({ session }: { session: GuidedSession }) {
  const locale = useLocale();
  const reducedMotion = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  const [speechOk, setSpeechOk] = useState(false);
  const [now, setNow] = useState(0);
  const [felt, setFelt] = useState<Felt | null>(null);
  const [suggestCheckin, setSuggestCheckin] = useState(false);
  const [saving, startSaving] = useTransition();

  // Timing is derived from timestamps so throttled background tabs stay accurate.
  const stepAccum = useRef(0);
  const segStart = useRef<number | null>(null);
  const activeAccum = useRef(0);
  const skipped = useRef(0);

  const step = session.steps[index];
  const running = phase === "running" && !paused;
  useWakeLock(phase === "running");

  useEffect(() => {
    setSpeechOk(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  const liveMs = segStart.current !== null && running ? Math.max(0, now - segStart.current) : 0;
  const stepElapsed = (stepAccum.current + liveMs) / 1000;
  const remaining = Math.max(0, step.seconds - stepElapsed);

  const closeSegment = useCallback(() => {
    if (segStart.current !== null) {
      const d = performance.now() - segStart.current;
      stepAccum.current += d;
      activeAccum.current += d;
      segStart.current = null;
    }
  }, []);

  const goTo = useCallback(
    (i: number) => {
      closeSegment();
      stepAccum.current = 0;
      if (i >= session.steps.length) {
        setPhase("finished");
        return;
      }
      setIndex(Math.max(0, i));
      segStart.current = performance.now();
      setNow(performance.now());
    },
    [closeSegment, session.steps.length],
  );

  // Auto-advance when a step's time is up.
  useEffect(() => {
    if (running && remaining <= 0) goTo(index + 1);
  }, [running, remaining, index, goTo]);

  // Read the step aloud on change.
  useEffect(() => {
    if (!speechOk || !readAloud || phase !== "running" || paused) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(`${step.title[locale]}. ${step.text[locale]}`);
    u.lang = locale === "hi" ? "hi-IN" : "en-IN";
    u.rate = 0.9;
    synth.speak(u);
    return () => synth.cancel();
  }, [index, readAloud, speechOk, phase, paused, locale, step]);

  useEffect(() => () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const start = () => {
    stepAccum.current = 0;
    activeAccum.current = 0;
    skipped.current = 0;
    setIndex(0);
    setPaused(false);
    setFelt(null);
    setSuggestCheckin(false);
    segStart.current = performance.now();
    setNow(performance.now());
    setPhase("running");
  };

  const togglePause = useCallback(() => {
    if (phase !== "running") return;
    if (paused) {
      segStart.current = performance.now();
      setNow(performance.now());
      setPaused(false);
    } else {
      closeSegment();
      setPaused(true);
    }
  }, [phase, paused, closeSegment]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && phase === "running" && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, togglePause]);

  const save = (f: Felt | null, completedFully: boolean) =>
    logSessionCompletion({ slug: session.slug, durationSec: activeAccum.current / 1000, completedFully, feltAfter: f });

  const stopUnwell = () => {
    closeSegment();
    setPhase("unwell");
    if (activeAccum.current >= 10_000) {
      void save("worse", false).catch(() => undefined);
    }
  };

  const chooseFelt = (f: Felt) => {
    setFelt(f);
    startSaving(async () => {
      const res = await save(f, skipped.current === 0).catch(() => null);
      if (!res || !res.ok) {
        setFelt(null);
        toast.error(res && !res.ok ? res.error : T.retry[locale]);
        return;
      }
      setSuggestCheckin(!!res.data?.suggestCheckin);
      toast.success(T.saved[locale]);
    });
  };

  // ── Screens ──

  if (phase === "intro") {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border bg-coral-soft/60 p-4">
          <h2 className="text-sm font-semibold text-navy">{T.safety[locale]}</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-navy/90">
            {session.safety.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-coral" />
                {s[locale]}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">{FOLLOW_TEAM_NOTE[locale]}</p>
        </div>
        <ol className="space-y-2">
          {session.steps.map((s, i) => (
            <li key={i} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-mint text-xs font-semibold text-primary">{i + 1}</span>
              <span className="flex-1 text-sm font-medium">{s.title[locale]}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{fmt(s.seconds)}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button size="lg" onClick={start} className="w-full sm:w-auto">
            <Play />
            {T.start[locale]}
          </Button>
          {speechOk && (
            <Button variant="ghost" onClick={() => setReadAloud((v) => !v)} aria-pressed={readAloud}>
              {readAloud ? <Volume2 /> : <VolumeX />}
              {T.readAloud[locale]}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (phase === "unwell") {
    return (
      <div className="space-y-5 rounded-2xl border bg-card p-6 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-coral-soft text-coral">
          <HeartPulse className="size-7" />
        </span>
        <h2 className="text-xl font-semibold">{T.unwellTitle[locale]}</h2>
        <p className="mx-auto max-w-md text-muted-foreground">{T.unwellBody[locale]}</p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/check-in">{T.checkin[locale]}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/guided">{T.library[locale]}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="space-y-6 rounded-2xl border bg-card p-6 text-center">
        <h2 className="text-2xl font-semibold">{T.doneTitle[locale]}</h2>
        <p className="text-muted-foreground">{T.doneBody[locale]}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["better", "same", "worse"] as const).map((f) => (
            <Button
              key={f}
              size="lg"
              variant={felt === f ? "default" : "outline"}
              disabled={saving || felt !== null}
              onClick={() => chooseFelt(f)}
            >
              {T[f][locale]}
            </Button>
          ))}
        </div>
        {suggestCheckin && (
          <div className="rounded-xl bg-coral-soft p-4 text-left text-sm text-navy">
            <p>{T.worseHint[locale]}</p>
            <Button className="mt-3" asChild>
              <Link href="/check-in">{T.checkin[locale]}</Link>
            </Button>
          </div>
        )}
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button variant="ghost" onClick={start}>
            <RotateCcw />
            {T.again[locale]}
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/guided">{T.library[locale]}</Link>
          </Button>
        </div>
      </div>
    );
  }

  // running
  const bp = breathPhase(step, stepElapsed);
  const overall = ((index + Math.min(1, stepElapsed / step.seconds)) / session.steps.length) * 100;
  const scale = bp ? (bp.key === "inhale" ? 1 : bp.key === "exhale" ? 0.55 : null) : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {T.step[locale]} {index + 1} {T.of[locale]} {session.steps.length}
          </span>
          {speechOk && (
            <button type="button" onClick={() => setReadAloud((v) => !v)} aria-pressed={readAloud} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-muted">
              {readAloud ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              {T.readAloud[locale]}
            </button>
          )}
        </div>
        <Progress value={overall} aria-label="Session progress" />
      </div>

      <div className="flex flex-col items-center gap-6 rounded-3xl border bg-card px-5 py-8 text-center">
        <div className="relative grid size-56 place-items-center sm:size-64" aria-live="polite">
          {bp ? (
            <>
              <div
                aria-hidden
                className={cn("absolute inset-0 rounded-full bg-primary/15", paused && "opacity-60")}
                style={
                  reducedMotion
                    ? undefined
                    : {
                        transform: `scale(${scale ?? (bp.key === "hold" ? 1 : 0.55)})`,
                        transition: paused ? "none" : `transform ${bp.length}s ease-in-out`,
                      }
                }
              />
              <div aria-hidden className="absolute inset-[22%] rounded-full bg-primary/25" />
              <div className="relative">
                <p className="text-xl font-semibold text-primary">{T[bp.key][locale]}</p>
                <p className="mt-1 text-sm text-muted-foreground tabular-nums">{Math.ceil(bp.remaining)}</p>
              </div>
            </>
          ) : (
            <div className="grid size-full place-items-center rounded-full border-8 border-mint">
              <span className="text-5xl font-semibold tabular-nums text-navy">{fmt(Math.ceil(remaining))}</span>
            </div>
          )}
        </div>
        <div className="max-w-lg space-y-2">
          <h2 className="text-2xl font-semibold text-balance">{step.title[locale]}</h2>
          <p className="text-lg leading-relaxed text-muted-foreground">{step.text[locale]}</p>
          {step.reps && (
            <p className="text-sm font-medium text-primary">
              × {step.reps} {T.reps[locale]}
            </p>
          )}
          {bp && <p className="text-sm text-muted-foreground tabular-nums">{fmt(Math.ceil(remaining))}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Button variant="outline" size="lg" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label={T.back[locale]}>
          <ChevronLeft />
          <span className="hidden sm:inline">{T.back[locale]}</span>
        </Button>
        <Button size="lg" onClick={togglePause}>
          {paused ? <Play /> : <Pause />}
          {paused ? T.resume[locale] : T.pause[locale]}
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => {
            skipped.current += 1;
            goTo(index + 1);
          }}
          aria-label={T.skip[locale]}
        >
          <span className="hidden sm:inline">{T.skip[locale]}</span>
          <ChevronRight />
        </Button>
      </div>
      <Button variant="destructive" size="lg" className="w-full" onClick={stopUnwell}>
        <X />
        {T.unwell[locale]}
      </Button>
    </div>
  );
}
