import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  internalQuery,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import {
  AuthError,
  requireOrgContext,
  requireOrgId,
  getOwnedOfferte,
  getOwnedKlant,
} from "./auth";
import { requireNotViewer, assertKanNaarKlantVersturen } from "./roles";
import { internal } from "./_generated/api";
import { upgradeKlantPipeline } from "./pipelineHelpers";
import {
  bepaalAcceptatieBesluit,
  voerKetenActieUit,
  type KetenActie,
} from "./acceptatieKeten";
import { logTijdlijnEvent } from "./tijdlijn";
import { zetTriggerMailKlaar } from "./mailTriggers";
import { voorcalculatieVanProject, voorcalculatieVanOfferte } from "./lib/voorcalculatieLookup";
import {
  assertKlantVoorStatus,
  klantNaam,
  type OfferteKlant,
} from "./lib/offerteKlant";
import { reserveerOfferteNummer } from "./lib/offerteNummer";
import { Doc, Id } from "./_generated/dataModel";

/**
 * Klantdossier → de klantgegevens zoals ze op de offerte worden vastgelegd.
 * De offerte houdt bewust een eigen kopie: latere adreswijzigingen in het
 * dossier mogen een verstuurde offerte niet met terugwerkende kracht wijzigen.
 */
function klantSnapshot(klant: Doc<"klanten">): OfferteKlant {
  return {
    naam: klant.naam,
    adres: klant.adres,
    postcode: klant.postcode,
    plaats: klant.plaats,
    email: klant.email,
    telefoon: klant.telefoon,
  };
}

/**
 * Offerte ophalen en toetsen aan een AL opgehaalde `orgId`.
 *
 * `getOwnedOfferte` roept zelf `requireOrgId` aan. In een bulk-lus betekent dat
 * per document opnieuw de identity- en organisatie-lookup; daarom hoisten de
 * bulkroutes de resolver naar boven en gebruiken ze deze variant. De
 * foutmeldingen zijn identiek aan `verifyOrgOwnership`, zodat de bulkroute geen
 * ander verhaal vertelt dan de losse route.
 */
async function offerteVanOrg(
  ctx: QueryCtx | MutationCtx,
  id: Id<"offertes">,
  orgId: Id<"organisaties">
): Promise<Doc<"offertes">> {
  const offerte = await ctx.db.get(id);
  if (!offerte) {
    throw new AuthError("offerte niet gevonden");
  }
  if (offerte.orgId?.toString() !== orgId.toString()) {
    throw new AuthError("Je hebt geen toegang tot deze offerte");
  }
  return offerte;
}

const klantValidator = v.object({
  naam: v.string(),
  adres: v.string(),
  postcode: v.string(),
  plaats: v.string(),
  email: v.optional(v.string()),
  telefoon: v.optional(v.string()),
});

const algemeenParamsValidator = v.object({
  bereikbaarheid: v.union(
    v.literal("goed"),
    v.literal("beperkt"),
    v.literal("slecht")
  ),
  achterstalligheid: v.optional(
    v.union(v.literal("laag"), v.literal("gemiddeld"), v.literal("hoog"))
  ),
});

const regelValidator = v.object({
  id: v.string(),
  scope: v.string(),
  omschrijving: v.string(),
  eenheid: v.string(),
  hoeveelheid: v.number(),
  prijsPerEenheid: v.number(),
  totaal: v.number(),
  type: v.union(v.literal("materiaal"), v.literal("arbeid"), v.literal("machine")),
  margePercentage: v.optional(v.number()), // Override marge per regel
  // Vrije builder (route 2, PRD §2.5b) — additief, zie schema.ts
  inkoopprijsPerEenheid: v.optional(v.number()),
  btwCode: v.optional(v.union(v.literal(9), v.literal(21))),
  kortingPercentage: v.optional(v.number()),
  productId: v.optional(v.id("producten")),
  prijsOpRegel: v.optional(v.boolean()),
});

const scopeMargesValidator = v.object({
  grondwerk: v.optional(v.number()),
  bestrating: v.optional(v.number()),
  borders: v.optional(v.number()),
  gras: v.optional(v.number()),
  houtwerk: v.optional(v.number()),
  water_elektra: v.optional(v.number()),
  specials: v.optional(v.number()),
  gras_onderhoud: v.optional(v.number()),
  borders_onderhoud: v.optional(v.number()),
  heggen: v.optional(v.number()),
  bomen: v.optional(v.number()),
  overig: v.optional(v.number()),
});

// List all offertes for authenticated user
export const list = query({
  args: {
    includeArchived: v.optional(v.boolean()),
    includeDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .collect();

    // Filter out deleted offertes unless includeDeleted is true
    let filtered = offertes;
    if (!args.includeDeleted) {
      filtered = filtered.filter((o) => !o.deletedAt);
    }

    // Filter out archived offertes unless includeArchived is true
    if (!args.includeArchived) {
      filtered = filtered.filter((o) => !o.isArchived);
    }

    return filtered;
  },
});

// List offertes with pagination
export const listPaginated = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const limit = args.limit || 25;

    const result = await ctx.db
      .query("offertes")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .paginate({ numItems: limit, cursor: args.cursor ?? null });

    return {
      offertes: result.page,
      nextCursor: result.continueCursor,
      hasMore: !result.isDone,
    };
  },
});

// Combined dashboard query - reduces round trips
export const getDashboardData = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await requireOrgId(ctx);
    // Get all offertes in one query
    const allOffertes = await ctx.db
      .query("offertes")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .collect();

    // Filter out archived and deleted offertes
    const offertes = allOffertes.filter((o) => !o.isArchived && !o.deletedAt);

    // Calculate stats
    const stats = {
      totaal: offertes.length,
      concept: 0,
      voorcalculatie: 0,
      verzonden: 0,
      geaccepteerd: 0,
      afgewezen: 0,
      totaalWaarde: 0,
      geaccepteerdWaarde: 0,
    };

    for (const offerte of offertes) {
      stats[offerte.status as keyof typeof stats]++;
      stats.totaalWaarde += offerte.totalen.totaalInclBtw;
      if (offerte.status === "geaccepteerd") {
        stats.geaccepteerdWaarde += offerte.totalen.totaalInclBtw;
      }
    }

    // Get recent 5
    const recent = offertes.slice(0, 5);

    return {
      stats,
      recent,
      // For backwards compatibility, also include a limited list
      offertes: offertes.slice(0, 50),
    };
  },
});

