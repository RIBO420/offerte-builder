"use client";

/**
 * Downloadknop voor orderbevestiging, bestelformulier en leveringsbon
 * (HERO-nabouw fase 6). Haalt de gegevens op bij het klikken en maakt de PDF
 * in de browser; ontbrekende velden in de vaste tekst worden gemeld.
 */

import { useState } from "react";
import { useConvex } from "convex/react";
import { toast } from "sonner";
import { FileDown, Loader2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

type Bron =
  | { soort: "orderbevestiging"; offerteId: Id<"offertes"> }
  | { soort: "bestelformulier"; inkooporderId: Id<"inkooporders"> }
  | { soort: "leveringsbon"; projectId: Id<"projecten"> };

const LABEL: Record<Bron["soort"], string> = {
  orderbevestiging: "Orderbevestiging",
  bestelformulier: "Bestelformulier",
  leveringsbon: "Leveringsbon",
};

export function DocumentPdfKnop({
  bron,
  variant = "outline",
  size = "sm",
}: {
  bron: Bron;
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "default";
}) {
  const convex = useConvex();
  const [bezig, setBezig] = useState(false);

  const maak = async () => {
    setBezig(true);
    try {
      const data =
        bron.soort === "orderbevestiging"
          ? await convex.query(api.documenten.orderbevestiging, { offerteId: bron.offerteId })
          : bron.soort === "bestelformulier"
            ? await convex.query(api.documenten.bestelformulier, { inkooporderId: bron.inkooporderId })
            : await convex.query(api.documenten.leveringsbon, { projectId: bron.projectId });
      if (data.ontbrekend.length > 0) {
        toast.warning(`Niet ingevuld in de tekst: ${data.ontbrekend.join(", ")}`);
      }
      const [{ pdf }, { DocumentPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./document-pdf"),
      ]);
      const blob = await pdf(<DocumentPDF data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.titel} ${data.nummer}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (fout) {
      toast.error(
        fout instanceof Error && "data" in fout
          ? String((fout as { data: unknown }).data)
          : `${LABEL[bron.soort]} maken mislukt`
      );
    } finally {
      setBezig(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={() => void maak()} disabled={bezig}>
      {bezig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
      {LABEL[bron.soort]}
    </Button>
  );
}
