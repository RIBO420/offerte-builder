import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId, getAuthenticatedUser, requireAuth } from "./auth";
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
 * Check if the authenticated user is an admin (company owner) for the medewerker record.
 * An admin is a user whose _id matches the medewerker's userId field.
 */
async function isAdminForMedewerker(
  ctx: QueryCtx | MutationCtx,
  medewerker: { userId: Id<"users"> }
): Promise<boolean> {
  const user = await getAuthenticatedUser(ctx);
  if (!user) return false;
  return user._id.toString() === medewerker.userId.toString();
}

/**
 * Check if the authenticated user is the linked medewerker.
 * A medewerker is linked when their clerkId matches medewerker.clerkUserId.
 */
async function isLinkedMedewerker(
  ctx: QueryCtx | MutationCtx,
  medewerker: { clerkUserId?: string }
): Promise<boolean> {
  const user = await getAuthenticatedUser(ctx);
  if (!user || !medewerker.clerkUserId) return false;
  return user.clerkId === medewerker.clerkUserId;
}

/**
 * Get the user's role in relation to medewerkers.
 * Returns: "admin" | "medewerker" | null
 * - admin: User is a company owner with medewerkers under their account
 * - medewerker: User is linked to a medewerker record via clerkUserId
 * - null: User has no access
 */
async function getUserRole(ctx: QueryCtx | MutationCtx): Promise<{
  role: "admin" | "medewerker" | null;
  userId: Id<"users"> | null;
  linkedMedewerker: Doc<"medewerkers"> | null;
  companyUserId: Id<"users"> | null;
}> {
  const user = await getAuthenticatedUser(ctx);
  if (!user) {
    return { role: null, userId: null, linkedMedewerker: null, companyUserId: null };
  }

  // Check if user is linked to a medewerker via clerkUserId
  const linkedMedewerker = await ctx.db
    .query("medewerkers")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
    .first();

  if (linkedMedewerker) {
    // User is a medewerker employee
    return {
      role: "medewerker",
      userId: user._id,
      linkedMedewerker,
      companyUserId: linkedMedewerker.userId,
    };
  }

  // Check if user has medewerkers under their account (is a company owner/admin)
  const ownedMedewerkers = await ctx.db
    .query("medewerkers")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();

  if (ownedMedewerkers) {
    // User is an admin (company owner) with medewerkers
    return {
      role: "admin",
      userId: user._id,
      linkedMedewerker: null,
      companyUserId: user._id,
    };
  }

  // User is authenticated but doesn't have medewerkers - could be a new admin
  // Allow them to create medewerkers (admin role by default for authenticated users)
  return {
    role: "admin",
    userId: user._id,
    linkedMedewerker: null,
    companyUserId: user._id,
  };
}

/**
 * Require admin role. Throws error if user is not admin.
 */
async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<{
  userId: Id<"users">;
  companyUserId: Id<"users">;
}> {
  const { role, userId, companyUserId } = await getUserRole(ctx);
  if (role !== "admin" || !userId || !companyUserId) {
    throw new Error("Alleen beheerders kunnen deze actie uitvoeren");
  }
  return { userId, companyUserId };
}

// ============================================
// QUERIES
// ============================================

/**
 * Get the linked medewerker profile for the current user.
 * This is for medewerkers to view their own profile.
 */
export const getMyMedewerkerProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) return null;

    // Find medewerker linked to this user's clerkId
    const medewerker = await ctx.db
      .query("medewerkers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
      .first();

    return medewerker;
  },
});

/**
 * Haal alle medewerkers op.
 * - Admin: sees all medewerkers they own
 * - Medewerker: sees only their own linked profile
 */
export const list = query({
  args: {
    isActief: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { role, userId, linkedMedewerker, companyUserId } = await getUserRole(ctx);

    if (!role || !companyUserId) {
      return [];
    }

    // Medewerker role: can only see their own profile
    if (role === "medewerker" && linkedMedewerker) {
      // If filtering by isActief and medewerker doesn't match, return empty
      if (args.isActief !== undefined && linkedMedewerker.isActief !== args.isActief) {
        return [];
      }
      return [linkedMedewerker];
    }

    // Admin role: see all medewerkers they own
    if (args.isActief !== undefined) {
      return await ctx.db
        .query("medewerkers")
        .withIndex("by_user_actief", (q) =>
          q.eq("userId", companyUserId).eq("isActief", args.isActief!)
        )
        .collect();
    }

    return await ctx.db
      .query("medewerkers")
      .withIndex("by_user", (q) => q.eq("userId", companyUserId))
      .collect();
  },
});

