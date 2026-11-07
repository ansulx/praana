"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export type TrendPoint = {
  label: string;
  pain: number | null;
  appetite: number | null;
  nausea: number | null;
  mobility: number | null;
  sleep: number | null;
  mood: number | null;
  anxiety: number | null;
  temperatureC: number | null;
};

const SMALL: { key: keyof TrendPoint; label: string; color: string }[] = [
  { key: "appetite", label: "Eating difficulty", color: "var(--chart-2)" },
  { key: "nausea", label: "Nausea", color: "var(--chart-4)" },
  { key: "mobility", label: "Mobility difficulty", color: "var(--chart-3)" },
  { key: "sleep", label: "Sleep difficulty", color: "var(--chart-5)" },
  { key: "mood", label: "Low mood", color: "var(--chart-3)" },
  { key: "anxiety", label: "Worry", color: "var(--chart-2)" },
];

const has = (data: TrendPoint[], key: keyof TrendPoint) => data.filter((d) => typeof d[key] === "number").length > 0;

export function TrendCharts({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No check-ins yet. Trends will appear here.</p>;
  }
  return (
    <div className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartBlock title="Pain" subtitle="0–10 · higher is worse" data={data} dataKey="pain" color="var(--chart-1)" domain={[0, 10]} reference={{ y: 7, label: "7" }} />
        {has(data, "temperatureC") ? (
          <ChartBlock title="Temperature" subtitle="°C · 38 °C reference" data={data} dataKey="temperatureC" color="var(--chart-2)" domain={[35, 40]} reference={{ y: 38, label: "38°C" }} />
        ) : (
          <div className="grid place-items-center rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No temperatures recorded</div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SMALL.map((s) => (
          <ChartBlock key={s.key} title={s.label} subtitle="0–4" data={data} dataKey={s.key} color={s.color} domain={[0, 4]} compact />
        ))}
      </div>
    </div>
  );
}

function ChartBlock({
  title,
  subtitle,
  data,
  dataKey,
  color,
  domain,
  reference,
  compact,
}: {
  title: string;
  subtitle: string;
  data: TrendPoint[];
  dataKey: keyof TrendPoint;
  color: string;
  domain: [number, number];
  reference?: { y: number; label: string };
  compact?: boolean;
}) {
  const config = { [dataKey]: { label: title, color } } satisfies ChartConfig;
  const empty = !has(data, dataKey);
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
      {empty ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Not reported</p>
      ) : (
        <ChartContainer config={config} className={compact ? "aspect-auto h-28 w-full" : "aspect-auto h-52 w-full"}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: compact ? -28 : -16, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} minTickGap={16} hide={compact} />
            <YAxis domain={domain} tickLine={false} axisLine={false} allowDecimals={dataKey === "temperatureC"} tickCount={compact ? 3 : 6} width={40} />
            {reference && <ReferenceLine y={reference.y} stroke="var(--coral)" strokeDasharray="4 4" label={{ value: reference.label, position: "insideTopRight", fill: "var(--coral)", fontSize: 11 }} />}
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Line type="monotone" dataKey={dataKey} stroke={`var(--color-${dataKey})`} strokeWidth={2.2} dot={{ r: compact ? 2 : 3 }} connectNulls isAnimationActive={false} />
          </LineChart>
        </ChartContainer>
      )}
    </div>
  );
}
