import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Get all versions for an offerte
export const listByOfferte = query({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
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
    return await ctx.db.get(args.id);
  },
});

// Get the latest version number for an offerte
export const getLatestVersionNumber = query({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
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
    userId: v.id("users"),
    actie: v.union(
      v.literal("aangemaakt"),
      v.literal("gewijzigd"),
      v.literal("status_gewijzigd"),
      v.literal("regels_gewijzigd"),
      v.literal("teruggedraaid")
    ),
    omschrijving: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the current offerte
    const offerte = await ctx.db.get(args.offerteId);
    if (!offerte) {
      throw new Error("Offerte not found");
    }

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
      userId: args.userId,
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
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get the version to restore
    const version = await ctx.db.get(args.versionId);
    if (!version) {
      throw new Error("Version not found");
    }

    // Get the offerte
    const offerte = await ctx.db.get(version.offerteId);
    if (!offerte) {
      throw new Error("Offerte not found");
    }

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
      userId: args.userId,
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
        | "definitief"
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
      throw new Error("Version not found");
    }

    return {
      version1,
      version2,
    };
  },
});
