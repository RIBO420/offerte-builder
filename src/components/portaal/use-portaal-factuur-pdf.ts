"use client";

/**
 * PDF-download voor facturen in het klantenportaal — hetzelfde render-pad
 * als kantoor (FactuurPDF + @react-pdf/renderer, dynamisch geladen), gevoed
 * door de allowlist-query portaal.getFactuurVoorPdf (alleen verzonden
 * facturen van de eigen klant).
 */

import { useCallback, useState } from "react";
import { useConvex } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function usePortaalFactuurPdf() {
  const convex = useConvex();
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadPdf = useCallback(
    async (factuurId: Id<"facturen"> | string) => {
      setIsDownloading(true);
      try {
        const data = await convex.query(api.portaal.getFactuurVoorPdf, {
          id: factuurId as Id<"facturen">,
        });
        if (!data) {
          toast.error("Factuur niet beschikbaar");
          return;
        }

        const [{ pdf }, { FactuurPDF }] = await Promise.all([
          import("@react-pdf/renderer"),
          import("@/components/project/factuur-pdf"),
        ]);

        const f = data.factuur;
        const element = FactuurPDF({
          factuur: {
            factuurnummer: f.factuurnummer,
            factuurdatum: f.factuurdatum,
            vervaldatum: f.vervaldatum,
            klant: f.klant,
            regels: f.regels.map((r) => ({
              id: r.id,
              omschrijving: r.omschrijving,
              aantal: r.hoeveelheid,
              eenheid: r.eenheid,
              prijsPerEenheid: r.prijsPerEenheid,
              totaal: r.totaal,
            })),
            correcties: f.correcties?.map((c, i) => ({
              id: `correctie-${i}`,
              omschrijving: c.omschrijving,
              bedrag: c.bedrag,
            })),
            subtotaal: f.subtotaal,
            btwPercentage: f.btwPercentage,
            btw: f.btwBedrag,
            btwUitsplitsing: f.btwUitsplitsing,
            totaalInclBtw: f.totaalInclBtw,
            notities: f.notities,
          },
          bedrijfsgegevens: data.bedrijfsgegevens,
        });

        const blob = await pdf(element).toBlob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${f.factuurnummer}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch {
        toast.error("PDF downloaden is niet gelukt");
      } finally {
        setIsDownloading(false);
      }
    },
    [convex]
  );

  return { downloadPdf, isDownloading };
}
