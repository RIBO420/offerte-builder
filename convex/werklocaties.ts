/**
 * Werklocaties Functions - Job Site Management
 *
 * Provides CRUD operations for werklocaties (job sites) linked to projects.
 * Each project has at most one werklocatie (1:1 relationship).
 * Contains location details, access information, utilities, safety notes, and photos.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireAuthUserId, verifyOwnership } from "./auth";
import { Id } from "./_generated/dataModel";

// Foto type validator matching schema
const fotoValidator = v.object({
  url: v.string(),
  beschrijving: v.optional(v.string()),
  type: v.optional(
    v.union(v.literal("voor"), v.literal("tijdens"), v.literal("na"))
  ),
  createdAt: v.number(),
});

/**
 * Get a werklocatie and verify ownership.
 */
async function getOwnedWerklocatie(
  ctx: Parameters<typeof requireAuth>[0],
  werklocatieId: Id<"werklocaties">
) {
  const werklocatie = await ctx.db.get(werklocatieId);
  return verifyOwnership(ctx, werklocatie, "werklocatie");
}

/**
 * Get werklocatie info for a project.
 * Returns null if no werklocatie exists for this project.
 */
export const getByProject = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;
    if (project.userId.toString() !== userId.toString()) {
      return null;
    }

    // Get werklocatie for this project
    const werklocatie = await ctx.db
      .query("werklocaties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();

    return werklocatie;
  },
});

/**
 * Create werklocatie info for a project.
 * A project can only have one werklocatie (1:1 relationship).
 */
export const create = mutation({
  args: {
    projectId: v.id("projecten"),
    // Location details
    adres: v.string(),
    postcode: v.string(),
    plaats: v.string(),
    coordinates: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
      })
    ),
    // Access information
    toegangInstructies: v.optional(v.string()),
    parkeerInfo: v.optional(v.string()),
    sleutelInfo: v.optional(v.string()),
    contactOpLocatie: v.optional(
      v.object({
        naam: v.optional(v.string()),
        telefoon: v.optional(v.string()),
      })
    ),
    // Utilities
    waterAansluiting: v.optional(v.boolean()),
    stroomAansluiting: v.optional(v.boolean()),
    toiletBeschikbaar: v.optional(v.boolean()),
    // Safety
    veiligheidsNotities: v.optional(v.string()),
    bijzonderheden: v.optional(v.string()),
    // Photos
    fotos: v.optional(v.array(fotoValidator)),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project niet gevonden");
    }
    if (project.userId.toString() !== userId.toString()) {
      throw new Error("Je hebt geen toegang tot dit project");
    }

    // Check if werklocatie already exists for this project
    const existingWerklocatie = await ctx.db
      .query("werklocaties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();

    if (existingWerklocatie) {
      throw new Error(
        "Er bestaat al een werklocatie voor dit project. Gebruik update om deze aan te passen."
      );
    }

    // Create the werklocatie
    const werklocatieId = await ctx.db.insert("werklocaties", {
      userId,
      projectId: args.projectId,
      adres: args.adres,
      postcode: args.postcode,
      plaats: args.plaats,
      coordinates: args.coordinates,
      toegangInstructies: args.toegangInstructies,
      parkeerInfo: args.parkeerInfo,
      sleutelInfo: args.sleutelInfo,
      contactOpLocatie: args.contactOpLocatie,
      waterAansluiting: args.waterAansluiting,
      stroomAansluiting: args.stroomAansluiting,
      toiletBeschikbaar: args.toiletBeschikbaar,
      veiligheidsNotities: args.veiligheidsNotities,
      bijzonderheden: args.bijzonderheden,
      fotos: args.fotos,
      createdAt: now,
      updatedAt: now,
    });

    return werklocatieId;
  },
});

/**
 * Update werklocatie info.
 */
export const update = mutation({
  args: {
    id: v.id("werklocaties"),
    // Location details
    adres: v.optional(v.string()),
    postcode: v.optional(v.string()),
    plaats: v.optional(v.string()),
    coordinates: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
      })
    ),
    // Access information
    toegangInstructies: v.optional(v.string()),
    parkeerInfo: v.optional(v.string()),
    sleutelInfo: v.optional(v.string()),
    contactOpLocatie: v.optional(
      v.object({
        naam: v.optional(v.string()),
        telefoon: v.optional(v.string()),
      })
    ),
    // Utilities
    waterAansluiting: v.optional(v.boolean()),
    stroomAansluiting: v.optional(v.boolean()),
    toiletBeschikbaar: v.optional(v.boolean()),
    // Safety
    veiligheidsNotities: v.optional(v.string()),
    bijzonderheden: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify ownership
    await getOwnedWerklocatie(ctx, args.id);
    const now = Date.now();

    const { id, ...updates } = args;

    // Filter out undefined values
    const filteredUpdates: Record<string, unknown> = { updatedAt: now };
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    });

    await ctx.db.patch(args.id, filteredUpdates);

    return args.id;
  },
});

