"use client";

import { Button } from "@/components/ui/button";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { KlantTakenCard } from "@/components/klanten/klant-taken-card";
import { KlantTijdlijn } from "@/components/tijdlijn/klant-tijdlijn";
import type { Id } from "../../../../convex/_generated/dataModel";

/**
 * Actueel — wat vraagt nú iets van je bij deze klant.
 *
 * Twee blokken: de openstaande taken (die staan in `KlantTakenCard` al
 * bovenaan) en daaronder de laatste drie contactmomenten als samenvatting.
 * De volledige tijdlijn met zoeken en filteren staat één klik verderop; hier
 * is drie genoeg om te zien waar het gesprek gebleven was.
 *
 * ANKERPUNT WS4: de gesprekscomposer ("Gesprek vastleggen" met
 * taakherkenning) komt bovenaan deze tab, vóór de taken — zie het merkteken
 * hieronder.
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
      {/* ── WS4: GesprekComposer hier ────────────────────────────────────── */}

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
        <KlantTijdlijn klantId={klantId} maxEntries={3} toonHistorie={false} />
      </SectiePaneel>
    </div>
  );
}
