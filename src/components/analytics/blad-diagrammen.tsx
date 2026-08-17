"use client";

/**
 * De vier recharts-diagrammen van het grafiekenblad (naast de maandstaven van
 * `jaar-vergelijking-chart.tsx`). Eén bestand, want ze delen hun lot: ze
 * bestaan alleen op dit blad en komen uitsluitend via `dynamic.tsx` binnen.
 *
 * Aanleiding: de eerste versie van het blad tekende panelen 2–6 als dunne
 * CSS-balkjes, en die lazen als progressbars in plaats van als diagrammen
 * (melding Ricardo 17 aug). Dit bestand vervangt ze door echte grafieken met
 * assen, vlakken en tooltips — zonder de dataviz-regels los te laten:
 *
 * - **Kleur is nooit de enige drager.** Elke waarde staat als tekst in het
 *   diagram of in de vaste legenda; tooltips noemen reeksen bij naam.
 * - **De omzetmix-donut** gebruikt het nagerekende identiteitspaar
 *   `--chart-1`/`--chart-3` (ΔE ≥ 13,9 onder CVD, zie de kopnoot van
 *   `jaar-vergelijking-chart.tsx`).
 * - **De ouderdomsstaven** dragen urgentie in één oplopende terracotta-reeks
 *   (`--chart-2` = "vraagt aandacht" in deze app); "nog niet vervallen" is
 *   bewust gedempt grijs — dat geld is geen probleem.
 * - **De nullijnstaven** dragen de betekenis in deríchting plus het
 *   ondertekende bedrag; groen/terracotta is de derde laag, want dat paar valt
 *   onder protanopie om (ΔE 2,8 — nagerekend).
 *
 * Tokens via `var(--chart-N)`, nooit `hsl(...)` eromheen (onze tokens zijn
 * oklch) en nooit hex.
 */