// Comprehensive dashboard query - batches ALL dashboard data in a single round-trip
// Combines: offerte stats, revenue stats, accepted without project, project stats,
// active projects, facturen stats, and recent facturen
export const getFullDashboardData = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await requireOrgId(ctx);

    // Batch fetch all data in parallel using Promise.all
    const [allOffertes, allProjects, allFacturen] = await Promise.all([
      ctx.db
        .query("offertes")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .order("desc")
        .collect(),
      ctx.db
        .query("projecten")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .order("desc")
        .collect(),
      ctx.db
        .query("facturen")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .order("desc")
        .collect(),
    ]);

    // Filter out archived and deleted items
    const offertes = allOffertes.filter((o) => !o.isArchived && !o.deletedAt);
    const projects = allProjects.filter((p) => !p.isArchived && !p.deletedAt);

    // === OFFERTE STATS ===
    const offerteStats = {
      totaal: offertes.length,
      concept: 0,
      voorcalculatie: 0,
      verzonden: 0,
      geaccepteerd: 0,
      afgewezen: 0,
      totaalWaarde: 0,
      geaccepteerdWaarde: 0,
    };

    // === REVENUE STATS (calculated from offertes) ===
    let totalAcceptedValue = 0;
    let totalAcceptedCount = 0;
    let totalSentCount = 0;
    const geaccepteerdeOfferteIds: string[] = [];

    for (const offerte of offertes) {
      offerteStats[offerte.status as keyof typeof offerteStats]++;
      offerteStats.totaalWaarde += offerte.totalen.totaalInclBtw;

      if (offerte.status === "geaccepteerd") {
        offerteStats.geaccepteerdWaarde += offerte.totalen.totaalInclBtw;
        totalAcceptedValue += offerte.totalen.totaalInclBtw;
        totalAcceptedCount++;
        geaccepteerdeOfferteIds.push(offerte._id.toString());
      }

      if (
        offerte.status === "verzonden" ||
        offerte.status === "geaccepteerd" ||
        offerte.status === "afgewezen"
      ) {
        totalSentCount++;
      }
    }

    const conversionRate =
      totalSentCount > 0
        ? Math.round((totalAcceptedCount / totalSentCount) * 100)
        : 0;
    const averageOfferteValue =
      totalAcceptedCount > 0
        ? Math.round(totalAcceptedValue / totalAcceptedCount)
        : 0;

    const revenueStats = {
      totalAcceptedValue,
      totalAcceptedCount,
      conversionRate,
      averageOfferteValue,
    };

    // === ACCEPTED OFFERTES WITHOUT PROJECT ===
    // offerteId is optioneel sinds werkitem-generalisatie
    const offertesWithProject = new Set(
      projects.map((p) => p.offerteId?.toString()).filter(Boolean)
    );
    const geaccepteerdeOffertes = offertes.filter(
      (o) => o.status === "geaccepteerd"
    );
    const acceptedWithoutProject = geaccepteerdeOffertes
      .filter((o) => !offertesWithProject.has(o._id.toString()))
      .slice(0, 5)
      .map((o) => ({
        _id: o._id,
        offerteNummer: o.offerteNummer,
        klantNaam: klantNaam(o.klant),
        totaal: o.totalen.totaalInclBtw,
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
    const activeProjectsRaw = projects
      .filter((p) => p.status === "in_uitvoering")
      .slice(0, 5);

    // OPTIMIZED: Batch fetch all related data using Promise.all instead of N+1 queries
    // 1. Build lookup map from offertes we already have
    const offerteMap = new Map(offertes.map((o) => [o._id.toString(), o]));

    // 2. Batch fetch voorcalculaties and urenRegistraties for each project in parallel
    // Since these tables don't have a by_user index, we fetch per-project but in parallel
    const projectIds = activeProjectsRaw.map((p) => p._id);
    const offerteIdsForProjects = activeProjectsRaw.map((p) => p.offerteId);

    // Fetch all voorcalculaties and urenRegistraties in parallel batches
    const [voorcalculatiesByProject, voorcalculatiesByOfferte, urenByProject] = await Promise.all([
      // Batch 1: Fetch voorcalculaties by project IDs
      Promise.all(
        projectIds.map((projectId) =>
          voorcalculatieVanProject(ctx, projectId)
        )
      ),
      // Batch 2: Fetch voorcalculaties by offerte IDs (fallback)
      Promise.all(
        offerteIdsForProjects.map((offerteId) =>
          voorcalculatieVanOfferte(ctx, offerteId)
        )
      ),
      // Batch 3: Fetch urenRegistraties by project IDs
      Promise.all(
        projectIds.map((projectId) =>
          ctx.db
            .query("urenRegistraties")
            .withIndex("by_project", (q) => q.eq("projectId", projectId))
            .collect()
        )
      ),
    ]);

    // Now process active projects with in-memory lookups (no additional queries)
    const activeProjects = activeProjectsRaw.map((project, index) => {
      // Get offerte for klant naam from our existing map
      // offerteId is optioneel sinds werkitem-generalisatie
      const offerte = project.offerteId
        ? offerteMap.get(project.offerteId.toString())
        : undefined;
      const klantNaam = offerte?.klant?.naam || "Onbekende klant";

      // Get voorcalculatie (check project-level first, then offerte-level)
      const voorcalculatie = voorcalculatiesByProject[index] || voorcalculatiesByOfferte[index];
      const begroteUren = voorcalculatie?.normUrenTotaal || 0;

      // Get uren registraties for totaal uren
      const urenRegistraties = urenByProject[index] || [];
      const totaalUren = urenRegistraties.reduce((sum, u) => sum + u.uren, 0);

      // Calculate voortgang percentage (0-100)
      let voortgang = 0;
      if (begroteUren > 0) {
        voortgang = Math.min(100, Math.round((totaalUren / begroteUren) * 100));
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
    let conceptCount = 0;
    let definitiefCount = 0;
    let verzondenCount = 0;
    let betaaldCount = 0;
    let vervallenCount = 0;
    let totaalBedrag = 0;
    let openstaandBedrag = 0;
    let betaaldBedrag = 0;

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
          openstaandBedrag += factuur.totaalInclBtw;
          break;
        case "betaald":
          betaaldCount++;
          betaaldBedrag += factuur.totaalInclBtw;
          break;
        case "vervallen":
          vervallenCount++;
          break;
      }
      totaalBedrag += factuur.totaalInclBtw;
    }

    const facturenStats = {
      totaal: allFacturen.length,
      totaalBedrag,
      openstaandBedrag,
      betaaldBedrag,
      concept: conceptCount,
      definitief: definitiefCount,
      verzonden: verzondenCount,
      betaald: betaaldCount,
      vervallen: vervallenCount,
    };

    // === RECENT FACTUREN ===
    const recentFacturen = allFacturen.slice(0, 5).map((factuur) => ({
      _id: factuur._id,
      factuurnummer: factuur.factuurnummer,
      klantNaam: factuur.klant.naam,
      totaalInclBtw: factuur.totaalInclBtw,
      status: factuur.status,
      factuurdatum: factuur.factuurdatum,
      vervaldatum: factuur.vervaldatum,
    }));

    return {
      // Offerte data
      offerteStats,
      recentOffertes: offertes.slice(0, 5),
      // Revenue stats (derived from offertes)
      revenueStats,
      // Action required items
      acceptedWithoutProject,
      // Project data
      projectStats,
      activeProjects,
      // Facturen data
      facturenStats,
      recentFacturen,
    };
  },
});

// List offertes by status
export const listByStatus = query({
  args: {
    status: v.union(
      v.literal("concept"),
      v.literal("voorcalculatie"),
      v.literal("verzonden"),
      v.literal("geaccepteerd"),
      v.literal("afgewezen")
    ),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    // Filter by status, exclude archived unless specified, and exclude deleted
    return offertes.filter((o) =>
      o.status === args.status &&
      (args.includeArchived || !o.isArchived) &&
      !o.deletedAt
    );
  },
});

// §5.3c: Verweesde concepten — concepten ouder dan X dagen zonder klantkoppeling.
// Kantoor kan deze via de offerte-lijst opgeschoond (gearchiveerd) zetten.
// Bewust géén cron en géén hard delete: archiveren gaat via bulkRemove (soft delete).
export const listVerweesdeConcepten = query({
  args: {
    ouderDanDagen: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const dagen = args.ouderDanDagen ?? 14;
    const grens = Date.now() - dagen * 24 * 60 * 60 * 1000;

    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    return offertes
      .filter(
        (o) =>
          o.status === "concept" &&
          !o.klantId &&
          !o.deletedAt &&
          !o.isArchived &&
          o.updatedAt < grens
      )
      .map((o) => ({
        _id: o._id,
        offerteNummer: o.offerteNummer,
        klantNaam: o.klant?.naam || "Geen klant",
        type: o.type,
        updatedAt: o.updatedAt,
      }))
      .sort((a, b) => a.updatedAt - b.updatedAt);
  },
});

// Get single offerte (with ownership verification)
export const get = query({
  args: { id: v.id("offertes") },
  handler: async (ctx, args) => {
    const offerte = await ctx.db.get(args.id);
    if (!offerte) return null;

    // Verify ownership
    const orgId = await requireOrgId(ctx);
    if (offerte.orgId?.toString() !== orgId.toString()) {
      return null; // Don't reveal existence to unauthorized users
    }

    return offerte;
  },
});

// Get single offerte with voorcalculatie data joined
export const getWithVoorcalculatie = query({
  args: { id: v.id("offertes") },
  handler: async (ctx, args) => {
    const offerte = await ctx.db.get(args.id);
    if (!offerte) return null;

    // Verify ownership
    const orgId = await requireOrgId(ctx);
    if (offerte.orgId?.toString() !== orgId.toString()) {
      return null; // Don't reveal existence to unauthorized users
    }

    // Get the voorcalculatie for this offerte
    const voorcalculatie = await voorcalculatieVanOfferte(ctx, args.id);

    return {
      ...offerte,
      voorcalculatie: voorcalculatie || null,
    };
  },
});

// Get offerte by nummer (staf, alleen eigen offertes — nummer is raadbaar,
// dus zonder scoping lekte dit volledige offertes incl. interne prijzen)
export const getByNummer = query({
  args: { offerteNummer: v.string() },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);
    // by_nummer is bedrijfsoverstijgend: nummers zijn per organisatie uniek,
    // dus alle treffers ophalen en die van de eigen organisatie kiezen.
    const treffers = await ctx.db
      .query("offertes")
      .withIndex("by_nummer", (q) => q.eq("offerteNummer", args.offerteNummer))
      .collect();
    return (
      treffers.find((o) => o.orgId?.toString() === orgId.toString()) ?? null
    );
  },
});

