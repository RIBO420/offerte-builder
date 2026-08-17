"use client";

import { Button } from "@/components/ui/button";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { KlantTakenCard } from "@/components/klanten/klant-taken-card";
import { KlantTijdlijn } from "@/components/tijdlijn/klant-tijdlijn";
import { GesprekComposer } from "@/components/klanten/dossier/gesprek-composer";
import type { Id } from "../../../../convex/_generated/dataModel";

/**
 * Actueel — wat vraagt nú iets van je bij deze klant.
 *
 * Drie blokken: bovenaan het vastleggen van een gesprek (de reden dat je hier
 * bent), daaronder de openstaande taken en daar weer onder de laatste drie
 * contactmomenten als samenvatting. De volledige tijdlijn met zoeken en
 * filteren staat één klik verderop; hier is drie genoeg om te zien waar het
 * gesprek gebleven was.
 *
 * De tijdlijn hieronder rendert bewust zónder eigen invoerveld
 * (`verbergComposer`): met de gesprekscomposer erboven zouden er anders twee
 * plekken op dit scherm staan om hetzelfde te doen.
 */
export function TabActueel({
  klantId,
  onNaarTijdlijn,
}: {
  klantId: Id<"klanten">;
  /** Schakelt naar de Tijdlijn-tab; geen link, want het is dezelfde pagina. */
  onNaarTijdlijn: () => void;
}) {
  return (
    <div className="space-y-4">
      <GesprekComposer klantId={klantId} />

      {/* Taken vóór de historie: vooruitkijken vóór terugkijken. */}
      <KlantTakenCard klantId={klantId} />

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
  );
}
