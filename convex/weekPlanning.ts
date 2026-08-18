/**
 * WeekPlanning — Drag-and-drop weekplanning
 *
 * Grid: medewerkers (Y-as) × dagen (X-as) met projectblokken.
 */

import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAuth, requireOrgId } from "./auth";
import { hasPermission, requireNotViewer } from "./roles";

/**
 * Haal de medewerkers en projecten op waarnaar toewijzingen verwijzen,
 * met gededupliceerde db.get's (één get per uniek id i.p.v. per rij).
 *
 * Alles wat niet aan `orgId` hangt valt buiten de map (audit §2): de rijen zijn
 * hierboven al op tenant gefilterd, maar een verdwaalde verwijzing naar een
 * project van een andere organisatie mag nooit alsnog een naam prijsgeven.
 */
async function haalPlanningReferenties(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organisaties">,
  toewijzingen: Array<{
    medewerkerId: Id<"medewerkers">;
    projectId: Id<"projecten">;
  }>
) {
  const medewerkerIds = [...new Set(toewijzingen.map((t) => t.medewerkerId))];
  const projectIds = [...new Set(toewijzingen.map((t) => t.projectId))];

  const [medewerkers, projecten] = await Promise.all([
    Promise.all(medewerkerIds.map((id) => ctx.db.get(id))),
    Promise.all(projectIds.map((id) => ctx.db.get(id))),
  ]);

  const medewerkerMap = new Map<Id<"medewerkers">, Doc<"medewerkers">>();
  medewerkers.forEach((m) => {
    if (m && m.orgId === orgId) medewerkerMap.set(m._id, m);
  });
  const projectMap = new Map<Id<"projecten">, Doc<"projecten">>();
  projecten.forEach((p) => {
    if (p && p.orgId === orgId) projectMap.set(p._id, p);
  });

  return { medewerkerMap, projectMap };
}

/**
 * Het medewerkerrecord van de ingelogde gebruiker.
 *
 * Er bestaan twee koppelroutes in de data: `users.linkedMedewerkerId`
 * (roles.ts) en `medewerkers.clerkUserId` (medewerkers.ts). Beide worden
 * gebruikt, dus we proberen ze allebei — anders krijgt een medewerker die maar
 * via één route gekoppeld is een leeg planbord.
 */
async function haalEigenMedewerker(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">
): Promise<Doc<"medewerkers"> | null> {
  if (user.linkedMedewerkerId) {
    const viaLink = await ctx.db.get(user.linkedMedewerkerId);
    if (viaLink) return viaLink;
  }

  return await ctx.db
    .query("medewerkers")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
    .first();
}

/** Rol- en tenantcontext voor het planbord. */
type PlanningContext = {
  /** De organisatie waarop élke planningquery gescoped moet worden. */
  orgId: Id<"organisaties">;
  /** Medewerkers waarvan planningrijen zichtbaar zijn (incl. inactieve). */
  rijScopeIds: Set<Id<"medewerkers">>;
  /** Actieve zichtbare medewerkers: Y-as én capaciteitsbasis. */
  zichtbareMedewerkers: Doc<"medewerkers">[];
};

/**
 * Tenant- en rolcontext voor het planbord (audit §2).
 *
 * De tabel `weekPlanning` heeft zelf géén tenant-veld; de scope loopt dus via
 * de medewerker waaraan een rij hangt. Daarom lezen we hier één keer alle
 * medewerkers van de organisatie via de `by_org`-index (i.p.v. de vroegere
 * `.filter()`-scan over álle bedrijven) en gebruiken we die set om zowel de
 * planningrijen te scopen als de capaciteit te berekenen.
 *
 * Rol: wie geen leesrecht op `medewerkers` heeft (medewerker, zzp'er,
 * materiaalman, klant) ziet uitsluitend de eigen rij — dezelfde regel als
 * `medewerkers.ts::list`, maar via de centrale rechtenmatrix zodat voorman en
 * projectleider hun leesrecht behouden.
 */