/**
 * Nieuwe offerte — altijd als concept.
 *
 * Twee dingen zijn hier bewust optioneel (masterplan offerte-entree):
 *
 * - **`klant`** (A3): een concept mag leeg beginnen, zodat "klik → leeg
 *   document" echt één klik is. Vanaf de eerste statusovergang wég van concept
 *   dwingt `assertKlantVoorStatus` een complete klant af.
 * - **`offerteNummer`** (A6): laat 'm weg, dan reserveert deze mutation het
 *   nummer zélf in dezelfde transactie als de insert — race-vrij. Meesturen mag
 *   nog (bestaande aanroepers), maar dan ben je zelf verantwoordelijk voor de
 *   uniciteit.
 */
export const create = mutation({
  args: {
    type: v.union(v.literal("aanleg"), v.literal("onderhoud")),
    offerteNummer: v.optional(v.string()),
    klant: v.optional(klantValidator),
    algemeenParams: algemeenParamsValidator,
    scopes: v.optional(v.array(v.string())),
    scopeData: v.optional(v.any()),
    notities: v.optional(v.string()),
    klantId: v.optional(v.id("klanten")),
    leadId: v.optional(v.id("configuratorAanvragen")),
    // Route 2 (PRD §2.5b): "vrij" = regel-editor; undefined = wizard
    bron: v.optional(v.union(v.literal("wizard"), v.literal("vrij"))),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const { org, user } = await requireOrgContext(ctx);
    const userId = user._id;
    const now = Date.now();

    // Klant uit het dossier wint van losse velden: zo staat er nooit een
    // klantId op de offerte met andere naam/adresgegevens ernaast.
    let klant = args.klant;
    if (args.klantId) {
      const klantDoc = await ctx.db.get(args.klantId);
      if (klantDoc && klantDoc.orgId?.toString() === org._id.toString()) {
        klant = klant ?? klantSnapshot(klantDoc);
      }
    }

    const offerteNummer =
      args.offerteNummer ?? (await reserveerOfferteNummer(ctx, userId));

    const offerteId = await ctx.db.insert("offertes", {
      orgId: org._id,
      userId,
      type: args.type,
      status: "concept",
      bron: args.bron,
      offerteNummer,
      klant,
      klantId: args.klantId,
      leadId: args.leadId,
      algemeenParams: args.algemeenParams,
      scopes: args.scopes,
      scopeData: args.scopeData,
      totalen: {
        materiaalkosten: 0,
        arbeidskosten: 0,
        totaalUren: 0,
        subtotaal: 0,
        marge: 0,
        margePercentage: 0,
        totaalExBtw: 0,
        btw: 0,
        totaalInclBtw: 0,
      },
      regels: [],
      notities: args.notities,
      createdAt: now,
      updatedAt: now,
    });

    // Create initial version
    const offerte = await ctx.db.get(offerteId);
    if (offerte) {
      await ctx.db.insert("offerte_versions", {
        offerteId,
        orgId: org._id,
        userId,
        versieNummer: 1,
        snapshot: {
          status: offerte.status,
          klant: offerte.klant,
          algemeenParams: {
            bereikbaarheid: offerte.algemeenParams.bereikbaarheid,
            achterstalligheid: offerte.algemeenParams.achterstalligheid,
          },
          scopes: offerte.scopes,
          scopeData: offerte.scopeData,
          totalen: offerte.totalen,
          regels: [],
          notities: offerte.notities,
        },
        actie: "aangemaakt",
        omschrijving: `Offerte ${offerteNummer} aangemaakt`,
        createdAt: now,
      });

      // Trigger notification for new offerte creation (optional - only if enabled in preferences)
      await ctx.scheduler.runAfter(0, internal.notifications.notifyOfferteCreated, {
        offerteId,
        createdByUserId: userId,
      });
    }

    // Update lead pipeline status and log activity when linked to a lead
    if (args.leadId) {
      await ctx.db.patch(args.leadId, {
        pipelineStatus: "offerte_verstuurd",
        updatedAt: now,
        // Koppel klant aan lead als er een klantId is
        ...(args.klantId ? { gekoppeldKlantId: args.klantId } : {}),
      });

      await ctx.db.insert("leadActiviteiten", {
        leadId: args.leadId,
        type: "offerte_gekoppeld",
        beschrijving: `Offerte ${offerteNummer} aangemaakt`,
        gebruikerId: userId,
        createdAt: now,
      });
    }

    return offerteId;
  },
});

