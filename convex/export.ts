/**
 * Export Queries - Data Export Functions
 *
 * Provides queries for exporting data to CSV/Excel.
 * All queries require admin role and return flat objects suitable for export.
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAdmin } from "./roles";

// ============================================
// Status and Type Labels
// ============================================

const offerteStatusLabels: Record<string, string> = {
  concept: "Concept",
  voorcalculatie: "Voorcalculatie",
  verzonden: "Verzonden",
  geaccepteerd: "Geaccepteerd",
  afgewezen: "Afgewezen",
};

const offerteTypeLabels: Record<string, string> = {
  aanleg: "Aanleg",
  onderhoud: "Onderhoud",
};

const projectStatusLabels: Record<string, string> = {
  gepland: "Gepland",
  in_uitvoering: "In Uitvoering",
  afgerond: "Afgerond",
  nacalculatie_compleet: "Nacalculatie Compleet",
  gefactureerd: "Gefactureerd",
};

const factuurStatusLabels: Record<string, string> = {
  concept: "Concept",
  definitief: "Definitief",
  verzonden: "Verzonden",
  betaald: "Betaald",
  vervallen: "Vervallen",
};

// ============================================
// Export Queries
// ============================================

/**
 * Export all offertes with klant names, formatted for export
 */
export const exportOffertes = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAdmin(ctx);

    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    // Filter out deleted and archived offertes
    const activeOffertes = offertes.filter((o) => !o.deletedAt && !o.isArchived);

    return activeOffertes.map((offerte) => ({
      offerteNummer: offerte.offerteNummer,
      type: offerteTypeLabels[offerte.type] ?? offerte.type,
      status: offerteStatusLabels[offerte.status] ?? offerte.status,
      klantNaam: offerte.klant.naam,
      klantAdres: offerte.klant.adres,
      klantPostcode: offerte.klant.postcode,
      klantPlaats: offerte.klant.plaats,
      klantEmail: offerte.klant.email ?? "",
      klantTelefoon: offerte.klant.telefoon ?? "",
      materiaalkosten: offerte.totalen.materiaalkosten,
      arbeidskosten: offerte.totalen.arbeidskosten,
      totaalUren: offerte.totalen.totaalUren,
      subtotaal: offerte.totalen.subtotaal,
      marge: offerte.totalen.marge,
      margePercentage: offerte.totalen.margePercentage,
      totaalExBtw: offerte.totalen.totaalExBtw,
      btw: offerte.totalen.btw,
      totaalInclBtw: offerte.totalen.totaalInclBtw,
      aangemaakt: offerte.createdAt,
      bijgewerkt: offerte.updatedAt,
      verzonden: offerte.verzondenAt ?? null,
    }));
  },
});

/**
 * Export all klanten
 */
export const exportKlanten = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAdmin(ctx);

    const klanten = await ctx.db
      .query("klanten")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    // Get offerte counts per klant
    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const offerteCountByKlant = new Map<string, number>();
    const totalValueByKlant = new Map<string, number>();

    for (const offerte of offertes) {
      if (offerte.klantId) {
        const klantIdStr = offerte.klantId.toString();
        offerteCountByKlant.set(
          klantIdStr,
          (offerteCountByKlant.get(klantIdStr) || 0) + 1
        );
        if (offerte.status === "geaccepteerd") {
          totalValueByKlant.set(
            klantIdStr,
            (totalValueByKlant.get(klantIdStr) || 0) + offerte.totalen.totaalInclBtw
          );
        }
      }
    }

    return klanten.map((klant) => ({
      naam: klant.naam,
      adres: klant.adres,
      postcode: klant.postcode,
      plaats: klant.plaats,
      email: klant.email ?? "",
      telefoon: klant.telefoon ?? "",
      notities: klant.notities ?? "",
      aantalOffertes: offerteCountByKlant.get(klant._id.toString()) ?? 0,
      totaleOmzet: totalValueByKlant.get(klant._id.toString()) ?? 0,
      aangemaakt: klant.createdAt,
      bijgewerkt: klant.updatedAt,
    }));
  },
});

/**
 * Export all projecten with status and offerte info
 */
