"use client";

import { useState, useEffect, useCallback } from "react";
import { pdf } from "@react-pdf/renderer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Loader2, AlertCircle, Eye } from "lucide-react";
import { OffertePDF } from "@/components/pdf/offerte-pdf";
import { handleError } from "@/lib/error-handling";
import { toast } from "sonner";
import type { Bedrijfsgegevens } from "@/types/offerte";
import type { PdfTheme } from "@/components/pdf/pdf-theme";

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

interface PdfPreviewModalProps {
  offerte: Offerte;
  bedrijfsgegevens?: Bedrijfsgegevens;
  theme?: PdfTheme;
  voorwaarden?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PdfPreviewModal({
  offerte,
  bedrijfsgegevens,
  theme,
  voorwaarden,
  open,
  onOpenChange,
}: PdfPreviewModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePdf = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const blob = await pdf(
        <OffertePDF offerte={offerte} bedrijfsgegevens={bedrijfsgegevens} theme={theme} voorwaarden={voorwaarden} />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err) {
      setError(
        "Er is een fout opgetreden bij het genereren van de PDF. Probeer het opnieuw."
      );
      handleError(err, {
        operationName: "pdf-preview-generation",
        extra: {
          offerteNummer: offerte.offerteNummer,
          klantNaam: offerte.klant.naam,
        },
      });
    } finally {
      setIsLoading(false);
    }
  }, [offerte, bedrijfsgegevens]);

  useEffect(() => {
    if (open) {
      generatePdf();
    }

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleDownload = () => {
    if (!pdfUrl) return;

    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = `${offerte.offerteNummer}-${offerte.klant.naam.replace(/\s+/g, "-")}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("PDF gedownload", {
      description: `${offerte.offerteNummer} is succesvol gedownload.`,
    });
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            PDF Voorbeeld
          </DialogTitle>
          <DialogDescription>
            Voorbeeld van offerte {offerte.offerteNummer} voor{" "}
            {offerte.klant.naam}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 rounded-md border bg-muted/30 overflow-hidden">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                PDF wordt gegenereerd...
              </p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive text-center">{error}</p>
              <Button variant="outline" size="sm" onClick={generatePdf}>
                Opnieuw proberen
              </Button>
            </div>
          )}

          {pdfUrl && !isLoading && !error && (
            <iframe
              src={pdfUrl}
              title={`PDF voorbeeld van offerte ${offerte.offerteNummer}`}
              className="w-full h-full border-0"
            />
          )}
        </div>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Sluiten
          </Button>
          <Button onClick={handleDownload} disabled={!pdfUrl || isLoading}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