// Update offerte basic info
export const update = mutation({
  args: {
    id: v.id("offertes"),
    klant: v.optional(klantValidator),
    algemeenParams: v.optional(algemeenParamsValidator),
    scopes: v.optional(v.array(v.string())),
    scopeData: v.optional(v.any()),
    notities: v.optional(v.string()),
    createVersion: v.optional(v.boolean()), // Optional: skip version for auto-save
  },
  handler: async (ctx, args) => {
    const user = await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);
    // Verify ownership before updating
    const offerte = await getOwnedOfferte(ctx, args.id);

    const { id, createVersion: shouldCreateVersion = true, ...updates } = args;
    const now = Date.now();

    // Guard: geaccepteerde offertes zijn vergrendeld — maak automatisch nieuwe versie
    if (offerte.status === "geaccepteerd") {
      // 1. Snapshot de huidige (getekende) staat als versiegeschiedenis
      const versions = await ctx.db
        .query("offerte_versions")
        .withIndex("by_offerte", (q) => q.eq("offerteId", id))
        .order("desc")
        .take(1);

      const versieNummer = (versions[0]?.versieNummer ?? 0) + 1;

      await ctx.db.insert("offerte_versions", {
        offerteId: id,
        orgId,
        userId: user._id,
        versieNummer,
        snapshot: {
          status: offerte.status,
          klant: offerte.klant,
          algemeenParams: {
            bereikbaarheid: offerte.algemeenParams.bereikbaarheid,
            achterstalligheid: offerte.algemeenParams.achterstalligheid,
          },
          scopes: offerte.scopes,
          scopeData: offerte.scopeData,
          totalen: offerte.totalen,
          regels: offerte.regels.map((r) => ({
            id: r.id,
            scope: r.scope,
            omschrijving: r.omschrijving,
            eenheid: r.eenheid,
            hoeveelheid: r.hoeveelheid,
            prijsPerEenheid: r.prijsPerEenheid,
            totaal: r.totaal,
            type: r.type,
          })),
          notities: offerte.notities,
        },
        actie: "nieuwe_versie",
        omschrijving: "Getekende offerte vergrendeld — nieuwe versie aangemaakt",
        createdAt: now,
      });

      // 2. Reset status naar concept, wis klantrespons, pas wijzigingen toe
      const filteredUpdates: Record<string, unknown> = {
        updatedAt: now,
        status: "concept",
        customerResponse: undefined,
      };

      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          filteredUpdates[key] = value;
        }
      }

      await ctx.db.patch(id, filteredUpdates);
      return id;
    }

    // Normale update flow (niet-geaccepteerde offertes)
    const filteredUpdates: Record<string, unknown> = { updatedAt: now };

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    await ctx.db.patch(id, filteredUpdates);

    // Create version snapshot if enabled (default: true)
    if (shouldCreateVersion) {
      const updatedOfferte = await ctx.db.get(id);
      if (updatedOfferte) {
        // Get next version number
        const versions = await ctx.db
          .query("offerte_versions")
          .withIndex("by_offerte", (q) => q.eq("offerteId", id))
          .order("desc")
          .take(1);

        const versieNummer = (versions[0]?.versieNummer ?? 0) + 1;

        await ctx.db.insert("offerte_versions", {
          offerteId: id,
          orgId,
          userId: updatedOfferte.userId,
          versieNummer,
          snapshot: {
            status: updatedOfferte.status,
            klant: updatedOfferte.klant,
            algemeenParams: {
              bereikbaarheid: updatedOfferte.algemeenParams.bereikbaarheid,
              achterstalligheid: updatedOfferte.algemeenParams.achterstalligheid,
            },
            scopes: updatedOfferte.scopes,
            scopeData: updatedOfferte.scopeData,
            totalen: updatedOfferte.totalen,
            regels: updatedOfferte.regels.map((r) => ({
              id: r.id,
              scope: r.scope,
              omschrijving: r.omschrijving,
              eenheid: r.eenheid,
              hoeveelheid: r.hoeveelheid,
              prijsPerEenheid: r.prijsPerEenheid,
              totaal: r.totaal,
              type: r.type,
            })),
            notities: updatedOfferte.notities,
          },
          actie: "gewijzigd",
          omschrijving: "Offerte gegevens gewijzigd",
          createdAt: now,
        });
      }
    }

    return id;
  },
});

/**
 * Klant koppelen aan (of wisselen op) een bestaande offerte.
 *
 * Hoort bij de vrije offerte-entree (masterplan A3): het concept bestaat al —
 * eventueel zonder klant — en krijgt hier zijn klant. Drie vormen:
 *
 *   koppelKlant({ id, klantId })   → klant uit het dossier (klantgegevens
 *                                    worden als momentopname overgenomen)
 *   koppelKlant({ id, klant })     → losse klantgegevens, zonder dossier
 *                                    (bestaande dossierkoppeling vervalt)
 *   koppelKlant({ id, ontkoppelen: true }) → klant weer weghalen (alleen concept)
 *
 * Wisselen mag zolang de offerte niet naar de klant is gegaan: bij verzonden,
 * geaccepteerd en afgewezen ligt de tenaamstelling vast.
 */