export const exportProjecten = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAdmin(ctx);

    const projecten = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    // Filter out deleted and archived projects
    const activeProjecten = projecten.filter((p) => !p.deletedAt && !p.isArchived);

    // Get related offerte info
    const result = await Promise.all(
      activeProjecten.map(async (project) => {
        const offerte = await ctx.db.get(project.offerteId);

        // Get voorcalculatie for begrote uren
        let voorcalculatie = await ctx.db
          .query("voorcalculaties")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .first();

        if (!voorcalculatie) {
          voorcalculatie = await ctx.db
            .query("voorcalculaties")
            .withIndex("by_offerte", (q) => q.eq("offerteId", project.offerteId))
            .first();
        }

        // Get totaal geregistreerde uren
        const urenRegistraties = await ctx.db
          .query("urenRegistraties")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();

        const totaalGeregistreerdeUren = urenRegistraties.reduce(
          (sum, u) => sum + u.uren,
          0
        );

        return {
          projectNaam: project.naam,
          status: projectStatusLabels[project.status] ?? project.status,
          offerteNummer: offerte?.offerteNummer ?? "",
          klantNaam: offerte?.klant?.naam ?? "",
          klantPlaats: offerte?.klant?.plaats ?? "",
          offerteBedrag: offerte?.totalen?.totaalInclBtw ?? 0,
          begroteUren: voorcalculatie?.normUrenTotaal ?? 0,
          geregistreerdeUren: Math.round(totaalGeregistreerdeUren * 10) / 10,
          geschatteDagen: voorcalculatie?.geschatteDagen ?? 0,
          teamGrootte: voorcalculatie?.teamGrootte ?? 0,
          aangemaakt: project.createdAt,
          bijgewerkt: project.updatedAt,
        };
      })
    );

    return result;
  },
});

/**
 * Export all facturen
 */
export const exportFacturen = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAdmin(ctx);

    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    return facturen.map((factuur) => ({
      factuurnummer: factuur.factuurnummer,
      status: factuurStatusLabels[factuur.status] ?? factuur.status,
      klantNaam: factuur.klant.naam,
      klantAdres: factuur.klant.adres,
      klantPostcode: factuur.klant.postcode,
      klantPlaats: factuur.klant.plaats,
      klantEmail: factuur.klant.email ?? "",
      subtotaal: factuur.subtotaal,
      btwPercentage: factuur.btwPercentage,
      btwBedrag: factuur.btwBedrag,
      totaalInclBtw: factuur.totaalInclBtw,
      factuurdatum: factuur.factuurdatum,
      vervaldatum: factuur.vervaldatum,
      betalingstermijnDagen: factuur.betalingstermijnDagen,
      verzondenOp: factuur.verzondenAt ?? null,
      betaaldOp: factuur.betaaldAt ?? null,
      aangemaakt: factuur.createdAt,
    }));
  },
});

/**
 * Export all urenregistraties with medewerker names
 */
export const exportUren = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);

    // Get all projects for this user
    const projecten = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const projectMap = new Map(
      projecten.map((p) => [p._id.toString(), p])
    );

    // Get all uren from all projects
    const urenPromises = projecten.map((project) =>
      ctx.db
        .query("urenRegistraties")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()
    );

    const urenArrays = await Promise.all(urenPromises);
    let allUren = urenArrays.flat();

    // Filter by date range if provided
    if (args.startDate) {
      allUren = allUren.filter((u) => u.datum >= args.startDate!);
    }
    if (args.endDate) {
      allUren = allUren.filter((u) => u.datum <= args.endDate!);
    }

    // Sort by date descending
    allUren.sort((a, b) => b.datum.localeCompare(a.datum));

    return allUren.map((uren) => {
      const project = projectMap.get(uren.projectId.toString());
      return {
        datum: uren.datum,
        medewerker: uren.medewerker,
        projectNaam: project?.naam ?? "Onbekend project",
        scope: uren.scope ?? "",
        uren: uren.uren,
        notities: uren.notities ?? "",
        bron: uren.bron ?? "",
      };
    });
  },
});

/**
 * Export medewerkers (admin only)
 */
export const exportMedewerkers = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAdmin(ctx);

    const medewerkers = await ctx.db
      .query("medewerkers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Get uren statistics for each medewerker
    const urenRegistraties = await ctx.db.query("urenRegistraties").collect();

    return medewerkers.map((medewerker) => {
      const medewerkerUren = urenRegistraties.filter(
        (ur) => ur.medewerker === medewerker.naam
      );
      const totaalUren = medewerkerUren.reduce((sum, ur) => sum + ur.uren, 0);

      return {
        naam: medewerker.naam,
        email: medewerker.email ?? "",
        telefoon: medewerker.telefoon ?? "",
        functie: medewerker.functie ?? "",
        contractType: medewerker.contractType ?? "",
        uurtarief: medewerker.uurtarief ?? 0,
        isActief: medewerker.isActief ? "Ja" : "Nee",
        totaalUren: Math.round(totaalUren * 10) / 10,
        aantalRegistraties: medewerkerUren.length,
        aangemaakt: medewerker.createdAt,
        bijgewerkt: medewerker.updatedAt,
      };
    });
  },
});