/**
 * Haal een enkele medewerker op.
 * - Admin: can get any medewerker they own
 * - Medewerker: can only get their own linked profile
 */
export const get = query({
  args: { id: v.id("medewerkers") },
  handler: async (ctx, args) => {
    const { role, linkedMedewerker, companyUserId } = await getUserRole(ctx);

    if (!role) return null;

    const medewerker = await ctx.db.get(args.id);
    if (!medewerker) return null;

    // Medewerker role: can only see their own profile
    if (role === "medewerker") {
      if (linkedMedewerker && linkedMedewerker._id.toString() === medewerker._id.toString()) {
        return medewerker;
      }
      return null;
    }

    // Admin role: can see medewerkers they own
    if (companyUserId && medewerker.userId.toString() === companyUserId.toString()) {
      return medewerker;
    }

    return null;
  },
});

/**
 * Haal alleen actieve medewerkers op (voor dropdowns/selecties).
 * - Admin: sees all active medewerkers they own
 * - Medewerker: sees only their own profile if active
 */
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const { role, linkedMedewerker, companyUserId } = await getUserRole(ctx);

    if (!role || !companyUserId) {
      return [];
    }

    // Medewerker role: can only see their own profile if active
    if (role === "medewerker" && linkedMedewerker) {
      if (linkedMedewerker.isActief) {
        return [linkedMedewerker];
      }
      return [];
    }

    // Admin role: see all active medewerkers they own
    return await ctx.db
      .query("medewerkers")
      .withIndex("by_user_actief", (q) =>
        q.eq("userId", companyUserId).eq("isActief", true)
      )
      .collect();
  },
});

// ============================================
// MUTATIONS - ADMIN ONLY
// ============================================

/**
 * Maak een nieuwe medewerker aan.
 * Only admin can create medewerkers.
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
    const { companyUserId } = await requireAdmin(ctx);
    const now = Date.now();

    return await ctx.db.insert("medewerkers", {
      userId: companyUserId,
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
 * - Admin: can update all fields for medewerkers they own
 * - Medewerker: can only update limited fields (telefoon, notities) on their own profile
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
    const { role, linkedMedewerker, companyUserId } = await getUserRole(ctx);

    if (!role) {
      throw new Error("Je moet ingelogd zijn om deze actie uit te voeren");
    }

    const medewerker = await ctx.db.get(args.id);
    if (!medewerker) {
      throw new Error("Medewerker niet gevonden");
    }

    // Check access based on role
    const isOwnProfile = linkedMedewerker && linkedMedewerker._id.toString() === medewerker._id.toString();
    const isOwner = companyUserId && medewerker.userId.toString() === companyUserId.toString();

    if (role === "medewerker") {
      // Medewerker can only update their own profile
      if (!isOwnProfile) {
        throw new Error("Je hebt geen toegang tot deze medewerker");
      }

      // Medewerker can only update limited fields
      const allowedFields = ["telefoon", "notities", "noodcontact"];
      const attemptedFields = Object.keys(args).filter(
        (key) => key !== "id" && args[key as keyof typeof args] !== undefined
      );
      const disallowedFields = attemptedFields.filter((f) => !allowedFields.includes(f));

      if (disallowedFields.length > 0) {
        throw new Error(
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

    // Admin role: verify ownership
    if (!isOwner) {
      throw new Error("Geen toegang tot deze medewerker");
    }

    // Admin can update all fields
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
 * Simplified mutation for medewerkers to update only allowed fields.
 */
