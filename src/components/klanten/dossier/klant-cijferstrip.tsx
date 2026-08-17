"use client";

import { Cel, Cijferstrip } from "@/components/ui/cijferstrip";
import { formatRelativeTime } from "@/lib/format/date";
import type { DossierTab, DossierTellingen } from "./dossier-nav";

/**
 * De vier tegels boven het klantdossier: wat vraagt hier geld, tijd en
 * aandacht, en wanneer sprak je deze klant voor het laatst.
 *
 * Dezelfde strook als op het dashboard (`@/components/ui/cijferstrip`), maar
 * de tegels zijn hier knoppen in plaats van links: ze schakelen een tab in
 * dezelfde pagina, en een link die niet navigeert hoort geen link te zijn.
 */

function datumKort(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
  const openstaand = tellingen?.openFacturen.openstaandBedrag ?? 0;
  const openFacturen = tellingen?.openFacturen.aantal ?? 0;
  const teLaat = tellingen?.openFacturen.teLaat === true;
  const openTaken = tellingen?.openTaken ?? 0;
  const offertes = tellingen?.offertes ?? 0;
  const laatsteContact = tellingen?.laatsteContactTimestamp ?? null;

  return (
    <Cijferstrip
      label="Kerncijfers van deze klant"
      className="@container/klantcijfers"
      kolommen="grid-cols-1 @[26rem]/klantcijfers:grid-cols-2 @[52rem]/klantcijfers:grid-cols-4"
    >
      <Cel
        label="Openstaand"
        onClick={() => onKies("facturen")}
        actief={actief === "facturen"}
        waarde={openstaand}
        // Geld dat binnen moet komen krijgt kleur; een nul blijft stil.
        waardeClassName={
          openstaand > 0
            ? teLaat
              ? "text-status-vervallen-text"
              : "text-status-herinnering-text"
            : undefined
        }
        voet={
          openFacturen === 0 ? (
            <span className="text-muted-foreground">geen open facturen</span>
          ) : teLaat ? (
            <span className="text-status-vervallen-text">
              {openFacturen} open · ouder dan 30 dagen
            </span>
          ) : (
            <span className="text-muted-foreground tabular-nums">
              {openFacturen} open {openFacturen === 1 ? "factuur" : "facturen"}
            </span>
          )
        }
      />

      <Cel
        label="Open taken"
        onClick={() => onKies("taken")}
        actief={actief === "taken"}
        waarde={openTaken}
        format="number"
        voet={
          openTaken === 0 ? (
            <span className="text-muted-foreground">alles afgerond</span>
          ) : (
            <span className="text-muted-foreground">
              wachten op een volgende stap
            </span>
          )
        }
      />

      <Cel
        label="Offertes"
        onClick={() => onKies("offertes")}
        actief={actief === "offertes"}
        waarde={offertes}
        format="number"
        voet={
          offertes === 0 ? (
            <span className="text-muted-foreground">nog geen offertes</span>
          ) : (
            <span className="text-muted-foreground">
              in dit dossier vastgelegd
            </span>
          )
        }
      />

      <Cel
        label="Laatste contact"
        onClick={() => onKies("tijdlijn")}
        actief={actief === "tijdlijn"}
        // Geen getal maar een tijdsafstand: "3 dagen geleden" zegt hier meer
        // dan een datum die je zelf moet narekenen. Een graadje kleiner dan de
        // cijfers ernaast, want een zin van vijftien tekens op 22px past niet
        // in een kwart strook — en inkorten gaat vóór uitwijken.
        waardeClassName="block truncate text-[17px] leading-6"
        waardeTekst={
          laatsteContact === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span title={datumKort(laatsteContact)}>
              {formatRelativeTime(laatsteContact)}
            </span>
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
