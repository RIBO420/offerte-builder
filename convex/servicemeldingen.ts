/**
 * Servicemeldingen Functions — Garantiebeheer (MOD-010)
 *
 * CRUD operations for service reports (complaints/requests) from customers.
 * Supports kanban workflow: nieuw → in_behandeling → ingepland → afgehandeld.
 * Auto-detects if a melding falls under an active warranty.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireAuthUserId, verifyOwnership } from "./auth";
import { requireNotViewer } from "./roles";
import { Id } from "./_generated/dataModel";

// Status validator
const statusValidator = v.union(
  v.literal("nieuw"),
  v.literal("in_behandeling"),
  v.literal("ingepland"),
  v.literal("afgehandeld")
);

const prioriteitValidator = v.union(
  v.literal("laag"),
  v.literal("normaal"),
  v.literal("hoog"),
  v.literal("urgent")
);

// ============================================
// QUERIES
// ============================================

/**
 * List all meldingen with optional filters.
 */
export const list = query({
  args: {
    status: v.optional(statusValidator),
    klantId: v.optional(v.id("klanten")),
    prioriteit: v.optional(prioriteitValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    let meldingen;
    if (args.status) {
      meldingen = await ctx.db
        .query("servicemeldingen")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", user._id).eq("status", args.status!)
        )
        .collect();
    } else {
      meldingen = await ctx.db
        .query("servicemeldingen")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
    }

    // Filter soft-deleted
    let result = meldingen.filter((m) => !m.deletedAt);

    // Apply additional filters
    if (args.klantId) {
      result = result.filter(
        (m) => m.klantId.toString() === args.klantId!.toString()
      );
    }
    if (args.prioriteit) {
      result = result.filter((m) => m.prioriteit === args.prioriteit);
    }

    // Enrich with klant and project data
    const enriched = await Promise.all(
      result.map(async (m) => {
        const klant = await ctx.db.get(m.klantId);
        const project = m.projectId ? await ctx.db.get(m.projectId) : null;
        return {
          ...m,
          klantNaam: klant?.naam ?? "Onbekend",
          projectNaam: project?.naam ?? null,
        };
      })
    );

    return enriched;
  },
});

/**
 * Get a single melding by ID with all related data.
 */
export const getById = query({
  args: { id: v.id("servicemeldingen") },
  handler: async (ctx, args) => {
    const melding = await ctx.db.get(args.id);
    if (!melding) return null;

    await verifyOwnership(ctx, melding, "servicemelding");

    const klant = await ctx.db.get(melding.klantId);
    const project = melding.projectId
      ? await ctx.db.get(melding.projectId)
      : null;
    const garantie = melding.garantieId
      ? await ctx.db.get(melding.garantieId)
      : null;

    // Get service afspraken
    const afspraken = await ctx.db
      .query("serviceAfspraken")
      .withIndex("by_melding", (q) => q.eq("meldingId", args.id))
      .collect();

    // Enrich afspraken with medewerker names
    const enrichedAfspraken = await Promise.all(
      afspraken.map(async (a) => {
        const medewerkerNames = await Promise.all(
          a.medewerkerIds.map(async (id) => {
            const med = await ctx.db.get(id);
            return med?.naam ?? "Onbekend";
          })
        );
        return {
          ...a,
          medewerkerNamen: medewerkerNames,
        };
      })
    );

    return {
      ...melding,
      klantNaam: klant?.naam ?? "Onbekend",
      klantAdres: klant
        ? `${klant.adres}, ${klant.postcode} ${klant.plaats}`
        : "",
      klantEmail: klant?.email ?? "",
      klantTelefoon: klant?.telefoon ?? "",
      projectNaam: project?.naam ?? null,
      projectStatus: project?.status ?? null,
      garantieStatus: garantie?.status ?? null,
      garantieEindDatum: garantie?.eindDatum ?? null,
      afspraken: enrichedAfspraken,
    };
  },
});

/**
 * Get meldingen for a specific klant.
 */
export const getByKlant = query({
  args: { klantId: v.id("klanten") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const meldingen = await ctx.db
      .query("servicemeldingen")
      .withIndex("by_klant", (q) => q.eq("klantId", args.klantId))
      .collect();

    return meldingen.filter((m) => !m.deletedAt);
  },
});

/**
 * Get meldingen for a specific project.
 */
export const getByProject = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const meldingen = await ctx.db
      .query("servicemeldingen")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return meldingen.filter((m) => !m.deletedAt);
  },
});

/**
 * Get meldingen grouped by status for kanban board.
 */
