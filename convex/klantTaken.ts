/**
 * Klanttaken v2 — losse to-do's per klant met maker, checker en uitzetter.
 *
 * ── Waarom een eigen tabel ────────────────────────────────────────────────
 * - klantTijdlijn legt vast wat er GEBEURD is (append-only dossier);
 *   een taak legt vast wat er nog MOET gebeuren en wisselt van status.
 * - planningTaken hangt aan een werkitem en voedt de uitvoering; een
 *   klanttaak bestaat ook zónder project (leadfase, nazorg, administratie).
 *
 * ── Wat v2 verandert (prototype v13) ──────────────────────────────────────
 * 1. VIER statussen in plaats van twee: todo → bezig → check → klaar.
 *    "check" ("Wacht op check") is een échte status met eigen filters en
 *    signalering, geen labeltje — harde klanteis 7.
 * 2. Toewijzen gebeurt aan ACCOUNTS (`users`), niet aan medewerkersrijen.
 *    Twee rollen per taak: `makerId` ("Maakt het") en `checkerId` ("Checkt het
 *    voor verzending"), plus `uitgezetDoorId` (wie het uitzette). In v1 hing
 *    een taak aan een `medewerkers`-rij, en juist kantoor en directie hebben
 *    die vaak niet — dat blokkeerde het gebruik.
 * 3. `laatsteBewegingOp` is de stilstandmeter: élke status-, toewijzings- of
 *    overdrachtsmutatie zet hem op nu. "Dit blijft liggen" op het werkbord
 *    telt hierop — de teller loopt bij STILSTAND, niet bij drukte.
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
import {
  isKlaar,
  isOpenTaak,
  isOver,
  normaliseerStatus,
  stilDagen,
  taakPrioriteitValidator,
  taakStatusValidator,
  telSubtaken,
  vandaagAmsterdam,
  type TaakStatus,
} from "./lib/taakModel";
import {
  isToewijsbaarBinnenOrg,
  laadToewijsbarePersonen,
  persoonVanUser,
  type ToewijsbaarPersoon,
} from "./lib/taakPersonen";

const MAX_TITEL = 200;
const MAX_OMSCHRIJVING = 2000;
const MAX_SUBTAKEN = 25;
const DEADLINE_PATROON = /^\d{4}-\d{2}-\d{2}$/;
/** Hoe lang een afgeronde taak nog op het werkbord blijft staan. */
const KLAAR_VENSTER_MS = 7 * 24 * 60 * 60 * 1000;

const subtaakValidator = v.object({ titel: v.string(), klaar: v.boolean() });

type KlantTaak = Doc<"klantTaken">;

/**
 * Wat het dossier en het werkbord van een taak nodig hebben, in één keer
 * meegeleverd zodat de UI niets hoeft na te rekenen of na te vragen.
 */
