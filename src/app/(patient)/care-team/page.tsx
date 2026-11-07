import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, Phone, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { careRoleLabel } from "@/lib/labels";
import { relativeTime } from "@/lib/dates";
import { getActivePatient } from "@/server/auth/access";
import { requireUser } from "@/server/auth/session";
import { getCareTeam, getTeamQuestions } from "@/server/services/patient";
import { AddContactDialog, AskTeamForm } from "./care-team-forms";

export const metadata: Metadata = { title: "Care team" };

const tel = (n: string) => `tel:${n.replace(/[^\d+]/g, "")}`;

export default async function CareTeamPage() {
  const user = await requireUser(["patient", "caregiver"]);
  const ctx = await getActivePatient(user);
  if (!ctx) notFound();
  const hi = user.locale === "hi";
  const [team, questions] = await Promise.all([getCareTeam(ctx.patient.id), getTeamQuestions(ctx.patient.id, 30)]);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold text-navy">{hi ? "मेरी केयर टीम" : "My care team"}</h1>
          <p className="mt-1 text-muted-foreground">{hi ? "किसे, कब कॉल करें।" : "Who to call, and when."}</p>
        </div>
        {user.role === "patient" && <AddContactDialog />}
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {team.length === 0 && (
          <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground sm:col-span-2">
            {hi ? "अभी कोई संपर्क नहीं। अस्पताल से मिले नंबर जोड़ें।" : "No contacts yet. Add the numbers your hospital gave you."}
          </p>
        )}
        {team.map((m) => (
          <Card key={m.id} className={m.isPrimaryContact ? "border-primary/40" : undefined}>
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{m.name}</p>
                  {m.isPrimaryContact && (
                    <Badge className="bg-mint text-primary">
                      <Star /> {hi ? "पहला संपर्क" : "First contact"}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{careRoleLabel(m.role, user.locale)}</p>
                {m.availability && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" /> {m.availability}
                  </p>
                )}
              </div>
              {m.phone && (
                <a href={tel(m.phone)} className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground" aria-label={`Call ${m.name}`}>
                  <Phone className="size-5" />
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{hi ? "टीम से पूछें" : "Ask your care team"}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {hi
              ? "ग़ैर-ज़रूरी सवालों के लिए। टीम आमतौर पर एक कार्यदिवस में जवाब देती है। ज़रूरी बात हो तो कॉल करें।"
              : "For non-urgent questions. A person from your team usually replies within a working day. For anything urgent, call."}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <AskTeamForm />
          <ul className="grid gap-3">
            {questions.map((q) => (
              <li key={q.id} className="rounded-2xl border p-4">
                <p className="font-medium">{q.question}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {relativeTime(q.createdAt)}
                  {q.askedBy !== user.id && (hi ? " · परिवार ने पूछा" : " · asked by family")}
                </p>
                {q.answer ? (
                  <div className="mt-3 rounded-xl bg-mint p-3 text-sm leading-relaxed">{q.answer}</div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground italic">{hi ? "जवाब का इंतज़ार…" : "Waiting for a reply…"}</p>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
