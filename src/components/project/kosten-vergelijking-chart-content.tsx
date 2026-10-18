"use client";

/**
 * Grafieken van het kostendashboard: begroot tegen besteed per soort, en de
 * afwijking per soort in procenten. Kleuren uit de tokens (begroot grijs,
 * besteed terracotta, boven begroting `destructive`); elke staaf draagt zijn
 * waarde als label, zodat kleur nooit het enige signaal is.
 */

import { memo, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format/currency";
import { formatAfwijkingProcent } from "@/lib/format/uren-kort";
import { SectieLegeStaat } from "@/components/ui/sectie-paneel";
import { euro, SOORT_LABEL, type SoortRegel } from "./kosten/stand";

const AS = { fontSize: 12, fill: "var(--muted-foreground)" };

interface TooltipRij {
  name: string;
  value: number;
  color: string;
}

function BedragTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipRij[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover p-2.5 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((rij) => (
        <p key={rij.name} className="flex items-center gap-2 tabular-nums">
          <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: rij.color }} />
          <span className="text-muted-foreground">{rij.name}</span>
          <span className="ms-auto font-medium">{formatCurrency(rij.value)}</span>
        </p>
      ))}
    </div>
  );
}

export const KostenVergelijkingChartContent = memo(function KostenVergelijkingChartContent({
  regels,
  height = 300,
}: {
  regels: SoortRegel[];
  height?: number;
}) {
  const data = useMemo(
    () =>
      regels
        .filter((r) => r.soort !== "overig" || r.begroot > 0 || r.besteed > 0)
        .map((r) => ({ soort: SOORT_LABEL[r.soort], begroot: r.begroot, besteed: r.besteed })),
    [regels]
  );

  if (!data.some((d) => d.begroot > 0 || d.besteed > 0)) {
    return <SectieLegeStaat tekst="Nog geen begroting of kosten om te vergelijken." />;
  }

  return (
    <figure className="flex flex-col gap-2 px-3 py-3">
      <figcaption className="font-display text-sm font-semibold">Begroot tegen besteed</figcaption>
      <div style={{ height }} className="min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 0 }} barGap={4}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="soort" tick={AS} stroke="var(--border)" tickLine={false} />
            <YAxis
              tick={AS}
              stroke="var(--border)"
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(v: number) => euro(v)}
            />
            <Tooltip content={<BedragTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
            <Bar dataKey="begroot" name="Begroot" fill="var(--muted-foreground)" fillOpacity={0.5} radius={[4, 4, 0, 0]}>
              <LabelList dataKey="begroot" position="top" fontSize={11} fill="var(--muted-foreground)" formatter={(v: unknown) => euro(Number(v))} />
            </Bar>
            <Bar dataKey="besteed" name="Besteed" fill="var(--accent-warm)" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="besteed" position="top" fontSize={11} fill="var(--foreground)" formatter={(v: unknown) => euro(Number(v))} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul aria-label="Legenda" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-1.5 w-3.5 rounded-full bg-muted-foreground/50" />
          Begroot
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-1.5 w-3.5 rounded-full bg-accent-warm" />
          Besteed
        </li>
      </ul>
    </figure>
  );
});

export const KostenAfwijkingChartContent = memo(function KostenAfwijkingChartContent({
  regels,
  afgerond,
  height = 220,
}: {
  regels: SoortRegel[];
  afgerond: boolean;
  height?: number;
}) {
  // Alleen soorten mét begroting hebben een afwijking in procenten.
  const data = useMemo(
    () =>
      regels
        .filter((r) => r.begroot > 0)
        .map((r) => ({
          soort: SOORT_LABEL[r.soort],
          afwijking: Math.round(((r.besteed - r.begroot) / r.begroot) * 100),
        })),
    [regels]
  );

  if (data.length === 0) return null;

  return (
    <figure className="flex flex-col gap-1 border-t px-3 py-3">
      <figcaption className="flex flex-col gap-0.5">
        <span className="font-display text-sm font-semibold">Afwijking per soort</span>
        <span className="text-xs text-muted-foreground">
          {afgerond
            ? "Besteed tegenover begroot, in procenten."
            : "Het project loopt nog: negatief betekent nog niet besteed, niet bespaard."}
        </span>
      </figcaption>
      <div style={{ height }} className="min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 0, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis
              type="number"
              tick={AS}
              stroke="var(--border)"
              tickLine={false}
              domain={[(min: number) => Math.min(min, 0), (max: number) => Math.max(max, 0)]}
              tickFormatter={(v: number) => formatAfwijkingProcent(v)}
            />
            <YAxis dataKey="soort" type="category" width={80} tick={AS} stroke="var(--border)" tickLine={false} />
            <Tooltip
              formatter={(v) => [formatAfwijkingProcent(Number(v)), "Afwijking"]}
              contentStyle={{
                backgroundColor: "var(--popover)",
                borderColor: "var(--border)",
                borderRadius: "0.5rem",
                color: "var(--popover-foreground)",
                fontSize: 12,
              }}
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            />
            <ReferenceLine x={0} stroke="var(--muted-foreground)" />
            <Bar dataKey="afwijking" radius={4}>
              {data.map((d) => (
                <Cell
                  key={d.soort}
                  fill={d.afwijking > 0 ? "var(--destructive)" : "var(--muted-foreground)"}
                  fillOpacity={d.afwijking > 0 ? 1 : 0.5}
                />
              ))}
              <LabelList
                dataKey="afwijking"
                position="right"
                fontSize={11}
                fill="var(--foreground)"
                formatter={(v: unknown) => formatAfwijkingProcent(Number(v))}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
});
