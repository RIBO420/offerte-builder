/**
 * Klanttaken — losse to-do's per klant, toewijsbaar aan een medewerker.
 *
 * ── Waarom een eigen tabel ────────────────────────────────────────────────
 * - klantTijdlijn legt vast wat er GEBEURD is (append-only dossier);
 *   een taak legt vast wat er nog MOET gebeuren en wisselt van status.
 * - planningTaken hangt aan een werkitem en voedt de uitvoering; een
 *   klanttaak bestaat ook zónder project (leadfase, nazorg, administratie).
 *
 * ── Toegangsmodel (PRD §1.2) ──────────────────────────────────────────────
 * Net als de klanttijdlijn is dit een INTERN kantoordossier:
 * - Lezen: alle interne rollen binnen het eigen bedrijf.
 * - Schrijven: alle interne rollen (een voorman mag zijn eigen taak afvinken);
 *   klantaccounts krijgen op elke functie een AuthError.
 * Elke functie scopet bovendien expliciet op orgId — de tenancy mag nooit
 * alleen van de gekozen index afhangen.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { AuthError, requireAuth, requireOrgId } from "./auth";
import { normalizeRole } from "./roles";
import { laadDocsMap } from "./lib/batchLoad";

const statusValidator = v.union(v.literal("open"), v.literal("afgerond"));
const prioriteitValidator = v.union(
  v.literal("laag"),
  v.literal("normaal"),
  v.literal("hoog")
);

const MAX_TITEL = 200;
const MAX_OMSCHRIJVING = 2000;
const DEADLINE_PATROON = /^\d{4}-\d{2}-\d{2}$/;

type KlantTaak = Doc<"klantTaken">;

export type VerrijkteKlantTaak = KlantTaak & {
  toegewezenAanNaam?: string;
  klantNaam?: string;
  werkitemNaam?: string;
};

// ============================================
// Helpers
// ============================================

/** Klantaccounts hebben geen toegang tot het interne takenoverzicht. */
async function requireInterneRol(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  if (normalizeRole(user.role) === "klant") {
    throw new AuthError(
      "Klanttaken zijn een intern kantoordossier en niet beschikbaar voor klantaccounts"
    );
  }
  return user;
}

async function getKlantBinnenBedrijf(
  ctx: QueryCtx | MutationCtx,
  klantId: Id<"klanten">
): Promise<{ klant: Doc<"klanten">; orgId: Id<"organisaties"> }> {
  const orgId = await requireOrgId(ctx);
  const klant = await ctx.db.get(klantId);
  // `orgId` is optioneel zolang de migratie loopt; een klant zonder org valt
  // buiten elke scope (zie verifyOrgOwnership in auth.ts).
  if (!klant || klant.orgId?.toString() !== orgId.toString()) {
    throw new ConvexError("Klant niet gevonden");
  }
  return { klant, orgId };
}

/** Taak ophalen én verifiëren dat hij binnen de eigen organisatie valt. */
async function getTaakBinnenBedrijf(
  ctx: MutationCtx,
  taakId: Id<"klantTaken">
): Promise<{ taak: KlantTaak; orgId: Id<"organisaties"> }> {
  const orgId = await requireOrgId(ctx);
  const taak = await ctx.db.get(taakId);
  if (!taak || taak.orgId?.toString() !== orgId.toString()) {
    throw new ConvexError("Taak niet gevonden");
  }
  return { taak, orgId };
}

function schoonTitel(titel: string): string {
  const schoon = titel.trim();
  if (!schoon) {
    throw new ConvexError("Titel is verplicht");
  }
  if (schoon.length > MAX_TITEL) {
    throw new ConvexError(`Titel mag maximaal ${MAX_TITEL} tekens zijn`);
  }
  return schoon;
}

function schoonOmschrijving(waarde: string | undefined): string | undefined {
  if (waarde === undefined) return undefined;
  const schoon = waarde.trim();
  if (!schoon) return undefined;
  if (schoon.length > MAX_OMSCHRIJVING) {
    throw new ConvexError(
      `Omschrijving mag maximaal ${MAX_OMSCHRIJVING} tekens zijn`
    );
  }
  return schoon;
}

function schoonDeadline(waarde: string | undefined): string | undefined {
  if (waarde === undefined) return undefined;
  const schoon = waarde.trim();
  if (!schoon) return undefined;
  if (!DEADLINE_PATROON.test(schoon)) {
    throw new ConvexError("Deadline moet in het formaat JJJJ-MM-DD staan");
  }
  return schoon;
}

/**
 * Medewerker valideren binnen hetzelfde bedrijf — voorkomt dat een taak aan
 * een medewerker van een andere tenant wordt gehangen.
 */
