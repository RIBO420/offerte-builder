"use client";

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { createPdfTheme, getDefaultTheme } from "@/components/pdf/pdf-theme";
import type { PdfBranding, PdfTheme, TemplateStijl } from "@/components/pdf/pdf-theme";

/**
 * Hook that builds a PdfTheme from the current user's instellingen (bedrijfsgegevens + huisstijl).
 *
 * Returns `getDefaultTheme()` when instellingen haven't loaded yet or when no
 * custom branding is configured, so PDF components can always render.
 */
export function usePdfTheme(): {
  theme: PdfTheme;
  isLoading: boolean;
  voorwaarden: {
    offerte?: string;
    factuur?: string;
    contract?: string;
  };
} {
  const { user } = useCurrentUser();

  const instellingen = useQuery(
    api.instellingen.get,
    user?._id ? {} : "skip"
  );

  // Resolve logo URL from storage ID (if present)
  const logoStorageId = instellingen?.pdfLogoStorageId ?? null;
  const logoUrl = useQuery(
    api.fotoStorage.getUrl,
    logoStorageId ? { storageId: logoStorageId } : "skip"
  );

  const theme = useMemo<PdfTheme>(() => {
    if (!instellingen) return getDefaultTheme();

    const bedrijf = instellingen.bedrijfsgegevens;
    const stijl: TemplateStijl = instellingen.pdfTemplateStijl ?? "klassiek";

    const branding: PdfBranding = {
      logoUrl: logoUrl ?? null,
      primaireKleur: instellingen.pdfPrimaireKleur ?? "#16a34a",
      secundaireKleur: instellingen.pdfSecundaireKleur ?? "#1a1a1a",
      bedrijfsnaam: bedrijf?.naam ?? "Top Tuinen",
      bedrijfsgegevens: {
        kvkNummer: bedrijf?.kvk,
        btwNummer: bedrijf?.btw,
        iban: bedrijf?.iban,
        adres: bedrijf
          ? `${bedrijf.adres}, ${bedrijf.postcode} ${bedrijf.plaats}`
          : undefined,
        telefoon: bedrijf?.telefoon,
        email: bedrijf?.email,
      },
    };

    return createPdfTheme(branding, stijl);
  }, [instellingen, logoUrl]);

  const voorwaarden = useMemo(() => {
    return instellingen?.pdfVoorwaarden ?? {};
  }, [instellingen?.pdfVoorwaarden]);

  return {
    theme,
    isLoading: user !== undefined && instellingen === undefined,
    voorwaarden,
  };
}
