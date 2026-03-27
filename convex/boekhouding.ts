/**
 * Boekhouding Functions — Bookkeeping integration module (MOD-014)
 *
 * Provides queries and mutations for managing connections to external
 * bookkeeping providers (Moneybird, Exact Online, Twinfield).
 *
 * NOTE: Actual API calls to external providers are NOT implemented here.
 * This file contains only the infrastructure (schema operations, sync logging,
 * status tracking). Real API integration will be added when provider
 * credentials are available.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireAuthUserId } from "./auth";
import { requireAdmin, requireNotViewer } from "./roles";

// ============================================
// VALIDATORS
// ============================================

const providerValidator = v.union(
  v.literal("moneybird"),
  v.literal("exact_online"),
  v.literal("twinfield"),
  v.literal("geen"),
);

const syncStatusValidator = v.union(
  v.literal("pending"),
  v.literal("syncing"),
  v.literal("synced"),
  v.literal("error"),
  v.literal("skipped"),
);

const syncRichtingValidator = v.union(
  v.literal("push"),
  v.literal("pull"),
  v.literal("bidirectioneel"),
);

// ============================================
// QUERIES
// ============================================

/**
 * Get current boekhouding settings for the authenticated user.
 * Masks sensitive fields (tokens) — returns only connection status info.
 */
export const getInstellingen = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const instellingen = await ctx.db
      .query("boekhoudInstellingen")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!instellingen) {
      return null;
    }

    // Mask sensitive fields — never expose tokens to the client
    return {
      _id: instellingen._id,
      provider: instellingen.provider,
      isActief: instellingen.isActief,
      autoSync: instellingen.autoSync,
      syncRichting: instellingen.syncRichting,
      externalBedrijfsId: instellingen.externalBedrijfsId,
      hasApiKey: !!instellingen.apiKey,
      hasAccessToken: !!instellingen.accessToken,
      hasRefreshToken: !!instellingen.refreshToken,
      grootboekMappings: instellingen.grootboekMappings,
      btwMappings: instellingen.btwMappings,
      laatsteSyncAt: instellingen.laatsteSyncAt,
      laatsteSyncStatus: instellingen.laatsteSyncStatus,
      createdAt: instellingen.createdAt,
      updatedAt: instellingen.updatedAt,
    };
  },
});

/**
 * Get sync status overview: counts of synced, pending, and error entries.
 */
export const getSyncOverview = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const allEntries = await ctx.db
      .query("boekhoudSync")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const synced = allEntries.filter((e) => e.syncStatus === "synced").length;
    const pending = allEntries.filter((e) => e.syncStatus === "pending" || e.syncStatus === "syncing").length;
    const errors = allEntries.filter((e) => e.syncStatus === "error").length;
    const skipped = allEntries.filter((e) => e.syncStatus === "skipped").length;

    return {
      totaal: allEntries.length,
      synced,
      pending,
      errors,
      skipped,
    };
  },
});

/**
 * Get sync log entries with pagination.
 * Returns most recent entries first.
 */
export const getSyncLog = query({
  args: {
    limit: v.optional(v.number()),
    entityType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const limit = args.limit ?? 20;

    let queryBuilder;

    if (args.entityType) {
      queryBuilder = ctx.db
        .query("boekhoudSync")
        .withIndex("by_entity_type", (q) =>
          q.eq("userId", user._id).eq("entityType", args.entityType as "factuur" | "creditnota" | "betaling" | "inkoopfactuur" | "contact")
        );
    } else {
      queryBuilder = ctx.db
        .query("boekhoudSync")
        .withIndex("by_user", (q) => q.eq("userId", user._id));
    }

    const entries = await queryBuilder
      .order("desc")
      .take(limit);

    // Enrich with factuur info where available
    const enrichedEntries = await Promise.all(
      entries.map(async (entry) => {
        let factuurNummer: string | undefined;
        let klantNaam: string | undefined;
        let bedrag: number | undefined;

        if (entry.factuurId) {
          const factuurId = entry.factuurId;
          const factuur = await ctx.db
            .query("facturen")
            .filter((q) => q.eq(q.field("_id"), factuurId))
            .first();
          if (factuur) {
            factuurNummer = factuur.factuurnummer;
            klantNaam = factuur.klant.naam;
            bedrag = factuur.totaalInclBtw;
          }
        }

        return {
          ...entry,
          factuurNummer,
          klantNaam,
          bedrag,
        };
      })
    );

    return enrichedEntries;
  },
});

/**
 * Get sync status for a specific factuur.
 */
