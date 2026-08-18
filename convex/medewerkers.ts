import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrgContext } from "./auth";
import { hasPermission, normalizeRole, requireNotViewer } from "./roles";
import { Id, Doc } from "./_generated/dataModel";
import { QueryCtx, MutationCtx } from "./_generated/server";

// Validators voor nieuwe velden
const specialisatieValidator = v.object({
  scope: v.string(),
  niveau: v.union(v.literal("junior"), v.literal("midlevel"), v.literal("senior")),
  gecertificeerd: v.optional(v.boolean()),
});

const certificaatValidator = v.object({
  naam: v.string(),
  uitgifteDatum: v.number(),
  vervaldatum: v.optional(v.number()),
  documentUrl: v.optional(v.string()),
});

const beschikbaarheidValidator = v.object({
  werkdagen: v.array(v.number()),
  urenPerWeek: v.number(),
  maxUrenPerDag: v.number(),
});

const adresValidator = v.object({
  straat: v.string(),
  postcode: v.string(),
  plaats: v.string(),
});

const noodcontactValidator = v.object({
  naam: v.string(),
  telefoon: v.string(),
  relatie: v.string(),
});

// ============================================
// ROLE-BASED ACCESS HELPERS
// ============================================

/**
 * Org-context + leesbereik voor de medewerkers-module.
 *
 * Vervangt de oude, ad-hoc `getUserRole`. Die leidde de tenant af uit
 * eigendom ("wie heeft medewerker-rijen op zijn userId staan") en de rol uit
 * "is dit account aan een medewerker-rij gekoppeld". Beide zijn sinds de
 * Clerk-Organizations-migratie fout: de tenant is de organisatie uit het
 * JWT, en de rol staat in `users.role`.
 *
 * `magAllenZien` volgt de rechtenmatrix in roles.ts: directie, projectleider
 * en voorman mogen `medewerkers` lezen; alle andere rollen zien uitsluitend
 * hun eigen profiel.
 */
async function medewerkerContext(ctx: QueryCtx | MutationCtx): Promise<{
  orgId: Id<"organisaties">;
  magAllenZien: boolean;
  magBeheren: boolean;
  eigenProfiel: Doc<"medewerkers"> | null;
}> {
  const { org, user } = await requireOrgContext(ctx);
  const role = normalizeRole(user.role);

  // Koppeling primair via users.linkedMedewerkerId (de bron van waarheid),
  // met de oudere clerkUserId-koppeling als terugval voor accounts die nog
  // niet omgezet zijn.
  let eigenProfiel: Doc<"medewerkers"> | null = null;
  if (user.linkedMedewerkerId) {
    eigenProfiel = await ctx.db.get(user.linkedMedewerkerId);
  }
  if (!eigenProfiel) {
    eigenProfiel = await ctx.db
      .query("medewerkers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
      .first();
  }
  // Een koppeling naar een medewerker van een ándere organisatie telt niet:
  // dat zou de tenantgrens langs de achterdeur openen.
  if (eigenProfiel && eigenProfiel.orgId !== org._id) {
    eigenProfiel = null;
  }

  return {
    orgId: org._id,
    magAllenZien: hasPermission(role, "read", "medewerkers"),
    magBeheren: hasPermission(role, "manage", "medewerkers"),
    eigenProfiel,
  };
}

/**
 * Vereis beheerrechten op het personeelsbestand (rechtenmatrix: alleen
 * directie heeft `manage` op `medewerkers`) én geef de org-context terug.
 */
async function requireMedewerkerBeheer(ctx: QueryCtx | MutationCtx): Promise<{
  orgId: Id<"organisaties">;
  userId: Id<"users">;
}> {
  const { org, user } = await requireOrgContext(ctx);
  if (!hasPermission(user.role, "manage", "medewerkers")) {
    throw new ConvexError("Alleen beheerders kunnen deze actie uitvoeren");
  }
  return { orgId: org._id, userId: user._id };
}

/**
 * Haal een medewerker op en controleer dat hij bij de eigen organisatie hoort.
 * Losse helper omdat elke beheer-mutatie exact dezelfde twee foutmeldingen
 * teruggeeft.
 */
async function getMedewerkerVanOrg(
  ctx: QueryCtx | MutationCtx,
  id: Id<"medewerkers">,
  orgId: Id<"organisaties">
): Promise<Doc<"medewerkers">> {
  const medewerker = await ctx.db.get(id);
  if (!medewerker) {
    throw new ConvexError("Medewerker niet gevonden");
  }
  if (medewerker.orgId !== orgId) {
    throw new ConvexError("Geen toegang tot deze medewerker");
  }
  return medewerker;
}

// ============================================
// QUERIES
// ============================================

/**
 * Search medewerkers by naam, email, of functie.
 * - Kantoor/voorman: doorzoekt het bestand van de eigen organisatie
 * - Veldrollen: alleen het eigen profiel, als dat matcht
 */
export const search = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    const { orgId, magAllenZien, eigenProfiel } = await medewerkerContext(ctx);

    const searchTerm = args.searchTerm.toLowerCase().trim();

    // Veldrollen zien alleen hun eigen profiel
    if (!magAllenZien) {
      if (!eigenProfiel) return [];
      if (!searchTerm) {
        return [eigenProfiel];
      }

      const matches =
        eigenProfiel.naam.toLowerCase().includes(searchTerm) ||
        eigenProfiel.email?.toLowerCase().includes(searchTerm) ||
        eigenProfiel.functie?.toLowerCase().includes(searchTerm);

      return matches ? [eigenProfiel] : [];
    }

    // Leesbereik: alle medewerkers van de eigen organisatie
    const medewerkers = await ctx.db
      .query("medewerkers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    // If no search term, return recent medewerkers
    if (!searchTerm) {
      return medewerkers.slice(0, 10);
    }

    // Filter by search term
    const matchingMedewerkers = medewerkers.filter((m) => {
      if (m.naam.toLowerCase().includes(searchTerm)) {
        return true;
      }
      if (m.email?.toLowerCase().includes(searchTerm)) {
        return true;
      }
      if (m.functie?.toLowerCase().includes(searchTerm)) {
        return true;
      }
      return false;
    });

    return matchingMedewerkers.slice(0, 20);
  },
});

