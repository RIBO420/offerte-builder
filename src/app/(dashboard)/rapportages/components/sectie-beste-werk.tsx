"use client";

/**
 * Sectie 4 — "Wat is mijn beste werk?"
 *
 * Twee ranglijsten, allebei horizontale staven (R3): welk soort werk levert op,
 * en welke klanten leveren op. De oude pagina had hier drie tabs voor
 * (Klanten, Winstgevendheid, deels Medewerkers), waarvan er twee exact dezelfde
 * tabel toonden en de derde negen even lange balken van 13%.
 *
 * Klantnamen linken door naar het dossier: het cijfer moet natelbaar zijn.
 */

import Link from "next/link";
import { formatCurrency } from "@/lib/format/currency";
import {
  formatPercentage,
  scopeLabel,
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
import type { BesteWerk, Periode } from "./types";

export function SectieBesteWerk({
  besteWerk,
  periode,
}: {
  besteWerk: BesteWerk;
  periode: Periode;
}) {
  const euro = (bedrag: number) => formatCurrency(bedrag, "nl-NL", false);

  const scopes = besteWerk.scopeMarges.filter((rij) => rij.omzetExclBtw > 0);
  const klanten = besteWerk.topKlanten.filter(
    (klant) => klant.getekendeOmzetExclBtw > 0
  );

  if (scopes.length === 0 && klanten.length === 0) {
    return (
      <LegeSectie
        tekst={`In ${periode.label} is nog geen werk getekend.`}
        hint="Zodra er offertes getekend zijn, staat hier welk soort werk het meeste opbrengt en welke klanten daar het grootste aandeel in hebben."
        actie={<Doorklik href="/klanten">Bekijk je klanten</Doorklik>}
      />
    );
  }

  const grootste = scopes[0];
  // "Beste werk" is niet het grootste werk maar het werk met de beste marge —
  // vandaar de aparte keuze en niet simpelweg scopes[0].
  const besteMarge = scopes.reduce(
    (beste, rij) => (rij.margePercentage > beste.margePercentage ? rij : beste),
    scopes[0]
  );
  // Staat er op elke offerte hetzelfde margepercentage (wat gebeurt zodra
  // niemand de opslagen per scope heeft ingevuld), dan is "beste marge" een
  // loterij tussen gelijke getallen. Dan is de eerlijke kop: dít is het
  // grootste onderdeel, en de marge zegt hier nog niets.
  const margeSpreiding = besteMarge
    ? besteMarge.margePercentage -
      scopes.reduce(
        (laagste, rij) =>
          rij.margePercentage < laagste ? rij.margePercentage : laagste,
        besteMarge.margePercentage
      )
    : 0;
  const margesVerschillen = margeSpreiding >= 1;
  const topKlant = klanten[0];

  const scopeRegels: StaafRegel[] = scopes.slice(0, 8).map((rij) => ({
    sleutel: rij.scope,
    label: scopeLabel(rij.scope),
    waarde: rij.omzetExclBtw,
    waardeTekst: euro(rij.omzetExclBtw),
    bijschrift: `${formatPercentage(rij.margePercentage)} marge · ${telwoord(
      rij.aantalOffertes,
      "opdracht",
      "opdrachten"
    )}`,
  }));

  return (
    <div className="grid gap-x-12 gap-y-9 @min-[54rem]/blok:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div>
        <Antwoordzin className="mb-7">
          {margesVerschillen && besteMarge ? (
            <>
              Je beste marge zit in{" "}
              <Nadruk>{scopeLabel(besteMarge.scope)}</Nadruk>:{" "}
              <Nadruk>{formatPercentage(besteMarge.margePercentage)}</Nadruk> op{" "}
              {euro(besteMarge.omzetExclBtw)} getekend werk.
              {grootste && grootste.scope !== besteMarge.scope && (
                <>
                  {" "}
                  De meeste omzet komt uit{" "}
                  <Nadruk>{scopeLabel(grootste.scope)}</Nadruk> (
                  {formatPercentage(grootste.aandeelPercentage, 0)} van het
                  totaal).
                </>
              )}
            </>
          ) : (
            grootste && (
              <>
                De meeste omzet komt uit{" "}
                <Nadruk>{scopeLabel(grootste.scope)}</Nadruk>:{" "}
                <Nadruk>{euro(grootste.omzetExclBtw)}</Nadruk>,{" "}
                {formatPercentage(grootste.aandeelPercentage, 0)} van het
                getekende werk. De marge is op elk onderdeel{" "}
                {formatPercentage(grootste.margePercentage)} — zolang de
                opslagen per scope gelijk staan, zegt dat cijfer niets over
                welk werk het beste rendeert.
              </>
            )
          )}
          {topKlant && (
            <>
              {" "}
              <Nadruk>{topKlant.klantNaam}</Nadruk> was je grootste klant met{" "}
              {euro(topKlant.getekendeOmzetExclBtw)}.
            </>
          )}
        </Antwoordzin>

        {margesVerschillen && besteMarge ? (
          <Heldcijfer
            label={`Beste marge — ${scopeLabel(besteMarge.scope)}`}
            waarde={formatPercentage(besteMarge.margePercentage).replace(
              "%",
              ""
            )}
            eenheid="%"
            onder={
              <>
                {euro(besteMarge.marge)} marge op{" "}
                {euro(besteMarge.omzetExclBtw)} getekend werk ·{" "}
                {telwoord(besteMarge.aantalOffertes, "opdracht", "opdrachten")}
              </>
            }
          />
        ) : (
          grootste && (
            <Heldcijfer
              label={`Grootste onderdeel — ${scopeLabel(grootste.scope)}`}
              waarde={euro(grootste.omzetExclBtw)}
              onder={
                <>
                  {formatPercentage(grootste.aandeelPercentage, 0)} van het
                  getekende werk ·{" "}
                  {telwoord(grootste.aantalOffertes, "opdracht", "opdrachten")}
                </>
              }
            />
          )
        )}

        <dl className="mt-7 divide-y divide-border/70 border-y border-border/70">
          <div className="flex items-baseline justify-between gap-3 py-2">
            <dt className="text-sm text-muted-foreground">
              Klanten met werk in {periode.label}
            </dt>
            <dd className="text-sm font-medium tabular-nums">
              {besteWerk.aantalKlanten}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-2">
            <dt className="text-sm text-muted-foreground">
              Daarvan meer dan één opdracht
            </dt>
            <dd className="text-sm font-medium tabular-nums">
              {besteWerk.aantalTerugkerend}
            </dd>
          </div>
        </dl>

        <div className="mt-7">
          <Doorklik href="/klanten">Bekijk alle klanten</Doorklik>
        </div>
      </div>

      <div className="min-w-0 space-y-9">
        <Bewijs
          titel="Getekend werk per onderdeel"
          toelichting="excl. btw"
        >
          {scopeRegels.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Het getekende werk heeft nog geen onderdelen.
            </p>
          ) : (
            <RangStaven regels={scopeRegels} />
          )}
        </Bewijs>

        <Bewijs titel="Grootste klanten" toelichting="in deze periode">
          {klanten.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Nog geen klant met getekend werk in deze periode.
            </p>
          ) : (
            <ul className="divide-y divide-border/70">
              {klanten.slice(0, 6).map((klant) => {
                const rij = (
                  <>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {klant.klantNaam}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {telwoord(klant.aantalGetekend, "opdracht", "opdrachten")}
                        {klant.isTerugkerend && " · terugkerend"} ·{" "}
                        {formatPercentage(klant.margePercentage)} marge
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {euro(klant.getekendeOmzetExclBtw)}
                    </span>
                  </>
                );
                return (
                  <li key={klant.klantId ?? klant.klantNaam}>
                    {klant.klantId ? (
                      <Link
                        href={`/klanten/${klant.klantId}`}
                        className="-mx-2 flex items-baseline justify-between gap-4 rounded-md px-2 py-2.5 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {rij}
                      </Link>
                    ) : (
                      <div className="flex items-baseline justify-between gap-4 py-2.5">
                        {rij}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Bewijs>
      </div>
    </div>
  );
}
