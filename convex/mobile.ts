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
import { requireAuth, requireOrgContext, requireOrgId } from "./auth";
import {
  requireAdmin,
  normalizeRole,
  getLinkedMedewerker,
  vereisUserBinnenOrg,
} from "./roles";
import type { Doc } from "./_generated/dataModel";
import { klantNaam, klantVeld } from "./lib/offerteKlant";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { voorcalculatieVanProject, voorcalculatieVanOfferte } from "./lib/voorcalculatieLookup";

/**
 * Zoek het medewerker-record van de ingelogde gebruiker.
 *
 * Twee routes, in deze volgorde:
 *  1. users.linkedMedewerkerId — de bron van waarheid.
 *  2. medewerkers.clerkUserId  — legacy pad, blijft werken voor records die nog niet
 *     via de koppelmutatie zijn aangemaakt.
 *
 * Voorheen gebruikte dit bestand uitsluitend route 2, terwijl urenSegmenten.ts route 1
 * gebruikt. Bij een record waar beide velden niet naar dezelfde gebruiker wijzen faalde
 * telkens één van de twee. Zie docs/MOBILE-AUDIT.md (B1/B2).
 */
async function vindEigenMedewerker(
  ctx: QueryCtx | MutationCtx,
  clerkId: string
): Promise<Doc<"medewerkers"> | null> {
  const viaKoppeling = await getLinkedMedewerker(ctx);
  if (viaKoppeling) return viaKoppeling;

  return await ctx.db
    .query("medewerkers")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkId))
    .first();
}

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
    const medewerker = await vindEigenMedewerker(ctx, user.clerkId);

    if (!medewerker) {
      return {
        userId: user._id,
        naam: user.name,
        email: user.email,
        isMedewerker: false,
        medewerker: null,
      };
    }

    // Bedrijfsgegevens van de ORGANISATIE van de medewerker. Guard vóór de
    // index-q.eq (CLAUDE.md regel 4): een medewerker van vóór de migratie
    // heeft nog geen orgId, en q.eq(undefined) zou de instellingen van elke
    // org-loze tenant matchen.
    const orgId = medewerker.orgId;
    const instellingen = orgId
      ? await ctx.db
          .query("instellingen")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
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

    const medewerker = await vindEigenMedewerker(ctx, user.clerkId);

    // Geen medewerkerprofiel is een legitieme toestand (bijv. een directie-account
    // zonder eigen veldprofiel). Dat is geen fout: gooien zorgde ervoor dat de app
    // "Kon biometrie instelling niet wijzigen" toonde terwijl er niets stuk was.
    if (!medewerker) {
      return { success: false as const, reason: "geen_medewerkerprofiel" as const };
    }

    await ctx.db.patch(medewerker._id, {
      biometricEnabled: args.enabled,
      updatedAt: Date.now(),
    });

    return { success: true as const, reason: null };
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
    const { org, user } = await requireOrgContext(ctx);

    // Get medewerker record
    const medewerker = await vindEigenMedewerker(ctx, user.clerkId);

    // Get the project
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new ConvexError("Project niet gevonden");
    }

    // Admin (directie) users can access all projects even without medewerker record
    const userIsAdmin = normalizeRole(user.role) === "directie";

    if (!medewerker && !userIsAdmin) {
      throw new ConvexError("Medewerker profiel niet gevonden");
    }

    // Tenantgrens: het project moet bij de organisatie uit het JWT horen.
    // Voorheen liep dit langs medewerker.userId vs project.userId — twee
    // eigenaarsvelden die na de org-migratie niets meer over de tenant zeggen.
    if (project.orgId !== org._id) {
      throw new ConvexError("Je hebt geen toegang tot dit project");
    }

    // Get voorcalculatie to check team membership
    // First check project-level voorcalculatie
    let voorcalculatie = await voorcalculatieVanProject(ctx, args.projectId);

    // If not found, check offerte-level voorcalculatie
    if (!voorcalculatie) {
      voorcalculatie = await voorcalculatieVanOfferte(ctx, project.offerteId);
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
            naam: klantNaam(offerte.klant),
            adres: klantVeld(offerte.klant, "adres"),
            postcode: klantVeld(offerte.klant, "postcode"),
            plaats: klantVeld(offerte.klant, "plaats"),
            telefoon: offerte.klant?.telefoon,
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
 *
 * ORG-SCOPING (zelfde besluit als users.listUsersWithDetails): de users-tabel
 * heeft nog géén orgId — dat komt pas in fase 6. Tot dan is de zichtbare set:
 *  - accounts die via `linkedMedewerkerId` aan een medewerker van DEZE
 *    organisatie hangen, plus
 *  - accounts zonder koppeling die géén klant zijn (nodig om een vers
 *    aangemaakt account te kunnen koppelen — anders is het onzichtbaar).
 * Klant-accounts van andere tenants en medewerkers van andere tenants vallen
 * er zo uit.
 */
export const adminListAllUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const orgId = await requireOrgId(ctx);

    // Get all users
    const users = await ctx.db.query("users").collect();

    // Medewerkers van DEZE organisatie (was: de hele tabel)
    const medewerkers = await ctx.db
      .query("medewerkers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const medewerkerById = new Map(
      medewerkers.map((m) => [m._id.toString(), m])
    );

    // Map users with medewerker info
    const usersWithMedewerkers = users.flatMap((u) => {
      const med = u.linkedMedewerkerId
        ? medewerkerById.get(u.linkedMedewerkerId.toString())
        : undefined;

      if (u.linkedMedewerkerId && !med) {
        // Gekoppeld aan een medewerker van een andere organisatie
        return [];
      }
      if (!u.linkedMedewerkerId && normalizeRole(u.role) === "klant") {
        // Ongekoppelde klantaccounts horen bij een portaal, niet bij dit scherm
        return [];
      }

      return [
        {
          _id: u._id,
          email: u.email,
          name: u.name,
          role: normalizeRole(u.role),
          linkedMedewerkerId: u.linkedMedewerkerId,
          linkedMedewerker: med
            ? { _id: med._id, naam: med.naam, functie: med.functie }
            : null,
          createdAt: u.createdAt,
        },
      ];
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
    await requireAdmin(ctx);
    const orgId = await requireOrgId(ctx);

    // Medewerkers van deze organisatie
    const medewerkers = await ctx.db
      .query("medewerkers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
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
    // Tenantgrens: zonder deze check patcht directie van organisatie A de rol
    // van een gebruiker van B (spiegel van users.updateUserRole).
    await vereisUserBinnenOrg(ctx, args.userId);

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
    await requireAdmin(ctx);
    const orgId = await requireOrgId(ctx);

    // Tenantgrens vóór álles: het ontkoppel-pad hieronder wist `clerkUserId`
    // op de oude medewerker en zet de gebruiker op rol "klant" — dat mag nooit
    // op een account van een andere organisatie.
    const targetUser = await vereisUserBinnenOrg(ctx, args.userId);

    // Maak een eventuele vorige koppeling los, anders blijft clerkUserId achter op het
    // oude medewerker-record en vindt vindEigenMedewerker straks de verkeerde persoon.
    if (
      targetUser.linkedMedewerkerId &&
      targetUser.linkedMedewerkerId !== args.medewerkerId
    ) {
      const oudeMedewerker = await ctx.db.get(targetUser.linkedMedewerkerId);
      if (oudeMedewerker) {
        await ctx.db.patch(oudeMedewerker._id, { clerkUserId: undefined });
      }
    }

    // If linking (not unlinking), verify the medewerker exists and belongs to
    // the admin's ORGANISATION (was: aan de admin-user zelf)
    if (args.medewerkerId) {
      const medewerker = await ctx.db.get(args.medewerkerId);
      if (!medewerker) {
        throw new ConvexError("Medewerker niet gevonden");
      }
      if (medewerker.orgId !== orgId) {
        throw new ConvexError(
          "Je kunt alleen medewerkers van je eigen organisatie koppelen"
        );
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

      // Zet clerkUserId op het medewerker-record, gelijk aan users.linkKlantAccount.
      await ctx.db.patch(args.medewerkerId, { clerkUserId: targetUser.clerkId });

      // De rol blijft ongemoeid: sinds de org-migratie leidt de tenant niet
      // meer uit de rol af (dat deed getCompanyUserId), dus een directie- of
      // projectleider-account dat óók een veldprofiel krijgt hoeft niet meer
      // naar "medewerker" gedegradeerd te worden. Alleen een klant-account
      // moet mee, anders blijft het in de portaal-routing hangen.
      await ctx.db.patch(args.userId, {
        linkedMedewerkerId: args.medewerkerId,
        ...(normalizeRole(targetUser.role) === "klant"
          ? { role: "medewerker" as const }
          : {}),
      });
    } else {
      await ctx.db.patch(args.userId, {
        linkedMedewerkerId: undefined,
        role: "klant" as const,
      });
    }

    return { success: true };
  },
});
