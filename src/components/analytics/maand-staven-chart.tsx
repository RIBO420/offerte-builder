"use client";

/**
 * Vorm 2 van het grafiekdieet (R3): verticale staven per maand.
 *
 * Maanden zijn discrete bakjes, geen continuüm — dus staven, geen vlak. De
 * oude `OfferteTrendChart` tekende een area over vier maanden waarvan er twee
 * leeg waren; dat suggereert een verloop dat er niet is.
 *
 * Kleur (R4): één reeks in Loof-groen (`var(--chart-1)`), níét
 * `hsl(var(--chart-1))` — de tokens zijn `oklch(...)`, en `hsl(oklch(…))` is
 * ongeldige CSS waardoor de SVG terugvalt op zwart. Dat was de
 * zwarte-grafieken-bug uit de schouw.
 *
 * De lopende maand krijgt een lichtere vulling: hij is nog niet af, en een
 * volle staaf naast afgesloten maanden leest als een terugval die er niet is.
 */

import { memo, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format/currency";

export interface MaandPunt {
  maandKey: string;
  label: string;
  getekendeOmzetExclBtw: number;
  gefactureerdInclBtw: number;
  aantalGetekend: number;
}

export type MaandReeks = "getekend" | "gefactureerd";

interface MaandStavenChartProps {
  data: MaandPunt[];
  reeks?: MaandReeks;
  /** `maandKey` van de maand die nu nog loopt; die staaf wordt lichter. */
  lopendeMaandKey?: string;
  /** Vaste hoogte — moet gelijk zijn aan de skeleton, anders schuift de pagina. */
  hoogte?: number;
}

function waardeVan(punt: MaandPunt, reeks: MaandReeks): number {
  return reeks === "gefactureerd"
    ? punt.gefactureerdInclBtw
    : punt.getekendeOmzetExclBtw;
}

/**
 * Astekst: "aug" en alleen bij een jaarwisseling "jan '27". Bij meer dan
 * veertien maanden slaat hij maanden over in plaats van labels te kantelen —
 * gedraaide tekst is altijd het begin van een onleesbare as.
 */
function asLabels(data: MaandPunt[]): Record<string, string> {
  const stap = data.length > 26 ? 6 : data.length > 14 ? 3 : 1;
  const labels: Record<string, string> = {};
  data.forEach((punt, index) => {
    const [jaar, maand] = punt.maandKey.split("-");
    const kort = punt.label.split(" ")[0];
    const isJaarstart = maand === "01" || index === 0;
    if (index % stap !== 0 && !isJaarstart) {
      labels[punt.maandKey] = "";
      return;
    }
    labels[punt.maandKey] = isJaarstart ? `${kort} '${jaar.slice(2)}` : kort;
  });
  return labels;
}

function Uitleg({
  active,
  payload,
  reeks,
  lopendeMaandKey,
}: {
  active?: boolean;
  payload?: Array<{ payload: MaandPunt }>;
  reeks: MaandReeks;
  lopendeMaandKey?: string;
}) {
  if (!active || !payload?.length) return null;
  const punt = payload[0].payload;
  const loopt = punt.maandKey === lopendeMaandKey;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="text-xs font-medium">
        {punt.label}
        {loopt && (
          <span className="ml-1.5 font-normal text-muted-foreground">
            loopt nog
          </span>
        )}
      </p>
      <p className="mt-0.5 font-display text-lg leading-tight font-semibold tabular-nums">
        {formatCurrency(waardeVan(punt, reeks), "nl-NL", false)}
      </p>
      {reeks === "getekend" && (
        <p className="text-xs text-muted-foreground">
          {punt.aantalGetekend === 1
            ? "1 getekende offerte"
            : `${punt.aantalGetekend} getekende offertes`}
        </p>
      )}
    </div>
  );
}

function MaandStavenChartBasis({
  data,
  reeks = "getekend",
  lopendeMaandKey,
  hoogte = 232,
}: MaandStavenChartProps) {
  const labels = useMemo(() => asLabels(data), [data]);
  const rijen = useMemo(
    () => data.map((punt) => ({ ...punt, waarde: waardeVan(punt, reeks) })),
    [data, reeks]
  );

  return (
    <ResponsiveContainer width="100%" height={hoogte}>
      <BarChart
        data={rijen}
        margin={{ top: 8, right: 4, bottom: 0, left: -8 }}
        barCategoryGap="22%"
      >
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
          cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
          content={
            <Uitleg reeks={reeks} lopendeMaandKey={lopendeMaandKey} />
          }
        />
        <Bar
          dataKey="waarde"
          fill="var(--chart-1)"
          radius={[3, 3, 0, 0]}
          maxBarSize={52}
          isAnimationActive={false}
        >
          {rijen.map((rij) => (
            <Cell
              key={rij.maandKey}
              fillOpacity={rij.maandKey === lopendeMaandKey ? 0.42 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export const MaandStavenChart = memo(MaandStavenChartBasis);
