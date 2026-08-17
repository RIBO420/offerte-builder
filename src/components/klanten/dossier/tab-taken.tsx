"use client";

import { KlantTakenCard } from "@/components/klanten/klant-taken-card";
import type { Id } from "../../../../convex/_generated/dataModel";

/**
 * Taken — open én afgerond. Dezelfde kaart als op Actueel; die toont de
 * afgeronde taken achter een uitklapper, dus hier is niets extra's nodig.
 */
export function TabTaken({ klantId }: { klantId: Id<"klanten"> }) {
  return <KlantTakenCard klantId={klantId} />;
}
