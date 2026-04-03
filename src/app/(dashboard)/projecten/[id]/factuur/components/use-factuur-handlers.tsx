"use client";

import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../../../../convex/_generated/api";
import { Id, Doc } from "../../../../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import type { PdfTheme } from "@/components/pdf/pdf-theme";
import type { Bedrijfsgegevens } from "@/types/offerte";

export interface FactuurHandlersState {
  isGenerating: boolean;
  isSaving: boolean;
  isSending: boolean;
  isCreatingCreditnota: boolean;
  isSendingAanmaning: boolean;
  creditnotaReden: string;
  setCreditnotaReden: (reden: string) => void;
  aanmaningNotities: string;
  setAanmaningNotities: (notities: string) => void;
  selectedAanmaningType: "eerste_aanmaning" | "tweede_aanmaning" | "ingebrekestelling" | null;
  setSelectedAanmaningType: (type: "eerste_aanmaning" | "tweede_aanmaning" | "ingebrekestelling" | null) => void;
  showSentSuccess: boolean;
  setShowSentSuccess: (show: boolean) => void;
  showCelebration: boolean;
  setShowCelebration: (show: boolean) => void;
  celebrationDismissed: boolean;
  setCelebrationDismissed: (dismissed: boolean) => void;
  handleGenerateFactuur: () => Promise<void>;
  handleMakeDefinitief: () => Promise<void>;
  handleSendFactuur: () => Promise<void>;
  handleMarkAsPaid: () => Promise<void>;
  handleSendReminder: () => Promise<void>;
  handleSendAanmaning: () => Promise<void>;
  handleCreateCreditnota: () => Promise<void>;
  handleDownloadPdf: () => void;
  handlePreviewPdf: () => void;
  isDownloadingPdf: boolean;
}

