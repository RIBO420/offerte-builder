import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

/**
 * Search voertuigen by kenteken, merk, model, or type.
 */
export const search = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const searchTerm = args.searchTerm.toLowerCase().trim();

    // Get all voertuigen for the user
    const voertuigen = await ctx.db
      .query("voertuigen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // If no search term, return recent voertuigen
    if (!searchTerm) {
      return voertuigen.slice(0, 10);
    }

    // Filter voertuigen by search term
    const matchingVoertuigen = voertuigen.filter((voertuig) => {
      // Search by kenteken
      if (voertuig.kenteken.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search by merk
      if (voertuig.merk.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search by model
      if (voertuig.model.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search by type
      if (voertuig.type.toLowerCase().includes(searchTerm)) {
        return true;
      }

      return false;
    });

    return matchingVoertuigen.slice(0, 20);
  },
});

// Haal alle voertuigen op voor de ingelogde gebruiker
// Optionele filter op status
export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("actief"),
        v.literal("inactief"),
        v.literal("onderhoud")
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Als status filter meegegeven, gebruik de samengestelde index
    if (args.status !== undefined) {
      return await ctx.db
        .query("voertuigen")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", userId).eq("status", args.status!)
        )
        .collect();
    }

    // Anders haal alle voertuigen op
    return await ctx.db
      .query("voertuigen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

/**
 * List voertuigen with pagination.
 * Returns paginated results with total count for pagination UI.
 */
export const listPaginated = query({
  args: {
    page: v.number(),
    limit: v.number(),
    status: v.optional(
      v.union(
        v.literal("actief"),
        v.literal("inactief"),
        v.literal("onderhoud")
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Get all voertuigen
    let allVoertuigen = await ctx.db
      .query("voertuigen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter by status if provided
    if (args.status) {
      allVoertuigen = allVoertuigen.filter((v) => v.status === args.status);
    }

    const totalCount = allVoertuigen.length;
    const totalPages = Math.ceil(totalCount / args.limit);

    // Calculate pagination slice
    const startIndex = (args.page - 1) * args.limit;
    const endIndex = startIndex + args.limit;
    const items = allVoertuigen.slice(startIndex, endIndex);

    return {
      items,
      totalCount,
      totalPages,
      page: args.page,
      limit: args.limit,
    };
  },
});

// Haal een enkel voertuig op (met eigenaarschap verificatie)
export const get = query({
  args: { id: v.id("voertuigen") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const voertuig = await ctx.db.get(args.id);

    if (!voertuig) return null;
    if (voertuig.userId.toString() !== userId.toString()) {
      return null;
    }

    return voertuig;
  },
});

// Haal alleen actieve voertuigen op (voor dropdowns/selecties)
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("voertuigen")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "actief")
      )
      .collect();
  },
});

// Zoek voertuig op kenteken
export const getByKenteken = query({
  args: { kenteken: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const voertuig = await ctx.db
      .query("voertuigen")
      .withIndex("by_kenteken", (q) => q.eq("kenteken", args.kenteken))
      .first();

    if (!voertuig) return null;
    // Verifieer eigenaarschap
    if (voertuig.userId.toString() !== userId.toString()) {
      return null;
    }

    return voertuig;
  },
});

