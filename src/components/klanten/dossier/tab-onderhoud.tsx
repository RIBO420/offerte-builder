"use client";

import { OnderhoudSectie } from "@/components/klanten/onderhoud-sectie";
import type { Id } from "../../../../convex/_generated/dataModel";

/**
 * Onderhoud — contracten en losse beurten (PRD §2.1). De sectie brengt haar
 * eigen kop, dialogen en lege staat mee; hier alleen nog de plek.
 */
export function TabOnderhoud({ klantId }: { klantId: Id<"klanten"> }) {
  return <OnderhoudSectie klantId={klantId} />;
}
