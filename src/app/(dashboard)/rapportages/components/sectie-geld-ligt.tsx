"use client";

/**
 * Sectie 3 — "Waar blijft geld liggen?"
 *
 * Twee soorten stilstaand geld onder één vraag:
 *   a. facturen die de deur uit zijn maar niet betaald (bewust niet
 *      periodegebonden — openstaand geld is openstaand, ook als de factuur van
 *      vorig kwartaal is);
 *   b. uren die wél gemaakt maar niet begroot zijn (wél periodegebonden, met de
 *      nacalculatie als peildatum).
 *
 * De diepere calculatie-analyse zit achter een uitklap (progressive
 * disclosure): op de oude pagina stond dat als een volle tab met verzonnen
 * cijfers, terwijl de twee échte componenten eronder leeg bungelden.
 */

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/format/currency";
import {
  dagenTekst,
  formatPercentage,
  ouderdomLabel,
  ouderdomLabelKort,
  ouderdomVraagtAandacht,
  scopeLabel,
  telwoord,
  urenTekst,
  type PeriodePreset,
} from "@/lib/rapportage-labels";
import {
  RangStaven,
  StapelBalk,
  type StaafRegel,
  type StapelDeel,
} from "@/components/analytics/staafwerk";
// Echte data, geen sample: de twee componenten die op de oude pagina onder het
// nepgeweld bungelden staan nu in de uitklap waar ze horen.
import { BeurtNacalculatie } from "@/components/analytics/beurt-nacalculatie";
import { NormuurSuggesties } from "@/components/catalogus/normuur-suggesties";
import { cn } from "@/lib/utils";
import {
  Antwoordzin,
  Bewijs,
  Doorklik,
  Heldcijfer,
  LegeSectie,
  Nadruk,
} from "./antwoord-blok";
import { VoorNacalculatieDetail } from "./voor-nacalculatie-detail";
import type { GeldLigt, Periode } from "./types";

/** Oudste eerst: wat het langst buiten staat verdient de eerste blik. */
const BUCKET_VOLGORDE = [
  "ouder_dan_60_dagen",
  "31_60_dagen",
  "1_30_dagen",
  "nog_niet_vervallen",
] as const;

/** Alles wat de vervaldatum voorbij is — samen "te laat". */
const VERVALLEN_BUCKETS = BUCKET_VOLGORDE.filter(ouderdomVraagtAandacht);

