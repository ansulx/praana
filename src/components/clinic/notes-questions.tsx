"use client";

import { useState } from "react";
import { Eye, Lock, MessageCircleQuestion, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { fmtDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { addNote, answerQuestion } from "@/server/actions/clinic";
import { useAction } from "./use-action";

export type NoteItem = { id: string; body: string; visibility: "team" | "shared"; createdAt: Date; author: string | null; careRole: string | null };

export function NotesPanel({ patientId, notes }: { patientId: string; notes: NoteItem[] }) {
  const { pending, run } = useAction();
  const [body, setBody] = useState("");
  const [shared, setShared] = useState(false);

  return (
    <div className="grid gap-4">
      <form
        className="grid gap-3 rounded-xl border bg-muted/30 p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => addNote(patientId, body, shared ? "shared" : "team"))) {
            setBody("");
            setShared(false);
          }
        }}
      >
        <Label htmlFor="note-body" className="sr-only">
          New note
        </Label>
        <Textarea id="note-body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note…" rows={3} maxLength={4000} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={shared} onCheckedChange={setShared} />
            {shared ? (
              <span className="flex items-center gap-1 font-medium text-primary">
                <Eye className="size-4" /> Visible to patient &amp; family
              </span>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Lock className="size-4" /> Team only
              </span>
            )}
          </label>
          <Button type="submit" size="sm" disabled={pending || body.trim().length < 2}>
            Save note
          </Button>
        </div>
        {shared && <p className="text-xs text-muted-foreground">Shared notes appear on the patient&apos;s Today screen. Write in plain language.</p>}
      </form>

      {notes.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ol className="grid gap-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl border p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{n.author ?? "Former team member"}</span>
                {n.careRole && <span className="capitalize">· {n.careRole}</span>}
                <span>· {fmtDateTime(n.createdAt)}</span>
                <span className={cn("ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5", n.visibility === "shared" ? "bg-mint text-primary" : "bg-muted")}>
                  {n.visibility === "shared" ? <Eye className="size-3" /> : <Lock className="size-3" />}
                  {n.visibility === "shared" ? "Shared" : "Team"}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{n.body}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export type QuestionItem = {
  id: string;
  question: string;
  answer: string | null;
  answeredAt: Date | null;
  createdAt: Date;
  askedBy: string | null;
  askedRole: string | null;
  answeredBy: string | null;
};

export function QuestionsPanel({ questions }: { questions: QuestionItem[] }) {
  if (!questions.length) return <p className="py-6 text-center text-sm text-muted-foreground">No questions from the patient or family.</p>;
  const open = questions.filter((q) => !q.answer);
  const done = questions.filter((q) => q.answer);
  return (
    <div className="grid gap-3">
      {[...open, ...done].map((q) => (
        <QuestionRow key={q.id} q={q} />
      ))}
    </div>
  );
}

function QuestionRow({ q }: { q: QuestionItem }) {
  const { pending, run } = useAction();
  const [answer, setAnswer] = useState("");
  return (
    <div className={cn("rounded-xl border p-3", !q.answer && "border-primary/40 bg-accent/40")}>
      <div className="flex items-start gap-2">
        <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium whitespace-pre-wrap">{q.question}</p>
          <p className="text-xs text-muted-foreground">
            {q.askedBy ?? "Unknown"} {q.askedRole === "caregiver" ? "(caregiver)" : ""} · {fmtDateTime(q.createdAt)}
          </p>
        </div>
      </div>
      {q.answer ? (
        <div className="mt-2 ml-6 rounded-lg bg-mint p-2.5 text-sm">
          <p className="whitespace-pre-wrap">{q.answer}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {q.answeredBy ?? "Care team"} · {q.answeredAt ? fmtDateTime(q.answeredAt) : ""}
          </p>
        </div>
      ) : (
        <form
          className="mt-2 ml-6 grid gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => answerQuestion(q.id, answer))) setAnswer("");
          }}
        >
          <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Write a reply the patient will see…" rows={2} maxLength={2000} aria-label="Answer" />
          <Button type="submit" size="sm" className="justify-self-end" disabled={pending || answer.trim().length < 2}>
            <Send />
            Send answer
          </Button>
        </form>
      )}
    </div>
  );
}
