import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

// Haversine formule voor afstandsberekening in km
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Aarde radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Alle actieve transportbedrijven ophalen voor ingelogde gebruiker
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const transportbedrijven = await ctx.db
      .query("transportbedrijven")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter alleen actieve transportbedrijven
    return transportbedrijven.filter((t) => t.isActief !== false);
  },
});

// Eén transportbedrijf ophalen op ID (met eigendomsverificatie)
export const getById = query({
  args: { id: v.id("transportbedrijven") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const transportbedrijf = await ctx.db.get(args.id);

    if (!transportbedrijf) return null;
    if (transportbedrijf.userId.toString() !== userId.toString()) {
      return null;
    }

    return transportbedrijf;
  },
});

// Nieuw transportbedrijf aanmaken
export const create = mutation({
  args: {
    naam: v.string(),
    adres: v.string(),
    lat: v.number(),
    lng: v.number(),
    kmTarief: v.number(),
    contactInfo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    if (!args.naam.trim()) {
      throw new Error("Naam is verplicht");
    }
    if (!args.adres.trim()) {
      throw new Error("Adres is verplicht");
    }

    const now = Date.now();
    return await ctx.db.insert("transportbedrijven", {
      userId,
      naam: args.naam.trim(),
      adres: args.adres.trim(),
      lat: args.lat,
      lng: args.lng,
      kmTarief: args.kmTarief,
      contactInfo: args.contactInfo,
      isActief: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Transportbedrijf bijwerken (met eigendomsverificatie)
export const update = mutation({
  args: {
    id: v.id("transportbedrijven"),
    naam: v.optional(v.string()),
    adres: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    kmTarief: v.optional(v.number()),
    contactInfo: v.optional(v.string()),
    isActief: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const transportbedrijf = await ctx.db.get(args.id);
    if (!transportbedrijf) {
      throw new Error("Transportbedrijf niet gevonden");
    }
    if (transportbedrijf.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit transportbedrijf");
    }

    const { id, ...updates } = args;
    const filteredUpdates: Record<string, unknown> = { updatedAt: Date.now() };

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    await ctx.db.patch(id, filteredUpdates);
    return id;
  },
});

// Soft delete transportbedrijf (isActief = false)
export const remove = mutation({
  args: { id: v.id("transportbedrijven") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const transportbedrijf = await ctx.db.get(args.id);
    if (!transportbedrijf) {
      throw new Error("Transportbedrijf niet gevonden");
    }
    if (transportbedrijf.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit transportbedrijf");
    }

    await ctx.db.patch(args.id, {
      isActief: false,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

// Dichtstbijzijnde transportbedrijven ophalen, gesorteerd op afstand
export const getNearest = query({
  args: {
    lat: v.number(),
    lng: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const transportbedrijven = await ctx.db
      .query("transportbedrijven")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter actieve en bereken afstand
    const metAfstand = transportbedrijven
      .filter((t) => t.isActief !== false)
      .map((t) => ({
        ...t,
        afstandKm: haversineDistance(args.lat, args.lng, t.lat, t.lng),
      }));

    // Sorteer op afstand (dichtsbij eerst)
    metAfstand.sort((a, b) => a.afstandKm - b.afstandKm);

    return metAfstand;
  },
});
