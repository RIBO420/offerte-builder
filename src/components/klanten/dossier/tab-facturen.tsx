"use client";

import { KlantFacturenSectie } from "@/components/klanten/klant-documenten";
import type { Id } from "../../../../convex/_generated/dataModel";

/**
 * Facturen — de geldkant van het dossier.
 *
 * WS2: filterchips (Alle / Niet betaald / Betaald) en een totaalbalk
 * (gefactureerd + openstaand) horen hier; `KlantFacturenSectie` heeft de
 * gegevens er al voor in huis.
 */
export function TabFacturen({ klantId }: { klantId: Id<"klanten"> }) {
  return <KlantFacturenSectie klantId={klantId} />;
}