/**
 * Get the linked medewerker profile for the current user.
 *
 * PERSOONLIJK pad: het eigen profiel hangt aan het Clerk-account, niet aan de
 * organisatie. De org-check blijft er wel op, zodat een account dat naar een
 * medewerker van een andere tenant wijst niets terugkrijgt.
 */
export const getMyMedewerkerProfile = query({
  args: {},
  handler: async (ctx) => {
    const { eigenProfiel } = await medewerkerContext(ctx);
    return eigenProfiel;
  },
});

/**
 * Haal medewerkers op met paginering.
 * - Kantoor/voorman: alle medewerkers van de eigen organisatie
 * - Veldrollen: alleen het eigen gekoppelde profiel
 */
export const listPaginated = query({
  args: {
    page: v.number(),
    limit: v.number(),
    isActief: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { orgId, magAllenZien, eigenProfiel } = await medewerkerContext(ctx);

    // Veldrollen zien alleen hun eigen profiel
    if (!magAllenZien) {
      const past =
        eigenProfiel !== null &&
        (args.isActief === undefined || eigenProfiel.isActief === args.isActief);
      if (!past) {
        return {
          items: [],
          totalCount: 0,
          totalPages: 0,
          page: args.page,
          limit: args.limit,
        };
      }
      return {
        items: [eigenProfiel!],
        totalCount: 1,
        totalPages: 1,
        page: 1,
        limit: args.limit,
      };
    }

    // Leesbereik: alle medewerkers van de eigen organisatie
    let allMedewerkers;
    if (args.isActief !== undefined) {
      allMedewerkers = await ctx.db
        .query("medewerkers")
        .withIndex("by_org_actief", (q) =>
          q.eq("orgId", orgId).eq("isActief", args.isActief!)
        )
        .collect();
    } else {
      allMedewerkers = await ctx.db
        .query("medewerkers")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
    }

    const totalCount = allMedewerkers.length;
    const totalPages = Math.ceil(totalCount / args.limit);
    const startIndex = (args.page - 1) * args.limit;
    const items = allMedewerkers.slice(startIndex, startIndex + args.limit);

    return {
      items,
      totalCount,
      totalPages,
      page: args.page,
      limit: args.limit,
    };
  },
});

/**
 * Haal alle medewerkers op.
 * - Kantoor/voorman: alle medewerkers van de eigen organisatie
 * - Veldrollen: alleen het eigen gekoppelde profiel
 */
export const list = query({
  args: {
    isActief: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { orgId, magAllenZien, eigenProfiel } = await medewerkerContext(ctx);

    // Veldrollen zien alleen hun eigen profiel
    if (!magAllenZien) {
      if (!eigenProfiel) return [];
      if (args.isActief !== undefined && eigenProfiel.isActief !== args.isActief) {
        return [];
      }
      return [eigenProfiel];
    }

    // Leesbereik: alle medewerkers van de eigen organisatie
    if (args.isActief !== undefined) {
      return await ctx.db
        .query("medewerkers")
        .withIndex("by_org_actief", (q) =>
          q.eq("orgId", orgId).eq("isActief", args.isActief!)
        )
        .collect();
    }

    return await ctx.db
      .query("medewerkers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
  },
});

/**
 * Haal een enkele medewerker op.
 * - Kantoor/voorman: elke medewerker van de eigen organisatie
 * - Veldrollen: alleen het eigen gekoppelde profiel
 */
export const get = query({
  args: { id: v.id("medewerkers") },
  handler: async (ctx, args) => {
    const { orgId, magAllenZien, eigenProfiel } = await medewerkerContext(ctx);

    const medewerker = await ctx.db.get(args.id);
    if (!medewerker) return null;

    // Tenantgrens eerst: buiten de eigen organisatie bestaat de rij niet.
    if (medewerker.orgId !== orgId) return null;

    if (!magAllenZien) {
      return eigenProfiel && eigenProfiel._id === medewerker._id ? medewerker : null;
    }

    return medewerker;
  },
});

/**
 * Haal alleen actieve medewerkers op (voor dropdowns/selecties).
 * - Kantoor/voorman: alle actieve medewerkers van de eigen organisatie
 * - Veldrollen: alleen het eigen profiel, als dat actief is
 */
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const { orgId, magAllenZien, eigenProfiel } = await medewerkerContext(ctx);

    // Veldrollen zien alleen hun eigen profiel
    if (!magAllenZien) {
      return eigenProfiel?.isActief ? [eigenProfiel] : [];
    }

    // Leesbereik: alle actieve medewerkers van de eigen organisatie
    return await ctx.db
      .query("medewerkers")
      .withIndex("by_org_actief", (q) =>
        q.eq("orgId", orgId).eq("isActief", true)
      )
      .collect();
  },
});

