"use client";

/**
 * Maandstaven met vorig jaar ernaast — de enige grafiek op het grafiekenblad
 * die twee reeksen naast elkaar zet.
 *
 * Waarom twee staven per maand en geen tweede lijn: maanden zijn discrete
 * bakjes (zie de kopnoot van `maand-staven-chart.tsx`), en de vraag is per maand
 * "meer of minder dan vorig jaar". Dat is een vergelijking van twee hoogtes op
 * dezelfde grondlijn, niet een verloop.
 *
 * **Kleur.** Twee reeksen betekent twee identiteitskleuren: `--chart-1`
 * (Loof-groen) voor dit jaar, `--chart-3` (steenblauw) voor vorig jaar.
 * Nagerekend met de validator van het dataviz-programma op onze eigen tokens:
 * ΔE 13,9 (licht) en 16,5 (donker) onder deuteranopie, ruim boven de norm van
 * 8, en 16,1/18,8 voor normaal zicht. `--chart-2` (terracotta) is bewust géén
 * tweede reeks: die kleur betekent in deze app "vraagt aandacht", en groen
 * naast terracotta valt onder protanopie wél om (ΔE 2,8). `--chart-4` (oker)
 * blijft eveneens buiten beeld: 2,5:1 op het lichte vlak.
 *
 * Kleur is nergens de enige drager: er is een legenda, de as noemt de maanden,
 * de tooltip zet beide bedragen met hun jaar erbij, en onder de grafiek staat
 * dezelfde reeks als uitklapbare tabel. Wie de kleuren niet ziet mist niets.
 *
 * Tokens via `var(--chart-N)` en niet `hsl(var(--chart-N))`: onze tokens zijn
 * `oklch(...)` en die wrapper maakte de grafieken zwart.
 */

import { memo, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format/currency";
import type { MaandPunt } from "./maand-staven-chart";

/** Eén maand met zijn tegenhanger van een jaar eerder. */
interface VergelijkRij {
  maandKey: string;
  label: string;
  asLabel: string;
  ditJaar: number;
  /** `null` als die maand vorig jaar buiten de vergelijkingsperiode viel. */
  vorigJaar: number | null;
  vorigLabel: string | null;
}

interface JaarVergelijkingChartProps {
  /** De maanden van de gekozen periode. */
  data: MaandPunt[];
  /** Dezelfde maanden een jaar eerder; leeg = geen vergelijking mogelijk. */
  vorigJaar?: MaandPunt[];
  hoogte?: number;
}

/** "2026-04" → "2025-04". Sleutelrekenen, geen datumrekenen. */
function eenJaarTerug(maandKey: string): string {
  const [jaar, maand] = maandKey.split("-");
  return `${Number(jaar) - 1}-${maand}`;
}

/**
 * Astekst: de korte maandnaam, en bij een jaarwisseling met het jaartal erbij.
 * Bij lange reeksen slaat de as maanden over in plaats van labels te kantelen —
 * gedraaide tekst is altijd het begin van een onleesbare as.
 */
function asLabelVan(punt: MaandPunt, index: number, totaal: number): string {
  const stap = totaal > 26 ? 6 : totaal > 14 ? 3 : 1;
  const [jaar, maand] = punt.maandKey.split("-");
  const kort = punt.label.split(" ")[0];
  const isJaarstart = maand === "01" || index === 0;
  if (index % stap !== 0 && !isJaarstart) return "";
  return isJaarstart ? `${kort} '${jaar.slice(2)}` : kort;
}

function euro(bedrag: number): string {
  return formatCurrency(bedrag, "nl-NL", false);
}

/** Ondertekend verschil in taal: "€ 1.200 meer dan vorig jaar". */
function verschilTekst(rij: VergelijkRij): string | null {
  if (rij.vorigJaar === null) return null;
  const verschil = rij.ditJaar - rij.vorigJaar;
  if (Math.abs(verschil) < 1) return "gelijk aan vorig jaar";
  return `${euro(Math.abs(verschil))} ${verschil > 0 ? "meer" : "minder"} dan vorig jaar`;
}

function Uitleg({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: VergelijkRij }>;
}) {
  if (!active || !payload?.length) return null;
  const rij = payload[0].payload;
  const verschil = verschilTekst(rij);
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="text-xs font-medium">{rij.label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 font-display text-lg leading-tight font-semibold tabular-nums">
        <Streepje kleur="var(--chart-1)" />
        {euro(rij.ditJaar)}
      </p>
      {rij.vorigJaar !== null && (
        <p className="mt-0.5 flex items-center gap-1.5 text-sm tabular-nums">
          <Streepje kleur="var(--chart-3)" />
          {euro(rij.vorigJaar)}
          <span className="text-muted-foreground">{rij.vorigLabel}</span>
        </p>
      )}
      {verschil && (
        <p className="mt-1 text-xs text-muted-foreground">{verschil}</p>
      )}
    </div>
  );
}

