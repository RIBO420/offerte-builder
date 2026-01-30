"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { pdf } from "@react-pdf/renderer";
import { OffertePDF } from "@/components/pdf/offerte-pdf";
import type { Bedrijfsgegevens } from "@/types/offerte";

export type PDFGenerationStep =
  | "preparing"
  | "generating"
  | "uploading"
  | "complete"
  | "error";

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

interface UsePDFGenerationOptions {
  onSuccess?: (url: string) => void;
  onError?: (error: Error) => void;
  /** Optional storage upload function. If not provided, creates a local blob URL */
  uploadToStorage?: (blob: Blob, filename: string) => Promise<string>;
  /** Company info for PDF header/footer */
  bedrijfsgegevens?: Bedrijfsgegevens;
}

interface UsePDFGenerationReturn {
  generate: (offerte: Offerte) => Promise<string>;
  isGenerating: boolean;
  currentStep: PDFGenerationStep;
  progress: number;
  error: string | null;
  downloadUrl: string | null;
  reset: () => void;
}

export function usePDFGeneration(
  options: UsePDFGenerationOptions = {}
): UsePDFGenerationReturn {
  const { onSuccess, onError, uploadToStorage, bedrijfsgegevens } = options;

  const [currentStep, setCurrentStep] = useState<PDFGenerationStep>("preparing");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Track blob URLs for cleanup
  const blobUrlRef = useRef<string | null>(null);

  // Cleanup blob URL helper
  const cleanupBlobUrl = useCallback(() => {
    if (blobUrlRef.current && blobUrlRef.current.startsWith("blob:")) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      cleanupBlobUrl();
    };
  }, [cleanupBlobUrl]);

  const reset = useCallback(() => {
    cleanupBlobUrl();
    setCurrentStep("preparing");
    setProgress(0);
    setError(null);
    setIsGenerating(false);
    setDownloadUrl(null);
  }, [cleanupBlobUrl]);

  const generate = useCallback(
    async (offerte: Offerte): Promise<string> => {
      // Cleanup previous blob URL before generating new one
      cleanupBlobUrl();

      // Reset state
      reset();
      setIsGenerating(true);

      try {
        // Step 1: Preparing
        setCurrentStep("preparing");
        setProgress(0);

        // Small delay to show the preparing step
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Step 2: Generating PDF
        setCurrentStep("generating");
        setProgress(10);

        const pdfComponent = OffertePDF({
          offerte,
          bedrijfsgegevens,
        });

        // Simulate progress during PDF generation
        const progressInterval = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 80) {
              clearInterval(progressInterval);
              return 80;
            }
            return prev + 10;
          });
        }, 200);

        const blob = await pdf(pdfComponent).toBlob();

        clearInterval(progressInterval);
        setProgress(90);

        const filename = `${offerte.offerteNummer}-${offerte.klant.naam.replace(/\s+/g, "-")}.pdf`;

        // Step 3: Upload to storage (if provided) or create local URL
        let url: string;

        if (uploadToStorage) {
          setCurrentStep("uploading");
          setProgress(95);
          url = await uploadToStorage(blob, filename);
        } else {
          // Create local blob URL for download
          setCurrentStep("uploading");
          setProgress(95);
          url = URL.createObjectURL(blob);
          // Track for cleanup
          blobUrlRef.current = url;
        }

        setProgress(100);
        setCurrentStep("complete");
        setDownloadUrl(url);
        onSuccess?.(url);

        return url;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Onbekende fout opgetreden";
        setError(errorMessage);
        setCurrentStep("error");
        onError?.(err instanceof Error ? err : new Error(errorMessage));
        throw err;
      } finally {
        setIsGenerating(false);
      }
    },
    [bedrijfsgegevens, cleanupBlobUrl, onError, onSuccess, reset, uploadToStorage]
  );

  return {
    generate,
    isGenerating,
    currentStep,
    progress,
    error,
    downloadUrl,
    reset,
  };
}

/**
 * Hook for PDF generation with modal state management
 * Combines usePDFGeneration with modal open/close state
 */
export function usePDFGenerationWithModal(
  options: UsePDFGenerationOptions = {}
) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const pdfGeneration = usePDFGeneration(options);

  const generateWithModal = useCallback(
    async (offerte: Offerte) => {
      setIsModalOpen(true);
      return pdfGeneration.generate(offerte);
    },
    [pdfGeneration]
  );

  const closeModal = useCallback(() => {
    if (!pdfGeneration.isGenerating) {
      setIsModalOpen(false);
      // Reset after a short delay to allow modal close animation
      setTimeout(() => {
        pdfGeneration.reset();
      }, 200);
    }
  }, [pdfGeneration]);

  const retry = useCallback(
    async (offerte: Offerte) => {
      pdfGeneration.reset();
      return pdfGeneration.generate(offerte);
    },
    [pdfGeneration]
  );

  return {
    ...pdfGeneration,
    generate: generateWithModal,
    isModalOpen,
    setIsModalOpen,
    closeModal,
    retry,
  };
}
