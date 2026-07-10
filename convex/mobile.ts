/**
 * Mobile App Backend Functions
 *
 * Provides API endpoints for the mobile employee app including:
 * - User profile and biometric settings
 * - Project details for medewerkers
 * - Admin user/role management
 */

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";
import { requireAdmin, normalizeRole } from "./roles";

// ============================================
// USER PROFILE
// ============================================

/**
 * Get the current user's profile for the mobile app.
 */
export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Get medewerker record
    const medewerker = await ctx.db
      .query("medewerkers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
      .first();

    if (!medewerker) {
      return {
        userId: user._id,
        naam: user.name,
        email: user.email,
        isMedewerker: false,
        medewerker: null,
      };
    }

    // Get company info
    const companyUser = await ctx.db.get(medewerker.userId);
    const instellingen = companyUser
      ? await ctx.db
          .query("instellingen")
          .withIndex("by_user", (q) => q.eq("userId", companyUser._id))
          .first()
      : null;

    return {
      userId: user._id,
      naam: medewerker.naam,
      email: medewerker.email || user.email,
      telefoon: medewerker.telefoon,
      functie: medewerker.functie,
      isMedewerker: true,
      medewerker: {
        _id: medewerker._id,
        naam: medewerker.naam,
        functie: medewerker.functie,
        specialisaties: medewerker.specialisaties,
        biometricEnabled: medewerker.biometricEnabled,
      },
      bedrijf: instellingen?.bedrijfsgegevens
        ? {
            naam: instellingen.bedrijfsgegevens.naam,
            logo: instellingen.bedrijfsgegevens.logo,
          }
        : null,
    };
  },
});

/**
 * Update biometric authentication setting.
 */
export const updateBiometricSetting = mutation({
  args: {
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Get medewerker record
    const medewerker = await ctx.db
      .query("medewerkers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
      .first();

    if (!medewerker) {
      throw new ConvexError("Medewerker profiel niet gevonden");
    }

    await ctx.db.patch(medewerker._id, {
      biometricEnabled: args.enabled,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get full project details for a medewerker (excluding prices).
 * Medewerkers can only access projects where they are assigned as a teamlid.
 * Returns all project data except financial fields (prices, costs, margins, etc.)
 */
export const getProjectDetailsForMedewerker = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Get medewerker record
    const medewerker = await ctx.db
      .query("medewerkers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
      .first();

    // Get the project
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new ConvexError("Project niet gevonden");
    }

    // Admin (directie) users can access all projects even without medewerker record
    const userIsAdmin = user.role === "directie";

    if (!medewerker && !userIsAdmin) {
      throw new ConvexError("Medewerker profiel niet gevonden");
    }

    // Verify project belongs to the medewerker's company (skip for admins who own the project)
    if (medewerker && medewerker.userId.toString() !== project.userId.toString()) {
      throw new ConvexError("Je hebt geen toegang tot dit project");
    }
    if (!medewerker && userIsAdmin && project.userId.toString() !== user._id.toString()) {
      throw new ConvexError("Je hebt geen toegang tot dit project");
    }

    // Get voorcalculatie to check team membership
    // First check project-level voorcalculatie
    let voorcalculatie = await ctx.db
      .query("voorcalculaties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first();

    // If not found, check offerte-level voorcalculatie
    if (!voorcalculatie) {
      voorcalculatie = await ctx.db
        .query("voorcalculaties")
        .withIndex("by_offerte", (q) => q.eq("offerteId", project.offerteId))
        .first();
    }

    // Check if medewerker is in the team (admins bypass team check)
    const teamleden = voorcalculatie?.teamleden ?? [];
    const isInTeam = medewerker ? teamleden.includes(medewerker.naam) : false;

    if (!isInTeam && !userIsAdmin) {
      throw new ConvexError("Je bent niet toegewezen aan dit project");
    }

    // Get offerte info (klant data only, no prices) — offerteId kan ontbreken bij losse werkitems
    const offerte = project.offerteId
      ? await ctx.db.get(project.offerteId)
      : null;
    const offerteInfo = offerte
      ? {
          offerteNummer: offerte.offerteNummer,
          type: offerte.type,
          status: offerte.status,
          klant: {
            naam: offerte.klant.naam,
            adres: offerte.klant.adres,
            postcode: offerte.klant.postcode,
            plaats: offerte.klant.plaats,
            telefoon: offerte.klant.telefoon,
          },
          algemeenParams: offerte.algemeenParams,
          scopes: offerte.scopes,
          notities: offerte.notities,
        }
      : null;

    // Get planning taken (tasks)
    const planningTaken = await ctx.db
      .query("planningTaken")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Sort tasks by volgorde
    const sortedTaken = planningTaken.sort((a, b) => a.volgorde - b.volgorde);

    // Get uren registraties for this medewerker
    const allUrenRegistraties = await ctx.db
      .query("urenRegistraties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Filter to this medewerker's hours (admins see all hours)
    const mijnUren = userIsAdmin && !medewerker
      ? allUrenRegistraties
      : allUrenRegistraties.filter(
          (u) =>
            u.medewerker === medewerker?.naam ||
            u.medewerkerClerkId === user.clerkId
        );

    // Calculate total hours for this medewerker
    const totaalUren = mijnUren.reduce((sum, u) => sum + u.uren, 0);

    // Voorcalculatie info (excluding any financial data, just scope and team info)
    const voorcalculatieInfo = voorcalculatie
      ? {
          teamGrootte: voorcalculatie.teamGrootte,
          teamleden: voorcalculatie.teamleden,
          effectieveUrenPerDag: voorcalculatie.effectieveUrenPerDag,
          normUrenTotaal: voorcalculatie.normUrenTotaal,
          geschatteDagen: voorcalculatie.geschatteDagen,
          normUrenPerScope: voorcalculatie.normUrenPerScope,
        }
      : null;

    // Return project details without financial data
    return {
      project: {
        _id: project._id,
        naam: project.naam,
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        isArchived: project.isArchived,
      },
      offerte: offerteInfo,
      voorcalculatie: voorcalculatieInfo,
      planningTaken: sortedTaken.map((t) => ({
        _id: t._id,
        scope: t.scope,
        taakNaam: t.taakNaam,
        normUren: t.normUren,
        geschatteDagen: t.geschatteDagen,
        volgorde: t.volgorde,
        status: t.status,
      })),
      mijnUrenRegistraties: mijnUren.map((u) => ({
        _id: u._id,
        datum: u.datum,
        uren: u.uren,
        taakId: u.taakId,
        scope: u.scope,
        notities: u.notities,
        bron: u.bron,
      })),
      totaalUren: Math.round(totaalUren * 100) / 100,
    };
  },
});

// ============================================
// ADMIN USER MANAGEMENT
// ============================================

/**
 * List all users (admin only).
 * Returns users with their roles and linked medewerkers.
 */
export const adminListAllUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    // Get all users
    const users = await ctx.db.query("users").collect();

    // Get all medewerkers for linking info
    const medewerkers = await ctx.db.query("medewerkers").collect();

    // Map users with medewerker info
    const usersWithMedewerkers = users.map((u) => {
      let linkedMedewerker = null;
      if (u.linkedMedewerkerId) {
        const med = medewerkers.find(
          (m) => m._id.toString() === u.linkedMedewerkerId?.toString()
        );
        if (med) {
          linkedMedewerker = {
            _id: med._id,
            naam: med.naam,
            functie: med.functie,
          };
        }
      }

      return {
        _id: u._id,
        email: u.email,
        name: u.name,
        role: normalizeRole(u.role),
        linkedMedewerkerId: u.linkedMedewerkerId,
        linkedMedewerker,
        createdAt: u.createdAt,
      };
    });

    return usersWithMedewerkers;
  },
});

/**
 * Get all medewerkers for linking (admin only).
 * Returns medewerkers that can be linked to users.
 */
export const adminListMedewerkers = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAdmin(ctx);

    // Get medewerkers owned by this admin
    const medewerkers = await ctx.db
      .query("medewerkers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Get users to check who is already linked
    const users = await ctx.db.query("users").collect();
    const linkedMedewerkerIds = new Set(
      users
        .filter((u) => u.linkedMedewerkerId)
        .map((u) => u.linkedMedewerkerId?.toString())
    );

    return medewerkers.map((m) => ({
      _id: m._id,
      naam: m.naam,
      email: m.email,
      functie: m.functie,
      isActief: m.isActief,
      isLinked: linkedMedewerkerIds.has(m._id.toString()),
    }));
  },
});

