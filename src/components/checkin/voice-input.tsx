"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/providers/locale-provider";
import { api } from "@/lib/client/api";

/* Minimal typings for the Web Speech API (not in lib.dom for all TS versions). */
type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const MAX_RECORD_MS = 120_000;

/**
 * Voice typing. Prefers the browser's own speech recognition (fast, free, on-device on many
 * phones); falls back to recording + server transcription when allowed; otherwise hides itself.
 */
export function VoiceInput({
  lang,
  serverFallback,
  onText,
  onInterim,
  disabled,
}: {
  lang: "en" | "hi";
  serverFallback: boolean;
  onText: (text: string) => void;
  onInterim?: (text: string) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const [mode, setMode] = useState<"native" | "server" | "none" | null>(null);
  const [state, setState] = useState<"idle" | "listening" | "transcribing">("idle");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Decide after mount to avoid hydration mismatch.
    const native = getRecognition();
    const canRecord = typeof window !== "undefined" && "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia;
    setMode(native ? "native" : serverFallback && canRecord ? "server" : "none");
  }, [serverFallback]);

  useEffect(
    () => () => {
      recRef.current?.abort();
      if (mediaRef.current?.state === "recording") mediaRef.current.stop();
      if (stopTimer.current) clearTimeout(stopTimer.current);
    },
    [],
  );

  const startNative = useCallback(() => {
    const Ctor = getRecognition();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang === "hi" ? "hi-IN" : "en-IN";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onText(r[0].transcript.trim());
        else interim += r[0].transcript;
      }
      onInterim?.(interim);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast.error("Microphone access is blocked. Allow it in your browser settings, or type instead.");
      } else if (e.error === "network") {
        toast.error("Voice typing needs an internet connection. Please type instead.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        toast.error("Voice typing stopped. You can try again or type.");
      }
    };
    rec.onend = () => {
      onInterim?.("");
      setState("idle");
    };
    recRef.current = rec;
    try {
      rec.start();
      setState("listening");
    } catch {
      setState("idle");
    }
  }, [lang, onInterim, onText]);

  const startServer = useCallback(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Microphone access is blocked. Allow it in your browser settings, or type instead.");
      return;
    }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((tr) => tr.stop());
      if (stopTimer.current) clearTimeout(stopTimer.current);
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      if (blob.size < 1200) {
        setState("idle");
        return;
      }
      setState("transcribing");
      try {
        const fd = new FormData();
        fd.append("audio", blob, "checkin");
        fd.append("lang", lang);
        const { text } = await api<{ text: string }>("/api/transcribe", { method: "POST", body: fd, timeoutMs: 45_000 });
        if (text) onText(text);
        else toast.message("We couldn't make out any words. Please try again closer to the phone.");
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setState("idle");
      }
    };
    mediaRef.current = rec;
    rec.start();
    setState("listening");
    stopTimer.current = setTimeout(() => rec.state === "recording" && rec.stop(), MAX_RECORD_MS);
  }, [lang, onText]);

  const stop = () => {
    recRef.current?.stop();
    if (mediaRef.current?.state === "recording") mediaRef.current.stop();
  };

  if (mode === null || mode === "none") return null;

  return (
    <Button
      type="button"
      size="lg"
      variant={state === "listening" ? "destructive" : "default"}
      disabled={disabled || state === "transcribing"}
      onClick={() => (state === "listening" ? stop() : mode === "native" ? startNative() : startServer())}
      aria-pressed={state === "listening"}
      className={cn("min-w-40", state === "listening" && "animate-pulse")}
    >
      {state === "transcribing" ? <Loader2 className="animate-spin" /> : state === "listening" ? <Square /> : <Mic />}
      {state === "listening" ? t("checkin.stop") : state === "transcribing" ? t("common.loading") : t("checkin.speak")}
    </Button>
  );
}