export const koppelKlant = mutation({
  args: {
    id: v.id("offertes"),
    klantId: v.optional(v.id("klanten")),
    klant: v.optional(klantValidator),
    ontkoppelen: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);
    const offerte = await getOwnedOfferte(ctx, args.id);

    if (offerte.status !== "concept" && offerte.status !== "voorcalculatie") {
      throw new ConvexError(
        "De klant van een verstuurde of getekende offerte kan niet meer worden gewijzigd — zet de offerte eerst terug naar concept."
      );
    }

    const now = Date.now();
    let nieuweKlant: OfferteKlant | undefined;
    let nieuwKlantId: Id<"klanten"> | undefined;
    let omschrijving: string;

    if (args.ontkoppelen) {
      if (offerte.status !== "concept") {
        throw new ConvexError(
          "Een klant loskoppelen kan alleen zolang de offerte een concept is."
        );
      }
      omschrijving = "Klant losgekoppeld van de offerte";
    } else if (args.klantId) {
      const klantDoc = await getOwnedKlant(ctx, args.klantId);
      nieuwKlantId = klantDoc._id;
      nieuweKlant = { ...klantSnapshot(klantDoc), ...(args.klant ?? {}) };
      omschrijving = `Klant gekoppeld: ${klantNaam(nieuweKlant)}`;
    } else if (args.klant) {
      nieuweKlant = args.klant;
      omschrijving = `Klantgegevens gewijzigd: ${klantNaam(nieuweKlant)}`;
    } else {
      throw new ConvexError(
        "Geef een klant op om te koppelen (klantId of klantgegevens), of zet ontkoppelen op true."
      );
    }

    await ctx.db.patch(args.id, {
      klant: nieuweKlant,
      klantId: nieuwKlantId,
      updatedAt: now,
    });

    // Versieregel zodat de klantwissel in de offertehistorie terugkomt.
    const versions = await ctx.db
      .query("offerte_versions")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.id))
      .order("desc")
      .take(1);

    await ctx.db.insert("offerte_versions", {
      offerteId: args.id,
      orgId,
      userId: user._id,
      versieNummer: (versions[0]?.versieNummer ?? 0) + 1,
      snapshot: {
        status: offerte.status,
        klant: nieuweKlant,
        algemeenParams: {
          bereikbaarheid: offerte.algemeenParams.bereikbaarheid,
          achterstalligheid: offerte.algemeenParams.achterstalligheid,
        },
        scopes: offerte.scopes,
        scopeData: offerte.scopeData,
        totalen: offerte.totalen,
        regels: offerte.regels.map((r) => ({
          id: r.id,
          scope: r.scope,
          omschrijving: r.omschrijving,
          eenheid: r.eenheid,
          hoeveelheid: r.hoeveelheid,
          prijsPerEenheid: r.prijsPerEenheid,
          totaal: r.totaal,
          type: r.type,
        })),
        notities: offerte.notities,
      },
      actie: "gewijzigd",
      omschrijving,
      createdAt: now,
    });

    return args.id;
  },
});

