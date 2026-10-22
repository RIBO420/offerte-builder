/**
 * Openbare offertelink (HERO-nabouw fase 6): klanten zonder portaaltoegang
 * krijgen bij het versturen een link /offerte/<token>. Alleen lezen: de
 * offerte zoals verstuurd, de PDF om te downloaden en de algemene
 * voorwaarden. Akkoord geven gaat per e-mail (zoals de offertetekst vraagt)
 * of via het klantportaal.
 *
 * Geen login; de token is de sleutel (generateSecureToken, 32 tekens) en kan
 * verlopen (shareExpiresAt). Alleen klantzichtbare velden: geen inkoop,
 * marge of interne notities.
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import { isShareTokenValid } from "./auth";
import { getoondeOfferteTeksten } from "./lib/offerteTekst";

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (args.token.length < 16) return null;
    const offerte = await ctx.db
      .query("offertes")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.token))
      .unique();
    if (!offerte || !isShareTokenValid(offerte, args.token)) return null;
    // Alleen verstuurde offertes zijn openbaar
    if (!["verzonden", "geaccepteerd", "afgewezen"].includes(offerte.status)) return null;

    const instellingen = offerte.orgId
      ? await ctx.db
          .query("instellingen")
          .withIndex("by_org", (q) => q.eq("orgId", offerte.orgId!))
          .unique()
      : null;
    const { teksten } = await getoondeOfferteTeksten(ctx, offerte);
    const [logoUrl, voorwaardenUrl] = await Promise.all([
      instellingen?.pdfLogoStorageId ? ctx.storage.getUrl(instellingen.pdfLogoStorageId) : null,
      instellingen?.voorwaardenPdfId ? ctx.storage.getUrl(instellingen.voorwaardenPdfId) : null,
    ]);

    return {
      offerte: {
        offerteNummer: offerte.offerteNummer,
        type: offerte.type,
        status: offerte.status,
        bron: offerte.bron,
        klant: offerte.klant,
        algemeenParams: offerte.algemeenParams,
        scopes: offerte.scopes,
        regels: offerte.regels.map((r) => ({
          id: r.id,
          scope: r.scope,
          omschrijving: r.omschrijving,
          eenheid: r.eenheid,
          hoeveelheid: r.hoeveelheid,
          prijsPerEenheid: r.prijsPerEenheid,
          totaal: r.totaal,
          type: r.type,
          optioneel: r.optioneel,
          btwCode: r.btwCode,
          artikelBeschrijving: r.artikelBeschrijving,
          kortingPercentage: r.kortingPercentage,
        })),
        totalen: {
          ...offerte.totalen,
          // Interne calculatie hoort niet bij de klant
          marge: 0,
          margePercentage: 0,
          materiaalkosten: 0,
          arbeidskosten: 0,
        },
        kortingOpTotaal: offerte.kortingOpTotaal,
        createdAt: offerte.createdAt,
        updatedAt: offerte.updatedAt,
      },
      teksten,
      verzondenAt: offerte.verzondenAt ?? null,
      bedrijfsgegevens: instellingen?.bedrijfsgegevens ?? null,
      branding: {
        logoUrl,
        primaireKleur: instellingen?.pdfPrimaireKleur ?? null,
        secundaireKleur: instellingen?.pdfSecundaireKleur ?? null,
        stijl: instellingen?.pdfTemplateStijl ?? null,
      },
      voorwaarden: instellingen?.pdfVoorwaarden?.offerte ?? null,
      voorwaardenPdf: voorwaardenUrl
        ? { url: voorwaardenUrl, naam: instellingen?.voorwaardenPdfNaam ?? "Algemene voorwaarden.pdf" }
        : null,
    };
  },
});