export const getKanbanData = query({
  args: {
    klantId: v.optional(v.id("klanten")),
    prioriteit: v.optional(prioriteitValidator),
    isGarantie: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const allMeldingen = await ctx.db
      .query("servicemeldingen")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    let filtered = allMeldingen.filter((m) => !m.deletedAt);

    // Apply filters
    if (args.klantId) {
      filtered = filtered.filter(
        (m) => m.klantId.toString() === args.klantId!.toString()
      );
    }
    if (args.prioriteit) {
      filtered = filtered.filter((m) => m.prioriteit === args.prioriteit);
    }
    if (args.isGarantie !== undefined) {
      filtered = filtered.filter((m) => m.isGarantie === args.isGarantie);
    }

    // Enrich with klant names
    const enriched = await Promise.all(
      filtered.map(async (m) => {
        const klant = await ctx.db.get(m.klantId);
        return {
          ...m,
          klantNaam: klant?.naam ?? "Onbekend",
        };
      })
    );

    // Group by status
    const kanban = {
      nieuw: enriched.filter((m) => m.status === "nieuw"),
      in_behandeling: enriched.filter((m) => m.status === "in_behandeling"),
      ingepland: enriched.filter((m) => m.status === "ingepland"),
      afgehandeld: enriched.filter((m) => m.status === "afgehandeld"),
    };

    return kanban;
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Create a new servicemelding.
 * Auto-detects if the related project has an active garantie.
 */
export const create = mutation({
  args: {
    klantId: v.id("klanten"),
    projectId: v.optional(v.id("projecten")),
    beschrijving: v.string(),
    prioriteit: prioriteitValidator,
    fotos: v.optional(v.array(v.string())),
    contactInfo: v.optional(v.string()),
    kosten: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Auto-detect garantie if a project is provided
    let detectedGarantieId: Id<"garanties"> | undefined = undefined;
    let isGarantie = false;

    if (args.projectId) {
      const garantie = await ctx.db
        .query("garanties")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId!))
        .first();

      if (garantie && garantie.status === "actief" && !garantie.deletedAt) {
        const todayStr = new Date().toISOString().split("T")[0];
        if (garantie.eindDatum >= todayStr) {
          detectedGarantieId = garantie._id;
          isGarantie = true;
        }
      }
    }

    const id = await ctx.db.insert("servicemeldingen", {
      userId,
      klantId: args.klantId,
      projectId: args.projectId,
      garantieId: detectedGarantieId,
      beschrijving: args.beschrijving,
      isGarantie,
      status: "nieuw",
      prioriteit: args.prioriteit,
      fotos: args.fotos,
      contactInfo: args.contactInfo,
      kosten: isGarantie ? 0 : (args.kosten ?? 0),
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

/**
 * Update melding status (for kanban drag-and-drop / workflow).
 */
export const updateStatus = mutation({
  args: {
    id: v.id("servicemeldingen"),
    status: statusValidator,
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);

    const melding = await ctx.db.get(args.id);
    await verifyOwnership(ctx, melding, "servicemelding");

    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

/**
 * Update melding details.
 */
export const update = mutation({
  args: {
    id: v.id("servicemeldingen"),
    beschrijving: v.optional(v.string()),
    prioriteit: v.optional(prioriteitValidator),
    isGarantie: v.optional(v.boolean()),
    kosten: v.optional(v.number()),
    contactInfo: v.optional(v.string()),
    fotos: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);

    const melding = await ctx.db.get(args.id);
    await verifyOwnership(ctx, melding, "servicemelding");

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.beschrijving !== undefined) updates.beschrijving = args.beschrijving;
    if (args.prioriteit !== undefined) updates.prioriteit = args.prioriteit;
    if (args.isGarantie !== undefined) {
      updates.isGarantie = args.isGarantie;
      if (args.isGarantie) updates.kosten = 0;
    }
    if (args.kosten !== undefined) updates.kosten = args.kosten;
    if (args.contactInfo !== undefined) updates.contactInfo = args.contactInfo;
    if (args.fotos !== undefined) updates.fotos = args.fotos;

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

/**
 * Add a service appointment to a melding.
 */
export const addAfspraak = mutation({
  args: {
    meldingId: v.id("servicemeldingen"),
    datum: v.string(),
    medewerkerIds: v.array(v.id("medewerkers")),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    const melding = await ctx.db.get(args.meldingId);
    await verifyOwnership(ctx, melding, "servicemelding");

    const now = Date.now();

    const afspraakId = await ctx.db.insert("serviceAfspraken", {
      meldingId: args.meldingId,
      userId,
      datum: args.datum,
      medewerkerIds: args.medewerkerIds,
      notities: args.notities,
      status: "gepland",
      createdAt: now,
      updatedAt: now,
    });

    // Update melding status to "ingepland"
    await ctx.db.patch(args.meldingId, {
      status: "ingepland",
      updatedAt: now,
    });

    return afspraakId;
  },
});

/**
 * Update an existing service appointment.
 */
export const updateAfspraak = mutation({
  args: {
    afspraakId: v.id("serviceAfspraken"),
    datum: v.optional(v.string()),
    medewerkerIds: v.optional(v.array(v.id("medewerkers"))),
    notities: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("gepland"),
        v.literal("uitgevoerd"),
        v.literal("geannuleerd")
      )
    ),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);

    const afspraak = await ctx.db.get(args.afspraakId);
    if (!afspraak) {
      throw new ConvexError("Afspraak niet gevonden");
    }

    await verifyOwnership(ctx, afspraak, "serviceafspraak");

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.datum !== undefined) updates.datum = args.datum;
    if (args.medewerkerIds !== undefined) updates.medewerkerIds = args.medewerkerIds;
    if (args.notities !== undefined) updates.notities = args.notities;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.afspraakId, updates);

    // If afspraak is marked as uitgevoerd, update melding to afgehandeld
    if (args.status === "uitgevoerd") {
      await ctx.db.patch(afspraak.meldingId, {
        status: "afgehandeld",
        updatedAt: Date.now(),
      });
    }

    return args.afspraakId;
  },
});
