"use client";

/**
 * Vorm 3 van het grafiekdieet (R3): één lijn over een lange reeks.
 *
 * Alleen bij écht lange periodes ("Alle tijd", meerjarig). Onder de vijftien
 * maanden wint de staafgrafiek: dan zijn de maanden nog aftelbare bakjes en
 * suggereert een lijn een verloop dat er tussen twee maandtotalen niet is.
 *
 * Twee reeksen is het maximum, en de tweede (gefactureerd) is bewust gedempt:
 * getekende omzet is het onderwerp, facturatie is de context. Kleuren via
 * `var(--chart-N)` — zie de kopnoot van `maand-staven-chart.tsx` voor waarom
 * `hsl(var(...))` de grafieken zwart maakte.
 */

import { memo, useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format/currency";
import type { MaandPunt } from "./maand-staven-chart";

interface LangeTrendChartProps {
  data: MaandPunt[];
  /** Tweede, gedempte reeks met de facturatie. */
  toonGefactureerd?: boolean;
  hoogte?: number;
}

function Uitleg({
  active,
  payload,
  toonGefactureerd,
}: {
  active?: boolean;
  payload?: Array<{ payload: MaandPunt }>;
  toonGefactureerd?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const punt = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="text-xs font-medium">{punt.label}</p>
      <p className="mt-0.5 font-display text-lg leading-tight font-semibold tabular-nums">
        {formatCurrency(punt.getekendeOmzetExclBtw, "nl-NL", false)}
      </p>
      <p className="text-xs text-muted-foreground">getekend, excl. btw</p>
      {toonGefactureerd && (
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          {formatCurrency(punt.gefactureerdInclBtw, "nl-NL", false)} gefactureerd
        </p>
      )}
    </div>
  );
}

function LangeTrendChartBasis({
  data,
  toonGefactureerd = false,
  hoogte = 232,
}: LangeTrendChartProps) {
  // Alleen bij een jaarwisseling een label: "jan '25". Twaalf maandnamen op
  // een as van drie jaar is ruis, en gekantelde tekst is nooit het antwoord.
  const labels = useMemo(() => {
    const map: Record<string, string> = {};
    data.forEach((punt, index) => {
      const [jaar, maand] = punt.maandKey.split("-");
      map[punt.maandKey] =
        maand === "01" || index === 0 ? `'${jaar.slice(2)}` : "";
    });
    return map;
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={hoogte}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid
          vertical={false}
          stroke="var(--border)"
          strokeOpacity={0.7}
        />
        <XAxis
          dataKey="maandKey"
          tickFormatter={(key: string) => labels[key] ?? ""}
          axisLine={false}
          tickLine={false}
          interval={0}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          height={22}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          width={56}
          tickCount={4}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickFormatter={(waarde: number) =>
            waarde === 0 ? "0" : formatCurrencyCompact(waarde)
          }
        />
        <Tooltip
          cursor={{ stroke: "var(--border)" }}
          content={<Uitleg toonGefactureerd={toonGefactureerd} />}
        />
        {toonGefactureerd && (
          <Line
            type="monotone"
            dataKey="gefactureerdInclBtw"
            stroke="var(--muted-foreground)"
            strokeOpacity={0.45}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        )}
        <Line
          type="monotone"
          dataKey="getekendeOmzetExclBtw"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3.5, fill: "var(--chart-1)", stroke: "none" }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export const LangeTrendChart = memo(LangeTrendChartBasis);