export function SectieGeldLigt({
  geldLigt,
  periode,
  preset,
  startDate,
  endDate,
}: {
  geldLigt: GeldLigt;
  periode: Periode;
  preset: PeriodePreset;
  startDate?: number;
  endDate?: number;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const euro = (bedrag: number) => formatCurrency(bedrag, "nl-NL", false);
  const { openstaand, voorNacalculatie } = geldLigt;

  const teLaatBedrag = VERVALLEN_BUCKETS.reduce(
    (som, bucket) => som + (openstaand.perBucket[bucket]?.bedrag ?? 0),
    0
  );
  const teLaatAantal = VERVALLEN_BUCKETS.reduce(
    (som, bucket) => som + (openstaand.perBucket[bucket]?.aantal ?? 0),
    0
  );

  const delen: StapelDeel[] = BUCKET_VOLGORDE.map((bucket) => ({
    sleutel: bucket,
    label: ouderdomLabel(bucket),
    waarde: openstaand.perBucket[bucket]?.bedrag ?? 0,
    waardeTekst: euro(openstaand.perBucket[bucket]?.bedrag ?? 0),
    vraagtAandacht: ouderdomVraagtAandacht(bucket),
  }));

  const scopeAfwijkingen: StaafRegel[] = voorNacalculatie.scopes
    .slice(0, 6)
    .map((rij) => ({
      sleutel: rij.scope,
      label: scopeLabel(rij.scope),
      waarde: Math.abs(rij.afwijkingEuro),
      waardeTekst: `${rij.afwijkingEuro > 0 ? "+" : ""}${euro(rij.afwijkingEuro)}`,
      vraagtAandacht: rij.afwijkingEuro > 0,
      bijschrift: `${urenTekst(rij.geplandeUren)} begroot, ${urenTekst(
        rij.werkelijkeUren
      )} gemaakt`,
    }));

  const heeftOpenstaand = openstaand.totaalOpenstaand > 0;
  const heeftNacalculatie = voorNacalculatie.aantalProjecten > 0;

  if (!heeftOpenstaand && !heeftNacalculatie) {
    return (
      <LegeSectie
        tekst="Er staat geen geld stil."
        hint={
          voorNacalculatie.projectenZonderNacalculatie > 0
            ? `Alle verstuurde facturen zijn betaald. Wel wachten ${telwoord(
                voorNacalculatie.projectenZonderNacalculatie,
                "afgerond project",
                "afgeronde projecten"
              )} nog op een nacalculatie — pas daarna is te zien of de begroting klopte.`
            : "Alle verstuurde facturen zijn betaald, en er is in deze periode nog geen project nagecalculeerd."
        }
        actie={<Doorklik href="/facturen">Bekijk de facturen</Doorklik>}
      />
    );
  }

  return (
    <div className="space-y-12">
      {/* ── a. Facturen die nog buiten staan ───────────────────────────── */}
      <div className="grid gap-x-12 gap-y-9 @min-[54rem]/blok:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div>
          <Antwoordzin className="mb-7">
            {heeftOpenstaand ? (
              <>
                Er staat <Nadruk>{euro(openstaand.totaalOpenstaand)}</Nadruk> aan
                verstuurde facturen nog buiten
                {teLaatAantal > 0 ? (
                  <>
                    , waarvan <Nadruk>{euro(teLaatBedrag)}</Nadruk> over de
                    vervaldatum heen is.
                  </>
                ) : (
                  <> — nog niets is vervallen.</>
                )}{" "}
                Gemiddeld staat dat geld{" "}
                <Nadruk>{dagenTekst(openstaand.gemiddeldeOuderdomDagen)}</Nadruk>{" "}
                te laat.
              </>
            ) : (
              <>Elke verstuurde factuur is betaald.</>
            )}
          </Antwoordzin>

          <Heldcijfer
            label="Openstaand, incl. btw"
            waarde={euro(openstaand.totaalOpenstaand)}
            toon={teLaatBedrag > 0 ? "aandacht" : "neutraal"}
            onder="Losstaand van de gekozen periode: een factuur van vorig kwartaal staat ook vandaag nog open."
          />

          <div className="mt-7">
            <Doorklik href="/facturen">
              {openstaand.regels.length === 1
                ? "Bekijk de openstaande factuur"
                : "Bekijk alle openstaande facturen"}
            </Doorklik>
          </div>
        </div>

        <div className="min-w-0 space-y-9">
          <Bewijs titel="Openstaand geld naar ouderdom">
            {heeftOpenstaand ? (
              <StapelBalk delen={delen} />
            ) : (
              <p className="py-2 text-sm text-muted-foreground">
                Niets openstaand.
              </p>
            )}
          </Bewijs>

          {openstaand.regels.length > 0 && (
            <Bewijs titel="Langst open" toelichting="oudste eerst">
              <ul className="divide-y divide-border/70">
                {openstaand.regels.slice(0, 5).map((regel) => (
                  <li key={regel.factuurId}>
                    <Link
                      href="/facturen"
                      className="-mx-2 flex items-baseline justify-between gap-4 rounded-md px-2 py-2.5 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {regel.klantNaam}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {regel.factuurnummer} ·{" "}
                          {ouderdomLabelKort(regel.bucket)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-sm font-medium tabular-nums",
                          regel.dagenTeLaat > 0
                            ? "text-[var(--chart-2)]"
                            : "text-foreground"
                        )}
                      >
                        {euro(regel.openstaand)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Bewijs>
          )}
        </div>
      </div>

      {/* ── b. Uren die niemand betaald heeft ──────────────────────────── */}
      <div className="border-t border-border/70 pt-9">
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Begroot tegenover werkelijk
        </h3>

        {!heeftNacalculatie ? (
          <p className="mt-2 max-w-[60ch] text-sm text-pretty text-muted-foreground">
            In {periode.label} is nog geen project nagecalculeerd.
            {voorNacalculatie.projectenZonderNacalculatie > 0 && (
              <>
                {" "}
                {telwoord(
                  voorNacalculatie.projectenZonderNacalculatie,
                  "afgerond project wacht",
                  "afgeronde projecten wachten"
                )}{" "}
                nog op een nacalculatie; zolang die ontbreekt is niet te zien of
                de begroting klopte.
              </>
            )}
          </p>
        ) : (
          <div className="mt-6 grid gap-x-12 gap-y-9 @min-[54rem]/blok:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div>
              <Antwoordzin className="mb-7">
                Over{" "}
                <Nadruk>
                  {telwoord(
                    voorNacalculatie.aantalProjecten,
                    "nagecalculeerd project",
                    "nagecalculeerde projecten"
                  )}
                </Nadruk>{" "}
                zijn{" "}
                <Nadruk>{urenTekst(Math.abs(voorNacalculatie.afwijkingUren))}</Nadruk>{" "}
                {voorNacalculatie.afwijkingUren >= 0 ? "méér" : "minder"} gemaakt
                dan begroot.{" "}
                {voorNacalculatie.afwijkingUren > 0 ? (
                  <>
                    Tegen {euro(voorNacalculatie.uurtarief)} per uur is dat{" "}
                    <Nadruk>{euro(voorNacalculatie.afwijkingEuro)}</Nadruk> aan
                    werk dat niemand betaald heeft.
                  </>
                ) : (
                  <>Dat is {euro(Math.abs(voorNacalculatie.afwijkingEuro))} aan
                    uren die je niet nodig had.</>
                )}
              </Antwoordzin>

              <Heldcijfer
                label={
                  voorNacalculatie.afwijkingUren > 0
                    ? "Niet begroot, wel gewerkt"
                    : "Onder de begroting gebleven"
                }
                waarde={euro(Math.abs(voorNacalculatie.afwijkingEuro))}
                toon={voorNacalculatie.afwijkingUren > 0 ? "aandacht" : "neutraal"}
                formaat="middel"
                onder={
                  <>
                    {formatPercentage(
                      Math.abs(voorNacalculatie.afwijkingPercentage)
                    )}{" "}
                    van de begrote uren ·{" "}
                    {voorNacalculatie.accurateProjecten} van de{" "}
                    {voorNacalculatie.aantalProjecten} projecten bleef binnen 10%
                  </>
                }
              />

              {voorNacalculatie.projectenZonderNacalculatie > 0 && (
                <p className="mt-5 max-w-[52ch] rounded-md border border-dashed border-border bg-muted/25 px-3 py-2.5 text-xs text-pretty text-muted-foreground">
                  Dit beeld is onvolledig:{" "}
                  {telwoord(
                    voorNacalculatie.projectenZonderNacalculatie,
                    "afgerond project heeft",
                    "afgeronde projecten hebben"
                  )}{" "}
                  in deze periode nog geen nacalculatie.
                </p>
              )}

            </div>

            <Bewijs
              titel="Afwijking per onderdeel"
              toelichting={`tegen ${euro(voorNacalculatie.uurtarief)} per uur`}
            >
              {scopeAfwijkingen.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">
                  De nacalculaties bevatten nog geen afwijking per onderdeel.
                </p>
              ) : (
                <RangStaven regels={scopeAfwijkingen} />
              )}
            </Bewijs>
          </div>
        )}

        {/* Progressive disclosure: de diepe calculatie-analyse. Op de oude
            pagina was dit een volle tab met verzonnen scopes; hier staat het
            achter één knop, over de volle breedte omdat er brede tabellen in
            zitten (nooit zijwaarts scrollen in een halve kolom). */}
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setDetailOpen((open) => !open)}
            aria-expanded={detailOpen}
            aria-controls="calculatie-detail"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {detailOpen
              ? "Verberg de calculatie-analyse"
              : "Toon de calculatie-analyse per project en beurt"}
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform duration-300 ease-out motion-reduce:transition-none",
                detailOpen && "rotate-180"
              )}
            />
          </button>

          {detailOpen && (
            <div id="calculatie-detail" className="mt-5 space-y-8">
              <div>
                <h4 className="mb-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  Projecten in {periode.label}
                </h4>
                <VoorNacalculatieDetail
                  preset={preset}
                  startDate={startDate}
                  endDate={endDate}
                />
              </div>
              <NormuurSuggesties />
              <BeurtNacalculatie />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