async function haalPlanningContext(
  ctx: QueryCtx | MutationCtx
): Promise<PlanningContext> {
  const user = await requireAuth(ctx);
  const eigenMedewerker = await haalEigenMedewerker(ctx, user);

  // Tenant komt sinds de org-migratie (fase 3) uit het Clerk-JWT en niet meer
  // uit het medewerkerrecord: rol bepaalt nog wél wat je ziet, niet meer van
  // wie. De rolafleiding via getCompanyUserId is daarmee overbodig.
  const orgId = await requireOrgId(ctx);

  const bedrijfsMedewerkers = await ctx.db
    .query("medewerkers")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();

  const magVolledigeLijst = hasPermission(user.role, "read", "medewerkers");
  const eigenRij =
    eigenMedewerker && eigenMedewerker.orgId === orgId
      ? eigenMedewerker
      : null;

  const zichtbaar = magVolledigeLijst
    ? bedrijfsMedewerkers
    : eigenRij
      ? [eigenRij]
      : [];

  return {
    orgId,
    // Inactieve medewerkers blijven meetellen voor de rijen: historische
    // toewijzingen van iemand die uit dienst is mogen niet verdwijnen.
    rijScopeIds: new Set(zichtbaar.map((m) => m._id)),
    zichtbareMedewerkers: zichtbaar.filter((m) => m.isActief),
  };
}

/** Houd alleen de planningrijen over die bij de zichtbare medewerkers horen. */
function scopeToewijzingen<T extends { medewerkerId: Id<"medewerkers"> }>(
  toewijzingen: T[],
  rijScopeIds: Set<Id<"medewerkers">>
): T[] {
  return toewijzingen.filter((t) => rijScopeIds.has(t.medewerkerId));
}

// ============================================
// Queries
// ============================================

/**
 * Alle toewijzingen ophalen voor een weekperiode.
 */
export const getWeek = query({
  args: {
    startDatum: v.string(), // YYYY-MM-DD (maandag)
    eindDatum: v.string(), // YYYY-MM-DD (vrijdag)
  },
  handler: async (ctx, args) => {
    const { orgId, rijScopeIds } = await haalPlanningContext(ctx);

    // Haal alle toewijzingen in het datumbereik (bereik in de index zelf,
    // zodat niet de hele tabel gescand wordt). De by_datum-index kent geen
    // tenant, dus scopen we daarna op de medewerkers van dit bedrijf.
    const alleToewijzingen = await ctx.db
      .query("weekPlanning")
      .withIndex("by_datum", (q) =>
        q.gte("datum", args.startDatum).lte("datum", args.eindDatum)
      )
      .collect();
    const toewijzingen = scopeToewijzingen(alleToewijzingen, rijScopeIds);

    // Enriche met medewerker en project info (gededupliceerde gets:
    // unieke ids zijn veel kleiner dan het aantal toewijzingen)
    const { medewerkerMap, projectMap } = await haalPlanningReferenties(
      ctx,
      orgId,
      toewijzingen
    );
    const enriched = toewijzingen.map((t) => {
      const medewerker = medewerkerMap.get(t.medewerkerId);
      const project = projectMap.get(t.projectId);
      return {
        ...t,
        medewerkerNaam: medewerker?.naam ?? "Onbekend",
        projectNaam: project?.naam ?? "Onbekend",
        projectStatus: project?.status,
      };
    });

    return enriched;
  },
});

/**
 * Actieve medewerkers ophalen voor de Y-as.
 *
 * Alleen de medewerkers van het eigen bedrijf, en alleen voor rollen die de
 * medewerkerslijst mogen lezen (zie haalPlanningContext).
 */
export const getMedewerkers = query({
  args: {},
  handler: async (ctx) => {
    const { zichtbareMedewerkers } = await haalPlanningContext(ctx);

    return zichtbareMedewerkers.map((m) => ({
      _id: m._id,
      naam: m.naam,
      functie: m.functie,
    }));
  },
});

/**
 * Actieve projecten ophalen voor drag-source.
 */
export const getActiveProjects = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await haalPlanningContext(ctx);

    // by_org_status-index: alleen de geplande/lopende projecten van déze
    // organisatie lezen. De oude by_status-variant las de projectnamen van álle
    // bedrijven (audit §2). Sorteren op _creationTime houdt dezelfde volgorde.
    const [gepland, inUitvoering] = await Promise.all([
      ctx.db
        .query("projecten")
        .withIndex("by_org_status", (q) =>
          q.eq("orgId", orgId).eq("status", "gepland")
        )
        .collect(),
      ctx.db
        .query("projecten")
        .withIndex("by_org_status", (q) =>
          q.eq("orgId", orgId).eq("status", "in_uitvoering")
        )
        .collect(),
    ]);

    return [...gepland, ...inUitvoering]
      .filter((p) => !p.deletedAt && !p.isArchived)
      .sort((a, b) => a._creationTime - b._creationTime)
      .map((p) => ({
        _id: p._id,
        naam: p.naam,
        status: p.status,
      }));
  },
});