export const getFactuurSyncStatus = query({
  args: {
    factuurId: v.id("facturen"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const factuur = await ctx.db.get(args.factuurId);
    if (!factuur) {
      return null;
    }

    // Get the latest sync entry for this factuur
    const syncEntry = await ctx.db
      .query("boekhoudSync")
      .withIndex("by_factuur", (q) => q.eq("factuurId", args.factuurId))
      .order("desc")
      .first();

    return {
      syncStatus: factuur.boekhoudSyncStatus ?? "not_synced",
      externalId: factuur.externalBookkeepingId,
      lastSyncAt: factuur.boekhoudSyncAt,
      syncEntry: syncEntry
        ? {
            _id: syncEntry._id,
            syncStatus: syncEntry.syncStatus,
            errorMessage: syncEntry.errorMessage,
            externalUrl: syncEntry.externalUrl,
            provider: syncEntry.provider,
            lastSyncAt: syncEntry.lastSyncAt,
            retryCount: syncEntry.retryCount,
          }
        : null,
    };
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Save or update boekhouding provider settings.
 * Only directie can manage boekhouding settings.
 */
export const saveInstellingen = mutation({
  args: {
    provider: providerValidator,
    apiKey: v.optional(v.string()),
    externalBedrijfsId: v.optional(v.string()),
    autoSync: v.boolean(),
    syncRichting: syncRichtingValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);

    const existing = await ctx.db
      .query("boekhoudInstellingen")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        provider: args.provider,
        ...(args.apiKey !== undefined && { apiKey: args.apiKey }),
        externalBedrijfsId: args.externalBedrijfsId,
        autoSync: args.autoSync,
        syncRichting: args.syncRichting,
        isActief: args.provider !== "geen",
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("boekhoudInstellingen", {
        userId: user._id,
        provider: args.provider,
        apiKey: args.apiKey,
        externalBedrijfsId: args.externalBedrijfsId,
        autoSync: args.autoSync,
        syncRichting: args.syncRichting,
        isActief: args.provider !== "geen",
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Disconnect from bookkeeping provider.
 * Clears credentials but preserves sync history (audit trail).
 */
export const disconnect = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAdmin(ctx);

    const existing = await ctx.db
      .query("boekhoudInstellingen")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!existing) {
      throw new ConvexError("Geen boekhoudkoppeling gevonden");
    }

    await ctx.db.patch(existing._id, {
      provider: "geen",
      apiKey: undefined,
      accessToken: undefined,
      refreshToken: undefined,
      tokenExpiresAt: undefined,
      externalBedrijfsId: undefined,
      isActief: false,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Mark a factuur for sync (sets status to pending).
 * Creates a sync log entry.
 */
export const markForSync = mutation({
  args: {
    factuurId: v.id("facturen"),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    const factuur = await ctx.db.get(args.factuurId);
    if (!factuur) {
      throw new ConvexError("Factuur niet gevonden");
    }
    if (factuur.userId !== userId) {
      throw new ConvexError("Geen toegang tot deze factuur");
    }

    // Check if boekhouding is configured
    const instellingen = await ctx.db
      .query("boekhoudInstellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!instellingen || !instellingen.isActief || instellingen.provider === "geen") {
      throw new ConvexError("Geen actieve boekhoudkoppeling. Configureer eerst een provider in Instellingen.");
    }

    const now = Date.now();

    // Update factuur sync status
    await ctx.db.patch(args.factuurId, {
      boekhoudSyncStatus: "pending",
      updatedAt: now,
    });

    // Create sync log entry
    await ctx.db.insert("boekhoudSync", {
      userId,
      factuurId: args.factuurId,
      entityType: "factuur",
      syncStatus: "pending",
      syncRichting: "push",
      provider: instellingen.provider,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update a sync log entry (used internally by sync actions).
 */
export const updateSyncEntry = mutation({
  args: {
    syncId: v.id("boekhoudSync"),
    syncStatus: syncStatusValidator,
    externalId: v.optional(v.string()),
    externalUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    retryCount: v.optional(v.number()),
    nextRetryAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    const syncEntry = await ctx.db.get(args.syncId);
    if (!syncEntry) {
      throw new ConvexError("Sync entry niet gevonden");
    }
    if (syncEntry.userId !== userId) {
      throw new ConvexError("Geen toegang tot deze sync entry");
    }

    const now = Date.now();

    // Update sync entry
    await ctx.db.patch(args.syncId, {
      syncStatus: args.syncStatus,
      ...(args.externalId !== undefined && { externalId: args.externalId }),
      ...(args.externalUrl !== undefined && { externalUrl: args.externalUrl }),
      ...(args.errorMessage !== undefined && { errorMessage: args.errorMessage }),
      ...(args.errorCode !== undefined && { errorCode: args.errorCode }),
      ...(args.retryCount !== undefined && { retryCount: args.retryCount }),
      ...(args.nextRetryAt !== undefined && { nextRetryAt: args.nextRetryAt }),
      lastSyncAt: now,
      ...(args.syncStatus === "synced" && { lastSuccessAt: now }),
      updatedAt: now,
    });

    // Also update the factuur sync status if this is a factuur sync
    if (syncEntry.factuurId) {
      const factuurSyncStatus = args.syncStatus === "synced"
        ? "synced" as const
        : args.syncStatus === "error"
          ? "error" as const
          : args.syncStatus === "pending" || args.syncStatus === "syncing"
            ? "pending" as const
            : "not_synced" as const;

      await ctx.db.patch(syncEntry.factuurId, {
        boekhoudSyncStatus: factuurSyncStatus,
        ...(args.externalId !== undefined && { externalBookkeepingId: args.externalId }),
        ...(args.syncStatus === "synced" && { boekhoudSyncAt: now }),
        updatedAt: now,
      });
    }

    // Update instellingen last sync status
    const instellingen = await ctx.db
      .query("boekhoudInstellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (instellingen) {
      await ctx.db.patch(instellingen._id, {
        laatsteSyncAt: now,
        laatsteSyncStatus: args.syncStatus === "synced"
          ? "success"
          : args.syncStatus === "error"
            ? "error"
            : undefined,
        updatedAt: now,
      });
    }
  },
});

/**
 * Save grootboek mappings.
 * Only directie can manage mappings.
 */
export const saveGrootboekMappings = mutation({
  args: {
    mappings: v.array(v.object({
      interneCategorie: v.string(),
      externGrootboekId: v.string(),
      externGrootboekNaam: v.string(),
      externGrootboekNummer: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);

    const existing = await ctx.db
      .query("boekhoudInstellingen")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!existing) {
      throw new ConvexError("Configureer eerst een boekhoudkoppeling");
    }

    await ctx.db.patch(existing._id, {
      grootboekMappings: args.mappings,
      updatedAt: Date.now(),
    });
  },
});
