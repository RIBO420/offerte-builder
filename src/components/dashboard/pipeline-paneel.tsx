"use client";

import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { formatCurrency } from "@/lib/format";
import {
  PIPELINE_FASEN,
  PIPELINE_FASE_LABEL,
  STATUS_STIP,
} from "./status-tokens";
import { AlleLink } from "./werk-panelen";

export interface OfferteStats {
  concept: number;
  voorcalculatie: number;
  verzonden: number;
  geaccepteerd: number;
  afgewezen: number;
  totaal: number;
}

// ── Pipeline ────────────────────────────────────────────────────────────────

function Staafje({ stats }: { stats: OfferteStats }) {
  const totaal = stats.totaal || 1;

  return (
    <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
      {PIPELINE_FASEN.map((fase) => {
        if (stats[fase] === 0) return null;
        return (
          <div
            key={fase}
            className="rounded-full transition-[width] duration-500"
            style={{
              width: `${(stats[fase] / totaal) * 100}%`,
              backgroundColor: STATUS_STIP[fase],
              minWidth: 4,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * "Waar staan mijn offertes?" — één staaf met een legenda die de tellers draagt.
 * De vier stat-boxen die hier ooit onder stonden herhaalden exact de segmenten.
 */
export function PipelinePaneel({ stats }: { stats: OfferteStats }) {
  return (
    <SectiePaneel
      titel="Offerte pipeline"
      telling={stats.totaal}
      acties={<AlleLink href="/offertes" tekst="Alle offertes" />}
    >
      <div className="flex flex-col gap-3 px-3 py-3">
        <Staafje stats={stats} />

        {/* Legenda: label + teller bij elk segment. Wikkelt vanzelf als het
            blok smal wordt — nooit een horizontale schuifbalk. */}
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          {PIPELINE_FASEN.map((fase) => (
            <li
              key={fase}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_STIP[fase] }}
                aria-hidden="true"
              />
              {PIPELINE_FASE_LABEL[fase]}
              <span className="font-semibold tabular-nums text-foreground">
                {stats[fase]}
              </span>
            </li>
          ))}
        </ul>

        {stats.concept > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {/* §5.3b: wizard-autosaves zijn geen pipeline. Wel zichtbaar, niet meegeteld. */}
            {stats.concept} concept{stats.concept === 1 ? "" : "en"} nog niet in de
            pipeline
          </p>
        )}
      </div>
    </SectiePaneel>
  );
}

// ── Conversie ───────────────────────────────────────────────────────────────

/**
 * "Hoeveel van wat de deur uitgaat, wordt getekend?" De ring is het cijfer;
 * de twee regels eronder maken hem controleerbaar.
 */
export function ConversiePaneel({
  rate,
  aantalGetekend,
  aantalVerstuurd,
  gemiddeldeWaarde,
}: {
  rate: number;
  aantalGetekend: number;
  aantalVerstuurd: number;
  gemiddeldeWaarde: number;
}) {
  const pct = Math.min(100, Math.max(0, rate));
  const omtrek = 2 * Math.PI * 40;
  const streep = (pct / 100) * omtrek;

  return (
    // De doorklik hoort er niet alleen inhoudelijk (de conversie-analyse leeft
    // op /rapportages) maar houdt de kop ook even hoog als die van de pipeline
    // ernaast — zonder actie is de kop 33px en met 41px, en dat verschil zie je
    // meteen als twee panelen naast elkaar staan.
    <SectiePaneel
      titel="Conversie"
      acties={<AlleLink href="/rapportages" tekst="Rapportage" />}
    >
      {/* flex-wrap: in de smalste cel (tablet, ~180px) zakt de uitleg onder de
          ring in plaats van ernaast te blijven duwen. Nooit zijwaarts scrollen. */}
      <div className="flex h-full flex-wrap items-center justify-center gap-x-4 gap-y-2 px-3 py-3">
        <svg
          width={84}
          height={84}
          viewBox="0 0 100 100"
          role="img"
          aria-label={`Conversie ${Math.round(pct)} procent`}
          className="shrink-0"
        >
          <circle cx={50} cy={50} r={40} fill="none" stroke="var(--border)" strokeWidth={8} />
          <circle
            cx={50}
            cy={50}
            r={40}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth={8}
            strokeDasharray={`${streep} ${omtrek - streep}`}
            strokeDashoffset={omtrek * 0.25}
            strokeLinecap="round"
            className="transition-[stroke-dasharray] duration-700"
          />
          <text
            x={50}
            y={50}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={24}
            fontWeight={800}
            fill="var(--primary)"
          >
            {Math.round(pct)}%
          </text>
        </svg>

        <dl className="min-w-0 space-y-1 text-[11px]">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <dt className="text-muted-foreground">Getekend</dt>
            <dd className="font-semibold tabular-nums">
              {aantalGetekend}/{aantalVerstuurd}
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <dt className="text-muted-foreground">Gemiddeld</dt>
            <dd className="font-semibold tabular-nums">
              {formatCurrency(gemiddeldeWaarde, "nl-NL", false)}
            </dd>
          </div>
        </dl>
      </div>
    </SectiePaneel>
  );
}
