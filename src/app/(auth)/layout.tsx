import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-mint lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Link href="/">
          <Logo />
        </Link>
        <div className="relative z-10 max-w-md">
          <p className="mb-4 text-sm font-semibold tracking-[0.16em] text-coral uppercase">The continuity gap</p>
          <h2 className="font-heading text-4xl leading-tight font-bold text-balance text-navy">
            The patient goes home. The recovery continues.
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            PRAANA turns the days between visits into a continuous, shareable recovery story, organised by AI, reviewed by people.
          </p>
          <p className="mt-8 text-lg text-navy" lang="hi">
            ऑपरेशन तो हो गया… अब आगे क्या? किससे पूछें?
          </p>
        </div>
        <p className="relative z-10 text-sm text-muted-foreground">AI listens, structures, and connects. Humans make clinical decisions.</p>
        <svg aria-hidden className="absolute -right-24 bottom-0 h-[70%] text-primary/10" viewBox="0 0 200 400" fill="currentColor">
          <path d="M100 400V180c0-60 30-110 0-180-30 70 0 120 0 180Z" />
          <path d="M100 240c-50-4-95-30-110-90 55-4 95 34 110 90Z" />
          <path d="M100 240c50-4 95-30 110-90-55-4-95 34-110 90Z" />
        </svg>
      </aside>
      <main className="flex flex-col px-5 py-8 sm:px-10">
        <Link href="/" className="mb-10 lg:hidden">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">{children}</div>
      </main>
    </div>
  );
}
