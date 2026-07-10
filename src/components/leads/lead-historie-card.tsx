"use client";

/**
 * Lead-historie op de klant-detailpagina (PRD §1.3): na promotie verdwijnt de
 * lead van het bord, maar de herkomst en activiteiten blijven hier bereikbaar.
 */

import { useQuery } from "convex/react";
import { History } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const BRON_LABELS: Record<string, string> = {
  configurator_gazon: "Configurator (gazon)",
  configurator_boomschors: "Configurator (boomschors)",
  configurator_verticuteren: "Configurator (verticuteren)",
  website_contact: "Website contactformulier",
  handmatig: "Handmatig",
  telefoon: "Telefoon",
  email: "E-mail",
  doorverwijzing: "Doorverwijzing",
};

function formatDatum(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function LeadHistorieCard({ klantId }: { klantId: Id<"klanten"> }) {
  const leadHistorie = useQuery(api.configuratorAanvragen.getLeadVoorKlant, {
    klantId,
  });

  // Geen gekoppelde lead (klant is handmatig aangemaakt of geïmporteerd)
  if (!leadHistorie) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Lead-historie
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Deze klant is ontstaan uit lead{" "}
          <span className="font-medium text-foreground">{leadHistorie.referentie}</span>
          {leadHistorie.bron ? ` via ${BRON_LABELS[leadHistorie.bron] ?? leadHistorie.bron}` : ""}
          {" op "}
          {formatDatum(leadHistorie.createdAt)}
          {leadHistorie.aantalFotos > 0
            ? ` (${leadHistorie.aantalFotos} foto${leadHistorie.aantalFotos === 1 ? "" : "'s"})`
            : ""}
          .
        </p>
        {leadHistorie.activiteiten.length > 0 && (
          <ul className="space-y-2">
            {leadHistorie.activiteiten.map((activiteit) => (
              <li key={activiteit._id} className="flex items-start gap-2 text-sm">
                <span className="text-muted-foreground whitespace-nowrap">
                  {formatDatum(activiteit.createdAt)}
                </span>
                <span>{activiteit.beschrijving}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
