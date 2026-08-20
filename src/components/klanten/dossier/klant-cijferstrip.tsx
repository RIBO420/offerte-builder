"use client";

import { Cel, Cijferstrip } from "@/components/ui/cijferstrip";
import type { DossierTab, DossierTellingen } from "./dossier-nav";

/**
 * De statregel boven het klantdossier (prototype v13 §A1): vier tegels die het
 * dossier samenvatten én bedienen.
 *
 * Elke tegel heeft een 4px gekleurde linkerbalk, zodat je de strook op kleur
 * scant in plaats van op tekst. De betekenis komt uit inventaris §C, vertaald
 * naar onze eigen tokens (nooit de prototype-hexwaarden):
 *
 * - **amber** (`status-herinnering-dot`) — geld: wat er nog binnen moet komen;
 * - **groen** (`chart-1`) — werk: wat er nog te doen staat;
 * - **kleibruin** (`accent-warm`) — kansen: offertes;
 * - **donkergroen** (`primary`) — relatie: wanneer sprak je deze klant.
 *
 * Dezelfde strook als op het dashboard (`@/components/ui/cijferstrip`), maar de
 * tegels zijn hier knoppen in plaats van links: ze zetten `?tab=` op dezelfde
 * pagina, en een link die niet navigeert hoort geen link te zijn.
 */

function datumKort(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "2026-08-25" → "di 25 aug"; een onleesbare waarde geeft null. */
function deadlineKort(deadline: string): string | null {
  const datum = new Date(`${deadline}T12:00:00`);
  if (Number.isNaN(datum.getTime())) return null;
  return datum.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Zelfde kalenderdag als nu — dan zegt "vandaag" meer dan een datum. */
function isVandaag(timestamp: number): boolean {
  const datum = new Date(timestamp);
  const nu = new Date();
  return (
    datum.getFullYear() === nu.getFullYear() &&
    datum.getMonth() === nu.getMonth() &&
    datum.getDate() === nu.getDate()
  );
}

export function KlantCijferstrip({
  tellingen,
  klantSinds,
  actief,
  onKies,
}: {
  tellingen: DossierTellingen | null | undefined;
  /** `createdAt` van de klant — de voetregel onder "Laatste contact". */
  klantSinds: number;
  actief: DossierTab;
  onKies: (tab: DossierTab) => void;
}) {
  const openstaand = tellingen?.openstaandBedrag ?? 0;
  const openFacturen = tellingen?.openFacturen ?? 0;
  // Rood is in v13 gereserveerd voor "staat langer dan 30 dagen open"; een
  // factuur die net over de vervaldatum is blijft amber (§A2).
  const ouderDan30 = tellingen?.factuurOuderDan30 === true;
  const openTaken = tellingen?.openTaken ?? 0;
  const eerstvolgende = tellingen?.eerstvolgendeDeadline ?? null;
  const offertes = tellingen?.offertesTotaal ?? 0;
  const concepten = tellingen?.offertesConcept ?? 0;
  const laatsteContact = tellingen?.laatsteContactOp ?? null;

  const eerstvolgendeTekst = eerstvolgende ? deadlineKort(eerstvolgende) : null;

  return (
    <Cijferstrip
      label="Kerncijfers van deze klant"
      className="@container/klantcijfers"
      kolommen="grid-cols-1 @[26rem]/klantcijfers:grid-cols-2 @[52rem]/klantcijfers:grid-cols-4"
    >
      <Cel
        label="Openstaand"
        balk="bg-status-herinnering-dot"
        onClick={() => onKies("facturen")}
        actief={actief === "facturen"}
        waarde={openstaand}
        // Geld dat binnen moet komen krijgt kleur; een nul blijft stil.
        waardeClassName={
          openstaand > 0
            ? ouderDan30
              ? "text-status-vervallen-text"
              : "text-status-herinnering-text"
            : undefined
        }
        voet={
          openFacturen === 0 ? (
            <span className="text-muted-foreground">geen open facturen</span>
          ) : (
            <span
              className={
                ouderDan30
                  ? "text-status-vervallen-text tabular-nums"
                  : "text-muted-foreground tabular-nums"
              }
            >
              {openFacturen} open{" "}
              {openFacturen === 1 ? "factuur" : "facturen"}
            </span>
          )
        }
      />

      <Cel
        label="Open taken"
        balk="bg-chart-1"
        onClick={() => onKies("taken")}
        actief={actief === "taken"}
        waarde={openTaken}
        format="number"
        voet={
          openTaken === 0 ? (
            <span className="text-muted-foreground">alles afgerond</span>
          ) : eerstvolgendeTekst ? (
            <span className="text-muted-foreground">
              eerstvolgende: {eerstvolgendeTekst}
            </span>
          ) : (
            <span className="text-muted-foreground">geen deadline gepland</span>
          )
        }
      />

      <Cel
        label="Offertes"
        balk="bg-accent-warm"
        onClick={() => onKies("offertes")}
        actief={actief === "offertes"}
        waarde={offertes}
        format="number"
        voet={
          offertes === 0 ? (
            <span className="text-muted-foreground">nog geen offertes</span>
          ) : concepten > 0 ? (
            <span className="text-muted-foreground tabular-nums">
              {concepten} in concept
            </span>
          ) : (
            <span className="text-muted-foreground tabular-nums">
              {offertes} {offertes === 1 ? "offerte" : "offertes"}
            </span>
          )
        }
      />

      <Cel
        label="Laatste contact"
        balk="bg-primary"
        onClick={() => onKies("tijdlijn")}
        actief={actief === "tijdlijn"}
        // Geen getal maar een moment. Een graadje kleiner dan de cijfers
        // ernaast, want een datum van vijftien tekens op 22px past niet in een
        // kwart strook — en inkorten gaat vóór uitwijken.
        waardeClassName="block truncate text-[17px] leading-6"
        waardeTekst={
          laatsteContact === null ? (
            <span className="text-muted-foreground">—</span>
          ) : isVandaag(laatsteContact) ? (
            <span title={datumKort(laatsteContact)}>vandaag</span>
          ) : (
            <span>{datumKort(laatsteContact)}</span>
          )
        }
        voet={
          <span className="text-muted-foreground tabular-nums">
            Klant sinds {datumKort(klantSinds)}
          </span>
        }
      />
    </Cijferstrip>
  );
}
