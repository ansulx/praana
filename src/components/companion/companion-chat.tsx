"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUp, BookOpen, Loader2, Send, ShieldAlert, Sparkles, Square, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLocale, useT } from "@/components/providers/locale-provider";
import type { HelpContacts } from "@/components/patient/help-now";
import { askCareTeam } from "@/server/actions/patient";

type Msg = { id: string; role: "user" | "assistant"; content: string; flagged?: string; source?: string | null; sources?: { slug: string; title: string }[]; pending?: boolean };

const SUGGESTIONS = {
  en: ["What should I eat to heal well?", "How do I look after my drain?", "I feel anxious about my results", "Tips for sleeping after surgery"],
  hi: ["ठीक होने के लिए क्या खाऊँ?", "ड्रेन की देखभाल कैसे करूँ?", "रिपोर्ट को लेकर घबराहट हो रही है", "सर्जरी के बाद नींद के लिए सुझाव"],
};

/** Tiny, safe renderer: paragraphs, "- " bullets and **bold**. No HTML injection. */
function Rich({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>));
  return (
    <div className="grid gap-2">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-•*]\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-•*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {inline(b)}
          </p>
        );
      })}
    </div>
  );
}

export function CompanionChat({ initial, aiOn, contacts }: { initial: Msg[]; aiOn: boolean; contacts: HelpContacts }) {
  const locale = useLocale();
  const t = useT();
  const hi = locale === "hi";
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentToTeam, setSentToTeam] = useState<Set<string>>(new Set());
  const [, start] = useTransition();
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    if (!navigator.onLine) {
      toast.error(t("common.offline"));
      return;
    }
    setInput("");
    setBusy(true);
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: message };
    const botId = `a-${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: botId, role: "assistant", content: "", pending: true }]);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const update = (patch: Partial<Msg>) => setMessages((m) => m.map((x) => (x.id === botId ? { ...x, ...patch } : x)));

    try {
      const res = await fetch("/api/companion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }), signal: ctrl.signal });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) window.location.href = "/login?next=/companion";
        throw new Error((data as { error?: string }).error ?? "Something went wrong.");
      }
      const type = res.headers.get("content-type") ?? "";
      if (type.includes("application/json")) {
        const data = (await res.json()) as { mode: string; text: string; sources?: Msg["sources"] };
        update({ content: data.text, pending: false, source: data.mode, flagged: data.mode === "safety" ? "urgent" : undefined, sources: data.sources });
      } else {
        let sources: Msg["sources"] = [];
        try {
          sources = JSON.parse(decodeURIComponent(res.headers.get("x-praana-sources") ?? "%5B%5D"));
        } catch {
          /* ignore */
        }
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          update({ content: acc });
        }
        update({ pending: false, source: "ai", sources });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") update({ pending: false, content: (messages.find((x) => x.id === botId)?.content ?? "") || (hi ? "(रोक दिया)" : "(stopped)") });
      else update({ pending: false, content: (err as Error).message, flagged: "error" });
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  const sendToTeam = (m: Msg) =>
    start(async () => {
      const r = await askCareTeam(m.content);
      if (r.ok) {
        setSentToTeam((s) => new Set(s).add(m.id));
        toast.success(r.message);
      } else toast.error(r.error);
    });

  return (
    <div className="mx-auto flex h-[calc(100dvh-10.5rem)] max-w-2xl flex-col lg:h-[calc(100dvh-6.5rem)]">
      <header className="mb-3">
        <h1 className="font-heading text-2xl font-bold text-navy">{hi ? "PRAANA से पूछें" : "Ask PRAANA"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {hi ? "रिकवरी से जुड़े सामान्य सवाल। " : "General recovery questions. "}
          {t("ai.disclaimer")}
        </p>
        {!aiOn && (
          <p className="mt-2 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
            <BookOpen className="size-3.5" /> {hi ? "जवाब PRAANA की रिकवरी जानकारी से आते हैं।" : "Answers come from PRAANA's reviewed recovery library."}
          </p>
        )}
      </header>

      <div className="-mx-1 flex-1 overflow-y-auto px-1" aria-live="polite">
        {messages.length === 0 && (
          <div className="grid gap-4 py-6">
            <div className="rounded-3xl border bg-mint p-5">
              <Sparkles className="size-6 text-primary" />
              <p className="mt-3 font-semibold">{hi ? "नमस्ते! मैं आपकी रिकवरी में मदद के लिए हूँ।" : "Namaste! I'm here to help with your recovery."}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {hi ? "खाने, चलने-फिरने, नींद, ड्रेन या मन की बातों के बारे में पूछें।" : "Ask about eating, moving, sleep, drain care, or how you're feeling."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS[locale].map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border bg-card px-4 py-2 text-sm hover:border-primary/50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <ul className="grid gap-4 py-2">
          {messages.map((m) =>
            m.role === "user" ? (
              <li key={m.id} className="flex flex-col items-end gap-1">
                <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-primary px-4 py-3 text-[15px] text-primary-foreground whitespace-pre-wrap">{m.content}</div>
                <button
                  onClick={() => sendToTeam(m)}
                  disabled={sentToTeam.has(m.id)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary disabled:text-primary"
                >
                  <UserRound className="size-3" /> {sentToTeam.has(m.id) ? (hi ? "टीम को भेजा" : "Sent to team") : hi ? "टीम को भेजें" : "Send to my care team"}
                </button>
              </li>
            ) : (
              <li key={m.id} className="flex gap-3">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", m.flagged === "urgent" ? "bg-destructive text-white" : "bg-mint text-primary")}>
                  {m.flagged === "urgent" ? <ShieldAlert className="size-4" /> : <Sparkles className="size-4" />}
                </span>
                <div
                  className={cn(
                    "max-w-[85%] rounded-3xl rounded-tl-lg border px-4 py-3 text-[15px] leading-relaxed",
                    m.flagged === "urgent" ? "border-destructive/40 bg-destructive/5" : m.flagged === "error" ? "border-dashed text-muted-foreground" : "bg-card",
                  )}
                >
                  {m.pending && !m.content ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <Rich text={m.content} />}
                  {m.flagged === "urgent" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {contacts.primary && (
                        <a href={`tel:${contacts.primary.phone.replace(/[^\d+]/g, "")}`} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
                          {t("urgent.callTeam")}
                        </a>
                      )}
                      <a href={`tel:${contacts.emergency}`} className="rounded-lg bg-destructive px-3 py-2 text-sm font-semibold text-white">
                        {t("urgent.callEmergency")} {contacts.emergency}
                      </a>
                      <a href={`tel:${contacts.helpline}`} className="rounded-lg border px-3 py-2 text-sm font-semibold">
                        {contacts.helplineName} {contacts.helpline}
                      </a>
                    </div>
                  )}
                  {!!m.sources?.length && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                      {m.sources.map((s) => (
                        <Link key={s.slug} href={`/learn/${s.slug}`} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs hover:bg-accent">
                          <BookOpen className="size-3" /> {s.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ),
          )}
        </ul>
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex items-end gap-2 rounded-3xl border bg-card p-2"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 2000))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder={hi ? "अपना सवाल लिखें…" : "Type your question…"}
          className="max-h-40 min-h-11 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          aria-label={hi ? "आपका सवाल" : "Your question"}
        />
        {busy ? (
          <Button type="button" size="icon" variant="outline" onClick={() => abortRef.current?.abort()} aria-label="Stop">
            <Square />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!input.trim()} aria-label={hi ? "भेजें" : "Send"}>
            {input.trim() ? <ArrowUp /> : <Send />}
          </Button>
        )}
      </form>
    </div>
  );
}