async function valideerMedewerker(
  ctx: MutationCtx,
  medewerkerId: Id<"medewerkers"> | undefined,
  orgId: Id<"organisaties">
): Promise<void> {
  if (!medewerkerId) return;
  const medewerker = await ctx.db.get(medewerkerId);
  if (!medewerker || medewerker.orgId?.toString() !== orgId.toString()) {
    throw new ConvexError("Medewerker niet gevonden");
  }
}

async function valideerWerkitem(
  ctx: MutationCtx,
  werkitemId: Id<"projecten"> | undefined,
  orgId: Id<"organisaties">
): Promise<void> {
  if (!werkitemId) return;
  const werkitem = await ctx.db.get(werkitemId);
  if (!werkitem || werkitem.orgId?.toString() !== orgId.toString()) {
    throw new ConvexError("Werkitem niet gevonden");
  }
}

/**
 * Open taken eerst, daarbinnen op deadline (taken zónder deadline onderaan),
 * dan op prioriteit. Afgeronde taken onderaan, nieuwste eerst.
 */
const PRIORITEIT_GEWICHT: Record<KlantTaak["prioriteit"], number> = {
  hoog: 0,
  normaal: 1,
  laag: 2,
};

function sorteerTaken(a: KlantTaak, b: KlantTaak): number {
  if (a.status !== b.status) return a.status === "open" ? -1 : 1;
  if (a.status === "afgerond") {
    return (b.afgerondAt ?? b.updatedAt) - (a.afgerondAt ?? a.updatedAt);
  }
  if (a.deadline !== b.deadline) {
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline < b.deadline ? -1 : 1;
  }
  const prioriteitVerschil =
    PRIORITEIT_GEWICHT[a.prioriteit] - PRIORITEIT_GEWICHT[b.prioriteit];
  if (prioriteitVerschil !== 0) return prioriteitVerschil;
  return a.createdAt - b.createdAt;
}

/** Namen van medewerker/klant/werkitem in één ronde ophalen (geen N+1). */
async function verrijkTaken(
  ctx: QueryCtx,
  taken: KlantTaak[],
  opties: { metKlantNaam?: boolean } = {}
): Promise<VerrijkteKlantTaak[]> {
  const medewerkerMap = await laadDocsMap(
    ctx,
    taken.map((t) => t.toegewezenAanId)
  );
  const werkitemMap = await laadDocsMap(
    ctx,
    taken.map((t) => t.werkitemId)
  );
  const klantMap = opties.metKlantNaam
    ? await laadDocsMap(
        ctx,
        taken.map((t) => t.klantId)
      )
    : null;

  return taken.map((taak) => ({
    ...taak,
    toegewezenAanNaam: taak.toegewezenAanId
      ? medewerkerMap.get(taak.toegewezenAanId.toString())?.naam
      : undefined,
    werkitemNaam: taak.werkitemId
      ? werkitemMap.get(taak.werkitemId.toString())?.naam
      : undefined,
    klantNaam: klantMap?.get(taak.klantId.toString())?.naam,
  }));
}

// ============================================
// Queries
// ============================================

/** Alle taken van één klant, open bovenaan. */
export const listVoorKlant = query({
  args: {
    klantId: v.id("klanten"),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args): Promise<VerrijkteKlantTaak[]> => {
    await requireInterneRol(ctx);
    const { orgId } = await getKlantBinnenBedrijf(ctx, args.klantId);

    const taken = await ctx.db
      .query("klantTaken")
      .withIndex("by_klant", (q) => q.eq("klantId", args.klantId))
      .collect();

    const gefilterd = taken
      .filter((t) => t.orgId?.toString() === orgId.toString())
      .filter((t) => !args.status || t.status === args.status)
      .sort(sorteerTaken);

    return verrijkTaken(ctx, gefilterd);
  },
});

/**
 * Aantal openstaande taken per klant — voor de teller in de klantenlijst.
 * Eén indexquery over de openstaande taken van het bedrijf, geen scan per klant.
 */
export const openTellingPerKlant = query({
  args: {},
  handler: async (ctx): Promise<Record<string, number>> => {
    await requireInterneRol(ctx);
    const orgId = await requireOrgId(ctx);

    const open = await ctx.db
      .query("klantTaken")
      .withIndex("by_org_status", (q) =>
        q.eq("orgId", orgId).eq("status", "open")
      )
      .collect();

    const telling: Record<string, number> = {};
    for (const taak of open) {
      const sleutel = taak.klantId.toString();
      telling[sleutel] = (telling[sleutel] ?? 0) + 1;
    }
    return telling;
  },
});

/**
 * "Mijn taken": openstaande taken van de ingelogde medewerker. Kantoorrollen
 * zonder gekoppeld medewerkerprofiel zien alle openstaande taken van het
 * bedrijf, zodat een projectleider niets mist.
 */