export function useFactuurHandlers(
  projectId: Id<"projecten">,
  factuurId: Id<"facturen"> | undefined,
  options?: {
    factuur?: Doc<"facturen"> | null;
    bedrijfsgegevens?: Bedrijfsgegevens;
    theme?: PdfTheme;
    voorwaarden?: string;
  }
): FactuurHandlersState {
  // Loading states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingCreditnota, setIsCreatingCreditnota] = useState(false);
  const [isSendingAanmaning, setIsSendingAanmaning] = useState(false);

  // Form states
  const [creditnotaReden, setCreditnotaReden] = useState("");
  const [aanmaningNotities, setAanmaningNotities] = useState("");
  const [selectedAanmaningType, setSelectedAanmaningType] = useState<
    "eerste_aanmaning" | "tweede_aanmaning" | "ingebrekestelling" | null
  >(null);

  // Success/celebration states
  const [showSentSuccess, setShowSentSuccess] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);

  // Mutations
  const generateFactuur = useMutation(api.facturen.generate);
  const updateFactuurStatus = useMutation(api.facturen.updateStatus);
  const markAsPaidAndArchive = useMutation(api.facturen.markAsPaidAndArchiveProject);
  const verstuurHerinnering = useMutation(api.betalingsherinneringen.verstuurHandmatig);
  const verstuurAanmaning = useMutation(api.betalingsherinneringen.verstuurAanmaning);
  const createCreditnotaMutation = useMutation(api.facturen.createCreditnota);

  const handleGenerateFactuur = useCallback(async () => {
    setIsGenerating(true);
    try {
      await generateFactuur({ projectId });
      toast.success("Factuur succesvol gegenereerd");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
      toast.error(`Fout bij genereren factuur: ${errorMessage}`);
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  }, [generateFactuur, projectId]);

  const handleMakeDefinitief = useCallback(async () => {
    if (!factuurId) return;
    setIsSaving(true);
    try {
      await updateFactuurStatus({ id: factuurId, status: "definitief" });
      toast.success("Factuur is nu definitief");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
      toast.error(`Fout bij definitief maken: ${errorMessage}`);
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  }, [factuurId, updateFactuurStatus]);

  const handleSendFactuur = useCallback(async () => {
    if (!factuurId) return;
    setIsSending(true);
    try {
      await updateFactuurStatus({ id: factuurId, status: "verzonden" });
      setShowSentSuccess(true);
      toast.success("Factuur succesvol verzonden!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
      toast.error(`Fout bij verzenden factuur: ${errorMessage}`);
      console.error(error);
    } finally {
      setIsSending(false);
    }
  }, [factuurId, updateFactuurStatus]);

  const handleMarkAsPaid = useCallback(async () => {
    if (!factuurId) return;
    setIsSaving(true);
    try {
      await markAsPaidAndArchive({ id: factuurId });
      setShowCelebration(true);
      toast.success("Project voltooid! Factuur is betaald en project is gearchiveerd.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
      toast.error(`Fout bij markeren als betaald: ${errorMessage}`);
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  }, [factuurId, markAsPaidAndArchive]);

  const handleSendReminder = useCallback(async () => {
    if (!factuurId) return;
    setIsSending(true);
    try {
      await verstuurHerinnering({ factuurId });
      toast.success("Betalingsherinnering verstuurd");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
      toast.error(`Fout bij verzenden herinnering: ${errorMessage}`);
      console.error(error);
    } finally {
      setIsSending(false);
    }
  }, [factuurId, verstuurHerinnering]);

  const handleSendAanmaning = useCallback(async () => {
    if (!factuurId || !selectedAanmaningType) return;
    setIsSendingAanmaning(true);
    try {
      await verstuurAanmaning({
        factuurId,
        type: selectedAanmaningType,
        notities: aanmaningNotities.trim() || undefined,
      });
      const labels: Record<string, string> = {
        eerste_aanmaning: "1e Aanmaning",
        tweede_aanmaning: "2e Aanmaning",
        ingebrekestelling: "Ingebrekestelling",
      };
      toast.success(`${labels[selectedAanmaningType]} succesvol verstuurd`);
      setSelectedAanmaningType(null);
      setAanmaningNotities("");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
      toast.error(`Fout bij verzenden aanmaning: ${errorMessage}`);
      console.error(error);
    } finally {
      setIsSendingAanmaning(false);
    }
  }, [factuurId, selectedAanmaningType, aanmaningNotities, verstuurAanmaning]);

  const handleCreateCreditnota = useCallback(async () => {
    if (!factuurId || !creditnotaReden.trim()) return;
    setIsCreatingCreditnota(true);
    try {
      await createCreditnotaMutation({
        factuurId,
        reden: creditnotaReden.trim(),
      });
      setCreditnotaReden("");
      toast.success("Creditnota succesvol aangemaakt");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
      toast.error(`Fout bij aanmaken creditnota: ${errorMessage}`);
      console.error(error);
    } finally {
      setIsCreatingCreditnota(false);
    }
  }, [factuurId, creditnotaReden, createCreditnotaMutation]);

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  /**
   * Map Convex factuur Doc to FactuurPDF component props.
   * Convex uses `hoeveelheid` / `btwBedrag` while the PDF component expects `aantal` / `btw`.
   */
  function buildFactuurPdfData(factuur: Doc<"facturen">) {
    return {
      factuurnummer: factuur.factuurnummer,
      factuurdatum: factuur.factuurdatum,
      vervaldatum: factuur.vervaldatum,
      klant: factuur.klant,
      regels: factuur.regels.map((r) => ({
        id: r.id,
        omschrijving: r.omschrijving,
        aantal: r.hoeveelheid,
        eenheid: r.eenheid,
        prijsPerEenheid: r.prijsPerEenheid,
        totaal: r.totaal,
      })),
      correcties: factuur.correcties?.map((c, i) => ({
        id: `correctie-${i}`,
        omschrijving: c.omschrijving,
        bedrag: c.bedrag,
      })),
      subtotaal: factuur.subtotaal,
      btwPercentage: factuur.btwPercentage,
      btw: factuur.btwBedrag,
      totaalInclBtw: factuur.totaalInclBtw,
      notities: factuur.notities,
    };
  }

  const handleDownloadPdf = useCallback(async () => {
    const factuur = options?.factuur;
    if (!factuur) {
      toast.error("Factuurgegevens niet beschikbaar");
      return;
    }

    setIsDownloadingPdf(true);
    try {
      // Dynamic imports to avoid loading react-pdf in the main bundle
      const [{ pdf }, { FactuurPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/project/factuur-pdf"),
      ]);

      const factuurData = buildFactuurPdfData(factuur);

      const element = (
        <FactuurPDF
          factuur={factuurData}
          bedrijfsgegevens={options?.bedrijfsgegevens}
          theme={options?.theme}
          voorwaarden={options?.voorwaarden}
        />
      );

      const blob = await pdf(element).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const klantNaam = factuur.klant.naam.replace(/\s+/g, "-");
      link.download = `${factuur.factuurnummer}-${klantNaam}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Factuur PDF gedownload", {
        description: `${factuur.factuurnummer} is succesvol gedownload.`,
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("PDF kon niet worden gegenereerd", {
        description: error instanceof Error ? error.message : "Onbekende fout opgetreden",
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [options?.factuur, options?.bedrijfsgegevens, options?.theme, options?.voorwaarden]);

  const handlePreviewPdf = useCallback(async () => {
    const factuur = options?.factuur;
    if (!factuur) {
      toast.error("Factuurgegevens niet beschikbaar");
      return;
    }

    setIsDownloadingPdf(true);
    try {
      const [{ pdf }, { FactuurPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/project/factuur-pdf"),
      ]);

      const factuurData = buildFactuurPdfData(factuur);

      const element = (
        <FactuurPDF
          factuur={factuurData}
          bedrijfsgegevens={options?.bedrijfsgegevens}
          theme={options?.theme}
          voorwaarden={options?.voorwaarden}
        />
      );

      const blob = await pdf(element).toBlob();

      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");

      // Revoke after a delay to allow the browser to open the tab
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (error) {
      console.error("PDF preview error:", error);
      toast.error("PDF preview kon niet worden geopend", {
        description: error instanceof Error ? error.message : "Onbekende fout opgetreden",
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [options?.factuur, options?.bedrijfsgegevens, options?.theme, options?.voorwaarden]);

  return {
    isGenerating,
    isSaving,
    isSending,
    isCreatingCreditnota,
    isSendingAanmaning,
    isDownloadingPdf,
    creditnotaReden,
    setCreditnotaReden,
    aanmaningNotities,
    setAanmaningNotities,
    selectedAanmaningType,
    setSelectedAanmaningType,
    showSentSuccess,
    setShowSentSuccess,
    showCelebration,
    setShowCelebration,
    celebrationDismissed,
    setCelebrationDismissed,
    handleGenerateFactuur,
    handleMakeDefinitief,
    handleSendFactuur,
    handleMarkAsPaid,
    handleSendReminder,
    handleSendAanmaning,
    handleCreateCreditnota,
    handleDownloadPdf,
    handlePreviewPdf,
  };
}
