"use client";

import { KlantFacturenSectie } from "@/components/klanten/klant-documenten";
import type { Id } from "../../../../convex/_generated/dataModel";

/**
 * Facturen — de geldkant van het dossier.
 *
 * De filterchips (Alle / Niet betaald / Betaald) en de totaalbalk zitten in
 * `KlantFacturenSectie` zelf: die component doet de query al, en filteren in
 * deze wrapper zou een tweede query op dezelfde lijst betekenen.
 */
export function TabFacturen({ klantId }: { klantId: Id<"klanten"> }) {
  return <KlantFacturenSectie klantId={klantId} />;
}