// ============================================
// MUTATIONS - ADMIN ONLY
// ============================================

/**
 * Maak een nieuwe medewerker aan — beheerrecht vereist (rechtenmatrix:
 * `manage` op `medewerkers`, dus directie). De rij krijgt de orgId van de
 * actieve organisatie.
 */
export const create = mutation({
  args: {
    naam: v.string(),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    functie: v.optional(v.string()),
    uurtarief: v.optional(v.number()),
    notities: v.optional(v.string()),
    specialisaties: v.optional(v.array(specialisatieValidator)),
    certificaten: v.optional(v.array(certificaatValidator)),
    beschikbaarheid: v.optional(beschikbaarheidValidator),
    contractType: v.optional(
      v.union(
        v.literal("fulltime"),
        v.literal("parttime"),
        v.literal("zzp"),
        v.literal("seizoen")
      )
    ),
    adres: v.optional(adresValidator),
    noodcontact: v.optional(noodcontactValidator),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireMedewerkerBeheer(ctx);
    const now = Date.now();

    return await ctx.db.insert("medewerkers", {
      orgId,
      naam: args.naam,
      email: args.email,
      telefoon: args.telefoon,
      functie: args.functie,
      uurtarief: args.uurtarief,
      notities: args.notities,
      specialisaties: args.specialisaties,
      certificaten: args.certificaten,
      beschikbaarheid: args.beschikbaarheid,
      contractType: args.contractType,
      adres: args.adres,
      noodcontact: args.noodcontact,
      isActief: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Type definities voor update
type Specialisatie = {
  scope: string;
  niveau: "junior" | "midlevel" | "senior";
  gecertificeerd?: boolean;
};

type Certificaat = {
  naam: string;
  uitgifteDatum: number;
  vervaldatum?: number;
  documentUrl?: string;
};

type Beschikbaarheid = {
  werkdagen: number[];
  urenPerWeek: number;
  maxUrenPerDag: number;
};

type Adres = {
  straat: string;
  postcode: string;
  plaats: string;
};

type Noodcontact = {
  naam: string;
  telefoon: string;
  relatie: string;
};

/**
 * Werk een medewerker bij.
 * - Beheerder: alle velden, voor medewerkers van de eigen organisatie
 * - Overige rollen: alleen telefoon/notities/noodcontact op het eigen profiel
 */
export const update = mutation({
  args: {
    id: v.id("medewerkers"),
    naam: v.optional(v.string()),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    functie: v.optional(v.string()),
    uurtarief: v.optional(v.number()),
    notities: v.optional(v.string()),
    isActief: v.optional(v.boolean()),
    specialisaties: v.optional(v.array(specialisatieValidator)),
    certificaten: v.optional(v.array(certificaatValidator)),
    beschikbaarheid: v.optional(beschikbaarheidValidator),
    contractType: v.optional(
      v.union(
        v.literal("fulltime"),
        v.literal("parttime"),
        v.literal("zzp"),
        v.literal("seizoen")
      )
    ),
    adres: v.optional(adresValidator),
    noodcontact: v.optional(noodcontactValidator),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const { orgId, magBeheren, eigenProfiel } = await medewerkerContext(ctx);

    const medewerker = await ctx.db.get(args.id);
    if (!medewerker) {
      throw new ConvexError("Medewerker niet gevonden");
    }
    // Tenantgrens: dezelfde melding als "niet gevonden" hoeft niet — dit is
    // een schrijfpad, daar mag expliciet staan dat de toegang ontbreekt.
    if (medewerker.orgId !== orgId) {
      throw new ConvexError("Geen toegang tot deze medewerker");
    }

    const isOwnProfile =
      eigenProfiel !== null && eigenProfiel._id === medewerker._id;

    if (!magBeheren) {
      // Zonder beheerrechten mag alleen het eigen profiel bijgewerkt worden
      if (!isOwnProfile) {
        throw new ConvexError("Je hebt geen toegang tot deze medewerker");
      }

      // Medewerker can only update limited fields
      const allowedFields = ["telefoon", "notities", "noodcontact"];
      const attemptedFields = Object.keys(args).filter(
        (key) => key !== "id" && args[key as keyof typeof args] !== undefined
      );
      const disallowedFields = attemptedFields.filter((f) => !allowedFields.includes(f));

      if (disallowedFields.length > 0) {
        throw new ConvexError(
          `Je kunt alleen de volgende velden bijwerken: ${allowedFields.join(", ")}`
        );
      }

      // Build update object for allowed fields only
      const updateData: {
        telefoon?: string;
        notities?: string;
        noodcontact?: Noodcontact;
        updatedAt: number;
      } = {
        updatedAt: Date.now(),
      };

      if (args.telefoon !== undefined) updateData.telefoon = args.telefoon;
      if (args.notities !== undefined) updateData.notities = args.notities;
      if (args.noodcontact !== undefined) updateData.noodcontact = args.noodcontact;

      await ctx.db.patch(args.id, updateData);
      return args.id;
    }

    // Beheerder mag alle velden bijwerken (tenant is hierboven al gecontroleerd)
    const updateData: {
      naam?: string;
      email?: string;
      telefoon?: string;
      functie?: string;
      uurtarief?: number;
      notities?: string;
      isActief?: boolean;
      specialisaties?: Specialisatie[];
      certificaten?: Certificaat[];
      beschikbaarheid?: Beschikbaarheid;
      contractType?: "fulltime" | "parttime" | "zzp" | "seizoen";
      adres?: Adres;
      noodcontact?: Noodcontact;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.naam !== undefined) updateData.naam = args.naam;
    if (args.email !== undefined) updateData.email = args.email;
    if (args.telefoon !== undefined) updateData.telefoon = args.telefoon;
    if (args.functie !== undefined) updateData.functie = args.functie;
    if (args.uurtarief !== undefined) updateData.uurtarief = args.uurtarief;
    if (args.notities !== undefined) updateData.notities = args.notities;
    if (args.isActief !== undefined) updateData.isActief = args.isActief;
    if (args.specialisaties !== undefined) updateData.specialisaties = args.specialisaties;
    if (args.certificaten !== undefined) updateData.certificaten = args.certificaten;
    if (args.beschikbaarheid !== undefined) updateData.beschikbaarheid = args.beschikbaarheid;
    if (args.contractType !== undefined) updateData.contractType = args.contractType;
    if (args.adres !== undefined) updateData.adres = args.adres;
    if (args.noodcontact !== undefined) updateData.noodcontact = args.noodcontact;

    await ctx.db.patch(args.id, updateData);

    return args.id;
  },
});

/**
 * Update alleen beperkte velden op het eigen profiel (voor medewerkers).
 *
 * PERSOONLIJK pad: het profiel wordt via `medewerkerContext` opgezocht, dat de
 * koppeling én de organisatiegrens al controleert. Geen extra org-query nodig.
 */
export const updateMyProfile = mutation({
  args: {
    telefoon: v.optional(v.string()),
    notities: v.optional(v.string()),
    noodcontact: v.optional(noodcontactValidator),
  },
  handler: async (ctx, args) => {
    const { eigenProfiel: medewerker } = await medewerkerContext(ctx);

    if (!medewerker) {
      throw new ConvexError("Geen medewerker profiel gevonden voor dit account");
    }

    const updateData: {
      telefoon?: string;
      notities?: string;
      noodcontact?: Noodcontact;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.telefoon !== undefined) updateData.telefoon = args.telefoon;
    if (args.notities !== undefined) updateData.notities = args.notities;
    if (args.noodcontact !== undefined) updateData.noodcontact = args.noodcontact;

    await ctx.db.patch(medewerker._id, updateData);
    return medewerker._id;
  },
});

/** Soft delete: zet isActief op false. Alleen een beheerder van deze organisatie. */
export const remove = mutation({
  args: { id: v.id("medewerkers") },
  handler: async (ctx, args) => {
    const { orgId } = await requireMedewerkerBeheer(ctx);
    await getMedewerkerVanOrg(ctx, args.id, orgId);

    await ctx.db.patch(args.id, {
      isActief: false,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

/** Permanent verwijderen. Alleen een beheerder van deze organisatie. */
export const hardDelete = mutation({
  args: { id: v.id("medewerkers") },
  handler: async (ctx, args) => {
    const { orgId } = await requireMedewerkerBeheer(ctx);
    await getMedewerkerVanOrg(ctx, args.id, orgId);

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// ============================================
// Uitgebreide queries en mutations
// ============================================

/**
 * Bepaalt of een urenregistratie bij de opgegeven organisatie hoort (audit §2).
 *
 * Sinds de org-migratie draagt `urenRegistraties` een `orgId`. Rijen van vóór de
 * backfill hebben dat veld nog niet; daarvoor vallen we terug op de organisatie
 * van het gekoppelde project — dezelfde relatie waar de backfill de orgId uit
 * afleidt, dus beide routes geven hetzelfde antwoord.
 *
 * De cache voorkomt dat hetzelfde project per registratie opnieuw wordt opgehaald.
 */
async function hoortRegistratieBijOrganisatie(
  ctx: QueryCtx | MutationCtx,
  registratie: Doc<"urenRegistraties">,
  orgId: Id<"organisaties">,
  projectTenantCache: Map<string, Id<"organisaties"> | null>
): Promise<boolean> {
  if (registratie.orgId) {
    return registratie.orgId === orgId;
  }

  const key = registratie.projectId.toString();
  let tenant = projectTenantCache.get(key);
  if (tenant === undefined) {
    const project = await ctx.db.get(registratie.projectId);
    tenant = project?.orgId ?? null;
    projectTenantCache.set(key, tenant);
  }
  return tenant === orgId;
}

/**
 * Haal medewerker op met gewerkte uren statistieken.
 * - Kantoor/voorman: elke medewerker van de eigen organisatie
 * - Veldrollen: alleen het eigen profiel
 */
export const getWithStats = query({
  args: { id: v.id("medewerkers") },
  handler: async (ctx, args) => {
    const { orgId, magAllenZien, eigenProfiel } = await medewerkerContext(ctx);

    const medewerker = await ctx.db.get(args.id);
    if (!medewerker) return null;

    // Tenantgrens eerst
    if (medewerker.orgId !== orgId) return null;

    if (!magAllenZien) {
      const isOwnProfile =
        eigenProfiel !== null && eigenProfiel._id === medewerker._id;
      if (!isOwnProfile) return null;
    }

    // Urenregistraties van déze medewerker (audit §2). Primair via de getypeerde
    // koppeling `medewerkerId` — die is per definitie tenant-veilig, want de
    // medewerker is hierboven al op organisatie gecontroleerd. Oude registraties
    // hebben die koppeling nog niet; daarvoor matchen we op naam via de
    // by_medewerker-index (geen full table scan meer) én controleren we expliciet
    // dat de registratie bij deze organisatie hoort — anders deelden twee
    // organisaties met een "Jan de Vries" elkaars uren.
    const urenViaKoppeling = await ctx.db
      .query("urenRegistraties")
      .withIndex("by_medewerker_id", (q) => q.eq("medewerkerId", medewerker._id))
      .collect();

    const urenViaNaam = await ctx.db
      .query("urenRegistraties")
      .withIndex("by_medewerker", (q) => q.eq("medewerker", medewerker.naam))
      .collect();

    const projectTenantCache = new Map<string, Id<"organisaties"> | null>();

    // Ook de koppeling-route langs de tenantcheck: `by_medewerker_id` is een
    // globale index, en een registratie kan (bij een verkeerd doorgegeven id)
    // uit een andere organisatie komen.
    const medewerkerUren: Doc<"urenRegistraties">[] = [];
    for (const registratie of urenViaKoppeling) {
      if (
        await hoortRegistratieBijOrganisatie(
          ctx,
          registratie,
          orgId,
          projectTenantCache
        )
      ) {
        medewerkerUren.push(registratie);
      }
    }

    for (const registratie of urenViaNaam) {
      // Heeft de registratie al een medewerkerId, dan is ze hierboven meegenomen
      // (of ze hoort bij een andere medewerker met dezelfde naam).
      if (registratie.medewerkerId) continue;
      if (
        await hoortRegistratieBijOrganisatie(
          ctx,
          registratie,
          orgId,
          projectTenantCache
        )
      ) {
        medewerkerUren.push(registratie);
      }
    }

    // Bereken totaal gewerkte uren
    const totaalUren = medewerkerUren.reduce((sum, ur) => sum + ur.uren, 0);

    // Uren per maand (laatste 12 maanden)
    const now = new Date();
    const urenPerMaand: { maand: string; uren: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const maandStr = date.toISOString().slice(0, 7); // YYYY-MM
      const maandUren = medewerkerUren
        .filter((ur) => ur.datum.startsWith(maandStr))
        .reduce((sum, ur) => sum + ur.uren, 0);
      urenPerMaand.push({
        maand: maandStr,
        uren: maandUren,
      });
    }

    // Unieke projecten
    const uniekeProjectIds = [...new Set(medewerkerUren.map((ur) => ur.projectId.toString()))];

    return {
      ...medewerker,
      stats: {
        totaalUren,
        aantalRegistraties: medewerkerUren.length,
        aantalProjecten: uniekeProjectIds.length,
        urenPerMaand,
        gemiddeldeUrenPerRegistratie: medewerkerUren.length > 0
          ? Math.round((totaalUren / medewerkerUren.length) * 100) / 100
          : 0,
      },
    };
  },
});

/**
 * Haal medewerkers op met prestatie metrics — alleen voor rollen die het
 * personeelsbestand mogen lezen, en uitsluitend over de eigen organisatie.
 */
export const getMedewerkersMetPrestaties = query({
  args: {
    periode: v.optional(v.object({
      van: v.number(), // timestamp
      tot: v.number(), // timestamp
    })),
  },
  handler: async (ctx, args) => {
    const { orgId, magAllenZien } = await medewerkerContext(ctx);

    if (!magAllenZien) {
      return [];
    }

    // Haal alle actieve medewerkers van deze organisatie op
    const medewerkers = await ctx.db
      .query("medewerkers")
      .withIndex("by_org_actief", (q) =>
        q.eq("orgId", orgId).eq("isActief", true)
      )
      .collect();

    // Haal projecten op voor efficiëntie berekening (tevens fallback-bron hieronder)
    const projecten = await ctx.db
      .query("projecten")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    const afgerondeProjecten = projecten.filter(
      (p) => p.status === "afgerond" || p.status === "nacalculatie_compleet" || p.status === "gefactureerd"
    );

    const vanDatum = args.periode
      ? new Date(args.periode.van).toISOString().slice(0, 10)
      : null;
    const totDatum = args.periode
      ? new Date(args.periode.tot).toISOString().slice(0, 10)
      : null;

    // Urenregistraties van DEZE organisatie (audit §2). Voorheen werd de hele
    // tabel gescand — over alle tenants heen. Nu via de by_org(_datum)-index,
    // die de periode-filtering meteen meeneemt.
    const urenRegistraties: Doc<"urenRegistraties">[] =
      vanDatum !== null && totDatum !== null
        ? await ctx.db
            .query("urenRegistraties")
            .withIndex("by_org_datum", (q) =>
              q
                .eq("orgId", orgId)
                .gte("datum", vanDatum)
                .lte("datum", totDatum)
            )
            .collect()
        : await ctx.db
            .query("urenRegistraties")
            .withIndex("by_org", (q) => q.eq("orgId", orgId))
            .collect();

    // FALLBACK zolang de orgId-backfill op urenRegistraties niet gedraaid is:
    // dan heeft géén enkele registratie een orgId en geeft de index hierboven leeg
    // terug. We halen ze in dat geval per project van deze organisatie op — nog
    // steeds tenant-veilig (projecten zijn al gescoped), alleen duurder. LET OP:
    // draai de backfill in één keer af; tussen twee batches door kan dit rapport
    // tijdelijk onvolledig zijn. Zodra de backfill klaar is, is dit pad dode code
    // voor organisaties mét uren en kan het verwijderd worden.
    if (urenRegistraties.length === 0) {
      for (const project of projecten) {
        const projectUren =
          vanDatum !== null && totDatum !== null
            ? await ctx.db
                .query("urenRegistraties")
                .withIndex("by_project_datum", (q) =>
                  q
                    .eq("projectId", project._id)
                    .gte("datum", vanDatum)
                    .lte("datum", totDatum)
                )
                .collect()
            : await ctx.db
                .query("urenRegistraties")
                .withIndex("by_project", (q) => q.eq("projectId", project._id))
                .collect();
        urenRegistraties.push(...projectUren);
      }
    }

    // Voorcalculaties van DEZE organisatie (audit §2) — voorheen ook een
    // volledige tabelscan over alle tenants.
    const voorcalculaties: Doc<"voorcalculaties">[] = await ctx.db
      .query("voorcalculaties")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    // Zelfde fallback als bij de uren: vóór de orgId-backfill
    // heeft geen enkele voorcalculatie een orgId. Haal ze dan op via de afgeronde
    // projecten — precies de projecten waarvoor hieronder een norm nodig is.
    if (voorcalculaties.length === 0) {
      for (const project of afgerondeProjecten) {
        const viaProject = await ctx.db
          .query("voorcalculaties")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        voorcalculaties.push(...viaProject);

        const offerteId = project.offerteId;
        if (offerteId) {
          const viaOfferte = await ctx.db
            .query("voorcalculaties")
            .withIndex("by_offerte", (q) => q.eq("offerteId", offerteId))
            .collect();
          voorcalculaties.push(...viaOfferte);
        }
      }
    }

    // Bouw Maps voor O(1) lookups (i.p.v. O(n²) nested .find())
    const voorcalcByProjectId = new Map<string, Doc<"voorcalculaties">>();
    const voorcalcByOfferteId = new Map<string, Doc<"voorcalculaties">>();
    for (const vc of voorcalculaties) {
      if (vc.projectId) voorcalcByProjectId.set(vc.projectId.toString(), vc);
      if (vc.offerteId) voorcalcByOfferteId.set(vc.offerteId.toString(), vc);
    }

    // Bouw Map van afgeronde projecten voor O(1) lookup
    const afgerondProjectMap = new Map<string, typeof afgerondeProjecten[0]>();
    for (const p of afgerondeProjecten) {
      afgerondProjectMap.set(p._id.toString(), p);
    }

    // Pre-bereken totaal uren per project voor efficiëntie ratio (voorkom herhaalde filtering)
    const totaalUrenPerProject = new Map<string, number>();
    for (const ur of urenRegistraties) {
      const key = ur.projectId.toString();
      totaalUrenPerProject.set(key, (totaalUrenPerProject.get(key) || 0) + ur.uren);
    }

    // Registraties toewijzen aan een medewerker: primair via de getypeerde
    // koppeling `medewerkerId`, en alleen als die ontbreekt (registraties van
    // vóór de koppeling) op naam. De naam-match is nu ongevaarlijk omdat
    // `urenRegistraties` hierboven al op deze organisatie gescoped is; eerder
    // liep hij over de héle tabel en telde hij de uren van een gelijknamige
    // collega bij een andere tenant mee.
    const urenPerMedewerkerId = new Map<string, Doc<"urenRegistraties">[]>();
    const urenPerNaam = new Map<string, Doc<"urenRegistraties">[]>();
    for (const ur of urenRegistraties) {
      if (ur.medewerkerId) {
        const key = ur.medewerkerId.toString();
        urenPerMedewerkerId.set(key, [
          ...(urenPerMedewerkerId.get(key) ?? []),
          ur,
        ]);
      } else {
        urenPerNaam.set(ur.medewerker, [
          ...(urenPerNaam.get(ur.medewerker) ?? []),
          ur,
        ]);
      }
    }

    // Bereken prestaties per medewerker
    const medewerkersMetPrestaties = medewerkers.map((medewerker) => {
      const medewerkerUren = [
        ...(urenPerMedewerkerId.get(medewerker._id.toString()) ?? []),
        ...(urenPerNaam.get(medewerker.naam) ?? []),
      ];

      const totaalUren = medewerkerUren.reduce((sum, ur) => sum + ur.uren, 0);
      const aantalProjecten = [...new Set(medewerkerUren.map((ur) => ur.projectId.toString()))].length;

      // Bereken efficiëntie ratio (werkelijke uren vs norm uren)
      let efficiëntieRatio: number | null = null;
      let totaalNormUren = 0;
      let totaalWerkelijkeUren = 0;

      const medewerkerProjectIds = [...new Set(medewerkerUren.map((ur) => ur.projectId.toString()))];

      for (const projectIdStr of medewerkerProjectIds) {
        const project = afgerondProjectMap.get(projectIdStr);
        if (project) {
          // O(1) lookup via Maps i.p.v. O(n) .find()
          // offerteId is optioneel sinds werkitem-generalisatie
          const voorcalc = voorcalcByProjectId.get(projectIdStr)
            || (project.offerteId
              ? voorcalcByOfferteId.get(project.offerteId.toString())
              : undefined);
          if (voorcalc) {
            // Proportioneel deel van norm uren (gebaseerd op bijdrage aan project)
            const projectUren = medewerkerUren
              .filter((ur) => ur.projectId.toString() === projectIdStr)
              .reduce((sum, ur) => sum + ur.uren, 0);

            const totaalProjectUren = totaalUrenPerProject.get(projectIdStr) || 0;

            if (totaalProjectUren > 0) {
              const proportie = projectUren / totaalProjectUren;
              totaalNormUren += voorcalc.normUrenTotaal * proportie;
              totaalWerkelijkeUren += projectUren;
            }
          }
        }
      }

      if (totaalNormUren > 0) {
        efficiëntieRatio = Math.round((totaalNormUren / totaalWerkelijkeUren) * 100) / 100;
      }

      // Uren per scope
      const urenPerScope: Record<string, number> = {};
      for (const ur of medewerkerUren) {
        if (ur.scope) {
          urenPerScope[ur.scope] = (urenPerScope[ur.scope] || 0) + ur.uren;
        }
      }

      return {
        medewerker: {
          _id: medewerker._id,
          naam: medewerker.naam,
          functie: medewerker.functie,
          contractType: medewerker.contractType,
        },
        prestaties: {
          totaalUren,
          aantalProjecten,
          efficiëntieRatio, // > 1 = sneller dan norm, < 1 = langzamer dan norm
          urenPerScope,
          gemiddeldeUrenPerProject: aantalProjecten > 0
            ? Math.round((totaalUren / aantalProjecten) * 100) / 100
            : 0,
        },
      };
    });

    // Sorteer op totaal uren (meest actieve eerst)
    return medewerkersMetPrestaties.sort(
      (a, b) => b.prestaties.totaalUren - a.prestaties.totaalUren
    );
  },
});

/**
 * Zoek medewerkers op specialisatie/scope.
 * - Kantoor/voorman: het bestand van de eigen organisatie
 * - Veldrollen: alleen het eigen profiel, als dat matcht
 */
export const getBySpecialisatie = query({
  args: {
    scope: v.string(),
    minimumNiveau: v.optional(v.union(
      v.literal("junior"),
      v.literal("midlevel"),
      v.literal("senior")
    )),
    alleenGecertificeerd: v.optional(v.boolean()),
    alleenActief: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { orgId, magAllenZien, eigenProfiel } = await medewerkerContext(ctx);

    // Niveau volgorde voor filtering
    const niveauVolgorde = { junior: 1, midlevel: 2, senior: 3 };
    const minimumNiveauWaarde = args.minimumNiveau
      ? niveauVolgorde[args.minimumNiveau]
      : 0;

    // Helper function to check if medewerker matches specialisatie criteria
    const matchesSpecialisatie = (m: Doc<"medewerkers">) => {
      if (!m.specialisaties) return false;

      const matchendeSpec = m.specialisaties.find((s: Specialisatie) => {
        // Check scope match
        if (s.scope.toLowerCase() !== args.scope.toLowerCase()) return false;

        // Check minimum niveau
        if (niveauVolgorde[s.niveau] < minimumNiveauWaarde) return false;

        // Check certificering indien vereist
        if (args.alleenGecertificeerd && !s.gecertificeerd) return false;

        return true;
      });

      return matchendeSpec !== undefined;
    };

    // Veldrollen zien alleen hun eigen profiel
    if (!magAllenZien) {
      if (!eigenProfiel) return [];
      // Check isActief filter
      if (args.alleenActief !== false && !eigenProfiel.isActief) {
        return [];
      }

      if (matchesSpecialisatie(eigenProfiel)) {
        const relevantSpec = eigenProfiel.specialisaties?.find(
          (s) => s.scope.toLowerCase() === args.scope.toLowerCase()
        );
        return [{
          ...eigenProfiel,
          relevanteSpecialisatie: relevantSpec,
        }];
      }
      return [];
    }

    // Leesbereik: alle medewerkers van de eigen organisatie
    let medewerkers;
    if (args.alleenActief !== false) {
      medewerkers = await ctx.db
        .query("medewerkers")
        .withIndex("by_org_actief", (q) =>
          q.eq("orgId", orgId).eq("isActief", true)
        )
        .collect();
    } else {
      medewerkers = await ctx.db
        .query("medewerkers")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
    }

    // Filter op specialisatie
    const gefilterdeM = medewerkers.filter(matchesSpecialisatie);

    // Return met relevante specialisatie info
    return gefilterdeM.map((m) => {
      const relevantSpec = m.specialisaties?.find(
        (s) => s.scope.toLowerCase() === args.scope.toLowerCase()
      );
      return {
        ...m,
        relevanteSpecialisatie: relevantSpec,
      };
    });
  },
});

/** Certificaat toevoegen/bijwerken/verwijderen. Alleen een beheerder van deze organisatie. */
export const updateCertificaat = mutation({
  args: {
    medewerkerId: v.id("medewerkers"),
    certificaat: certificaatValidator,
    actie: v.union(v.literal("toevoegen"), v.literal("bijwerken"), v.literal("verwijderen")),
    certificaatIndex: v.optional(v.number()), // Index voor bijwerken/verwijderen
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireMedewerkerBeheer(ctx);
    const medewerker = await getMedewerkerVanOrg(ctx, args.medewerkerId, orgId);

    const certificaten = medewerker.certificaten || [];

    switch (args.actie) {
      case "toevoegen":
        certificaten.push(args.certificaat);
        break;

      case "bijwerken":
        if (args.certificaatIndex === undefined || args.certificaatIndex < 0 || args.certificaatIndex >= certificaten.length) {
          throw new ConvexError("Ongeldige certificaat index");
        }
        certificaten[args.certificaatIndex] = args.certificaat;
        break;

      case "verwijderen":
        if (args.certificaatIndex === undefined || args.certificaatIndex < 0 || args.certificaatIndex >= certificaten.length) {
          throw new ConvexError("Ongeldige certificaat index");
        }
        certificaten.splice(args.certificaatIndex, 1);
        break;
    }

    await ctx.db.patch(args.medewerkerId, {
      certificaten,
      updatedAt: Date.now(),
    });

    return args.medewerkerId;
  },
});

/**
 * Check certificaten die (bijna) verlopen.
 * - Kantoor/voorman: alle actieve medewerkers van de eigen organisatie
 * - Veldrollen: alleen de eigen certificaten
 */
export const checkVervaldataCertificaten = query({
  args: {
    dagenVoorwaarschuwing: v.optional(v.number()), // Default: 30 dagen
  },
  handler: async (ctx, args) => {
    const { orgId, magAllenZien, eigenProfiel } = await medewerkerContext(ctx);

    const waarschuwingsDagen = args.dagenVoorwaarschuwing || 30;
    const waarschuwingsDrempel = Date.now() + (waarschuwingsDagen * 24 * 60 * 60 * 1000);

    // Get medewerkers based on role
    let medewerkers: Doc<"medewerkers">[];
    if (!magAllenZien) {
      // Veldrollen zien alleen hun eigen certificaten
      if (!eigenProfiel?.isActief) {
        return [];
      }
      medewerkers = [eigenProfiel];
    } else {
      // Leesbereik: alle actieve medewerkers van de eigen organisatie
      medewerkers = await ctx.db
        .query("medewerkers")
        .withIndex("by_org_actief", (q) =>
          q.eq("orgId", orgId).eq("isActief", true)
        )
        .collect();
    }

    const resultaten: {
      medewerker: { _id: Id<"medewerkers">; naam: string };
      certificaat: { naam: string; vervaldatum: number };
      status: "verlopen" | "bijna_verlopen";
      dagenTotVerval: number;
    }[] = [];

    const now = Date.now();

    for (const medewerker of medewerkers) {
      if (!medewerker.certificaten) continue;

      for (const cert of medewerker.certificaten) {
        if (!cert.vervaldatum) continue; // Permanente certificaten overslaan

        const dagenTotVerval = Math.floor(
          (cert.vervaldatum - now) / (24 * 60 * 60 * 1000)
        );

        if (cert.vervaldatum < now) {
          // Verlopen
          resultaten.push({
            medewerker: { _id: medewerker._id, naam: medewerker.naam },
            certificaat: { naam: cert.naam, vervaldatum: cert.vervaldatum },
            status: "verlopen",
            dagenTotVerval,
          });
        } else if (cert.vervaldatum < waarschuwingsDrempel) {
          // Bijna verlopen
          resultaten.push({
            medewerker: { _id: medewerker._id, naam: medewerker.naam },
            certificaat: { naam: cert.naam, vervaldatum: cert.vervaldatum },
            status: "bijna_verlopen",
            dagenTotVerval,
          });
        }
      }
    }

    // Sorteer: verlopen eerst, dan op dagen tot verval
    return resultaten.sort((a, b) => {
      if (a.status === "verlopen" && b.status !== "verlopen") return -1;
      if (a.status !== "verlopen" && b.status === "verlopen") return 1;
      return a.dagenTotVerval - b.dagenTotVerval;
    });
  },
});
