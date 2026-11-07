/**
 * Calendar maths in the patient's timezone. "Day 3 after surgery" must not flip at
 * UTC midnight (05:30 in India), so all day arithmetic runs on local YYYY-MM-DD strings.
 */

export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Kolkata";

const ymdFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Local calendar date as YYYY-MM-DD. */
export function localYmd(d: Date = new Date()): string {
  return ymdFmt.format(d);
}

const DAY = 86_400_000;

function ymdToUtc(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from `fromYmd` to `toYmd` (positive if `to` is later). */
export function daysBetween(fromYmd: string, toYmd: string): number {
  return Math.round((ymdToUtc(toYmd) - ymdToUtc(fromYmd)) / DAY);
}

/** Day 0 = surgery day. Negative before surgery. Null if no surgery date. */
export function dayOffset(surgeryDate: string | null | undefined, at: Date = new Date()): number | null {
  if (!surgeryDate) return null;
  return daysBetween(surgeryDate, localYmd(at));
}

export function addDaysYmd(ymd: string, days: number): string {
  const t = new Date(ymdToUtc(ymd) + days * DAY);
  return t.toISOString().slice(0, 10);
}

export function isValidYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === s;
}

/** Current local time as minutes since midnight, for medication slots. */
export function localMinutesNow(d: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

export function slotToMinutes(slot: string): number {
  const [h, m] = slot.split(":").map(Number);
  return h * 60 + m;
}

export function formatDayLabel(offset: number | null, locale: "en" | "hi" = "en"): string {
  if (offset === null) return locale === "hi" ? "सर्जरी की तारीख़ नहीं" : "Surgery date not set";
  if (offset === 0) return locale === "hi" ? "सर्जरी का दिन" : "Surgery day";
  if (offset < 0) {
    const n = Math.abs(offset);
    return locale === "hi" ? `सर्जरी में ${n} दिन` : `${n} day${n === 1 ? "" : "s"} to surgery`;
  }
  return locale === "hi" ? `सर्जरी के बाद दिन ${offset}` : `Day ${offset} after surgery`;
}

const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: APP_TIMEZONE, hour: "numeric", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("en-IN", { timeZone: APP_TIMEZONE, day: "numeric", month: "short" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: APP_TIMEZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export const fmtTime = (d: Date | string) => timeFmt.format(new Date(d));
export const fmtDate = (d: Date | string) => dateFmt.format(new Date(d));
export const fmtDateTime = (d: Date | string) => dateTimeFmt.format(new Date(d));

export function relativeTime(d: Date | string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(d).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return fmtDate(d);
}
