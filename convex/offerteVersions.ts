import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireAuth, getOwnedOfferte } from "./auth";
import { requireNotViewer } from "./roles";

// Get all versions for an offerte
export const listByOfferte = query({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
    // Verify the offerte belongs to the authenticated user
    await getOwnedOfferte(ctx, args.offerteId);

    return await ctx.db
      .query("offerte_versions")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.offerteId))
      .order("desc")
      .collect();
  },
});

// Get a specific version
export const get = query({
  args: { id: v.id("offerte_versions") },
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.id);
    if (!version) {
      throw new ConvexError("Version not found");
    }

    // Verify the parent offerte belongs to the authenticated user
    await getOwnedOfferte(ctx, version.offerteId);

    return version;
  },
});

// Get the latest version number for an offerte
export const getLatestVersionNumber = query({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
    // Verify the offerte belongs to the authenticated user
    await getOwnedOfferte(ctx, args.offerteId);

    const versions = await ctx.db
      .query("offerte_versions")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.offerteId))
      .order("desc")
      .take(1);

    return versions[0]?.versieNummer ?? 0;
  },
});

// Create a new version snapshot
export const createVersion = mutation({
  args: {
    offerteId: v.id("offertes"),
    actie: v.union(
      v.literal("aangemaakt"),
      v.literal("gewijzigd"),
      v.literal("status_gewijzigd"),
      v.literal("regels_gewijzigd"),
      v.literal("teruggedraaid"),
      v.literal("nieuwe_versie")
    ),
    omschrijving: v.string(),
  },
  handler: async (ctx, args) => {
    // Derive userId from auth context instead of accepting from client
    const user = await requireNotViewer(ctx);

    // Get the current offerte and verify ownership
    const offerte = await getOwnedOfferte(ctx, args.offerteId);

    // Get next version number
    const versions = await ctx.db
      .query("offerte_versions")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.offerteId))
      .order("desc")
      .take(1);

    const versieNummer = (versions[0]?.versieNummer ?? 0) + 1;

    // Create snapshot
    const snapshot = {
      status: offerte.status,
      klant: offerte.klant,
      algemeenParams: {
        bereikbaarheid: offerte.algemeenParams.bereikbaarheid,
        achterstalligheid: offerte.algemeenParams.achterstalligheid,
      },
      scopes: offerte.scopes,
      scopeData: offerte.scopeData,
      totalen: offerte.totalen,
      regels: offerte.regels.map((r) => ({
        id: r.id,
        scope: r.scope,
        omschrijving: r.omschrijving,
        eenheid: r.eenheid,
        hoeveelheid: r.hoeveelheid,
        prijsPerEenheid: r.prijsPerEenheid,
        totaal: r.totaal,
        type: r.type,
      })),
      notities: offerte.notities,
    };

    return await ctx.db.insert("offerte_versions", {
      offerteId: args.offerteId,
      userId: user._id,
      versieNummer,
      snapshot,
      actie: args.actie,
      omschrijving: args.omschrijving,
      createdAt: Date.now(),
    });
  },
});

// Rollback to a previous version
export const rollback = mutation({
  args: {
    versionId: v.id("offerte_versions"),
  },
  handler: async (ctx, args) => {
    // Derive userId from auth context
    const user = await requireNotViewer(ctx);

    // Get the version to restore
    const version = await ctx.db.get(args.versionId);
    if (!version) {
      throw new ConvexError("Version not found");
    }

    // Verify the offerte belongs to the authenticated user
    const offerte = await getOwnedOfferte(ctx, version.offerteId);

    // First create a version snapshot of current state before rollback
    const currentVersions = await ctx.db
      .query("offerte_versions")
      .withIndex("by_offerte", (q) => q.eq("offerteId", version.offerteId))
      .order("desc")
      .take(1);

    const newVersieNummer = (currentVersions[0]?.versieNummer ?? 0) + 1;

    // Create snapshot of current state
    const currentSnapshot = {
      status: offerte.status,
      klant: offerte.klant,
      algemeenParams: {
        bereikbaarheid: offerte.algemeenParams.bereikbaarheid,
        achterstalligheid: offerte.algemeenParams.achterstalligheid,
      },
      scopes: offerte.scopes,
      scopeData: offerte.scopeData,
      totalen: offerte.totalen,
      regels: offerte.regels.map((r) => ({
        id: r.id,
        scope: r.scope,
        omschrijving: r.omschrijving,
        eenheid: r.eenheid,
        hoeveelheid: r.hoeveelheid,
        prijsPerEenheid: r.prijsPerEenheid,
        totaal: r.totaal,
        type: r.type,
      })),
      notities: offerte.notities,
    };

    // Save current state as new version (before rollback)
    await ctx.db.insert("offerte_versions", {
      offerteId: version.offerteId,
      userId: user._id,
      versieNummer: newVersieNummer,
      snapshot: currentSnapshot,
      actie: "teruggedraaid",
      omschrijving: `Teruggedraaid naar versie ${version.versieNummer}`,
      createdAt: Date.now(),
    });

    // Apply the old version to the offerte
    const snapshot = version.snapshot;
    await ctx.db.patch(version.offerteId, {
      status: snapshot.status as
        | "concept"
        | "voorcalculatie"
        | "verzonden"
        | "geaccepteerd"
        | "afgewezen",
      klant: snapshot.klant,
      algemeenParams: {
        bereikbaarheid: snapshot.algemeenParams.bereikbaarheid as
          | "goed"
          | "beperkt"
          | "slecht",
        achterstalligheid: snapshot.algemeenParams.achterstalligheid as
          | "laag"
          | "gemiddeld"
          | "hoog"
          | undefined,
      },
      scopes: snapshot.scopes,
      scopeData: snapshot.scopeData,
      totalen: snapshot.totalen,
      regels: snapshot.regels.map((r) => ({
        ...r,
        type: r.type as "materiaal" | "arbeid" | "machine",
      })),
      notities: snapshot.notities,
      updatedAt: Date.now(),
    });

    return version.offerteId;
  },
});

// Compare two versions
export const compareVersions = query({
  args: {
    versionId1: v.id("offerte_versions"),
    versionId2: v.id("offerte_versions"),
  },
  handler: async (ctx, args) => {
    const [version1, version2] = await Promise.all([
      ctx.db.get(args.versionId1),
      ctx.db.get(args.versionId2),
    ]);

    if (!version1 || !version2) {
      throw new ConvexError("Version not found");
    }

    // Verify ownership of the parent offerte(s)
    await getOwnedOfferte(ctx, version1.offerteId);
    if (version1.offerteId !== version2.offerteId) {
      await getOwnedOfferte(ctx, version2.offerteId);
    }

    return {
      version1,
      version2,
    };
  },
});
