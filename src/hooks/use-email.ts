"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";

export type EmailType = "offerte_verzonden" | "herinnering" | "bedankt";

interface SendEmailParams {
  offerteId: Id<"offertes">;
  type: EmailType;
  to: string;
  klantNaam: string;
  offerteNummer: string;
  totaalInclBtw: number;
  bedrijfsnaam: string;
  bedrijfsEmail?: string;
  bedrijfsTelefoon?: string;
  offerteType: "aanleg" | "onderhoud";
  scopes?: string[];
  customMessage?: string;
  cc?: string;
  voorwaardenPdfUrl?: string;
  voorwaardenPdfNaam?: string;
}

export function useEmail() {
  const createEmailLog = useMutation(api.emailLogs.create);
  const [isSending, setIsSending] = useState(false);

  const sendEmail = async (params: SendEmailParams) => {
    setIsSending(true);

    try {
      // Send email via API route
      const response = await fetch("/api/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: params.type,
          to: params.to,
          klantNaam: params.klantNaam,
          offerteNummer: params.offerteNummer,
          totaalInclBtw: params.totaalInclBtw,
          bedrijfsnaam: params.bedrijfsnaam,
          bedrijfsEmail: params.bedrijfsEmail,
          bedrijfsTelefoon: params.bedrijfsTelefoon,
          offerteType: params.offerteType,
          scopes: params.scopes,
          customMessage: params.customMessage,
          cc: params.cc,
          voorwaardenPdfUrl: params.voorwaardenPdfUrl,
          voorwaardenPdfNaam: params.voorwaardenPdfNaam,
        }),
      });

      const result = await response.json();

      // Log the email (userId derived from auth context)
      await createEmailLog({
        offerteId: params.offerteId,
        type: params.type,
        to: params.to,
        subject: result.subject || `Offerte ${params.offerteNummer}`,
        status: result.success ? "verzonden" : "mislukt",
        resendId: result.resendId,
        error: result.error,
        customMessage: params.customMessage,
        cc: params.cc,
      });

      if (!result.success) {
        throw new Error(result.error || "Email verzenden mislukt");
      }

      return { success: true, resendId: result.resendId };
    } catch (error) {
      // Log failed attempt (userId derived from auth context)
      await createEmailLog({
        offerteId: params.offerteId,
        type: params.type,
        to: params.to,
        subject: `Offerte ${params.offerteNummer}`,
        status: "mislukt",
        error: error instanceof Error ? error.message : "Onbekende fout",
        customMessage: params.customMessage,
        cc: params.cc,
      });

      throw error;
    } finally {
      setIsSending(false);
    }
  };

  return {
    sendEmail,
    isSending,
  };
}

export function useEmailLogs(offerteId: Id<"offertes"> | null) {
  const logs = useQuery(
    api.emailLogs.listByOfferte,
    offerteId ? { offerteId } : "skip"
  );

  const stats = useQuery(
    api.emailLogs.getOfferteEmailStats,
    offerteId ? { offerteId } : "skip"
  );

  return {
    logs: logs ?? [],
    stats: stats ?? null,
    isLoading: logs === undefined,
  };
}
