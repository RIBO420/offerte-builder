"use client";

/** Inleiding en afsluiting van deze factuur → DocumentTekstenCard. */

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { DocumentTekstenCard } from "@/components/teksten/document-teksten-card";

export function FactuurTeksten({ factuur }: { factuur: Doc<"facturen"> }) {
  const getoond = useQuery(api.facturen.getTeksten, { id: factuur._id });
  const opslaan = useMutation(api.facturen.updateTeksten);
  const documentStatus = factuur.documentStatus ?? factuur.status;

  return (
    <DocumentTekstenCard
      documentNaam={factuur.isCreditnota ? "creditfactuur" : "factuur"}
      soort={factuur.documentSoort ?? (factuur.isCreditnota ? "creditnota" : "factuur")}
      getoond={getoond}
      magBewerken={documentStatus === "concept"}
      beginWaarde={factuur.teksten}
      onOpslaan={async (teksten) => {
        await opslaan({ id: factuur._id, ...teksten });
      }}
    />
  );
}