// ============================================
// Mutations
// ============================================

/**
 * Controleer dat een medewerker bij de eigen organisatie hoort (audit §2).
 * Zonder deze check kon een ingelogde gebruiker planningrijen schrijven op
 * medewerkers en projecten van een ánder bedrijf.
 */
async function vereisEigenMedewerker(
  ctx: MutationCtx,
  medewerkerId: Id<"medewerkers">,
  orgId: Id<"organisaties">
): Promise<Doc<"medewerkers">> {
  const medewerker = await ctx.db.get(medewerkerId);
  if (!medewerker || medewerker.orgId !== orgId) {
    throw new ConvexError("Medewerker niet gevonden");
  }
  return medewerker;
}

/** Idem voor projecten. */
async function vereisEigenProject(
  ctx: MutationCtx,
  projectId: Id<"projecten">,
  orgId: Id<"organisaties">
): Promise<Doc<"projecten">> {
  const project = await ctx.db.get(projectId);
  if (!project || project.orgId !== orgId) {
    throw new ConvexError("Project niet gevonden");
  }
  return project;
}

/**
 * Toewijzing toevoegen (drag-drop een project op een medewerker+dag).
 */
export const assign = mutation({
  args: {
    medewerkerId: v.id("medewerkers"),
    projectId: v.id("projecten"),
    datum: v.string(),
    uren: v.optional(v.number()),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const { orgId } = await haalPlanningContext(ctx);
    await vereisEigenMedewerker(ctx, args.medewerkerId, orgId);
    await vereisEigenProject(ctx, args.projectId, orgId);

    // Check of deze combinatie al bestaat
    const existing = await ctx.db
      .query("weekPlanning")
      .withIndex("by_medewerker_datum", (q) =>
        q.eq("medewerkerId", args.medewerkerId).eq("datum", args.datum)
      )
      .filter((q) => q.eq(q.field("projectId"), args.projectId))
      .first();

    if (existing) {
      // Update bestaande toewijzing
      await ctx.db.patch(existing._id, {
        uren: args.uren,
        notities: args.notities,
      });
      return existing._id;
    }

    return await ctx.db.insert("weekPlanning", {
      medewerkerId: args.medewerkerId,
      projectId: args.projectId,
      datum: args.datum,
      uren: args.uren,
      notities: args.notities,
      createdAt: Date.now(),
    });
  },
});

/**
 * Toewijzing verplaatsen (drag van ene cel naar andere).
 */
export const move = mutation({
  args: {
    id: v.id("weekPlanning"),
    medewerkerId: v.id("medewerkers"),
    datum: v.string(),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const { orgId } = await haalPlanningContext(ctx);

    const item = await ctx.db.get(args.id);
    if (!item) throw new ConvexError("Toewijzing niet gevonden");

    // Zowel de bron- als de doelmedewerker moet van het eigen bedrijf zijn:
    // anders kon een toewijzing van een ander bedrijf verplaatst worden, of de
    // eigen toewijzing naar een vreemde medewerker.
    await vereisEigenMedewerker(ctx, item.medewerkerId, orgId);
    await vereisEigenMedewerker(ctx, args.medewerkerId, orgId);

    await ctx.db.patch(args.id, {
      medewerkerId: args.medewerkerId,
      datum: args.datum,
    });
  },
});

/**
 * Toewijzing verwijderen.
 */
export const remove = mutation({
  args: { id: v.id("weekPlanning") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const { orgId } = await haalPlanningContext(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) throw new ConvexError("Toewijzing niet gevonden");
    // Alleen toewijzingen van eigen medewerkers zijn verwijderbaar.
    await vereisEigenMedewerker(ctx, item.medewerkerId, orgId);
    await ctx.db.delete(args.id);
  },
});

// ============================================
// Seizoensplanning: Maand / Kwartaal / Jaar views
// ============================================

/**
 * Get all planning assignments for a given month.
 * Returns tasks grouped by date with medewerker and project info.
 */
