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

// ── Pijplijn + conversie (dashboard A) ──────────────────────────────────────

export interface ConversieCijfers {
  rate: number;
  aantalGetekend: number;
  aantalVerstuurd: number;
  gemiddeldeWaarde: number;
}

/**
 * De geldkolom heeft één offertepaneel: per fase een eigen balk (in een
 * smalle kolom lees je vier balken sneller dan één gestapelde staaf met een
 * legenda), en de conversie als voetregel eronder — het is hetzelfde
 * onderwerp, dus geen eigen doos.
 *
 * De balken schalen op de grootste fase, niet op het totaal: zo is het
 * verschil tussen fasen zichtbaar, ook als één fase domineert.
 */
export function OffertePijplijnPaneel({
  stats,
  conversie,
}: {
  stats: OfferteStats;
  conversie: ConversieCijfers;
}) {
  const grootste = Math.max(1, ...PIPELINE_FASEN.map((fase) => stats[fase]));
  const pct = Math.min(100, Math.max(0, conversie.rate));
  const omtrek = 2 * Math.PI * 23;
  const streep = (pct / 100) * omtrek;

  return (
    <SectiePaneel
      titel="Offertepijplijn"
      kopbalk
      telling={stats.totaal}
      acties={<AlleLink href="/offertes" tekst="Alle offertes" />}
    >
      <div className="flex flex-col gap-3 px-3 py-3">
        <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)_2rem] items-center gap-x-2.5 gap-y-2">
          {PIPELINE_FASEN.map((fase) => (
            <div key={fase} className="contents">
              <dt className="truncate text-[13px] text-muted-foreground">
                {PIPELINE_FASE_LABEL[fase]}
              </dt>
              <dd className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${(stats[fase] / grootste) * 100}%`,
                    backgroundColor: STATUS_STIP[fase],
                    minWidth: stats[fase] > 0 ? 4 : 0,
                  }}
                />
              </dd>
              <dd className="text-right text-sm font-semibold tabular-nums">
                {stats[fase]}
              </dd>
            </div>
          ))}
        </dl>

        {stats.concept > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {/* §5.3b: wizard-autosaves zijn geen pipeline. Wel zichtbaar, niet meegeteld. */}
            + {stats.concept} concept{stats.concept === 1 ? "" : "en"} nog niet in de
            pipeline
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 border-t px-3 py-3">
        <svg
          width={56}
          height={56}
          viewBox="0 0 56 56"
          role="img"
          aria-label={`Conversie ${Math.round(pct)} procent`}
          className="shrink-0"
        >
          <circle cx={28} cy={28} r={23} fill="none" stroke="var(--border)" strokeWidth={6} />
          <circle
            cx={28}
            cy={28}
            r={23}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth={6}
            strokeDasharray={`${streep} ${omtrek - streep}`}
            strokeDashoffset={omtrek * 0.25}
            strokeLinecap="round"
            className="transition-[stroke-dasharray] duration-700"
          />
          <text
            x={28}
            y={28}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={13}
            fontWeight={700}
            fill="var(--foreground)"
          >
            {Math.round(pct)}%
          </text>
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Conversie</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {conversie.aantalGetekend} van {conversie.aantalVerstuurd} getekend · gem.{" "}
            {formatCurrency(conversie.gemiddeldeWaarde, "nl-NL", false)}
          </p>
        </div>
        <AlleLink href="/rapportages" tekst="Rapportage" />
      </div>
    </SectiePaneel>
  );
}
