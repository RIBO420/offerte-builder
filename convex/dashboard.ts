/**
 * Consolidated Admin Dashboard Query
 *
 * Replaces 3 overlapping queries with a single round-trip:
 * - getFullDashboardData (offertes.ts) — offertes, projecten, facturen
 * - getDirectieStats (directieDashboard.ts) — offertes, projecten, facturen, uren
 * - getMateriaalmanStats (materiaalmanDashboard.ts) — voertuigen, machines, voorraad, QC
 *
 * Fetches all data once and computes all stats from the shared dataset.
 */

import { query } from "./_generated/server";
import { requireAuthUserId } from "./auth";
import { filterConceptenUit } from "./lib/pipelineKpis";
import { voorcalculatieVanProject, voorcalculatieVanOfferte } from "./lib/voorcalculatieLookup";
import {
  berekenFacturatie,
  berekenGetekendeOmzet,
  binnenVenster,
  isTelbaar,
  type Venster,
} from "./lib/omzetDefinities";
import { bepaalPeriode } from "./lib/rapportagePeriode";
import { telOfferteStatussen } from "./lib/rapportageAggregatie";

// ── Main query ───────────────────────────────────────────────────────
//
// R2: alle geldbedragen hieronder komen uit `lib/omzetDefinities.ts`, het
// bestand waar /rapportages ook uit leest. Reken hier nooit een eigen omzet
// uit — dan lopen dashboard en rapportage weer uit elkaar (zie de schouw van
// 15 aug 2026, die vier verschillende "omzetten" mat).