// Catalogus-bouwsteenregels op de offerte (PRD §2.5a + bijlage A) — additief
// naast regels[]. Gestructureerde bron voor contract-voorvulling (§2.1):
// onderhoudscontracten.createFromOfferte leest deze regels 1-op-1 terug.
export const updateBouwsteenRegels = mutation({
  args: {
    id: v.id("offertes"),
    bouwsteenRegels: v.array(
      v.object({
        bouwsteenId: v.id("bouwstenen"),
        naam: v.string(),
        soort: v.string(),
        frequentiePerJaar: v.number(),
        prijsPerBeurt: v.number(),
        prijsPerBeurtHandmatig: v.optional(v.boolean()),
        btwCode: v.union(v.literal(9), v.literal(21)),
        eenmalig: v.boolean(),
        zandKeuze: v.optional(
          v.object({
            keuze: v.union(v.literal("voegzand"), v.literal("straatzand")),
            prijsVoegzand: v.number(),
            prijsStraatzand: v.number(),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const offerte = await getOwnedOfferte(ctx, args.id);

    // Historie beschermen: een geaccepteerde offerte behoudt haar eigen
    // bouwsteen-regels en tarieven (§8.7); wijzig eerst via updateRegels
    // (die maakt een nieuwe versie en zet de status terug naar concept).
    if (offerte.status === "geaccepteerd") {
      throw new ConvexError(
        "Geaccepteerde offerte is vergrendeld — bouwsteen-regels kunnen niet meer wijzigen"
      );
    }

    await ctx.db.patch(args.id, {
      bouwsteenRegels: args.bouwsteenRegels,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

// Update offerte regels and recalculate totals
export const updateRegels = mutation({
  args: {
    id: v.id("offertes"),
    regels: v.array(regelValidator),
    margePercentage: v.number(), // Standaard marge
    scopeMarges: v.optional(scopeMargesValidator), // Per-scope marges
    btwPercentage: v.number(),
    uurtarief: v.number(),
    createVersion: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);
    // Verify ownership before updating
    const offerte = await getOwnedOfferte(ctx, args.id);

    const now = Date.now();
    const shouldCreateVersion = args.createVersion ?? true;

    // Guard: geaccepteerde offertes zijn vergrendeld — maak automatisch nieuwe versie
    if (offerte.status === "geaccepteerd") {
      // Snapshot de huidige (getekende) staat als versiegeschiedenis
      const versions = await ctx.db
        .query("offerte_versions")
        .withIndex("by_offerte", (q) => q.eq("offerteId", args.id))
        .order("desc")
        .take(1);

      const versieNummer = (versions[0]?.versieNummer ?? 0) + 1;

      await ctx.db.insert("offerte_versions", {
        offerteId: args.id,
        orgId,
        userId: user._id,
        versieNummer,
        snapshot: {
          status: offerte.status,
          klant: offerte.klant,
          algemeenParams: {
            bereikbaarheid: offerte.algemeenParams.bereikbaarheid,
            achterstalligheid: offerte.algemeenParams.achterstalligheid,
          },
          scopes: offerte.scopes,
          scopeData: offerte.scopeData,
          totalen: offerte.totalen,
          regels: offerte.regels.map((r) => ({
            id: r.id,
            scope: r.scope,
            omschrijving: r.omschrijving,
            eenheid: r.eenheid,
            hoeveelheid: r.hoeveelheid,
            prijsPerEenheid: r.prijsPerEenheid,
            totaal: r.totaal,
            type: r.type,
          })),
          notities: offerte.notities,
        },
        actie: "nieuwe_versie",
        omschrijving: "Getekende offerte vergrendeld — nieuwe versie aangemaakt (regels gewijzigd)",
        createdAt: now,
      });

      // Reset status naar concept en wis klantrespons
      // De regels en totalen worden hieronder berekend en toegepast
      await ctx.db.patch(args.id, {
        status: "concept",
        customerResponse: undefined,
        updatedAt: now,
      });
    }

    // Helper functie om effectieve marge te bepalen per regel
    const getEffectiveMargePercentage = (regel: typeof args.regels[0]): number => {
      // Prioriteit: 1) regel.margePercentage, 2) scopeMarges[scope], 3) standaardMarge
      if (regel.margePercentage !== undefined && regel.margePercentage !== null) {
        return regel.margePercentage;
      }
      if (args.scopeMarges) {
        const scopeMarge = args.scopeMarges[regel.scope as keyof typeof args.scopeMarges];
        if (scopeMarge !== undefined && scopeMarge !== null) {
          return scopeMarge;
        }
      }
      return args.margePercentage;
    };

    // Calculate totals with per-regel margins
    let materiaalkosten = 0;
    let arbeidskosten = 0;
    let totaalUren = 0;
    let totaleMarge = 0;

    for (const regel of args.regels) {
      const effectieveMarge = getEffectiveMargePercentage(regel);
      const regelMarge = regel.totaal * (effectieveMarge / 100);
      totaleMarge += regelMarge;

      if (regel.type === "materiaal") {
        materiaalkosten += regel.totaal;
      } else if (regel.type === "arbeid") {
        arbeidskosten += regel.totaal;
        totaalUren += regel.hoeveelheid;
      } else if (regel.type === "machine") {
        // Machine costs go to arbeidskosten
        arbeidskosten += regel.totaal;
      }
    }

    const subtotaal = materiaalkosten + arbeidskosten;
    // Gebruik de berekende totale marge i.p.v. simpele percentage berekening
    const marge = totaleMarge;
    // Bereken effectief gemiddeld marge percentage voor weergave
    const effectiefMargePercentage = subtotaal > 0 ? (marge / subtotaal) * 100 : args.margePercentage;
    const totaalExBtw = subtotaal + marge;
    const btw = totaalExBtw * (args.btwPercentage / 100);
    const totaalInclBtw = totaalExBtw + btw;

    const newTotalen = {
      materiaalkosten,
      arbeidskosten,
      totaalUren,
      subtotaal,
      marge,
      margePercentage: Math.round(effectiefMargePercentage * 100) / 100, // Afgerond op 2 decimalen
      totaalExBtw,
      btw,
      totaalInclBtw,
    };

    await ctx.db.patch(args.id, {
      regels: args.regels,
      totalen: newTotalen,
      updatedAt: now,
    });

    // Create version snapshot if enabled
    if (shouldCreateVersion) {
      const offerte = await ctx.db.get(args.id);
      if (offerte) {
        const versions = await ctx.db
          .query("offerte_versions")
          .withIndex("by_offerte", (q) => q.eq("offerteId", args.id))
          .order("desc")
          .take(1);

        const versieNummer = (versions[0]?.versieNummer ?? 0) + 1;

        await ctx.db.insert("offerte_versions", {
          offerteId: args.id,
          orgId,
          userId: offerte.userId,
          versieNummer,
          snapshot: {
            status: offerte.status,
            klant: offerte.klant,
            algemeenParams: {
              bereikbaarheid: offerte.algemeenParams.bereikbaarheid,
              achterstalligheid: offerte.algemeenParams.achterstalligheid,
            },
            scopes: offerte.scopes,
            scopeData: offerte.scopeData,
            totalen: newTotalen,
            regels: args.regels.map((r) => ({
              id: r.id,
              scope: r.scope,
              omschrijving: r.omschrijving,
              eenheid: r.eenheid,
              hoeveelheid: r.hoeveelheid,
              prijsPerEenheid: r.prijsPerEenheid,
              totaal: r.totaal,
              type: r.type,
              margePercentage: r.margePercentage,
            })),
            notities: offerte.notities,
          },
          actie: "regels_gewijzigd",
          omschrijving: `Regels gewijzigd (${args.regels.length} regels)`,
          createdAt: now,
        });
      }
    }

    return args.id;
  },
});

// Update status
// Workflow: concept → voorcalculatie → verzonden → geaccepteerd/afgewezen
export const updateStatus = mutation({
  args: {
    id: v.id("offertes"),
    status: v.union(
      v.literal("concept"),
      v.literal("voorcalculatie"),
      v.literal("verzonden"),
      v.literal("geaccepteerd"),
      v.literal("afgewezen")
    ),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);
    // Capability "versturen naar klant" (PRD §1.2): de overgang naar
    // "verzonden" triggert e-mail/portaalnotificatie — alleen kantoor
    if (args.status === "verzonden") {
      await assertKanNaarKlantVersturen(ctx);
    }
    // Verify ownership before updating (also retrieves the offerte)
    const oldOfferte = await getOwnedOfferte(ctx, args.id);
    const now = Date.now();
    const oldStatus = oldOfferte.status;

    // Validate status workflow
    // concept → voorcalculatie → verzonden → geaccepteerd/afgewezen
    // Vrije offertes (route 2, PRD §2.5b) hebben geen voorcalculatie-stap
    // en mogen direct van concept naar verzonden.
    const isVrijeOfferte = oldOfferte.bron === "vrij";
    const validTransitions: Record<string, string[]> = {
      concept: isVrijeOfferte ? ["voorcalculatie", "verzonden"] : ["voorcalculatie"],
      voorcalculatie: ["concept", "verzonden"],
      verzonden: ["voorcalculatie", "geaccepteerd", "afgewezen"],
      geaccepteerd: ["verzonden"],
      afgewezen: ["verzonden"],
    };

    if (!validTransitions[oldStatus]?.includes(args.status)) {
      throw new ConvexError(
        `Ongeldige statuswijziging: ${oldStatus} → ${args.status}`
      );
    }

    // HARDE GUARD (masterplan A3): een concept mag zonder klant bestaan, maar
    // zodra de offerte de conceptfase verlaat moeten naam, adres, postcode en
    // plaats gevuld zijn — daar draaien PDF, mail, project en factuur op.
    assertKlantVoorStatus(oldOfferte, args.status);

    // When changing to "verzonden", check that a voorcalculatie exists
    // (niet voor vrije offertes: die kennen geen voorcalculatie-record)
    if (args.status === "verzonden" && !isVrijeOfferte) {
      const voorcalculatie = await voorcalculatieVanOfferte(ctx, args.id);

      if (!voorcalculatie) {
        throw new ConvexError(
          "Voorcalculatie moet eerst worden ingevuld voordat de offerte kan worden verzonden"
        );
      }
    }

    // ── Harde acceptatie-validatie + overgang naar de keten (PRD §2.5) ──
    // Een offerte kan nooit op "geaccepteerd" zonder ten minste één werkitem.
    // Route 1 (bouwsteenRegels): automatisch concept-contract (uitvoering na
    // de status-patch hieronder). Aanleg-wizard: automatisch eenmalig project
    // (voorheen handmatige stap ná acceptatie — mag nu niet meer ontbreken).
    // Route 2 (vrij): kantoor koppelt éérst werkitems via de koppel-dialoog,
    // anders weigert deze mutation met een duidelijke fout.
    let ketenActie: KetenActie = "geen";
    if (args.status === "geaccepteerd") {
      const besluit = await bepaalAcceptatieBesluit(ctx, oldOfferte);
      if (!besluit.toegestaan) {
        throw new ConvexError(besluit.reden);
      }
      ketenActie = besluit.actie;
    }

    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };

    if (args.status === "verzonden") {
      updates.verzondenAt = now;
    }

    // Reset customerResponse when status changes away from geaccepteerd/afgewezen
    // This ensures the customer portal shows the correct status
    if (
      (oldOfferte.customerResponse?.status === "geaccepteerd" ||
        oldOfferte.customerResponse?.status === "afgewezen") &&
      args.status !== "geaccepteerd" &&
      args.status !== "afgewezen"
    ) {
      // Keep the view history but reset the response status to "bekeken"
      updates.customerResponse = oldOfferte.customerResponse
        ? {
            status: "bekeken",
            viewedAt: oldOfferte.customerResponse.viewedAt,
            respondedAt: now,
            // Clear signature when resetting
          }
        : undefined;
    }

    await ctx.db.patch(args.id, updates);

    // — Klanttijdlijn (PRD §2.3): auto-event bij verzonden/geaccepteerd —
    // Additief: logTijdlijnEvent is niet-blokkerend en breekt deze flow nooit.
    if (
      oldOfferte.klantId &&
      (args.status === "verzonden" || args.status === "geaccepteerd")
    ) {
      await logTijdlijnEvent(ctx, {
        userId: oldOfferte.userId,
        klantId: oldOfferte.klantId,
        eventType:
          args.status === "verzonden"
            ? "offerte_verzonden"
            : "offerte_geaccepteerd",
        tekst:
          args.status === "verzonden"
            ? `Offerte ${oldOfferte.offerteNummer} verzonden aan de klant`
            : `Offerte ${oldOfferte.offerteNummer} geaccepteerd`,
      });
    }

    // Create version snapshot for status change
    const offerte = await ctx.db.get(args.id);
    if (offerte) {
      // ── Overgang naar de keten (PRD §2.5) — gedeelde kern ──
      // Route 1: voorgevuld CONCEPT-contract (kantoor activeert daarna via
      // de beurtgenerator, §2.1). Aanleg-wizard: eenmalig project. De
      // uitvoering leeft in convex/acceptatieKeten.ts en wordt óók door de
      // klant-paden (portaal + publieke link) gebruikt.
      await voerKetenActieUit(ctx, offerte, ketenActie, now);
      const versions = await ctx.db
        .query("offerte_versions")
        .withIndex("by_offerte", (q) => q.eq("offerteId", args.id))
        .order("desc")
        .take(1);

      const versieNummer = (versions[0]?.versieNummer ?? 0) + 1;

      const statusLabels: Record<string, string> = {
        concept: "Concept",
        voorcalculatie: "Voorcalculatie",
        verzonden: "Verzonden",
        geaccepteerd: "Geaccepteerd",
        afgewezen: "Afgewezen",
      };

      await ctx.db.insert("offerte_versions", {
        offerteId: args.id,
        orgId,
        userId: offerte.userId,
        versieNummer,
        snapshot: {
          status: offerte.status,
          klant: offerte.klant,
          algemeenParams: {
            bereikbaarheid: offerte.algemeenParams.bereikbaarheid,
            achterstalligheid: offerte.algemeenParams.achterstalligheid,
          },
          scopes: offerte.scopes,
          scopeData: offerte.scopeData,
          totalen: offerte.totalen,
          regels: offerte.regels.map((r) => ({
            id: r.id,
            scope: r.scope,
            omschrijving: r.omschrijving,
            eenheid: r.eenheid,
            hoeveelheid: r.hoeveelheid,
            prijsPerEenheid: r.prijsPerEenheid,
            totaal: r.totaal,
            type: r.type,
          })),
          notities: offerte.notities,
        },
        actie: "status_gewijzigd",
        omschrijving: `Status gewijzigd: ${statusLabels[oldStatus]} → ${statusLabels[args.status]}`,
        createdAt: now,
      });

      // Trigger notification for status change (verzonden, geaccepteerd, afgewezen)
      if (args.status === "verzonden" || args.status === "geaccepteerd" || args.status === "afgewezen") {
        await ctx.scheduler.runAfter(0, internal.notifications.notifyOfferteStatusChange, {
          offerteId: args.id,
          newStatus: args.status,
          triggeredBy: offerte.userId.toString(),
        });
      }

      // CRM-002: Auto-upgrade klant pipeline status
      if (offerte.klantId) {
        if (args.status === "verzonden") {
          await upgradeKlantPipeline(ctx, offerte.klantId, "offerte_verzonden");
        } else if (args.status === "geaccepteerd") {
          await upgradeKlantPipeline(ctx, offerte.klantId, "getekend");
        }
      }

      // Notify klant via portal email if they have portal access
      if (args.status === "verzonden" && offerte.klantId) {
        await ctx.scheduler.runAfter(0, internal.portaalEmail.sendOfferteNotification, {
          offerteId: offerte._id,
        });
      }

      // §2.7 (event offerte_verzonden): begeleidende mail klaarzetten in de
      // Concept-mails-wachtrij — maar ALLEEN voor klanten ZONDER portaal-
      // toegang. Klanten mét portaal krijgen hierboven al de portaal-
      // notificatie (sendOfferteNotification) — geen dubbele mail.
      // Additief: zonder actieve trigger of dedupe-sleutel gebeurt er niets.
      if (args.status === "verzonden" && offerte.klantId) {
        const klant = await ctx.db.get(offerte.klantId);
        if (klant && !klant.portalEnabled && klant.email) {
          const siteUrl =
            process.env.NEXT_PUBLIC_APP_URL ||
            process.env.SITE_URL ||
            "https://app.toptuinen.nl";
          const offerteLink = offerte.shareToken
            ? `${siteUrl}/offerte/${offerte.shareToken}`
            : `${siteUrl}/offertes`;
          await zetTriggerMailKlaar(ctx, {
            event: "offerte_verzonden",
            userId: offerte.userId,
            ontvangerEmail: klant.email,
            ontvangerNaam: klant.naam,
            variabelen: {
              klantnaam: klant.naam,
              offerteNummer: offerte.offerteNummer,
              offerteBedrag: new Intl.NumberFormat("nl-NL", {
                style: "currency",
                currency: "EUR",
              }).format(offerte.totalen.totaalInclBtw),
              offerteLink,
            },
            klantId: offerte.klantId,
            offerteId: offerte._id,
            dedupeSleutel: `offerte_verzonden:${offerte._id.toString()}`,
          });
        }
      }
    }

    return args.id;
  },
});

// Soft delete offerte (sets deletedAt timestamp)
// Items can be restored within 30 days, after which they are permanently deleted
export const remove = mutation({
  args: { id: v.id("offertes") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Verify ownership before deleting
    await getOwnedOfferte(ctx, args.id);
    const now = Date.now();

    await ctx.db.patch(args.id, {
      deletedAt: now,
      updatedAt: now,
    });

    return args.id;
  },
});

// Restore a soft-deleted offerte
export const restore = mutation({
  args: { id: v.id("offertes") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Verify ownership before restoring
    const offerte = await getOwnedOfferte(ctx, args.id);

    // Check if actually deleted
    if (!offerte.deletedAt) {
      throw new ConvexError("Deze offerte is niet verwijderd");
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      deletedAt: undefined,
      updatedAt: now,
    });

    return args.id;
  },
});

// Permanently delete offerte (hard delete)
// Used by cleanup function or manual permanent deletion
export const permanentlyDelete = mutation({
  args: { id: v.id("offertes") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Verify ownership before deleting
    await getOwnedOfferte(ctx, args.id);
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Archive offerte
export const archive = mutation({
  args: { id: v.id("offertes") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Verify ownership before archiving
    await getOwnedOfferte(ctx, args.id);
    const now = Date.now();

    await ctx.db.patch(args.id, {
      isArchived: true,
      archivedAt: now,
      updatedAt: now,
    });

    return args.id;
  },
});

// Duplicate offerte
export const duplicate = mutation({
  args: {
    id: v.id("offertes"),
    newOfferteNummer: v.string(),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Verify ownership before duplicating
    const original = await getOwnedOfferte(ctx, args.id);
    const { org, user } = await requireOrgContext(ctx);
    const now = Date.now();

    return await ctx.db.insert("offertes", {
      orgId: org._id,
      userId: user._id,
      type: original.type,
      status: "concept",
      // `bron` bepaalt welke editor de kopie opent (PRD §2.5b). Zonder deze
      // regel gold elke kopie als scope-offerte: een gedupliceerde vríje
      // offerte belandde in het werkblad, dat zijn handgeschreven regels
      // vervolgens door de scope-berekening zou vervangen.
      bron: original.bron,
      offerteNummer: args.newOfferteNummer,
      klant: original.klant,
      klantId: original.klantId,
      algemeenParams: original.algemeenParams,
      scopes: original.scopes,
      scopeData: original.scopeData,
      totalen: original.totalen,
      regels: original.regels,
      vrijeTeksten: original.vrijeTeksten,
      kortingOpTotaal: original.kortingOpTotaal,
      notities: original.notities
        ? `Kopie van ${original.offerteNummer}\n\n${original.notities}`
        : `Kopie van ${original.offerteNummer}`,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Get stats for dashboard
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await requireOrgId(ctx);
    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    const stats = {
      totaal: offertes.length,
      concept: 0,
      voorcalculatie: 0,
      verzonden: 0,
      geaccepteerd: 0,
      afgewezen: 0,
      totaalWaarde: 0,
      geaccepteerdWaarde: 0,
    };

    for (const offerte of offertes) {
      stats[offerte.status as keyof typeof stats]++;
      stats.totaalWaarde += offerte.totalen.totaalInclBtw;
      if (offerte.status === "geaccepteerd") {
        stats.geaccepteerdWaarde += offerte.totalen.totaalInclBtw;
      }
    }

    return stats;
  },
});

// Get revenue statistics for dashboard
export const getRevenueStats = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await requireOrgId(ctx);
    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    let totalAcceptedValue = 0;
    let totalAcceptedCount = 0;
    let totalSentCount = 0; // verzonden + geaccepteerd + afgewezen

    for (const offerte of offertes) {
      if (offerte.status === "geaccepteerd") {
        totalAcceptedValue += offerte.totalen.totaalInclBtw;
        totalAcceptedCount++;
      }
      // Count all offertes that have been sent (includes accepted and rejected)
      if (
        offerte.status === "verzonden" ||
        offerte.status === "geaccepteerd" ||
        offerte.status === "afgewezen"
      ) {
        totalSentCount++;
      }
    }

    // Calculate conversion rate (accepted / total sent)
    const conversionRate =
      totalSentCount > 0
        ? Math.round((totalAcceptedCount / totalSentCount) * 100)
        : 0;

    // Calculate average offerte value (of accepted offertes)
    const averageOfferteValue =
      totalAcceptedCount > 0
        ? Math.round(totalAcceptedValue / totalAcceptedCount)
        : 0;

    return {
      totalAcceptedValue,
      totalAcceptedCount,
      conversionRate,
      averageOfferteValue,
    };
  },
});

// Get recent offertes
export const getRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const limit = args.limit || 5;

    return await ctx.db
      .query("offertes")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(limit);
  },
});

// Bulk update status
// Note: Bulk update skips workflow validation for admin convenience
// but still requires voorcalculatie for verzonden status
export const bulkUpdateStatus = mutation({
  args: {
    ids: v.array(v.id("offertes")),
    status: v.union(
      v.literal("concept"),
      v.literal("voorcalculatie"),
      v.literal("verzonden"),
      v.literal("geaccepteerd"),
      v.literal("afgewezen")
    ),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Resolver één keer buiten de lus (niet per document, zie offerteVanOrg)
    const orgId = await requireOrgId(ctx);
    const now = Date.now();

    for (const id of args.ids) {
      // Verify ownership for each offerte
      const bestaande = await offerteVanOrg(ctx, id, orgId);

      // Zelfde harde klant-guard als in updateStatus: bulk mag geen sluiproute
      // zijn om een concept zonder klant op verzonden/geaccepteerd te zetten.
      assertKlantVoorStatus(bestaande, args.status);

      // When changing to "verzonden", check that a voorcalculatie exists
      if (args.status === "verzonden") {
        const voorcalculatie = await voorcalculatieVanOfferte(ctx, id);

        if (!voorcalculatie) {
          throw new ConvexError(
            "Voorcalculatie moet eerst worden ingevuld voordat de offerte kan worden verzonden"
          );
        }
      }

      const updates: Record<string, unknown> = {
        status: args.status,
        updatedAt: now,
      };

      if (args.status === "verzonden") {
        updates.verzondenAt = now;
      }

      await ctx.db.patch(id, updates);

      // CRM-002: Auto-upgrade klant pipeline status
      const offerte = await ctx.db.get(id);
      if (offerte?.klantId) {
        if (args.status === "verzonden") {
          await upgradeKlantPipeline(ctx, offerte.klantId, "offerte_verzonden");
        } else if (args.status === "geaccepteerd") {
          await upgradeKlantPipeline(ctx, offerte.klantId, "getekend");
        }
      }
    }

    return args.ids.length;
  },
});

// Bulk soft delete offertes
export const bulkRemove = mutation({
  args: {
    ids: v.array(v.id("offertes")),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);
    const now = Date.now();
    for (const id of args.ids) {
      // Verify ownership for each offerte
      await offerteVanOrg(ctx, id, orgId);
      await ctx.db.patch(id, {
        deletedAt: now,
        updatedAt: now,
      });
    }
    return args.ids.length;
  },
});

// Bulk restore soft-deleted offertes
export const bulkRestore = mutation({
  args: {
    ids: v.array(v.id("offertes")),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);
    const now = Date.now();
    for (const id of args.ids) {
      // Verify ownership for each offerte
      await offerteVanOrg(ctx, id, orgId);
      await ctx.db.patch(id, {
        deletedAt: undefined,
        updatedAt: now,
      });
    }
    return args.ids.length;
  },
});

// Get accepted offertes without a project (action required)
export const getAcceptedOffertesWithoutProject = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await requireOrgId(ctx);

    // Get all accepted offertes for this organisation
    const acceptedOffertes = await ctx.db
      .query("offertes")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    // Filter to only accepted offertes
    const geaccepteerdeOffertes = acceptedOffertes.filter(
      (o) => o.status === "geaccepteerd"
    );

    if (geaccepteerdeOffertes.length === 0) {
      return [];
    }

    // Get all projects for this organisation to check which offertes already
    // have a project
    const projects = await ctx.db
      .query("projecten")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    // Create a Set of offerteIds that have a project
    // offerteId is optioneel sinds werkitem-generalisatie
    const offertesWithProject = new Set(
      projects.map((p) => p.offerteId?.toString()).filter(Boolean)
    );

    // Filter offertes that don't have a project yet
    const offertesWithoutProject = geaccepteerdeOffertes.filter(
      (o) => !offertesWithProject.has(o._id.toString())
    );

    // Return max 5 items with required fields, sorted by createdAt desc
    return offertesWithoutProject
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5)
      .map((o) => ({
        _id: o._id,
        offerteNummer: o.offerteNummer,
        klantNaam: klantNaam(o.klant),
        totaal: o.totalen.totaalInclBtw,
        datum: o.createdAt,
      }));
  },
});

// ── Internal queries (for use by other Convex functions) ────────────────

/** Get an offerte by ID without auth checks. For internal use only. */
export const getByIdInternal = internalQuery({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.offerteId);
  },
});
