"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { Button } from "@/components/ui/button";
import { Download, Loader2, AlertCircle } from "lucide-react";
import { OffertePDF } from "./offerte-pdf";
import { handleError, getMutationErrorMessage } from "@/lib/error-handling";
import { toast } from "sonner";
import type { Bedrijfsgegevens } from "@/types/offerte";

interface OfferteRegel {
  id: string;
  scope: string;
  omschrijving: string;
  eenheid: string;
  hoeveelheid: number;
  prijsPerEenheid: number;
  totaal: number;
  type: "materiaal" | "arbeid" | "machine";
}

interface OfferteTotalen {
  materiaalkosten: number;
  arbeidskosten: number;
  totaalUren: number;
  subtotaal: number;
  marge: number;
  margePercentage: number;
  totaalExBtw: number;
  btw: number;
  totaalInclBtw: number;
}

interface Offerte {
  offerteNummer: string;
  type: "aanleg" | "onderhoud";
  status: string;
  klant: {
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
    email?: string;
    telefoon?: string;
  };
  algemeenParams: {
    bereikbaarheid: string;
    achterstalligheid?: string;
  };
  scopes?: string[];
  scopeData?: Record<string, unknown>;
  regels: OfferteRegel[];
  totalen: OfferteTotalen;
  notities?: string;
  createdAt: number;
  updatedAt: number;
}

interface PDFDownloadButtonProps {
  offerte: Offerte;
  bedrijfsgegevens?: Bedrijfsgegevens;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function PDFDownloadButton({
  offerte,
  bedrijfsgegevens,
  variant = "outline",
  size = "default",
}: PDFDownloadButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleDownload = async () => {
    setIsGenerating(true);
    setHasError(false);
    try {
      const blob = await pdf(
        <OffertePDF offerte={offerte} bedrijfsgegevens={bedrijfsgegevens} />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${offerte.offerteNummer}-${offerte.klant.naam.replace(/\s+/g, "-")}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("PDF gedownload", {
        description: `${offerte.offerteNummer} is succesvol gedownload.`,
      });
    } catch (error) {
      setHasError(true);

      // Log to Sentry with context
      handleError(error, {
        operationName: "pdf-generation",
        extra: {
          offerteNummer: offerte.offerteNummer,
          klantNaam: offerte.klant.naam,
          regelsCount: offerte.regels.length,
        },
      });

      // Show user-friendly error message
      const errorMessage = getMutationErrorMessage(error);
      toast.error("PDF kon niet worden gegenereerd", {
        description: errorMessage,
        action: {
          label: "Opnieuw",
          onClick: handleDownload,
        },
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant={hasError ? "destructive" : variant}
      size={size}
      onClick={handleDownload}
      disabled={isGenerating}
    >
      {isGenerating ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : hasError ? (
        <AlertCircle className="mr-2 h-4 w-4" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {isGenerating ? "Genereren..." : hasError ? "Opnieuw proberen" : "PDF"}
    </Button>
  );
}