import { memo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format/currency";
import { BEWIJS_HOOGTE } from "./maten";

function euro(bedrag: number): string {
  return formatCurrency(bedrag, "nl-NL", false);
}

/** Ondertekend bedrag: "+ € 2.400" / "− € 320" — echte tekens. */
function euroMetTeken(bedrag: number): string {
  if (Math.round(bedrag) === 0) return euro(0);
  return `${bedrag > 0 ? "+ " : "− "}${euro(Math.abs(bedrag))}`;
}

/** Vaste tooltipdoos: zelfde vorm als in `jaar-vergelijking-chart.tsx`. */
function TooltipDoos({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      {children}
    </div>
  );
}

// ── 1 · Omzetmix als donut ───────────────────────────────────────────────

export interface DonutDeel {
  sleutel: string;
  label: string;
  waarde: number;
  /** Gedempte regel in legenda en tooltip: aandeel, aantal, marge. */
  bijschrift: string;
}

/** Vaste kleurtoewijzing op sleutel — kleur volgt de entiteit, nooit de rang. */
const DONUT_KLEUREN: Record<string, string> = {
  aanleg: "var(--chart-1)",
  onderhoud: "var(--chart-3)",
};

function DonutUitleg({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DonutDeel }>;
}) {
  if (!active || !payload?.length) return null;
  const deel = payload[0].payload;
  return (
    <TooltipDoos>
      <p className="text-xs font-medium">{deel.label}</p>
      <p className="mt-0.5 font-display text-lg leading-tight font-semibold tabular-nums">
        {euro(deel.waarde)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{deel.bijschrift}</p>
    </TooltipDoos>
  );
}

function OmzetMixDonutBasis({
  delen,
  totaalLabel,
}: {
  delen: DonutDeel[];
  /** Wat het middencijfer betekent, bv. "getekend excl. btw". */
  totaalLabel: string;
}) {
  const totaal = delen.reduce((som, deel) => som + deel.waarde, 0);

  return (
    <div>
      <div className="relative" style={{ height: BEWIJS_HOOGTE - 52 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<DonutUitleg />} />
            <Pie
              data={delen}
              dataKey="waarde"
              nameKey="label"
              innerRadius="62%"
              outerRadius="92%"
              // 2 px lucht in de vlakkleur tussen de segmenten (dataviz-spacer);
              // geen rand, want een rand voegt gewicht toe dat geen data is.
              paddingAngle={2}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {delen.map((deel) => (
                <Cell
                  key={deel.sleutel}
                  fill={DONUT_KLEUREN[deel.sleutel] ?? "var(--chart-5)"}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Het totaal in het gat: HTML-overlay, dus gewone teksttokens en geen
            SVG-schaalproblemen. aria-hidden — de legenda eronder draagt alles. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
        >
          <span className="font-display text-xl font-semibold tabular-nums">
            {euro(totaal)}
          </span>
          <span className="text-[11px] text-muted-foreground">{totaalLabel}</span>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {delen.map((deel) => (
          <li key={deel.sleutel} className="flex items-baseline gap-2 text-sm">
            <span
              aria-hidden="true"
              className="inline-block size-2.5 shrink-0 translate-y-px rounded-[2px]"
              style={{
                backgroundColor: DONUT_KLEUREN[deel.sleutel] ?? "var(--chart-5)",
              }}
            />
            <span className="min-w-0 flex-1 truncate" title={deel.label}>
              {deel.label}
              <span className="ml-2 text-xs text-muted-foreground">
                {deel.bijschrift}
              </span>
            </span>
            <span className="font-medium tabular-nums">{euro(deel.waarde)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const OmzetMixDonut = memo(OmzetMixDonutBasis);

// ── 2 · Openstaand geld per ouderdom ─────────────────────────────────────

export interface OuderdomStaaf {
  sleutel: string;
  /** Korte aslabel ("31–60 dgn"). */
  asLabel: string;
  /** Volledige naam voor de tooltip ("31–60 dagen te laat"). */
  label: string;
  bedrag: number;
  aantal: number;
  vraagtAandacht: boolean;
}

/**
 * Urgentie als één oplopende reeks: hoe later, hoe voller het terracotta.
 * "Nog niet vervallen" is gedempt — dat is geen probleemgeld.
 */
function ouderdomVulling(staaf: OuderdomStaaf, index: number): {
  fill: string;
  fillOpacity: number;
} {
  if (!staaf.vraagtAandacht) {
    return { fill: "var(--muted-foreground)", fillOpacity: 0.35 };
  }
  // index 1..3 → 0.5 / 0.75 / 1
  return { fill: "var(--chart-2)", fillOpacity: 0.5 + (index - 1) * 0.25 };
}

function OuderdomUitleg({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: OuderdomStaaf }>;
}) {
  if (!active || !payload?.length) return null;
  const staaf = payload[0].payload;
  return (
    <TooltipDoos>
      <p className="text-xs font-medium">{staaf.label}</p>
      <p className="mt-0.5 font-display text-lg leading-tight font-semibold tabular-nums">
        {euro(staaf.bedrag)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {staaf.aantal === 1 ? "1 factuur" : `${staaf.aantal} facturen`}
      </p>
    </TooltipDoos>
  );
}

function OuderdomStavenBasis({ staven }: { staven: OuderdomStaaf[] }) {
  return (
    <ResponsiveContainer width="100%" height={BEWIJS_HOOGTE - 32}>
      <BarChart
        data={staven}
        margin={{ top: 20, right: 4, bottom: 0, left: -8 }}
        barCategoryGap="28%"
      >
        <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.7} />
        <XAxis
          dataKey="asLabel"
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
          content={<OuderdomUitleg />}
        />
        <Bar dataKey="bedrag" radius={[3, 3, 0, 0]} maxBarSize={64} isAnimationActive={false}>
          {/* Het bedrag boven elke staaf: tekst in teksttoken, niet in de
              datakleur — en zo is de tooltip nooit de enige weg. */}
          <LabelList
            dataKey="bedrag"
            position="top"
            formatter={(waarde) =>
              typeof waarde === "number" && waarde > 0
                ? formatCurrencyCompact(waarde)
                : ""
            }
            style={{
              fill: "var(--foreground)",
              fontSize: 11,
              fontVariantNumeric: "tabular-nums",
            }}
          />
          {staven.map((staaf, index) => {
            const vulling = ouderdomVulling(staaf, index);
            return (
              <Cell
                key={staaf.sleutel}
                fill={vulling.fill}
                fillOpacity={vulling.fillOpacity}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export const OuderdomStaven = memo(OuderdomStavenBasis);

// ── 3 · Staven om een nullijn (begroot vs werkelijk) ─────────────────────

export interface NullijnRegel {
  sleutel: string;
  label: string;
  /** Ondertekend: positief = duurder dan begroot. */
  waarde: number;
  /** Gedempte regel voor de tooltip: "62 uur gewerkt, 55 uur begroot". */
  bijschrift: string;
}

const NULLIJN_RIJHOOGTE = 34;

function NullijnUitleg({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: NullijnRegel }>;
}) {
  if (!active || !payload?.length) return null;
  const regel = payload[0].payload;
  return (
    <TooltipDoos>
      <p className="text-xs font-medium">{regel.label}</p>
      <p className="mt-0.5 font-display text-lg leading-tight font-semibold tabular-nums">
        {euroMetTeken(regel.waarde)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{regel.bijschrift}</p>
    </TooltipDoos>
  );
}

/**
 * Het ondertekende bedrag aan het vrije uiteinde van de staaf — de kant hangt
 * van het teken af, dus een eigen labelcomponent in plaats van `position`.
 */
function NullijnLabel(props: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: number | string;
}) {
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const breedte = Number(props.width ?? 0);
  const hoogte = Number(props.height ?? 0);
  const waarde = Number(props.value ?? 0);
  // recharts geeft bij negatieve waarden een negatieve breedte door.
  const naarRechts = breedte >= 0;
  const eindX = naarRechts ? x + breedte + 6 : x + breedte - 6;
  return (
    <text
      x={eindX}
      y={y + hoogte / 2}
      dominantBaseline="central"
      textAnchor={naarRechts ? "start" : "end"}
      style={{
        fill: "var(--foreground)",
        fontSize: 11,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {euroMetTeken(waarde)}
    </text>
  );
}

function NullijnStavenBasis({
  regels,
  linksLabel,
  rechtsLabel,
}: {
  regels: NullijnRegel[];
  linksLabel: string;
  rechtsLabel: string;
}) {
  // Symmetrisch domein met kop-ruimte voor de eindlabels: anders hangt de
  // nullijn scheef en valt "+ € 2.400" buiten beeld.
  const grootste = Math.max(1, ...regels.map((regel) => Math.abs(regel.waarde)));
  const grens = grootste * 1.45;

  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
        <span>← {linksLabel}</span>
        <span>{rechtsLabel} →</span>
      </div>
      <ResponsiveContainer
        width="100%"
        height={regels.length * NULLIJN_RIJHOOGTE + 8}
      >
        <BarChart
          data={regels}
          layout="vertical"
          margin={{ top: 0, right: 8, bottom: 0, left: 8 }}
          barCategoryGap="30%"
        >
          <XAxis type="number" domain={[-grens, grens]} hide />
          <YAxis
            type="category"
            dataKey="label"
            axisLine={false}
            tickLine={false}
            width={104}
            tick={{ fill: "var(--foreground)", fontSize: 12 }}
          />
          <ReferenceLine
            x={0}
            stroke="var(--muted-foreground)"
            strokeOpacity={0.6}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
            content={<NullijnUitleg />}
          />
          <Bar dataKey="waarde" maxBarSize={14} radius={3} isAnimationActive={false}>
            <LabelList dataKey="waarde" content={<NullijnLabel />} />
            {regels.map((regel) => (
              <Cell
                key={regel.sleutel}
                // Richting + ondertekend bedrag dragen de betekenis; deze twee
                // kleuren zijn de derde laag (zie kopnoot).
                fill={regel.waarde > 0 ? "var(--chart-2)" : "var(--chart-1)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export const NullijnStaven = memo(NullijnStavenBasis);

// ── 4 · Marge per soort werk ─────────────────────────────────────────────

export interface MargeRegel {
  sleutel: string;
  label: string;
  /** Marge als percentage van de omzet. */
  percentage: number;
  percentageTekst: string;
  /** Gedempte regel voor de tooltip: marge in euro's, omzet, aantal. */
  bijschrift: string;
}

const MARGE_RIJHOOGTE = 34;

function MargeUitleg({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: MargeRegel }>;
}) {
  if (!active || !payload?.length) return null;
  const regel = payload[0].payload;
  return (
    <TooltipDoos>
      <p className="text-xs font-medium">{regel.label}</p>
      <p className="mt-0.5 font-display text-lg leading-tight font-semibold tabular-nums">
        {regel.percentageTekst}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{regel.bijschrift}</p>
    </TooltipDoos>
  );
}

function MargeStavenBasis({ regels }: { regels: MargeRegel[] }) {
  const grootste = Math.max(10, ...regels.map((regel) => regel.percentage));

  return (
    <ResponsiveContainer
      width="100%"
      height={regels.length * MARGE_RIJHOOGTE + 26}
    >
      <BarChart
        data={regels}
        layout="vertical"
        margin={{ top: 0, right: 44, bottom: 0, left: 8 }}
        barCategoryGap="30%"
      >
        <CartesianGrid
          horizontal={false}
          stroke="var(--border)"
          strokeOpacity={0.7}
        />
        <XAxis
          type="number"
          domain={[0, Math.ceil(grootste / 5) * 5]}
          axisLine={false}
          tickLine={false}
          tickCount={4}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickFormatter={(waarde: number) => `${waarde}%`}
          height={22}
        />
        <YAxis
          type="category"
          dataKey="label"
          axisLine={false}
          tickLine={false}
          width={112}
          tick={{ fill: "var(--foreground)", fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
          content={<MargeUitleg />}
        />
        <Bar
          dataKey="percentage"
          fill="var(--chart-1)"
          maxBarSize={14}
          radius={[0, 3, 3, 0]}
          isAnimationActive={false}
        >
          <LabelList
            dataKey="percentageTekst"
            position="right"
            style={{
              fill: "var(--foreground)",
              fontSize: 11,
              fontVariantNumeric: "tabular-nums",
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export const MargeStaven = memo(MargeStavenBasis);
