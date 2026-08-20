"use client";

import { Button } from "@/components/ui/button";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { KlantTakenCard } from "@/components/klanten/klant-taken-card";
import { KlantTijdlijn } from "@/components/tijdlijn/klant-tijdlijn";
import { GesprekComposer } from "@/components/klanten/dossier/gesprek-composer";
import type { Id } from "../../../../convex/_generated/dataModel";

/**
 * Actueel — wat vraagt nú iets van je bij deze klant (prototype v13 §A3).
 *
 * Bovenaan het vastleggen van een gesprek: dat is de reden dat je hier bent.
 * Daaronder twee kolommen die samen één werkstroom vormen — links de
 * openstaande taken (het gevolg van dat gesprek), rechts de laatste drie
 * contactmomenten (de aanloop ernaartoe). De volledige tijdlijn met zoeken en
 * filteren staat één klik verderop; drie is hier genoeg om te zien waar het
 * gesprek gebleven was.
 *
 * De kolommen splitsen op containerbreedte, niet op vensterbreedte: dit paneel
 * staat naast het dossiersubmenu en weet zelf niet hoe breed het scherm is.
 * Onder 52rem stapelen ze, en dan staan taken bóven de historie —
 * vooruitkijken vóór terugkijken.
 *
 * De tijdlijn rendert bewust zónder eigen invoerveld (`verbergComposer`): met
 * de gesprekscomposer erboven zouden er anders twee plekken op dit scherm
 * staan om hetzelfde te doen.
 */
export function TabActueel({
  klantId,
  onNaarTijdlijn,
  onNaarTaken,
  opnameToestemming = false,
}: {
  klantId: Id<"klanten">;
  /** Schakelt naar de Tijdlijn-tab; geen link, want het is dezelfde pagina. */
  onNaarTijdlijn: () => void;
  /** Schakelt naar de Taken-tab ("Alle taken"). */
  onNaarTaken?: () => void;
  /**
   * De klant heeft ooit mondeling toestemming gegeven voor opnemen. Zet de
   * meldplicht NIET opzij (harde eis 3) — het voegt alleen een notitie toe.
   */
  opnameToestemming?: boolean;
}) {
  return (
    <div className="@container/actueel space-y-4">
      <GesprekComposer
        klantId={klantId}
        opnameToestemming={opnameToestemming}
      />

      <div className="grid items-start gap-4 @[52rem]/actueel:grid-cols-2">
        <KlantTakenCard klantId={klantId} onAlleTaken={onNaarTaken} />

        <SectiePaneel
          titel="Laatste contact"
          kopbalk
          acties={
            <Button variant="outline" size="xs" onClick={onNaarTijdlijn}>
              Hele tijdlijn
            </Button>
          }
        >
          {/* Zonder eigen paneel: de kopbalk hierboven ís de kop van dit blok. */}
          <KlantTijdlijn
            klantId={klantId}
            maxEntries={3}
            toonHistorie={false}
            verbergComposer
          />
        </SectiePaneel>
      </div>
    </div>
  );
}
