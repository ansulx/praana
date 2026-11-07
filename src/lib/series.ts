import { addDaysYmd, localYmd } from "@/lib/dates";
import type { ScaleDomain } from "@/lib/domains";

type Row = { createdAt: Date | string } & Partial<Record<ScaleDomain, number | null>> & { temperatureC?: number | null };

/**
 * One value per local calendar day for the last `days` days (oldest first).
 * Pain and temperature take the day's worst reading; other domains take the latest.
 */
export function dailySeries(rows: Row[], days: number, key: ScaleDomain | "temperatureC", today = localYmd()): { date: string; value: number | null }[] {
  const byDay = new Map<string, Row[]>();
  for (const r of rows) {
    const d = localYmd(new Date(r.createdAt));
    byDay.set(d, [...(byDay.get(d) ?? []), r]);
  }
  const out: { date: string; value: number | null }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDaysYmd(today, -i);
    const list = (byDay.get(date) ?? []).filter((r) => r[key] !== null && r[key] !== undefined);
    let value: number | null = null;
    if (list.length) {
      if (key === "pain" || key === "temperatureC") value = Math.max(...list.map((r) => r[key] as number));
      else value = [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0][key] as number;
    }
    out.push({ date, value });
  }
  return out;
}

/** Compare the mean of the last half to the first half: negative = improving (lower is better). */
export function trendDelta(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null);
  if (v.length < 3) return null;
  const mid = Math.floor(v.length / 2);
  const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  return avg(v.slice(mid)) - avg(v.slice(0, mid));
}
