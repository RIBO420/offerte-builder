"use client";

import { KlantTijdlijn } from "@/components/tijdlijn/klant-tijdlijn";
import type { Id } from "../../../../convex/_generated/dataModel";

/**
 * Tijdlijn — het volledige dossier van wat er gebeurd is (PRD §2.3), met
 * zoeken, filteren op kanaal/klus en de compositie voor kantoor.
 */
export function TabTijdlijn({ klantId }: { klantId: Id<"klanten"> }) {
  return <KlantTijdlijn klantId={klantId} toonPaneel />;
}