// Maak een nieuw voertuig aan
export const create = mutation({
  args: {
    kenteken: v.string(),
    merk: v.string(),
    model: v.string(),
    type: v.string(),
    bouwjaar: v.optional(v.number()),
    kleur: v.optional(v.string()),
    fleetgoId: v.optional(v.string()),
    fleetgoData: v.optional(v.any()),
    kmStand: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("actief"),
        v.literal("inactief"),
        v.literal("onderhoud")
      )
    ),
    notities: v.optional(v.string()),
    // Verzekering en APK gegevens
    apkVervaldatum: v.optional(v.number()),
    verzekeringsVervaldatum: v.optional(v.number()),
    verzekeraar: v.optional(v.string()),
    polisnummer: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    return await ctx.db.insert("voertuigen", {
      userId,
      kenteken: args.kenteken,
      merk: args.merk,
      model: args.model,
      type: args.type,
      bouwjaar: args.bouwjaar,
      kleur: args.kleur,
      fleetgoId: args.fleetgoId,
      fleetgoData: args.fleetgoData,
      kmStand: args.kmStand,
      status: args.status ?? "actief",
      notities: args.notities,
      apkVervaldatum: args.apkVervaldatum,
      verzekeringsVervaldatum: args.verzekeringsVervaldatum,
      verzekeraar: args.verzekeraar,
      polisnummer: args.polisnummer,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Werk een voertuig bij (met eigenaarschap verificatie)
export const update = mutation({
  args: {
    id: v.id("voertuigen"),
    kenteken: v.optional(v.string()),
    merk: v.optional(v.string()),
    model: v.optional(v.string()),
    type: v.optional(v.string()),
    bouwjaar: v.optional(v.number()),
    kleur: v.optional(v.string()),
    fleetgoId: v.optional(v.string()),
    fleetgoData: v.optional(v.any()),
    kmStand: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("actief"),
        v.literal("inactief"),
        v.literal("onderhoud")
      )
    ),
    notities: v.optional(v.string()),
    // Verzekering en APK gegevens
    apkVervaldatum: v.optional(v.number()),
    verzekeringsVervaldatum: v.optional(v.number()),
    verzekeraar: v.optional(v.string()),
    polisnummer: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const voertuig = await ctx.db.get(args.id);
    if (!voertuig) {
      throw new Error("Voertuig niet gevonden");
    }
    if (voertuig.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit voertuig");
    }

    // Bouw update object expliciet (geen dynamic object access)
    const updateData: {
      kenteken?: string;
      merk?: string;
      model?: string;
      type?: string;
      bouwjaar?: number;
      kleur?: string;
      fleetgoId?: string;
      fleetgoData?: unknown;
      kmStand?: number;
      status?: "actief" | "inactief" | "onderhoud";
      notities?: string;
      apkVervaldatum?: number;
      verzekeringsVervaldatum?: number;
      verzekeraar?: string;
      polisnummer?: string;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.kenteken !== undefined) updateData.kenteken = args.kenteken;
    if (args.merk !== undefined) updateData.merk = args.merk;
    if (args.model !== undefined) updateData.model = args.model;
    if (args.type !== undefined) updateData.type = args.type;
    if (args.bouwjaar !== undefined) updateData.bouwjaar = args.bouwjaar;
    if (args.kleur !== undefined) updateData.kleur = args.kleur;
    if (args.fleetgoId !== undefined) updateData.fleetgoId = args.fleetgoId;
    if (args.fleetgoData !== undefined) updateData.fleetgoData = args.fleetgoData;
    if (args.kmStand !== undefined) updateData.kmStand = args.kmStand;
    if (args.status !== undefined) updateData.status = args.status;
    if (args.notities !== undefined) updateData.notities = args.notities;
    if (args.apkVervaldatum !== undefined) updateData.apkVervaldatum = args.apkVervaldatum;
    if (args.verzekeringsVervaldatum !== undefined) updateData.verzekeringsVervaldatum = args.verzekeringsVervaldatum;
    if (args.verzekeraar !== undefined) updateData.verzekeraar = args.verzekeraar;
    if (args.polisnummer !== undefined) updateData.polisnummer = args.polisnummer;

    await ctx.db.patch(args.id, updateData);

    return args.id;
  },
});

// Soft delete: zet status op inactief (met eigenaarschap verificatie)
export const remove = mutation({
  args: { id: v.id("voertuigen") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const voertuig = await ctx.db.get(args.id);
    if (!voertuig) {
      throw new Error("Voertuig niet gevonden");
    }
    if (voertuig.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit voertuig");
    }

    await ctx.db.patch(args.id, {
      status: "inactief",
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

// Permanent verwijderen (met eigenaarschap verificatie)
export const hardDelete = mutation({
  args: { id: v.id("voertuigen") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const voertuig = await ctx.db.get(args.id);
    if (!voertuig) {
      throw new Error("Voertuig niet gevonden");
    }
    if (voertuig.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit voertuig");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Sync voertuig data van FleetGo
export const syncFromFleetGo = mutation({
  args: {
    id: v.id("voertuigen"),
    fleetgoData: v.any(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const voertuig = await ctx.db.get(args.id);
    if (!voertuig) {
      throw new Error("Voertuig niet gevonden");
    }
    if (voertuig.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit voertuig");
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      fleetgoData: args.fleetgoData,
      laatsteSyncAt: now,
      updatedAt: now,
    });

    return args.id;
  },
});

// Snelle update voor kilometerstand
export const updateKmStand = mutation({
  args: {
    id: v.id("voertuigen"),
    kmStand: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const voertuig = await ctx.db.get(args.id);
    if (!voertuig) {
      throw new Error("Voertuig niet gevonden");
    }
    if (voertuig.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit voertuig");
    }

    await ctx.db.patch(args.id, {
      kmStand: args.kmStand,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

// Haal een voertuig op met alle gerelateerde details
// Inclusief onderhoud, kilometerstand historie en brandstof registraties
export const getWithDetails = query({
  args: { id: v.id("voertuigen") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const voertuig = await ctx.db.get(args.id);

    if (!voertuig) return null;
    if (voertuig.userId.toString() !== userId.toString()) {
      return null;
    }

    // Haal gerelateerde onderhoud records op
    const onderhoud = await ctx.db
      .query("voertuigOnderhoud")
      .withIndex("by_voertuig", (q) => q.eq("voertuigId", args.id))
      .collect();

    // Haal kilometerstand historie op
    const kilometerStanden = await ctx.db
      .query("kilometerStanden")
      .withIndex("by_voertuig", (q) => q.eq("voertuigId", args.id))
      .collect();

    // Haal brandstof registraties op
    const brandstofRegistraties = await ctx.db
      .query("brandstofRegistratie")
      .withIndex("by_voertuig", (q) => q.eq("voertuigId", args.id))
      .collect();

    // Sorteer op datum (nieuwste eerst)
    const sortedKilometerStanden = kilometerStanden.sort((a, b) =>
      b.datum.localeCompare(a.datum)
    );
    const sortedBrandstof = brandstofRegistraties.sort((a, b) =>
      b.datum - a.datum
    );
    const sortedOnderhoud = onderhoud.sort((a, b) =>
      b.geplanteDatum - a.geplanteDatum
    );

    return {
      ...voertuig,
      onderhoud: sortedOnderhoud,
      kilometerStanden: sortedKilometerStanden,
      brandstofRegistraties: sortedBrandstof,
    };
  },
});

// Overzicht van alle vervaldatums (APK, verzekering, onderhoud)
// Retourneert items die binnenkort verlopen of al verlopen zijn
export const getVervaldataOverzicht = query({
  args: {
    dagenVooruit: v.optional(v.number()), // Standaard 30 dagen vooruit kijken
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const dagenVooruit = args.dagenVooruit ?? 30;
    const now = Date.now();
    const grens = now + dagenVooruit * 24 * 60 * 60 * 1000;

    // Haal alle voertuigen op
    const voertuigen = await ctx.db
      .query("voertuigen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Haal alle gepland onderhoud op
    const onderhoud = await ctx.db
      .query("voertuigOnderhoud")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const vervalItems: {
      voertuigId: string;
      kenteken: string;
      merk: string;
      model: string;
      type: "apk" | "verzekering" | "onderhoud";
      omschrijving: string;
      vervaldatum: number;
      isVerlopen: boolean;
      dagenTotVerval: number;
    }[] = [];

    // Check APK en verzekering vervaldatums per voertuig
    for (const voertuig of voertuigen) {
      // APK vervaldatum
      if (voertuig.apkVervaldatum && voertuig.apkVervaldatum <= grens) {
        const dagenTotVerval = Math.floor(
          (voertuig.apkVervaldatum - now) / (24 * 60 * 60 * 1000)
        );
        vervalItems.push({
          voertuigId: voertuig._id,
          kenteken: voertuig.kenteken,
          merk: voertuig.merk,
          model: voertuig.model,
          type: "apk",
          omschrijving: "APK keuring",
          vervaldatum: voertuig.apkVervaldatum,
          isVerlopen: voertuig.apkVervaldatum < now,
          dagenTotVerval,
        });
      }

      // Verzekering vervaldatum
      if (voertuig.verzekeringsVervaldatum && voertuig.verzekeringsVervaldatum <= grens) {
        const dagenTotVerval = Math.floor(
          (voertuig.verzekeringsVervaldatum - now) / (24 * 60 * 60 * 1000)
        );
        vervalItems.push({
          voertuigId: voertuig._id,
          kenteken: voertuig.kenteken,
          merk: voertuig.merk,
          model: voertuig.model,
          type: "verzekering",
          omschrijving: `Verzekering ${voertuig.verzekeraar ? `(${voertuig.verzekeraar})` : ""}`.trim(),
          vervaldatum: voertuig.verzekeringsVervaldatum,
          isVerlopen: voertuig.verzekeringsVervaldatum < now,
          dagenTotVerval,
        });
      }
    }

    // Check gepland onderhoud
    for (const item of onderhoud) {
      if (item.status !== "voltooid" && item.geplanteDatum <= grens) {
        const voertuig = voertuigen.find((v) => v._id === item.voertuigId);
        if (voertuig) {
          const dagenTotVerval = Math.floor(
            (item.geplanteDatum - now) / (24 * 60 * 60 * 1000)
          );
          vervalItems.push({
            voertuigId: voertuig._id,
            kenteken: voertuig.kenteken,
            merk: voertuig.merk,
            model: voertuig.model,
            type: "onderhoud",
            omschrijving: item.omschrijving,
            vervaldatum: item.geplanteDatum,
            isVerlopen: item.geplanteDatum < now,
            dagenTotVerval,
          });
        }
      }
    }

    // Sorteer op vervaldatum (vroegste eerst)
    vervalItems.sort((a, b) => a.vervaldatum - b.vervaldatum);

    // Samenvatting statistieken
    const verlopen = vervalItems.filter((item) => item.isVerlopen);
    const binnenkort = vervalItems.filter((item) => !item.isVerlopen);

    return {
      items: vervalItems,
      samenvatting: {
        totaal: vervalItems.length,
        verlopen: verlopen.length,
        binnenkort: binnenkort.length,
        perType: {
          apk: vervalItems.filter((item) => item.type === "apk").length,
          verzekering: vervalItems.filter((item) => item.type === "verzekering").length,
          onderhoud: vervalItems.filter((item) => item.type === "onderhoud").length,
        },
      },
    };
  },
});