export const listByMonth = query({
  args: {
    year: v.number(),
    month: v.number(), // 1-12
  },
  handler: async (ctx, args) => {
    const { orgId, rijScopeIds, zichtbareMedewerkers } =
      await haalPlanningContext(ctx);

    // Build date range: first and last day of month (YYYY-MM-DD strings)
    const startDatum = `${args.year}-${String(args.month).padStart(2, "0")}-01`;
    const lastDay = new Date(args.year, args.month, 0).getDate();
    const eindDatum = `${args.year}-${String(args.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const alleToewijzingen = await ctx.db
      .query("weekPlanning")
      .withIndex("by_datum", (q) =>
        q.gte("datum", startDatum).lte("datum", eindDatum)
      )
      .collect();
    const toewijzingen = scopeToewijzingen(alleToewijzingen, rijScopeIds);

    // Capaciteit op basis van de zichtbare medewerkers van dit bedrijf
    const urenPerDag = 8;
    const beschikbareUrenPerDag = zichtbareMedewerkers.length * urenPerDag;

    // Enrich with medewerker and project info (gededupliceerde gets)
    const { medewerkerMap, projectMap } = await haalPlanningReferenties(
      ctx,
      orgId,
      toewijzingen
    );
    const enriched = toewijzingen.map((t) => {
      const medewerker = medewerkerMap.get(t.medewerkerId);
      const project = projectMap.get(t.projectId);
      return {
        _id: t._id,
        datum: t.datum,
        uren: t.uren,
        medewerkerId: t.medewerkerId,
        projectId: t.projectId,
        medewerkerNaam: medewerker?.naam ?? "Onbekend",
        projectNaam: project?.naam ?? "Onbekend",
        projectStatus: project?.status,
      };
    });

    // Group by date
    const perDag: Record<
      string,
      {
        datum: string;
        taken: typeof enriched;
        aantalTaken: number;
        uren: number;
        beschikbareUren: number;
        medewerkers: string[];
      }
    > = {};

    for (const item of enriched) {
      if (!perDag[item.datum]) {
        perDag[item.datum] = {
          datum: item.datum,
          taken: [],
          aantalTaken: 0,
          uren: 0,
          beschikbareUren: beschikbareUrenPerDag,
          medewerkers: [],
        };
      }
      perDag[item.datum].taken.push(item);
      perDag[item.datum].aantalTaken += 1;
      perDag[item.datum].uren += item.uren ?? urenPerDag;
      const naam = item.medewerkerNaam;
      if (!perDag[item.datum].medewerkers.includes(naam)) {
        perDag[item.datum].medewerkers.push(naam);
      }
    }

    return {
      perDag,
      beschikbareUrenPerDag,
      totaalMedewerkers: zichtbareMedewerkers.length,
    };
  },
});

/**
 * Get planning summary per week for a quarter.
 * Quarter 1 = Jan-Mar, 2 = Apr-Jun, 3 = Jul-Sep, 4 = Oct-Dec
 */
export const listByQuarter = query({
  args: {
    year: v.number(),
    quarter: v.number(), // 1-4
  },
  handler: async (ctx, args) => {
    const { rijScopeIds, zichtbareMedewerkers } =
      await haalPlanningContext(ctx);

    const startMonth = (args.quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;

    const startDatum = `${args.year}-${String(startMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(args.year, endMonth, 0).getDate();
    const eindDatum = `${args.year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const alleToewijzingen = await ctx.db
      .query("weekPlanning")
      .withIndex("by_datum", (q) =>
        q.gte("datum", startDatum).lte("datum", eindDatum)
      )
      .collect();
    const toewijzingen = scopeToewijzingen(alleToewijzingen, rijScopeIds);

    const urenPerDag = 8;

    // Group by ISO week number
    const perWeek: Record<
      string,
      {
        weekNummer: number;
        startDatum: string;
        aantalTaken: number;
        geplandeUren: number;
        beschikbareUren: number;
        bezetting: number;
        medewerkers: Set<string>;
      }
    > = {};

    for (const t of toewijzingen) {
      const d = new Date(t.datum + "T00:00:00");
      // ISO week number calculation
      const tempDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dayNum = tempDate.getUTCDay() || 7;
      tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
      const weekNum = Math.ceil(((tempDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

      const weekKey = `${args.year}-W${weekNum}`;
      if (!perWeek[weekKey]) {
        // Calculate Monday of this week
        const monday = new Date(d);
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
        const beschikbaar = zichtbareMedewerkers.length * urenPerDag * 5; // 5 werkdagen

        perWeek[weekKey] = {
          weekNummer: weekNum,
          startDatum: monday.toISOString().split("T")[0],
          aantalTaken: 0,
          geplandeUren: 0,
          beschikbareUren: beschikbaar,
          bezetting: 0,
          medewerkers: new Set(),
        };
      }

      perWeek[weekKey].aantalTaken += 1;
      perWeek[weekKey].geplandeUren += t.uren ?? urenPerDag;
      perWeek[weekKey].medewerkers.add(t.medewerkerId);
    }

    // Calculate bezetting and convert Set to count
    const result = Object.values(perWeek)
      .map((w) => ({
        weekNummer: w.weekNummer,
        startDatum: w.startDatum,
        aantalTaken: w.aantalTaken,
        geplandeUren: w.geplandeUren,
        beschikbareUren: w.beschikbareUren,
        bezetting:
          w.beschikbareUren > 0
            ? Math.round((w.geplandeUren / w.beschikbareUren) * 100)
            : 0,
        aantalMedewerkers: w.medewerkers.size,
      }))
      .sort((a, b) => a.weekNummer - b.weekNummer);

    return {
      weken: result,
      totaalMedewerkers: zichtbareMedewerkers.length,
    };
  },
});

/**
 * Capacity overview for the year view.
 * Returns per-month: total planned hours, available capacity, utilization %.
 * Also returns per-medewerker hours per month.
 */
export const getCapacityOverview = query({
  args: {
    year: v.number(),
  },
  handler: async (ctx, args) => {
    const { rijScopeIds, zichtbareMedewerkers } =
      await haalPlanningContext(ctx);

    // Full year range
    const startDatum = `${args.year}-01-01`;
    const eindDatum = `${args.year}-12-31`;

    const alleToewijzingen = await ctx.db
      .query("weekPlanning")
      .withIndex("by_datum", (q) =>
        q.gte("datum", startDatum).lte("datum", eindDatum)
      )
      .collect();
    const toewijzingen = scopeToewijzingen(alleToewijzingen, rijScopeIds);

    const urenPerDag = 8;

    // Calculate werkdagen per month (exclude weekends)
    function werkdagenInMaand(year: number, month: number): number {
      const lastDay = new Date(year, month, 0).getDate();
      let count = 0;
      for (let d = 1; d <= lastDay; d++) {
        const day = new Date(year, month - 1, d).getDay();
        if (day !== 0 && day !== 6) count++;
      }
      return count;
    }

    // Per month aggregation
    const perMaand: {
      maand: number;
      geplandeUren: number;
      beschikbareUren: number;
      bezetting: number;
      aantalProjecten: number;
      projectIds: Set<string>;
    }[] = [];

    // Per medewerker per month
    const perMedewerker: Record<
      string,
      { naam: string; urenPerMaand: number[] }
    > = {};

    for (const mw of zichtbareMedewerkers) {
      perMedewerker[mw._id] = {
        naam: mw.naam,
        urenPerMaand: new Array(12).fill(0),
      };
    }

    for (let m = 1; m <= 12; m++) {
      const werkdagen = werkdagenInMaand(args.year, m);
      const beschikbaar = zichtbareMedewerkers.length * urenPerDag * werkdagen;

      perMaand.push({
        maand: m,
        geplandeUren: 0,
        beschikbareUren: beschikbaar,
        bezetting: 0,
        aantalProjecten: 0,
        projectIds: new Set(),
      });
    }

    for (const t of toewijzingen) {
      const maand = parseInt(t.datum.substring(5, 7), 10);
      const idx = maand - 1;
      if (idx >= 0 && idx < 12) {
        perMaand[idx].geplandeUren += t.uren ?? urenPerDag;
        perMaand[idx].projectIds.add(t.projectId);

        // Per medewerker tracking
        if (perMedewerker[t.medewerkerId]) {
          perMedewerker[t.medewerkerId].urenPerMaand[idx] += t.uren ?? urenPerDag;
        }
      }
    }

    // Finalize
    const maanden = perMaand.map((m) => ({
      maand: m.maand,
      geplandeUren: m.geplandeUren,
      beschikbareUren: m.beschikbareUren,
      bezetting:
        m.beschikbareUren > 0
          ? Math.round((m.geplandeUren / m.beschikbareUren) * 100)
          : 0,
      aantalProjecten: m.projectIds.size,
    }));

    const medewerkers = Object.entries(perMedewerker).map(([id, data]) => ({
      medewerkerId: id,
      naam: data.naam,
      urenPerMaand: data.urenPerMaand,
    }));

    return {
      maanden,
      medewerkers,
      totaalMedewerkers: zichtbareMedewerkers.length,
    };
  },
});
