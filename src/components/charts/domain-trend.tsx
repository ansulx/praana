"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { DOMAIN_BY_KEY, type ScaleDomain } from "@/lib/domains";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/providers/locale-provider";

export type TrendPoint = { date: string; label: string } & Partial<Record<ScaleDomain | "temperatureC", number | null>>;

const KEYS: (ScaleDomain | "temperatureC")[] = ["pain", "appetite", "mobility", "sleep", "mood", "anxiety", "nausea", "temperatureC"];

export function DomainTrend({ data }: { data: TrendPoint[] }) {
  const locale = useLocale();
  const [key, setKey] = useState<ScaleDomain | "temperatureC">("pain");
  const isTemp = key === "temperatureC";
  const max = isTemp ? undefined : DOMAIN_BY_KEY[key as ScaleDomain].max;
  const label = isTemp ? (locale === "hi" ? "तापमान" : "Temperature") : locale === "hi" ? DOMAIN_BY_KEY[key as ScaleDomain].hi : DOMAIN_BY_KEY[key as ScaleDomain].en;
  const config: ChartConfig = { [key]: { label, color: "var(--chart-1)" } };
  const hasData = data.some((d) => d[key] !== null && d[key] !== undefined);

  return (
    <div>
      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist">
        {KEYS.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={key === k}
            onClick={() => setKey(k)}
            className={cn("h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium", key === k ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}
          >
            {k === "temperatureC" ? (locale === "hi" ? "तापमान" : "Temp") : locale === "hi" ? DOMAIN_BY_KEY[k].hi : DOMAIN_BY_KEY[k].en}
          </button>
        ))}
      </div>
      {hasData ? (
        <ChartContainer config={config} className="aspect-auto h-56 w-full">
          <LineChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
            <YAxis
              domain={isTemp ? [35, 40] : [0, max!]}
              ticks={isTemp ? [35, 36, 37, 38, 39, 40] : max === 10 ? [0, 2, 4, 6, 8, 10] : [0, 1, 2, 3, 4]}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            {isTemp && <ReferenceLine y={38} stroke="var(--coral)" strokeDasharray="4 4" label={{ value: "38°C", position: "right", fill: "var(--coral)", fontSize: 11 }} />}
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey={key} type="monotone" stroke={`var(--color-${key})`} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          </LineChart>
        </ChartContainer>
      ) : (
        <p className="grid h-56 place-items-center rounded-2xl border border-dashed text-sm text-muted-foreground">
          {locale === "hi" ? "इस दौरान कोई जानकारी नहीं" : "Nothing recorded for this yet"}
        </p>
      )}
      {!isTemp && (
        <p className="mt-2 text-xs text-muted-foreground">{locale === "hi" ? "ऊँचा = ज़्यादा परेशानी" : "Higher means more trouble"}</p>
      )}
    </div>
  );
}
