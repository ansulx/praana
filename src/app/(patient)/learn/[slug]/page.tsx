import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, MessageCircleQuestion } from "lucide-react";
import { ARTICLES, DISCIPLINE_LABELS, getArticle } from "@/content/learn";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/auth/session";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = getArticle((await params).slug);
  return { title: a ? a.title.en : "Article" };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();
  const user = await requireUser(["patient", "caregiver"]);
  const locale = user.locale;
  const hi = locale === "hi";

  const related = ARTICLES.filter((a) => a.slug !== article.slug && a.stages.some((s) => article.stages.includes(s))).slice(0, 3);

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/learn">
          <ArrowLeft />
          {hi ? "सारी जानकारी" : "All articles"}
        </Link>
      </Button>

      <header className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">{DISCIPLINE_LABELS[article.discipline][locale]}</p>
        <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{article.title[locale]}</h1>
        {hi && <p className="text-sm text-muted-foreground">{article.title.en}</p>}
        <p className="text-lg text-muted-foreground">{article.summary[locale]}</p>
        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          {article.minutes} {hi ? "मिनट" : "min read"}
        </p>
        {hi && <p className="rounded-xl bg-amber-soft p-3 text-sm text-navy">नीचे का विवरण अभी अंग्रेज़ी में है। कोई सवाल हो तो “पूछें” में हिंदी में पूछ सकते हैं।</p>}
      </header>

      <div className="space-y-5">
        {article.sections.map((s) => (
          <section key={s.heading} className="space-y-1.5">
            <h2 className="text-lg font-semibold text-navy">{s.heading}</h2>
            <p className="leading-relaxed text-foreground/90">{s.body}</p>
          </section>
        ))}
      </div>

      <p className="border-t pt-4 text-xs text-muted-foreground">{article.reviewedNote}</p>

      <div className="flex flex-col gap-3 rounded-2xl bg-mint p-4 sm:flex-row sm:items-center">
        <MessageCircleQuestion className="size-6 shrink-0 text-primary" />
        <p className="flex-1 text-sm text-navy">{hi ? "कोई और सवाल? अपनी केयर टीम से पूछें।" : "Still have a question? Ask your care team."}</p>
        <Button asChild>
          <Link href="/care-team">{hi ? "सवाल भेजें" : "Ask a question"}</Link>
        </Button>
      </div>

      {related.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{hi ? "यह भी पढ़ें" : "Related"}</h2>
          <ul className="space-y-1.5">
            {related.map((a) => (
              <li key={a.slug}>
                <Link href={`/learn/${a.slug}`} className="text-primary underline-offset-4 hover:underline">
                  {a.title[locale]}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