/**
 * Update a user's role (admin only).
 */
export const adminUpdateUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("directie"),
      v.literal("projectleider"),
      v.literal("voorman"),
      v.literal("medewerker"),
      v.literal("klant"),
      v.literal("onderaannemer_zzp"),
      v.literal("materiaalman"),
      // Legacy compat
      v.literal("admin"),
      v.literal("viewer")
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);

    // Prevent changing own role
    if (args.userId.toString() === user._id.toString()) {
      throw new ConvexError("Je kunt je eigen rol niet wijzigen");
    }

    // Normalize and update the user's role
    await ctx.db.patch(args.userId, {
      role: normalizeRole(args.role),
    });

    return { success: true };
  },
});

/**
 * Link a user to a medewerker (admin only).
 */
export const adminLinkUserToMedewerker = mutation({
  args: {
    userId: v.id("users"),
    medewerkerId: v.optional(v.id("medewerkers")),
  },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);

    // If linking (not unlinking), verify the medewerker exists and belongs to admin
    if (args.medewerkerId) {
      const medewerker = await ctx.db.get(args.medewerkerId);
      if (!medewerker) {
        throw new ConvexError("Medewerker niet gevonden");
      }
      if (medewerker.userId.toString() !== user._id.toString()) {
        throw new ConvexError("Je kunt alleen je eigen medewerkers koppelen");
      }

      // Check if medewerker is already linked to another user
      const existingLink = await ctx.db
        .query("users")
        .withIndex("by_linked_medewerker", (q) =>
          q.eq("linkedMedewerkerId", args.medewerkerId)
        )
        .first();

      if (existingLink && existingLink._id.toString() !== args.userId.toString()) {
        throw new ConvexError("Deze medewerker is al aan een andere gebruiker gekoppeld");
      }
    }

    // Update the user's linked medewerker
    await ctx.db.patch(args.userId, {
      linkedMedewerkerId: args.medewerkerId,
    });

    return { success: true };
  },
});