/** Reekssleutel in de tooltip: een streepje, geen gevuld blok (dataviz). */
function Streepje({ kleur }: { kleur: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-[2px] w-3 shrink-0 rounded-full"
      style={{ backgroundColor: kleur }}
    />
  );
}

/** Legenda buiten recharts: eigen tekst-tokens, geen data-kleur op letters. */
function Legenda({
  ditLabel,
  vorigLabel,
}: {
  ditLabel: string;
  vorigLabel: string | null;
}) {
  return (
    <ul className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block size-2.5 rounded-[2px]"
          style={{ backgroundColor: "var(--chart-1)" }}
        />
        {ditLabel}
      </li>
      {vorigLabel && (
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block size-2.5 rounded-[2px]"
            style={{ backgroundColor: "var(--chart-3)" }}
          />
          {vorigLabel}
        </li>
      )}
    </ul>
  );
}

function JaarVergelijkingChartBasis({
  data,
  vorigJaar = [],
  hoogte = 232,
}: JaarVergelijkingChartProps) {
  const rijen = useMemo<VergelijkRij[]>(() => {
    const vorig = new Map(vorigJaar.map((punt) => [punt.maandKey, punt]));
    return data.map((punt, index) => {
      const tegenhanger = vorig.get(eenJaarTerug(punt.maandKey));
      return {
        maandKey: punt.maandKey,
        label: punt.label,
        asLabel: asLabelVan(punt, index, data.length),
        ditJaar: punt.getekendeOmzetExclBtw,
        vorigJaar: tegenhanger
          ? tegenhanger.getekendeOmzetExclBtw
          : null,
        vorigLabel: tegenhanger?.label ?? null,
      };
    });
  }, [data, vorigJaar]);

  // Is er überhaupt een maand met een tegenhanger? Zo niet, dan is dit een
  // grafiek met één reeks en hoort er geen legenda en geen tweede staaf te
  // staan (een reeks van louter nullen leest als "vorig jaar was leeg").
  const heeftVergelijking = rijen.some((rij) => rij.vorigJaar !== null);
  const ditLabel = "Getekend, deze periode";
  const vorigLabel = heeftVergelijking ? "Zelfde maand vorig jaar" : null;

  return (
    <div>
      <Legenda ditLabel={ditLabel} vorigLabel={vorigLabel} />
      <ResponsiveContainer width="100%" height={hoogte}>
        <BarChart
          data={rijen}
          margin={{ top: 8, right: 4, bottom: 0, left: -8 }}
          barCategoryGap="24%"
          // 2 px lucht in de vlakkleur tussen de twee staven van één maand —
          // een randje om de staaf zou data-gewicht toevoegen dat geen data is.
          barGap={2}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeOpacity={0.7}
          />
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
            content={<Uitleg />}
          />
          {heeftVergelijking && (
            <Bar
              dataKey="vorigJaar"
              name={vorigLabel ?? undefined}
              fill="var(--chart-3)"
              radius={[3, 3, 0, 0]}
              maxBarSize={22}
              isAnimationActive={false}
            />
          )}
          <Bar
            dataKey="ditJaar"
            name={ditLabel}
            fill="var(--chart-1)"
            radius={[3, 3, 0, 0]}
            maxBarSize={22}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* De tooltip mag nooit de enige weg naar een getal zijn. Ingeklapt, dus
          hij kost niets zolang niemand hem nodig heeft. */}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          Maandcijfers als tabel
        </summary>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="border-b border-border/70 text-left text-muted-foreground">
              <th scope="col" className="py-1 font-medium">
                Maand
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Deze periode
              </th>
              {heeftVergelijking && (
                <th scope="col" className="py-1 text-right font-medium">
                  Vorig jaar
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rijen.map((rij) => (
              <tr key={rij.maandKey} className="border-b border-border/40">
                <th scope="row" className="py-1 text-left font-normal">
                  {rij.label}
                </th>
                <td className="py-1 text-right tabular-nums">
                  {euro(rij.ditJaar)}
                </td>
                {heeftVergelijking && (
                  <td className="py-1 text-right tabular-nums text-muted-foreground">
                    {rij.vorigJaar === null ? "—" : euro(rij.vorigJaar)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export const JaarVergelijkingChart = memo(JaarVergelijkingChartBasis);