export const getAdminDashboardData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    const now = new Date();
    const nu = now.getTime();
    // Kwartaalgrenzen uit de gedeelde periodelaag (R5), zodat "dit kwartaal"
    // op het dashboard exact hetzelfde venster is als in /rapportages.
    const kwartaal = bepaalPeriode("dit-kwartaal", nu);
    // `vorigePeriode` is bij een kwartaal altijd gevuld; de terugval is een
    // leeg venster, zodat een onverwachte null nooit "alle tijd" wordt.
    const vorigKwartaal: Venster = kwartaal.vorigePeriode ?? {
      start: kwartaal.start,
      eind: kwartaal.start,
    };
    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    // ── Fetch ALL data in one parallel batch ─────────────────────────

    const [
      allOffertes,
      allProjects,
      allFacturen,
      urenDezeMaandRecords,
      voertuigen,
      machines,
      voorraad,
      qcChecks,
    ] = await Promise.all([
      ctx.db
        .query("offertes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect(),
      ctx.db
        .query("projecten")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect(),
      ctx.db
        .query("facturen")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect(),
      ctx.db
        .query("urenRegistraties")
        .withIndex("by_datum", (q) => q.gte("datum", monthStartStr))
        .collect(),
      ctx.db
        .query("voertuigen")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("machines")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("voorraad")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("kwaliteitsControles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    // Filter out archived/deleted items (gedeelde regel, zie omzetDefinities)
    const offertes = allOffertes.filter(isTelbaar);
    const projects = allProjects.filter(isTelbaar);

    // ══════════════════════════════════════════════════════════════════
    // From getFullDashboardData (offertes.ts)
    // ══════════════════════════════════════════════════════════════════

    // === OFFERTE STATS ===
    // §5.3b (PRD §2.5e): concepten (wizard auto-save) tellen niet mee in de
    // pipeline-KPI's — totaal en totaalWaarde zijn exclusief concepten.
    // Het concept-aantal blijft wel zichtbaar als losse teller.
    const pipelineOffertes = filterConceptenUit(offertes);

    // Statustelling via de gedeelde teller: die vangt ook de legacy-status
    // `definitief` op, die hier voorheen in een NaN-sleutel verdween.
    const telling = telOfferteStatussen(offertes);
    const omzetAlleTijd = berekenGetekendeOmzet(offertes);

    const offerteStats = {
      totaal: telling.pipelineTotaal,
      concept: telling.concept,
      voorcalculatie: telling.voorcalculatie,
      verzonden: telling.verzonden,
      geaccepteerd: telling.geaccepteerd,
      afgewezen: telling.afgewezen,
      totaalWaarde: pipelineOffertes.reduce(
        (sum, o) => sum + (o.totalen?.totaalInclBtw ?? 0),
        0
      ),
      geaccepteerdWaarde: omzetAlleTijd.getekendeOmzetInclBtw,
    };

    const totalSentCount =
      telling.verzonden + telling.geaccepteerd + telling.afgewezen;

    const conversionRate =
      totalSentCount > 0
        ? Math.round((telling.geaccepteerd / totalSentCount) * 100)
        : 0;

    const revenueStats = {
      // Getekende omzet incl. btw, alle tijd — zelfde definitie als
      // rapportage.hoeLoopt.huidig.getekendeOmzetInclBtw.
      totalAcceptedValue: omzetAlleTijd.getekendeOmzetInclBtw,
      totalAcceptedCount: omzetAlleTijd.aantalGetekend,
      conversionRate,
      averageOfferteValue: Math.round(
        omzetAlleTijd.aantalGetekend > 0
          ? omzetAlleTijd.getekendeOmzetInclBtw / omzetAlleTijd.aantalGetekend
          : 0
      ),
    };

    // === RECENT OFFERTES (top 5 with klant info) ===
    const recentOffertes = offertes.slice(0, 5).map((o) => ({
      _id: o._id,
      offerteNummer: o.offerteNummer,
      klantNaam: o.klant?.naam ?? "Onbekende klant",
      status: o.status,
      totaal: o.totalen?.totaalInclBtw ?? 0,
      updatedAt: o.updatedAt,
    }));

    // === ACCEPTED WITHOUT PROJECT ===
    const offertesWithProject = new Set(
      projects.filter((p) => p.offerteId).map((p) => p.offerteId!.toString())
    );
    const acceptedWithoutProject = offertes
      .filter(
        (o) =>
          o.status === "geaccepteerd" &&
          !offertesWithProject.has(o._id.toString())
      )
      .slice(0, 5)
      .map((o) => ({
        _id: o._id,
        offerteNummer: o.offerteNummer,
        klantNaam: o.klant?.naam ?? "Onbekende klant",
        totaal: o.totalen?.totaalInclBtw ?? 0,
        datum: o.createdAt,
      }));

    // === PROJECT STATS ===
    const projectStats = {
      totaal: projects.length,
      gepland: 0,
      in_uitvoering: 0,
      afgerond: 0,
      nacalculatie_compleet: 0,
      gefactureerd: 0,
    };

    for (const project of projects) {
      if (project.status in projectStats) {
        projectStats[project.status as keyof typeof projectStats]++;
      }
    }

    // === ACTIVE PROJECTS WITH PROGRESS ===
    // Pre-build offerte map for O(1) klant lookups (no N+1)
    const offerteMap = new Map(offertes.map((o) => [o._id.toString(), o]));

    const activeProjectsRaw = projects
      .filter((p) => p.status === "in_uitvoering")
      .slice(0, 5);

    const projectIds = activeProjectsRaw.map((p) => p._id);
    const offerteIdsForProjects = activeProjectsRaw.map((p) => p.offerteId);

    // Batch fetch voorcalculaties and uren for active projects in parallel
    const [voorcalculatiesByProject, voorcalculatiesByOfferte, urenByProject] =
      await Promise.all([
        Promise.all(
          projectIds.map((projectId) =>
            voorcalculatieVanProject(ctx, projectId)
          )
        ),
        Promise.all(
          offerteIdsForProjects.map((offerteId) =>
            voorcalculatieVanOfferte(ctx, offerteId)
          )
        ),
        Promise.all(
          projectIds.map((projectId) =>
            ctx.db
              .query("urenRegistraties")
              .withIndex("by_project", (q) => q.eq("projectId", projectId))
              .collect()
          )
        ),
      ]);

    const activeProjects = activeProjectsRaw.map((project, index) => {
      // offerteId is optioneel sinds werkitem-generalisatie
      const offerte = project.offerteId
        ? offerteMap.get(project.offerteId.toString())
        : undefined;
      const klantNaam = offerte?.klant?.naam || "Onbekende klant";

      const voorcalculatie =
        voorcalculatiesByProject[index] || voorcalculatiesByOfferte[index];
      const begroteUren = voorcalculatie?.normUrenTotaal || 0;

      const urenRegistraties = urenByProject[index] || [];
      const totaalUren = urenRegistraties.reduce((sum, u) => sum + u.uren, 0);

      let voortgang = 0;
      if (begroteUren > 0) {
        voortgang = Math.min(
          100,
          Math.round((totaalUren / begroteUren) * 100)
        );
      }

      return {
        _id: project._id,
        naam: project.naam,
        status: project.status,
        voortgang,
        totaalUren: Math.round(totaalUren * 10) / 10,
        begroteUren: Math.round(begroteUren * 10) / 10,
        klantNaam,
      };
    });

    // === FACTUREN STATS ===
    // De aantallen blijven per legacy-status geteld (dat is wat de badges op
    // het dashboard tonen); de bedragen komen uit de gedeelde definitie.
    let conceptCount = 0;
    let definitiefCount = 0;
    let verzondenCount = 0;
    let betaaldCount = 0;
    let vervallenCount = 0;
    let totaalBedrag = 0;

    for (const factuur of allFacturen) {
      switch (factuur.status) {
        case "concept":
          conceptCount++;
          break;
        case "definitief":
          definitiefCount++;
          break;
        case "verzonden":
          verzondenCount++;
          break;
        case "betaald":
          betaaldCount++;
          break;
        case "vervallen":
          vervallenCount++;
          break;
      }
      totaalBedrag += factuur.totaalInclBtw;
    }

    // Openstaand = verzonden facturen minus wat er al binnen is (incl.
    // deelbetalingen). Voorheen stonden hier twee tegenstrijdige definities
    // náást elkaar in dezelfde payload: `facturenStats.openstaandBedrag`
    // telde alleen status "verzonden", `financieel.openstaandBedrag` alleen
    // "definitief" + "vervallen". Nu allebei hetzelfde getal.
    const facturatieAlleTijd = berekenFacturatie(allFacturen, null, nu);

    const facturenStats = {
      totaal: allFacturen.length,
      totaalBedrag,
      openstaandBedrag: facturatieAlleTijd.openstaand,
      betaaldBedrag: facturatieAlleTijd.ontvangen,
      concept: conceptCount,
      definitief: definitiefCount,
      verzonden: verzondenCount,
      betaald: betaaldCount,
      vervallen: vervallenCount,
    };

    const recentFacturen = allFacturen.slice(0, 5).map((factuur) => ({
      _id: factuur._id,
      factuurnummer: factuur.factuurnummer,
      klantNaam: factuur.klant?.naam ?? "Onbekende klant",
      totaalInclBtw: factuur.totaalInclBtw,
      status: factuur.status,
      factuurdatum: factuur.factuurdatum,
      vervaldatum: factuur.vervaldatum,
    }));

    // ══════════════════════════════════════════════════════════════════
    // From getDirectieStats (directieDashboard.ts) — unique data only
    // ══════════════════════════════════════════════════════════════════

    // Financieel: openstaand en te laat — zelfde definitie als hierboven en
    // als rapportage.geldLigt.openstaand.
    const financieel = {
      openstaandBedrag: facturatieAlleTijd.openstaand,
      vervaldeAantal: facturatieAlleTijd.aantalVervallen,
      vervaldenBedrag: facturatieAlleTijd.vervallenBedrag,
    };

    // Uren this month
    const urenDezeMaand = urenDezeMaandRecords.reduce(
      (sum, u) => sum + (u.uren ?? 0),
      0
    );

    // Quarter comparison
    // §5.3b: concepten tellen niet mee in de kwartaal-KPI's van de pipeline.
    // Instroom telt op aanmaakdatum; omzet telt op tekendatum en facturatie op
    // factuurdatum — dezelfde peildata als /rapportages (zie omzetDefinities).
    const offertesThisQ = pipelineOffertes.filter((o) =>
      binnenVenster(o.createdAt, kwartaal)
    );
    const offertesPrevQ = pipelineOffertes.filter((o) =>
      binnenVenster(o.createdAt, vorigKwartaal)
    );

    const omzetThisQ = berekenGetekendeOmzet(offertes, kwartaal);
    const omzetPrevQ = berekenGetekendeOmzet(offertes, vorigKwartaal);
    const facturatieThisQ = berekenFacturatie(allFacturen, kwartaal, nu);
    const facturatiePrevQ = berekenFacturatie(allFacturen, vorigKwartaal, nu);

    const kwartaalVergelijking = {
      offertesThisQ: offertesThisQ.length,
      offertesPrevQ: offertesPrevQ.length,
      acceptedThisQ: omzetThisQ.aantalGetekend,
      acceptedPrevQ: omzetPrevQ.aantalGetekend,
      revenueThisQ: omzetThisQ.getekendeOmzetInclBtw,
      revenuePrevQ: omzetPrevQ.getekendeOmzetInclBtw,
      gefactureerdThisQ: facturatieThisQ.gefactureerdInclBtw,
      gefactureerdPrevQ: facturatiePrevQ.gefactureerdInclBtw,
    };

    // ══════════════════════════════════════════════════════════════════
    // From getMateriaalmanStats (materiaalmanDashboard.ts) — summary
    // ══════════════════════════════════════════════════════════════════

    // Blokkades: vehicles in onderhoud/inactief + inactive machines
    const voertuigBlokkades =
      voertuigen.filter(
        (v) => v.status === "onderhoud" || v.status === "inactief"
      ).length;
    const machineBlokkades = machines.filter((m) => !m.isActief).length;
    const blokkadeCount = voertuigBlokkades + machineBlokkades;

    // Voorraad alerts: items below minimum stock level
    const voorraadAlerts = voorraad.filter(
      (v) => v.minVoorraad && v.hoeveelheid < v.minVoorraad
    ).length;

    // Open QC checks
    const openQCCount = qcChecks.filter(
      (q) => q.status === "open" || q.status === "in_uitvoering"
    ).length;

    const issueCount = blokkadeCount + voorraadAlerts + openQCCount;
    const hasIssues = issueCount > 0;

    // Build Dutch summary string
    let summary = "Alles operationeel";
    if (hasIssues) {
      const parts: string[] = [];
      if (blokkadeCount > 0) {
        parts.push(
          `${blokkadeCount} blokkade${blokkadeCount !== 1 ? "s" : ""}`
        );
      }
      if (voorraadAlerts > 0) {
        parts.push(
          `${voorraadAlerts} voorraad alert${voorraadAlerts !== 1 ? "s" : ""}`
        );
      }
      if (openQCCount > 0) {
        parts.push(
          `${openQCCount} open QC check${openQCCount !== 1 ? "s" : ""}`
        );
      }
      summary = parts.join(", ");
    }

    const vlootSummary = {
      hasIssues,
      issueCount,
      summary,
    };

    // ══════════════════════════════════════════════════════════════════
    // Combined return
    // ══════════════════════════════════════════════════════════════════

    return {
      // From getFullDashboardData
      offerteStats,
      recentOffertes,
      revenueStats,
      acceptedWithoutProject,
      projectStats,
      activeProjects,
      facturenStats,
      recentFacturen,

      // From getDirectieStats (unique data only)
      financieel,
      urenDezeMaand,
      kwartaalVergelijking,

      // From getMateriaalmanStats (summary only)
      vlootSummary,
    };
  },
});
