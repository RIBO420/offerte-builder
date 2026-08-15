"use client";

/**
 * Sectie 2 — "Wat zit er in de pipeline?"
 *
 * Twee tijdsbegrippen, en dat moet de tekst zeggen in plaats van verzwijgen:
 * open werk is open op dít moment (een offerte van april ligt in augustus nog
 * steeds stil), terwijl de conversie gaat over de offertes die ín de gekozen
 * periode zijn aangemaakt. De sectiekop draagt daarom "Los van de gekozen
 * periode" — dat is de hele reden dat het hier niet verwarrend is.
 *
 * De trechtergrafiek is weg. Een funnel-vorm codeert niets dat een rij staafjes
 * met een percentage ernaast niet beter zegt, en hij was in de schouw ook nog
 * eens volledig zwart.
 */

import Link from "next/link";
import { formatCurrency } from "@/lib/format/currency";
import {
  formatPercentage,
  offerteStatusLabel,
  stilTekst,
  telwoord,
} from "@/lib/rapportage-labels";
import { RangStaven, type StaafRegel } from "@/components/analytics/staafwerk";
import {
  Antwoordzin,
  Bewijs,
  Doorklik,
  Heldcijfer,
  LegeSectie,
  Nadruk,
} from "./antwoord-blok";
import type { Periode, Pipeline } from "./types";

export function SectiePipeline({
  pipeline,
  periode,
}: {
  pipeline: Pipeline;
  periode: Periode;
}) {
  const euro = (bedrag: number) => formatCurrency(bedrag, "nl-NL", false);
  const { openStatussen, funnel, conversie, conversieInPeriode } = pipeline;
  const openTotaal = openStatussen.pipelineTotaal;

  if (openTotaal === 0) {
    return (
      <LegeSectie
        tekst="Er staat op dit moment geen offerte open."
        hint="Zodra een offerte op voorcalculatie of verzonden staat, verschijnt hier de openstaande waarde, de conversie en wat er te lang stil ligt."
        actie={<Doorklik href="/offertes">Bekijk alle offertes</Doorklik>}
      />
    );
  }

  const trap: StaafRegel[] = [
    {
      sleutel: "voorcalculatie",
      label: "Voorcalculatie gemaakt",
      waarde: funnel.voorcalculatie,
      waardeTekst: String(funnel.voorcalculatie),
      bijschrift: "alle offertes vanaf voorcalculatie, concepten niet meegeteld",
    },
    {
      sleutel: "verzonden",
      label: "Naar de klant verstuurd",
      waarde: funnel.verzonden,
      waardeTekst: String(funnel.verzonden),
      bijschrift: `${formatPercentage(conversie.voorcalculatieToVerzonden, 0)} van de voorcalculaties`,
    },
    {
      sleutel: "afgehandeld",
      label: "Beantwoord door de klant",
      waarde: funnel.afgehandeld,
      waardeTekst: String(funnel.afgehandeld),
      bijschrift: `${formatPercentage(conversie.verzondenToAfgehandeld, 0)} van het verstuurde werk`,
    },
    {
      sleutel: "geaccepteerd",
      label: "Getekend",
      waarde: funnel.geaccepteerd,
      waardeTekst: String(funnel.geaccepteerd),
      bijschrift: `${formatPercentage(conversie.afgehandeldToWon, 0)} van de beantwoorde offertes`,
    },
  ];

  const stil = pipeline.blijftLiggen.filter(
    (regel) => regel.dagenStil >= pipeline.drempelDagen
  );

  return (
    <div className="grid gap-x-12 gap-y-9 @min-[54rem]/blok:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div>
        <Antwoordzin className="mb-7">
          {openTotaal === 1 ? "Er staat " : "Er staan "}
          <Nadruk>{telwoord(openTotaal, "offerte", "offertes")}</Nadruk> open
          ter waarde van{" "}
          <Nadruk>{euro(pipeline.openWaardeInclBtw)}</Nadruk> incl. btw.
          {pipeline.aantalBlijftLiggen > 0 ? (
            <>
              {" "}
              Daarvan liggen er{" "}
              <Nadruk>{pipeline.aantalBlijftLiggen}</Nadruk> langer dan{" "}
              {pipeline.drempelDagen} dagen stil.
            </>
          ) : (
            <> Er ligt niets langer dan {pipeline.drempelDagen} dagen stil.</>
          )}
        </Antwoordzin>

        <Heldcijfer
          label="Open werk, incl. btw"
          waarde={euro(pipeline.openWaardeInclBtw)}
          onder={
            <>
              {openStatussen.voorcalculatie} in voorcalculatie ·{" "}
              {openStatussen.verzonden} bij de klant
            </>
          }
        />

        <dl className="mt-7 divide-y divide-border/70 border-y border-border/70">
          <div className="flex items-baseline justify-between gap-3 py-2">
            {/* Inclusief concepten: de wizard slaat automatisch op, dus deze
                teller staat hoger dan de trap hiernaast — die begint pas bij
                voorcalculatie. Dat verschil hoort in het label te staan, niet
                in een voetnoot. */}
            <dt className="text-sm text-muted-foreground">
              Aangemaakt in {periode.label}, incl. concepten
            </dt>
            <dd className="text-sm font-medium tabular-nums">
              {telwoord(pipeline.aangemaaktInPeriode, "offerte", "offertes")}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-2">
            <dt className="text-sm text-muted-foreground">
              Conversie van de voorcalculaties uit {periode.label}
            </dt>
            <dd className="text-sm font-medium tabular-nums">
              {pipeline.aangemaaktInPeriode > 0
                ? formatPercentage(conversieInPeriode.overallConversion, 0)
                : "nog niets"}
            </dd>
          </div>
        </dl>

        <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
          <Doorklik href="/offertes?status=verzonden">
            {openStatussen.verzonden === 1
              ? "Bekijk de verstuurde offerte"
              : `Bekijk de ${openStatussen.verzonden} verstuurde offertes`}
          </Doorklik>
          <Doorklik href="/offertes?status=voorcalculatie">
            Bekijk de voorcalculaties
          </Doorklik>
        </div>
      </div>

      <div className="min-w-0 space-y-9">
        <Bewijs titel="Van voorcalculatie tot handtekening" toelichting="alle tijd">
          <RangStaven regels={trap} maximum={funnel.voorcalculatie} />
        </Bewijs>

        <Bewijs
          titel="Blijft liggen"
          toelichting={`langer dan ${pipeline.drempelDagen} dagen stil`}
        >
          {stil.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Niets blijft liggen — elke open offerte is de afgelopen{" "}
              {pipeline.drempelDagen} dagen nog in beweging geweest.
            </p>
          ) : (
            <ul className="divide-y divide-border/70">
              {stil.slice(0, 6).map((regel) => (
                <li key={regel.offerteId}>
                  <Link
                    href={`/offertes/${regel.offerteId}`}
                    className="-mx-2 flex items-baseline justify-between gap-4 rounded-md px-2 py-2.5 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {regel.klantNaam}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {regel.offerteNummer} ·{" "}
                        {offerteStatusLabel(regel.status)} ·{" "}
                        {euro(regel.bedragInclBtw)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-[var(--chart-2)]">
                      {stilTekst(regel.dagenStil)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Bewijs>
      </div>
    </div>
  );
}
