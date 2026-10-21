"use client";

/** Inleiding en afsluiting van deze offerte → DocumentTekstenCard. */

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { DocumentTekstenCard } from "@/components/teksten/document-teksten-card";

interface TekstenCardProps {
  id: string;
  type: "aanleg" | "onderhoud";
  status: string;
  vrijeTeksten?: { aanhef?: string; voorwaarden?: string };
}

export function TekstenCard({ id, type, status, vrijeTeksten }: TekstenCardProps) {
  const offerteId = id as Id<"offertes">;
  const getoond = useQuery(api.offertes.getTeksten, { id: offerteId });
  const opslaan = useMutation(api.offertes.updateTeksten);

  return (
    <DocumentTekstenCard
      documentNaam="offerte"
      soort={type === "onderhoud" ? "offerte_onderhoud" : "offerte_aanleg"}
      getoond={getoond}
      magBewerken={status === "concept" || status === "voorcalculatie"}
      beginWaarde={{
        inleiding: vrijeTeksten?.aanhef,
        afsluiting: vrijeTeksten?.voorwaarden,
      }}
      onOpslaan={async (teksten) => {
        await opslaan({ id: offerteId, ...teksten });
      }}
    />
  );
}
