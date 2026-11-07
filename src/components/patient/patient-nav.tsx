"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarHeart,
  HeartPulse,
  Home,
  LineChart,
  ListChecks,
  LogOut,
  Map,
  Menu,
  MessageCircleHeart,
  Pill,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useT } from "@/components/providers/locale-provider";
import { logoutAction } from "@/server/actions/auth";

type Item = { href: string; label: MessageKey; icon: React.ComponentType<{ className?: string }> };

/** Keep primary to four jobs: Today · Check-in · Story · Ask. Rest lives in More. */
const PRIMARY: Item[] = [
  { href: "/home", label: "nav.home", icon: Home },
  { href: "/check-in", label: "nav.checkin", icon: HeartPulse },
  { href: "/timeline", label: "nav.timeline", icon: CalendarHeart },
  { href: "/companion", label: "nav.companion", icon: MessageCircleHeart },
];

const SECONDARY: Item[] = [
  { href: "/journey", label: "nav.journey", icon: Map },
  { href: "/care-team", label: "nav.team", icon: Users },
  { href: "/guided", label: "nav.guided", icon: Sparkles },
  { href: "/medicines", label: "nav.medicines", icon: Pill },
  { href: "/insights", label: "nav.insights", icon: LineChart },
  { href: "/plan", label: "nav.plan", icon: ListChecks },
  { href: "/learn", label: "nav.learn", icon: BookOpen },
  { href: "/settings", label: "nav.settings", icon: Settings },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav() {
  const t = useT();
  const isActive = useActive();
  const link = (item: Item) => (
    <Link
      key={item.href}
      href={item.href}
      prefetch
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground",
        isActive(item.href) && "bg-accent text-accent-foreground",
      )}
    >
      <item.icon className="size-5" />
      {t(item.label)}
    </Link>
  );
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar px-4 py-6 lg:flex">
      <Link href="/home" className="mb-8 px-2">
        <Logo />
      </Link>
      <nav className="flex flex-col gap-1">{PRIMARY.map(link)}</nav>
      <div className="my-4 h-px bg-border" />
      <nav className="flex flex-col gap-1">{SECONDARY.map(link)}</nav>
      <form action={logoutAction} className="mt-auto">
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-muted-foreground hover:bg-accent">
          <LogOut className="size-5" />
          {t("nav.signout")}
        </button>
      </form>
    </aside>
  );
}

export function BottomNav() {
  const t = useT();
  const isActive = useActive();
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {PRIMARY.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            className={cn(
              "flex flex-col items-center gap-1 pt-2.5 pb-1 text-[11px] font-medium text-muted-foreground",
              isActive(item.href) && "text-primary",
            )}
          >
            <item.icon className={cn("size-6", item.href === "/check-in" && "text-primary")} />
            <span className="max-w-full truncate px-0.5">{t(item.label)}</span>
          </Link>
        ))}
        <MoreSheet />
      </div>
    </nav>
  );
}

function MoreSheet() {
  const t = useT();
  const isActive = useActive();
  return (
    <Sheet>
      <SheetTrigger className="flex flex-col items-center gap-1 pt-2.5 pb-1 text-[11px] font-medium text-muted-foreground">
        <Menu className="size-6" />
        <span>{t("nav.more")}</span>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl pb-8">
        <SheetHeader>
          <SheetTitle>
            <Logo />
          </SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-3 gap-3 px-4">
          {SECONDARY.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm font-medium",
                isActive(item.href) && "border-primary bg-accent",
              )}
            >
              <item.icon className="size-6 text-primary" />
              {t(item.label)}
            </Link>
          ))}
          <form action={logoutAction} className="contents">
            <button className="flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm font-medium">
              <LogOut className="size-6 text-muted-foreground" />
              {t("nav.signout")}
            </button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
