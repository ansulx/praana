import Link from "next/link";
import { ArrowRight, AudioLines, Camera, CheckCircle2, HeartHandshake, LineChart, MessageSquareText, ShieldCheck, Sparkles, Stethoscope, UsersRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getSessionUser, homeFor } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const STAGES = [
  { n: 1, title: "Meet my care team", body: "Surgery plan, expectations, who to call." },
  { n: 2, title: "Prepare myself", body: "Nutrition, movement, breathing, a calmer mind." },
  { n: 3, title: "Go through surgery", body: "Clarity on the day, a discharge plan you understand." },
  { n: 4, title: "Recover at home", body: "Daily support, and someone watching the story." },
  { n: 5, title: "Back to what matters", body: "Strength, confidence, life beyond surgery." },
];

const STEPS = [
  { icon: MessageSquareText, title: "Check in your way", body: "Type, speak or add a photo, in English, Hindi or both. Family can check in too." },
  { icon: Sparkles, title: "AI organises the story", body: "Free text becomes pain, eating, sleep, wound and mood on a living timeline." },
  { icon: ShieldCheck, title: "Safety checks run first", body: "Warning signs are caught by fixed rules, every time, even offline, and you're told what to do now." },
  { icon: Stethoscope, title: "A person reviews", body: "Your care team sees a concise update and decides what happens next." },
];

export default async function Landing() {
  const user = await getSessionUser();
  const cta = user ? { href: homeFor(user.role), label: "Open PRAANA" } : { href: "/register", label: "Get started" };

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav className="flex items-center gap-2">
          {!user && (
            <Button asChild variant="ghost">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
          <Button asChild>
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-10 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-mint px-3 py-1 text-sm font-medium text-primary">
            <HeartHandshake className="size-4" /> For people having cancer surgery, and their families
          </p>
          <h1 className="mt-6 font-heading text-4xl leading-[1.1] font-bold text-balance text-navy sm:text-5xl lg:text-6xl">
            Recovery happens <span className="text-primary">between visits.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            After surgery you go home, and the care team sees only the next appointment. PRAANA keeps you, your family and your care team
            connected every day, from before the operation to life after it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={cta.href}>
                {cta.label} <ArrowRight />
              </Link>
            </Button>
            {!user && (
              <Button asChild size="lg" variant="outline">
                <Link href="/register?role=clinician">I&apos;m a clinician</Link>
              </Button>
            )}
          </div>
          <p className="mt-6 text-sm text-muted-foreground" lang="hi">
            अस्पताल से घर तक। आपकी रिकवरी अब अनदेखी नहीं रहेगी।
          </p>
        </div>

        <div className="relative">
          <div className="rounded-3xl border bg-card p-5 shadow-xl shadow-primary/5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">Day 6 after surgery</span>
              <span className="rounded-full bg-mint px-2.5 py-1 text-xs font-semibold text-primary">Steady</span>
            </div>
            <p className="mt-4 rounded-2xl bg-muted p-4 text-[15px] leading-relaxed">
              “Feeling better today. Pain about 3. Walked to the gate and back. Drain only 30 ml. A bit worried about the pathology report.”
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              {[
                ["Pain", "3/10", "↓ from 6"],
                ["Eating", "Little less", "↑ better"],
                ["Moving", "Walking", "↑ better"],
              ].map(([k, v, d]) => (
                <div key={k} className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">{k}</div>
                  <div className="font-semibold">{v}</div>
                  <div className="text-xs text-primary">{d}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-primary/20 bg-mint p-4 text-sm">
              <Stethoscope className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <b>For the care team:</b> Improving pain and mobility; drain output falling. Mentions worry about results.
              </span>
            </div>
          </div>
          <div className="absolute -bottom-6 -left-4 hidden rounded-2xl border bg-card px-4 py-3 shadow-lg sm:flex sm:items-center sm:gap-3">
            <AudioLines className="size-5 text-primary" />
            <Camera className="size-5 text-primary" />
            <span className="text-sm font-medium">Speak, type or snap a photo</span>
          </div>
        </div>
      </section>

      <section className="border-y bg-mint/60 py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-heading text-3xl font-bold text-navy">The whole journey, not just the follow-up</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-5">
            {STAGES.map((s) => (
              <li key={s.n} className="rounded-2xl border bg-card p-5">
                <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{s.n}</span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="font-heading text-3xl font-bold text-navy">How PRAANA works</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.title}>
              <span className="grid size-12 place-items-center rounded-2xl bg-mint text-primary">
                <s.icon className="size-6" />
              </span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {[
            { icon: UsersRound, title: "Patient & family", items: ["Check in by text, voice or photo", "Guided breathing, yoga & physio", "Live tele-physiotherapy", "Medicine reminders"] },
            { icon: LineChart, title: "Living recovery record", items: ["Day-by-day timeline", "Original words kept alongside scores", "Wound photos in context", "Shareable with the whole team"] },
            { icon: Stethoscope, title: "Care team", items: ["Worklist sorted by who needs review", "Quiet patients surface too", "Trends before the follow-up", "Notes & answers back to families"] },
          ].map((c) => (
            <div key={c.title} className="rounded-3xl border bg-card p-6">
              <c.icon className="size-6 text-primary" />
              <h3 className="mt-3 font-heading text-lg font-semibold">{c.title}</h3>
              <ul className="mt-4 grid gap-2 text-sm">
                {c.items.map((i) => (
                  <li key={i} className="flex gap-2">
                    <CheckCircle2 className="size-4 shrink-0 translate-y-0.5 text-primary" /> {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-navy py-16 text-white dark:bg-card">
        <div className="mx-auto max-w-4xl px-5 text-center">
          <p className="font-heading text-2xl font-semibold text-balance sm:text-3xl">AI listens, structures, and connects. Humans make clinical decisions.</p>
          <p className="mx-auto mt-4 max-w-2xl text-white/70">
            PRAANA does not diagnose, prescribe or replace your doctor, and it is not an emergency service. In an emergency, call 112.
          </p>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row">
        <Logo />
        <span>Supporting life beyond surgery.</span>
      </footer>
    </div>
  );
}