/**
 * Add a photo to the werklocatie.
 * Photos include URL, optional description, type (voor/tijdens/na), and timestamp.
 */
export const addFoto = mutation({
  args: {
    id: v.id("werklocaties"),
    url: v.string(),
    beschrijving: v.optional(v.string()),
    type: v.optional(
      v.union(v.literal("voor"), v.literal("tijdens"), v.literal("na"))
    ),
  },
  handler: async (ctx, args) => {
    // Verify ownership
    const werklocatie = await getOwnedWerklocatie(ctx, args.id);
    const now = Date.now();

    // Create the foto object
    const foto = {
      url: args.url,
      beschrijving: args.beschrijving,
      type: args.type,
      createdAt: now,
    };

    // Add the photo to the array
    const currentFotos = werklocatie.fotos ?? [];
    const updatedFotos = [...currentFotos, foto];

    await ctx.db.patch(args.id, {
      fotos: updatedFotos,
      updatedAt: now,
    });

    return args.id;
  },
});

/**
 * Remove a photo from the werklocatie by URL.
 */
export const removeFoto = mutation({
  args: {
    id: v.id("werklocaties"),
    fotoUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify ownership
    const werklocatie = await getOwnedWerklocatie(ctx, args.id);
    const now = Date.now();

    // Remove the photo from the array by URL
    const currentFotos = werklocatie.fotos ?? [];
    const updatedFotos = currentFotos.filter((foto) => foto.url !== args.fotoUrl);

    await ctx.db.patch(args.id, {
      fotos: updatedFotos,
      updatedAt: now,
    });

    return args.id;
  },
});

/**
 * Create werklocatie from offerte klantgegevens.
 * Helper function to auto-populate werklocatie data from the linked offerte.
 * Uses the offerte's klant address as the werklocatie address.
 */
export const createFromOfferte = mutation({
  args: {
    projectId: v.id("projecten"),
    // Optional overrides for the address (if werklocatie differs from klant address)
    adresOverride: v.optional(v.string()),
    postcodeOverride: v.optional(v.string()),
    plaatsOverride: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Get the project
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project niet gevonden");
    }
    if (project.userId.toString() !== userId.toString()) {
      throw new Error("Je hebt geen toegang tot dit project");
    }

    // Check if werklocatie already exists
    const existingWerklocatie = await ctx.db
      .query("werklocaties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();

    if (existingWerklocatie) {
      throw new Error(
        "Er bestaat al een werklocatie voor dit project. Gebruik update om deze aan te passen."
      );
    }

    // Get the offerte to access klant data
    const offerte = await ctx.db.get(project.offerteId);
    if (!offerte) {
      throw new Error("Offerte niet gevonden voor dit project");
    }

    // Use override values or fall back to offerte klant data
    const adres = args.adresOverride ?? offerte.klant.adres;
    const postcode = args.postcodeOverride ?? offerte.klant.postcode;
    const plaats = args.plaatsOverride ?? offerte.klant.plaats;

    // Create the werklocatie with data from offerte
    const werklocatieId = await ctx.db.insert("werklocaties", {
      userId,
      projectId: args.projectId,
      adres,
      postcode,
      plaats,
      // Contact info from offerte klant
      contactOpLocatie: {
        naam: offerte.klant.naam,
        telefoon: offerte.klant.telefoon,
      },
      createdAt: now,
      updatedAt: now,
    });

    return werklocatieId;
  },
});

/**
 * Delete a werklocatie.
 */
export const remove = mutation({
  args: { id: v.id("werklocaties") },
  handler: async (ctx, args) => {
    // Verify ownership
    await getOwnedWerklocatie(ctx, args.id);

    await ctx.db.delete(args.id);

    return args.id;
  },
});

/**
 * Get werklocatie with project details.
 * Useful for displaying werklocatie info with context.
 */
export const getWithProject = query({
  args: { id: v.id("werklocaties") },
  handler: async (ctx, args) => {
    const werklocatie = await ctx.db.get(args.id);
    if (!werklocatie) return null;

    // Verify ownership
    const user = await requireAuth(ctx);
    if (werklocatie.userId.toString() !== user._id.toString()) {
      return null;
    }

    // Get project
    const project = await ctx.db.get(werklocatie.projectId);
    if (!project) return null;

    // Get offerte for klant info
    const offerte = await ctx.db.get(project.offerteId);

    return {
      werklocatie,
      project,
      klantNaam: offerte?.klant?.naam ?? "Onbekende klant",
    };
  },
});

/**
 * List all werklocaties for the authenticated user.
 * Ordered by updatedAt descending (most recent first).
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    return await ctx.db
      .query("werklocaties")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});
