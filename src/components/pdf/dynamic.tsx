"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";

// Loading component for PDF button
function PDFButtonLoading() {
  return (
    <Button variant="outline" disabled>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Laden...
    </Button>
  );
}

// Dynamically import PDFDownloadButton since @react-pdf/renderer is ~500KB
export const DynamicPDFDownloadButton = dynamic(
  () => import("./pdf-download-button").then((mod) => mod.PDFDownloadButton),
  {
    loading: () => <PDFButtonLoading />,
    ssr: false,
  }
);

// Export a hook wrapper for lazy loading the PDF generation hook
export async function loadPDFGeneration() {
  const { usePDFGeneration, usePDFGenerationWithModal } = await import(
    "@/hooks/use-pdf-generation"
  );
  return { usePDFGeneration, usePDFGenerationWithModal };
}
