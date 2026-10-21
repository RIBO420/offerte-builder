import type { CSSProperties } from "react";
import { TopTuinenLogo } from "@/components/ui/top-tuinen-logo";
import { formatCurrency } from "@/lib/format/currency";
import { formatDecimal } from "@/lib/format/number";
import { formatDate } from "./types";

/**
 * Het papiervel blijft ook in het donkere thema licht: zo ziet de klant de
 * factuur (PDF, mail). Daarom zet het vel de lichte waarden van de
 * Loof & Leem-tokens lokaal terug — dezelfde waarden als `:root` in
 * `src/app/globals.css`. Binnen het vel werken de gewone klassen
 * (`bg-background`, `text-muted-foreground`, `border`) dus licht, ook onder
 * `.dark` (`@theme inline` laat utilities naar `var(--token)` wijzen).
 */
const PAPIER_TOKENS = {
  "--background": "oklch(0.982 0.002 140)",
  "--foreground": "oklch(0.19 0.01 150)",
  "--muted": "oklch(0.957 0.003 140)",
  "--muted-foreground": "oklch(0.45 0.015 150)",
  "--border": "oklch(0.905 0.006 140)",
  "--primary": "oklch(0.44 0.11 152)",
  colorScheme: "light",
} as CSSProperties;

export interface PapierRegel {
  id?: string;
  omschrijving: string;
  hoeveelheid: number;
  eenheid: string;
  prijsPerEenheid: number;
  totaal: number;
}

export interface FactuurPapierProps {
  /** Klantgerichte naam: "Top Tuinen", nooit "Top Tuinen OS". */
  bedrijfNaam: string;
  nummer?: string;
  factuurdatum?: number;
  vervaldatum?: number;
  klant?: { naam: string; adres?: string; postcode?: string; plaats?: string };
  projectNaam: string;
  regels?: PapierRegel[];
  correcties?: { omschrijving: string; bedrag: number }[] | null;
  /** Ontbreekt bij een project zonder offerte: dan geen bedragen. */
  bedragen?: {
    subtotaal: number;
    btw: { label: string; bedrag: number }[];
    totaal: number;
  };
  notities?: string;
  /** Wettelijke vermelding onder de totalen (bv. btw verlegd) */
  vermelding?: string;
}

const LABEL = "mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

export function FactuurPapier({
  bedrijfNaam,
  nummer,
  factuurdatum,
  vervaldatum,
  klant,
  projectNaam,
  regels,
  correcties,
  bedragen,
  notities,
  vermelding,
}: FactuurPapierProps) {
  const kenmerk = [nummer, factuurdatum ? formatDate(factuurdatum) : null].filter(Boolean).join(" · ");

  return (
    <div
      style={PAPIER_TOKENS}
      className="@container/papier flex flex-col gap-7 rounded-lg bg-background px-5 py-8 text-foreground shadow-card-elevated @xl/vel:px-11 @xl/vel:py-10"
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="grid size-8 place-items-center rounded-[9px] bg-primary">
            <TopTuinenLogo variant="wit" size={22} />
          </span>
          <span className="font-display text-lg font-semibold">{bedrijfNaam}</span>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-semibold">Factuur</p>
          {kenmerk && <p className="text-[13px] text-muted-foreground tabular-nums">{kenmerk}</p>}
          {vervaldatum && (
            <p className="text-[13px] text-muted-foreground tabular-nums">
              Te betalen vóór {formatDate(vervaldatum)}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 text-sm @md/papier:grid-cols-2">
        <div className="min-w-0">
          <p className={LABEL}>Factuur voor</p>
          {klant ? (
            <>
              <p className="font-semibold">{klant.naam}</p>
              {klant.adres && <p>{klant.adres}</p>}
              {(klant.postcode || klant.plaats) && (
                <p>{[klant.postcode, klant.plaats].filter(Boolean).join(" ")}</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Geen klantgegevens</p>
          )}
        </div>
        <div className="min-w-0">
          <p className={LABEL}>Project</p>
          <p>{projectNaam}</p>
        </div>
      </div>

      {regels && regels.length > 0 && (
        <div className="text-sm">
          <div
            aria-hidden="true"
            className="hidden grid-cols-[minmax(0,1fr)_6rem_6.5rem_6.5rem] gap-3 border-b pb-2 text-xs text-muted-foreground @xl/papier:grid"
          >
            <span>Omschrijving</span>
            <span className="text-right">Aantal</span>
            <span className="text-right">Prijs</span>
            <span className="text-right">Totaal</span>
          </div>
          <ul className="divide-y">
            {regels.map((regel, i) => (
              <li
                key={regel.id ?? i}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 py-2 @xl/papier:grid-cols-[minmax(0,1fr)_6rem_6.5rem_6.5rem]"
              >
                <span className="min-w-0 break-words">{regel.omschrijving}</span>
                <span className="order-last col-span-full text-xs text-muted-foreground tabular-nums @xl/papier:order-none @xl/papier:col-span-1 @xl/papier:text-right @xl/papier:text-sm @xl/papier:text-foreground">
                  {formatDecimal(regel.hoeveelheid, regel.hoeveelheid % 1 === 0 ? 0 : 2)} {regel.eenheid}
                  <span className="@xl/papier:hidden"> × {formatCurrency(regel.prijsPerEenheid)}</span>
                </span>
                <span className="hidden text-right tabular-nums @xl/papier:inline">
                  {formatCurrency(regel.prijsPerEenheid)}
                </span>
                <span className="text-right font-medium tabular-nums">{formatCurrency(regel.totaal)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {correcties && correcties.length > 0 && (
        <div className="text-sm">
          <p className={LABEL}>Correcties</p>
          <ul className="flex flex-col gap-1">
            {correcties.map((c, i) => (
              <li key={i} className="flex justify-between gap-4">
                <span className="min-w-0 text-muted-foreground">{c.omschrijving}</span>
                <span className="shrink-0 tabular-nums">
                  {c.bedrag >= 0 ? "+" : ""}
                  {formatCurrency(c.bedrag)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {bedragen && (
        <dl className="grid grid-cols-[1fr_auto] gap-y-2 border-t pt-[18px] text-sm">
          <dt className="text-muted-foreground">Subtotaal</dt>
          <dd className="text-right tabular-nums">{formatCurrency(bedragen.subtotaal)}</dd>
          {bedragen.btw.map((b) => (
            <div key={b.label} className="contents">
              <dt className="text-muted-foreground">{b.label}</dt>
              <dd className="text-right tabular-nums">{formatCurrency(b.bedrag)}</dd>
            </div>
          ))}
          <dt className="border-t pt-2.5 text-base font-semibold">Totaal</dt>
          <dd className="border-t pt-2.5 text-right font-display text-xl font-semibold tabular-nums">
            {formatCurrency(bedragen.totaal)}
          </dd>
        </dl>
      )}

      {vermelding && (
        <p className="whitespace-pre-wrap border-t pt-4 text-[13px] font-medium">{vermelding}</p>
      )}
      {notities && (
        <p className="whitespace-pre-wrap border-t pt-4 text-[13px] text-muted-foreground">{notities}</p>
      )}
    </div>
  );
}