export const mijnTaken = query({
  args: {
    alleenEigen: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<VerrijkteKlantTaak[]> => {
    const user = await requireInterneRol(ctx);
    const orgId = await requireOrgId(ctx);

    const eigenMedewerkerId = user.linkedMedewerkerId;
    const alleenEigen = args.alleenEigen ?? Boolean(eigenMedewerkerId);

    const taken =
      alleenEigen && eigenMedewerkerId
        ? await ctx.db
            .query("klantTaken")
            .withIndex("by_medewerker_status", (q) =>
              q.eq("toegewezenAanId", eigenMedewerkerId).eq("status", "open")
            )
            .collect()
        : await ctx.db
            .query("klantTaken")
            .withIndex("by_org_status", (q) =>
              q.eq("orgId", orgId).eq("status", "open")
            )
            .collect();

    const gefilterd = taken
      .filter((t) => t.orgId?.toString() === orgId.toString())
      .sort(sorteerTaken)
      .slice(0, args.limit ?? 50);

    return verrijkTaken(ctx, gefilterd, { metKlantNaam: true });
  },
});

// ============================================
// Mutations
// ============================================

export const create = mutation({
  args: {
    klantId: v.id("klanten"),
    titel: v.string(),
    omschrijving: v.optional(v.string()),
    prioriteit: v.optional(prioriteitValidator),
    deadline: v.optional(v.string()),
    toegewezenAanId: v.optional(v.id("medewerkers")),
    werkitemId: v.optional(v.id("projecten")),
  },
  handler: async (ctx, args): Promise<Id<"klantTaken">> => {
    const user = await requireInterneRol(ctx);
    const { orgId } = await getKlantBinnenBedrijf(ctx, args.klantId);
    await valideerMedewerker(ctx, args.toegewezenAanId, orgId);
    await valideerWerkitem(ctx, args.werkitemId, orgId);

    const now = Date.now();
    return await ctx.db.insert("klantTaken", {
      orgId,
      // Legacy-veld: `userId` is sinds fase 3 geen scope meer, maar nog wel
      // verplicht in het schema tot fase 6.
      userId: user._id,
      klantId: args.klantId,
      titel: schoonTitel(args.titel),
      omschrijving: schoonOmschrijving(args.omschrijving),
      status: "open",
      prioriteit: args.prioriteit ?? "normaal",
      deadline: schoonDeadline(args.deadline),
      toegewezenAanId: args.toegewezenAanId,
      werkitemId: args.werkitemId,
      aangemaaktDoorId: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("klantTaken"),
    titel: v.optional(v.string()),
    omschrijving: v.optional(v.string()),
    prioriteit: v.optional(prioriteitValidator),
    // Leeg doorgeven wist de deadline/toewijzing (undefined = ongewijzigd).
    deadline: v.optional(v.string()),
    toegewezenAanId: v.optional(v.union(v.id("medewerkers"), v.null())),
    werkitemId: v.optional(v.union(v.id("projecten"), v.null())),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    await requireInterneRol(ctx);
    const { orgId } = await getTaakBinnenBedrijf(ctx, args.id);

    const patch: Partial<KlantTaak> = { updatedAt: Date.now() };

    if (args.titel !== undefined) patch.titel = schoonTitel(args.titel);
    if (args.omschrijving !== undefined) {
      patch.omschrijving = schoonOmschrijving(args.omschrijving);
    }
    if (args.prioriteit !== undefined) patch.prioriteit = args.prioriteit;
    if (args.deadline !== undefined) {
      patch.deadline = schoonDeadline(args.deadline);
    }
    if (args.toegewezenAanId !== undefined) {
      const medewerkerId = args.toegewezenAanId ?? undefined;
      await valideerMedewerker(ctx, medewerkerId, orgId);
      patch.toegewezenAanId = medewerkerId;
    }
    if (args.werkitemId !== undefined) {
      const werkitemId = args.werkitemId ?? undefined;
      await valideerWerkitem(ctx, werkitemId, orgId);
      patch.werkitemId = werkitemId;
    }

    await ctx.db.patch(args.id, patch);
    return { success: true };
  },
});

/** Afvinken en weer openzetten — het knopje in de takenlijst. */
export const setStatus = mutation({
  args: {
    id: v.id("klantTaken"),
    status: statusValidator,
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const user = await requireInterneRol(ctx);
    await getTaakBinnenBedrijf(ctx, args.id);

    await ctx.db.patch(args.id, {
      status: args.status,
      afgerondAt: args.status === "afgerond" ? Date.now() : undefined,
      afgerondDoorId: args.status === "afgerond" ? user._id : undefined,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const remove = mutation({
  args: { id: v.id("klantTaken") },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    await requireInterneRol(ctx);
    await getTaakBinnenBedrijf(ctx, args.id);

    await ctx.db.delete(args.id);
    return { success: true };
  },
});