export type VerrijkteTaak = Omit<KlantTaak, "status"> & {
  status: TaakStatus;
  stilDagen: number;
  over: boolean;
  ai: boolean;
  maker: ToewijsbaarPersoon | null;
  checker: ToewijsbaarPersoon | null;
  uitzetter: ToewijsbaarPersoon | null;
  subtakenKlaar: number;
  subtakenTotaal: number;
  reactieCount: number;
  klantNaam: string;
  werkitemNaam?: string;
  /** DEPRECATED (v1-UI): naam van de maker. Vervalt met fase 2. */
  toegewezenAanNaam?: string;
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
  ctx: QueryCtx | MutationCtx,
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

function schoonSubtaken(
  subtaken: Array<{ titel: string; klaar: boolean }> | undefined
): Array<{ titel: string; klaar: boolean }> | undefined {
  if (subtaken === undefined) return undefined;
  const schoon = subtaken
    .map((s) => ({ titel: s.titel.trim(), klaar: s.klaar }))
    .filter((s) => s.titel !== "");
  if (schoon.length > MAX_SUBTAKEN) {
    throw new ConvexError(`Maximaal ${MAX_SUBTAKEN} subtaken per taak`);
  }
  for (const subtaak of schoon) {
    if (subtaak.titel.length > MAX_TITEL) {
      throw new ConvexError(`Subtaak mag maximaal ${MAX_TITEL} tekens zijn`);
    }
  }
  // Lege lijst = geen subtaken; zo blijft "heeft deze taak subtaken?" één check.
  return schoon.length === 0 ? undefined : schoon;
}

/**
 * Een taakrol (maker/checker) valideren binnen de eigen organisatie.
 * `null` betekent "niemand"; `undefined` betekent "ongewijzigd".
 */
async function valideerPersoon(
  ctx: MutationCtx,
  userId: Id<"users"> | null | undefined,
  orgId: Id<"organisaties">,
  rol: string
): Promise<Id<"users"> | undefined> {
  if (userId === undefined || userId === null) return undefined;
  if (!(await isToewijsbaarBinnenOrg(ctx, userId, orgId))) {
    throw new ConvexError(`Deze persoon kan geen ${rol} zijn van deze taak`);
  }
  return userId;
}

/**
 * DEPRECATED-brug (v1-UI): een medewerkerstoewijzing vertalen naar het account
 * dat erbij hoort, zodat de oude dossierkaart blijft werken tot fase 2 hem
 * vervangt. Geen match → geen maker; liever leeg dan de verkeerde naam.
 */
async function makerVanMedewerker(
  ctx: MutationCtx,
  medewerkerId: Id<"medewerkers"> | null | undefined,
  orgId: Id<"organisaties">
): Promise<Id<"users"> | undefined> {
  if (!medewerkerId) return undefined;
  const medewerker = await ctx.db.get(medewerkerId);
  if (!medewerker || medewerker.orgId?.toString() !== orgId.toString()) {
    throw new ConvexError("Medewerker niet gevonden");
  }
  // Convex-regel 4: `clerkUserId` is optioneel — nooit ongeguard de index in.
  const clerkUserId = medewerker.clerkUserId;
  if (!clerkUserId) return undefined;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkUserId))
    .unique();
  return user?._id;
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
  const aKlaar = isKlaar(a.status);
  const bKlaar = isKlaar(b.status);
  if (aKlaar !== bKlaar) return aKlaar ? 1 : -1;
  if (aKlaar) {
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

/**
 * Namen, tellingen en afleidingen in één ronde erbij (geen N+1).
 *
 * De reactietelling loopt per taak over de index `taakReacties.by_taak`: dat
 * schaalt met het aantal getoonde taken (begrensd door wat er open staat), niet
 * met de hele reactiegeschiedenis van het bedrijf.
 */
async function verrijkTaken(
  ctx: QueryCtx,
  taken: KlantTaak[],
  nu: number = Date.now()
): Promise<VerrijkteTaak[]> {
  const userMap = await laadDocsMap(ctx, [
    ...taken.map((t) => t.makerId),
    ...taken.map((t) => t.checkerId),
    ...taken.map((t) => t.uitgezetDoorId),
  ]);
  const klantMap = await laadDocsMap(
    ctx,
    taken.map((t) => t.klantId)
  );
  const werkitemMap = await laadDocsMap(
    ctx,
    taken.map((t) => t.werkitemId)
  );

  const reactieAantallen = await Promise.all(
    taken.map(async (taak) => {
      const reacties = await ctx.db
        .query("taakReacties")
        .withIndex("by_taak", (q) => q.eq("taakId", taak._id))
        .collect();
      return reacties.length;
    })
  );

  const vandaag = vandaagAmsterdam(nu);
  const persoon = (id: Id<"users"> | undefined): ToewijsbaarPersoon | null => {
    if (!id) return null;
    const user = userMap.get(id.toString());
    return user ? persoonVanUser(user) : null;
  };

  return taken.map((taak, i) => {
    const maker = persoon(taak.makerId);
    return {
      ...taak,
      status: normaliseerStatus(taak.status),
      stilDagen: stilDagen(taak.laatsteBewegingOp, taak._creationTime, nu),
      over: isOver(taak.deadline, taak.status, vandaag),
      ai: taak.bronTijdlijnId !== undefined,
      maker,
      checker: persoon(taak.checkerId),
      uitzetter: persoon(taak.uitgezetDoorId),
      ...telSubtaken(taak.subtaken),
      reactieCount: reactieAantallen[i],
      klantNaam: klantMap.get(taak.klantId.toString())?.naam ?? "Onbekend",
      werkitemNaam: taak.werkitemId
        ? werkitemMap.get(taak.werkitemId.toString())?.naam
        : undefined,
      toegewezenAanNaam: maker?.naam,
    };
  });
}

/** Elke beweging op de taak zet de stilstandmeter terug. */
function bewegingPatch(nu: number = Date.now()) {
  return { laatsteBewegingOp: nu, updatedAt: nu };
}

// ============================================
// Queries
// ============================================

/** Alle taken van één klant, open bovenaan. */
export const listVoorKlant = query({
  args: {
    klantId: v.id("klanten"),
    status: v.optional(taakStatusValidator),
  },
  handler: async (ctx, args): Promise<VerrijkteTaak[]> => {
    await requireInterneRol(ctx);
    const { orgId } = await getKlantBinnenBedrijf(ctx, args.klantId);

    // Bewust alléén op klantId (een geldige prefix van by_klant): het
    // statusveld staat tijdens de v2-migratie even in twee smaken, en dan mag
    // een index-`eq` op een statusliteral niet bepalen wat je te zien krijgt.
    const taken = await ctx.db
      .query("klantTaken")
      .withIndex("by_klant", (q) => q.eq("klantId", args.klantId))
      .collect();

    const gefilterd = taken
      .filter((t) => t.orgId?.toString() === orgId.toString())
      .filter((t) => !args.status || normaliseerStatus(t.status) === args.status)
      .sort(sorteerTaken);

    return verrijkTaken(ctx, gefilterd);
  },
});

/**
 * Aantal openstaande taken per klant — voor de teller in de klantenlijst.
 * Eén indexquery over de taken van het bedrijf, geen scan per klant.
 */
export const openTellingPerKlant = query({
  args: {},
  handler: async (ctx): Promise<Record<string, number>> => {
    await requireInterneRol(ctx);
    const orgId = await requireOrgId(ctx);

    const taken = await ctx.db
      .query("klantTaken")
      .withIndex("by_org_status", (q) => q.eq("orgId", orgId))
      .collect();

    const telling: Record<string, number> = {};
    for (const taak of taken) {
      if (!isOpenTaak(taak.status)) continue;
      const sleutel = taak.klantId.toString();
      telling[sleutel] = (telling[sleutel] ?? 0) + 1;
    }
    return telling;
  },
});

/**
 * "Mijn taken" op het dashboard: de taken waar ík aan zit.
 *
 * REGRESSIE (v1-bug): wie geen `medewerkers`-rij had — en dat is precies
 * kantoor en directie — viel terug op "alle openstaande taken van het bedrijf".
 * Dat paneel heette "Mijn taken" en toonde andermans werk. In v2 hangt de
 * scope aan het ACCOUNT (maker of checker = ik), dus die terugval bestaat niet
 * meer. `alleenEigen: false` is nu een expliciete keuze van de aanroeper voor
 * een teamoverzicht, geen stille default.
 */
export const mijnTaken = query({
  args: {
    alleenEigen: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<VerrijkteTaak[]> => {
    const user = await requireInterneRol(ctx);
    const orgId = await requireOrgId(ctx);
    const alleenEigen = args.alleenEigen ?? true;

    const taken = await ctx.db
      .query("klantTaken")
      .withIndex("by_org_status", (q) => q.eq("orgId", orgId))
      .collect();

    const ik = user._id.toString();
    const gefilterd = taken
      .filter((t) => t.orgId?.toString() === orgId.toString())
      .filter((t) => isOpenTaak(t.status))
      .filter(
        (t) =>
          !alleenEigen ||
          t.makerId?.toString() === ik ||
          t.checkerId?.toString() === ik
      )
      .sort(sorteerTaken)
      .slice(0, args.limit ?? 50);

    return verrijkTaken(ctx, gefilterd);
  },
});

/**
 * Alles wat het werkbord "Mijn dag" in één keer nodig heeft: de taken van de
 * hele organisatie (het bord filtert zelf op perspectief), de toewijsbare
 * personen voor de selects en de klantnamen voor de klant-indeling.
 *
 * Afgeronde taken blijven zeven dagen staan: het bord moet laten zien wat je
 * vandaag hebt weggewerkt, zonder de historie van vorig jaar op te halen.
 */
export const mijnDag = query({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    taken: VerrijkteTaak[];
    personen: ToewijsbaarPersoon[];
    klanten: Array<{ _id: Id<"klanten">; naam: string }>;
  }> => {
    await requireInterneRol(ctx);
    const orgId = await requireOrgId(ctx);
    const nu = Date.now();

    const alle = await ctx.db
      .query("klantTaken")
      .withIndex("by_org_status", (q) => q.eq("orgId", orgId))
      .collect();

    const relevant = alle
      .filter((t) => t.orgId?.toString() === orgId.toString())
      .filter((t) => {
        if (isOpenTaak(t.status)) return true;
        const af = t.afgerondAt ?? t.laatsteBewegingOp ?? t.updatedAt;
        return nu - af <= KLAAR_VENSTER_MS;
      })
      .sort(sorteerTaken);

    const taken = await verrijkTaken(ctx, relevant, nu);
    const personen = await laadToewijsbarePersonen(ctx, orgId);

    const klantMap = new Map<string, { _id: Id<"klanten">; naam: string }>();
    for (const taak of taken) {
      klantMap.set(taak.klantId.toString(), {
        _id: taak.klantId,
        naam: taak.klantNaam,
      });
    }

    return {
      taken,
      personen,
      klanten: [...klantMap.values()].sort((a, b) =>
        a.naam.localeCompare(b.naam, "nl")
      ),
    };
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
    prioriteit: v.optional(taakPrioriteitValidator),
    deadline: v.optional(v.string()),
    makerId: v.optional(v.id("users")),
    checkerId: v.optional(v.id("users")),
    werkitemId: v.optional(v.id("projecten")),
    /** DEPRECATED (v1-UI): wordt vertaald naar `makerId`. Vervalt met fase 2. */
    toegewezenAanId: v.optional(v.id("medewerkers")),
  },
  handler: async (ctx, args): Promise<Id<"klantTaken">> => {
    const user = await requireInterneRol(ctx);
    const { orgId } = await getKlantBinnenBedrijf(ctx, args.klantId);
    const makerId =
      (await valideerPersoon(ctx, args.makerId, orgId, "maker")) ??
      (await makerVanMedewerker(ctx, args.toegewezenAanId, orgId));
    const checkerId = await valideerPersoon(
      ctx,
      args.checkerId,
      orgId,
      "checker"
    );
    await valideerWerkitem(ctx, args.werkitemId, orgId);

    const now = Date.now();
    return await ctx.db.insert("klantTaken", {
      orgId,
      klantId: args.klantId,
      titel: schoonTitel(args.titel),
      omschrijving: schoonOmschrijving(args.omschrijving),
      status: "todo",
      prioriteit: args.prioriteit ?? "normaal",
      deadline: schoonDeadline(args.deadline),
      makerId,
      checkerId,
      uitgezetDoorId: user._id,
      werkitemId: args.werkitemId,
      aangemaaktDoorId: user._id,
      laatsteBewegingOp: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    taakId: v.id("klantTaken"),
    titel: v.optional(v.string()),
    omschrijving: v.optional(v.string()),
    prioriteit: v.optional(taakPrioriteitValidator),
    // Leeg doorgeven wist de deadline (undefined = ongewijzigd).
    deadline: v.optional(v.string()),
    subtaken: v.optional(v.array(subtaakValidator)),
    werkitemId: v.optional(v.union(v.id("projecten"), v.null())),
    /** DEPRECATED (v1-UI): wordt vertaald naar `makerId`. Vervalt met fase 2. */
    toegewezenAanId: v.optional(v.union(v.id("medewerkers"), v.null())),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    await requireInterneRol(ctx);
    const { orgId } = await getTaakBinnenBedrijf(ctx, args.taakId);

    const patch: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.titel !== undefined) patch.titel = schoonTitel(args.titel);
    if (args.omschrijving !== undefined) {
      patch.omschrijving = schoonOmschrijving(args.omschrijving);
    }
    if (args.prioriteit !== undefined) patch.prioriteit = args.prioriteit;
    if (args.deadline !== undefined) {
      patch.deadline = schoonDeadline(args.deadline);
    }
    if (args.subtaken !== undefined) {
      patch.subtaken = schoonSubtaken(args.subtaken);
    }
    if (args.werkitemId !== undefined) {
      const werkitemId = args.werkitemId ?? undefined;
      await valideerWerkitem(ctx, werkitemId, orgId);
      patch.werkitemId = werkitemId;
    }
    if (args.toegewezenAanId !== undefined) {
      // Toewijzen is een beweging, ook via de oude weg.
      patch.makerId = await makerVanMedewerker(ctx, args.toegewezenAanId, orgId);
      Object.assign(patch, bewegingPatch());
    }

    await ctx.db.patch(args.taakId, patch);
    return { success: true };
  },
});

/**
 * Statuswissel — de vier knoppen op de taakkaart en het slepen tussen de
 * statuskolommen op het bord. Zet de stilstandmeter terug.
 */
export const setStatus = mutation({
  args: {
    taakId: v.id("klantTaken"),
    status: taakStatusValidator,
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const user = await requireInterneRol(ctx);
    await getTaakBinnenBedrijf(ctx, args.taakId);

    const now = Date.now();
    await ctx.db.patch(args.taakId, {
      status: args.status,
      afgerondAt: args.status === "klaar" ? now : undefined,
      afgerondDoorId: args.status === "klaar" ? user._id : undefined,
      ...bewegingPatch(now),
    });
    return { success: true };
  },
});

/**
 * Maker en/of checker zetten. `null` = niemand, veld weglaten = ongewijzigd.
 * Een overdracht is een beweging: de stilstandmeter gaat terug naar nul.
 */
export const wijsToe = mutation({
  args: {
    taakId: v.id("klantTaken"),
    makerId: v.optional(v.union(v.id("users"), v.null())),
    checkerId: v.optional(v.union(v.id("users"), v.null())),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const user = await requireInterneRol(ctx);
    const { taak, orgId } = await getTaakBinnenBedrijf(ctx, args.taakId);

    const patch: Record<string, unknown> = bewegingPatch();

    if (args.makerId !== undefined) {
      patch.makerId = await valideerPersoon(ctx, args.makerId, orgId, "maker");
    }
    if (args.checkerId !== undefined) {
      patch.checkerId = await valideerPersoon(
        ctx,
        args.checkerId,
        orgId,
        "checker"
      );
    }
    // Wie werk uitzet dat nog geen uitzetter had, is de uitzetter. Zonder dit
    // blijft "Uitgezet door mij" op het bord leeg voor alles wat vóór v2
    // bestond.
    if (taak.uitgezetDoorId === undefined) {
      patch.uitgezetDoorId = user._id;
    }

    await ctx.db.patch(args.taakId, patch);
    return { success: true };
  },
});

/** "Zelf oppakken" van het blijft-liggen-paneel: ik word de maker. */
export const zelfOppakken = mutation({
  args: { taakId: v.id("klantTaken") },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const user = await requireInterneRol(ctx);
    const { taak } = await getTaakBinnenBedrijf(ctx, args.taakId);

    await ctx.db.patch(args.taakId, {
      makerId: user._id,
      uitgezetDoorId: taak.uitgezetDoorId ?? user._id,
      ...bewegingPatch(),
    });
    return { success: true };
  },
});

export const remove = mutation({
  args: { taakId: v.id("klantTaken") },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    await requireInterneRol(ctx);
    await getTaakBinnenBedrijf(ctx, args.taakId);

    // Reacties horen bij de taak en hebben zonder hem geen betekenis meer.
    const reacties = await ctx.db
      .query("taakReacties")
      .withIndex("by_taak", (q) => q.eq("taakId", args.taakId))
      .collect();
    for (const reactie of reacties) {
      await ctx.db.delete(reactie._id);
    }

    await ctx.db.delete(args.taakId);
    return { success: true };
  },
});