export const updateMyProfile = mutation({
  args: {
    telefoon: v.optional(v.string()),
    notities: v.optional(v.string()),
    noodcontact: v.optional(noodcontactValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Find linked medewerker
    const medewerker = await ctx.db
      .query("medewerkers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
      .first();

    if (!medewerker) {
      throw new Error("Geen medewerker profiel gevonden voor dit account");
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

/**
 * Soft delete: zet isActief op false.
 * Only admin can deactivate medewerkers.
 */
export const remove = mutation({
  args: { id: v.id("medewerkers") },
  handler: async (ctx, args) => {
    const { companyUserId } = await requireAdmin(ctx);

    const medewerker = await ctx.db.get(args.id);
    if (!medewerker) {
      throw new Error("Medewerker niet gevonden");
    }
    if (medewerker.userId.toString() !== companyUserId.toString()) {
      throw new Error("Geen toegang tot deze medewerker");
    }

    await ctx.db.patch(args.id, {
      isActief: false,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

/**
 * Permanent verwijderen.
 * Only admin can hard delete medewerkers.
 */
export const hardDelete = mutation({
  args: { id: v.id("medewerkers") },
  handler: async (ctx, args) => {
    const { companyUserId } = await requireAdmin(ctx);

    const medewerker = await ctx.db.get(args.id);
    if (!medewerker) {
      throw new Error("Medewerker niet gevonden");
    }
    if (medewerker.userId.toString() !== companyUserId.toString()) {
      throw new Error("Geen toegang tot deze medewerker");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// ============================================
// Uitgebreide queries en mutations
// ============================================

/**
 * Haal medewerker op met gewerkte uren statistieken.
 * - Admin: can get stats for any medewerker they own
 * - Medewerker: can only get stats for their own profile
 */
export const getWithStats = query({
  args: { id: v.id("medewerkers") },
  handler: async (ctx, args) => {
    const { role, linkedMedewerker, companyUserId } = await getUserRole(ctx);

    if (!role) return null;

    const medewerker = await ctx.db.get(args.id);
    if (!medewerker) return null;

    // Check access
    const isOwnProfile = linkedMedewerker && linkedMedewerker._id.toString() === medewerker._id.toString();
    const isOwner = companyUserId && medewerker.userId.toString() === companyUserId.toString();

    if (role === "medewerker" && !isOwnProfile) {
      return null;
    }
    if (role === "admin" && !isOwner) {
      return null;
    }

    // Haal alle urenregistraties op voor deze medewerker
    const alleUrenRegistraties = await ctx.db
      .query("urenRegistraties")
      .collect();

    // Filter op medewerker naam (urenRegistraties gebruikt medewerker naam, niet ID)
    const medewerkerUren = alleUrenRegistraties.filter(
      (ur) => ur.medewerker === medewerker.naam
    );

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
 * Haal medewerkers op met prestatie metrics.
 * Only admin can see performance metrics for all medewerkers.
 */
export const getMedewerkersMetPrestaties = query({
  args: {
    periode: v.optional(v.object({
      van: v.number(), // timestamp
      tot: v.number(), // timestamp
    })),
  },
  handler: async (ctx, args) => {
    const { role, companyUserId } = await getUserRole(ctx);

    if (role !== "admin" || !companyUserId) {
      return [];
    }

    // Haal alle actieve medewerkers op
    const medewerkers = await ctx.db
      .query("medewerkers")
      .withIndex("by_user_actief", (q) =>
        q.eq("userId", companyUserId).eq("isActief", true)
      )
      .collect();

    // Haal alle urenregistraties op
    let urenRegistraties = await ctx.db.query("urenRegistraties").collect();

    // Filter op periode indien opgegeven
    if (args.periode) {
      const vanDatum = new Date(args.periode.van).toISOString().slice(0, 10);
      const totDatum = new Date(args.periode.tot).toISOString().slice(0, 10);
      urenRegistraties = urenRegistraties.filter(
        (ur) => ur.datum >= vanDatum && ur.datum <= totDatum
      );
    }

    // Haal projecten op voor efficiëntie berekening
    const projecten = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", companyUserId))
      .collect();

    const afgerondeProjecten = projecten.filter(
      (p) => p.status === "afgerond" || p.status === "nacalculatie_compleet" || p.status === "gefactureerd"
    );

    // Haal voorcalculaties op voor norm uren
    const voorcalculaties = await ctx.db.query("voorcalculaties").collect();

    // Bereken prestaties per medewerker
    const medewerkersMetPrestaties = medewerkers.map((medewerker) => {
      const medewerkerUren = urenRegistraties.filter(
        (ur) => ur.medewerker === medewerker.naam
      );

      const totaalUren = medewerkerUren.reduce((sum, ur) => sum + ur.uren, 0);
      const aantalProjecten = [...new Set(medewerkerUren.map((ur) => ur.projectId.toString()))].length;

      // Bereken efficiëntie ratio (werkelijke uren vs norm uren)
      let efficiëntieRatio: number | null = null;
      let totaalNormUren = 0;
      let totaalWerkelijkeUren = 0;

      const medewerkerProjectIds = [...new Set(medewerkerUren.map((ur) => ur.projectId.toString()))];

      for (const projectIdStr of medewerkerProjectIds) {
        const project = afgerondeProjecten.find((p) => p._id.toString() === projectIdStr);
        if (project) {
          const voorcalc = voorcalculaties.find(
            (vc) => vc.projectId?.toString() === projectIdStr || vc.offerteId?.toString() === project.offerteId.toString()
          );
          if (voorcalc) {
            // Proportioneel deel van norm uren (gebaseerd op bijdrage aan project)
            const projectUren = medewerkerUren
              .filter((ur) => ur.projectId.toString() === projectIdStr)
              .reduce((sum, ur) => sum + ur.uren, 0);

            const totaalProjectUren = urenRegistraties
              .filter((ur) => ur.projectId.toString() === projectIdStr)
              .reduce((sum, ur) => sum + ur.uren, 0);

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
 * - Admin: searches all medewerkers they own
 * - Medewerker: can only see their own profile if it matches
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
    const { role, linkedMedewerker, companyUserId } = await getUserRole(ctx);

    if (!role || !companyUserId) {
      return [];
    }

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

    // Medewerker role: can only see their own profile if it matches
    if (role === "medewerker" && linkedMedewerker) {
      // Check isActief filter
      if (args.alleenActief !== false && !linkedMedewerker.isActief) {
        return [];
      }

      if (matchesSpecialisatie(linkedMedewerker)) {
        const relevantSpec = linkedMedewerker.specialisaties?.find(
          (s) => s.scope.toLowerCase() === args.scope.toLowerCase()
        );
        return [{
          ...linkedMedewerker,
          relevanteSpecialisatie: relevantSpec,
        }];
      }
      return [];
    }

    // Admin role: search all medewerkers they own
    let medewerkers;
    if (args.alleenActief !== false) {
      medewerkers = await ctx.db
        .query("medewerkers")
        .withIndex("by_user_actief", (q) =>
          q.eq("userId", companyUserId).eq("isActief", true)
        )
        .collect();
    } else {
      medewerkers = await ctx.db
        .query("medewerkers")
        .withIndex("by_user", (q) => q.eq("userId", companyUserId))
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

/**
 * Update of voeg certificaat toe.
 * Only admin can manage certificates.
 */
export const updateCertificaat = mutation({
  args: {
    medewerkerId: v.id("medewerkers"),
    certificaat: certificaatValidator,
    actie: v.union(v.literal("toevoegen"), v.literal("bijwerken"), v.literal("verwijderen")),
    certificaatIndex: v.optional(v.number()), // Index voor bijwerken/verwijderen
  },
  handler: async (ctx, args) => {
    const { companyUserId } = await requireAdmin(ctx);

    const medewerker = await ctx.db.get(args.medewerkerId);
    if (!medewerker) {
      throw new Error("Medewerker niet gevonden");
    }
    if (medewerker.userId.toString() !== companyUserId.toString()) {
      throw new Error("Geen toegang tot deze medewerker");
    }

    const certificaten = medewerker.certificaten || [];

    switch (args.actie) {
      case "toevoegen":
        certificaten.push(args.certificaat);
        break;

      case "bijwerken":
        if (args.certificaatIndex === undefined || args.certificaatIndex < 0 || args.certificaatIndex >= certificaten.length) {
          throw new Error("Ongeldige certificaat index");
        }
        certificaten[args.certificaatIndex] = args.certificaat;
        break;

      case "verwijderen":
        if (args.certificaatIndex === undefined || args.certificaatIndex < 0 || args.certificaatIndex >= certificaten.length) {
          throw new Error("Ongeldige certificaat index");
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
 * - Admin: sees all expiring certificates for medewerkers they own
 * - Medewerker: sees only their own expiring certificates
 */
export const checkVervaldataCertificaten = query({
  args: {
    dagenVoorwaarschuwing: v.optional(v.number()), // Default: 30 dagen
  },
  handler: async (ctx, args) => {
    const { role, linkedMedewerker, companyUserId } = await getUserRole(ctx);

    if (!role || !companyUserId) {
      return [];
    }

    const waarschuwingsDagen = args.dagenVoorwaarschuwing || 30;
    const waarschuwingsDrempel = Date.now() + (waarschuwingsDagen * 24 * 60 * 60 * 1000);

    // Get medewerkers based on role
    let medewerkers: Doc<"medewerkers">[];
    if (role === "medewerker" && linkedMedewerker) {
      // Medewerker can only see their own certificates
      if (!linkedMedewerker.isActief) {
        return [];
      }
      medewerkers = [linkedMedewerker];
    } else {
      // Admin sees all active medewerkers they own
      medewerkers = await ctx.db
        .query("medewerkers")
        .withIndex("by_user_actief", (q) =>
          q.eq("userId", companyUserId).eq("isActief", true)
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
