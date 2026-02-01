import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

// Haal alle brandstof registraties op voor een voertuig
export const listByVoertuig = query({
  args: {
    voertuigId: v.id("voertuigen"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const limit = args.limit ?? 100;

    // Verifieer eigenaarschap van voertuig
    const voertuig = await ctx.db.get(args.voertuigId);
    if (!voertuig || voertuig.userId.toString() !== userId.toString()) {
      return [];
    }

    const records = await ctx.db
      .query("brandstofRegistratie")
      .withIndex("by_voertuig", (q) => q.eq("voertuigId", args.voertuigId))
      .collect();

    // Sorteer op datum (nieuwste eerst)
    const sorted = records.sort((a, b) => b.datum - a.datum);

    return sorted.slice(0, limit);
  },
});

// Haal alle brandstof registraties op voor de gebruiker
export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const limit = args.limit ?? 100;

    const records = await ctx.db
      .query("brandstofRegistratie")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Sorteer op datum (nieuwste eerst)
    const sorted = records.sort((a, b) => b.datum - a.datum);

    return sorted.slice(0, limit);
  },
});

// Haal een enkele brandstof registratie op
export const get = query({
  args: { id: v.id("brandstofRegistratie") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const record = await ctx.db.get(args.id);

    if (!record) return null;
    if (record.userId.toString() !== userId.toString()) {
      return null;
    }

    return record;
  },
});

// Maak een nieuwe brandstof registratie aan
export const create = mutation({
  args: {
    voertuigId: v.id("voertuigen"),
    datum: v.number(), // Timestamp
    liters: v.number(),
    kosten: v.number(),
    kilometerstand: v.number(),
    locatie: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Verifieer eigenaarschap van voertuig
    const voertuig = await ctx.db.get(args.voertuigId);
    if (!voertuig) {
      throw new Error("Voertuig niet gevonden");
    }
    if (voertuig.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit voertuig");
    }

    // Update ook de kilometerstand op het voertuig
    await ctx.db.patch(args.voertuigId, {
      kmStand: args.kilometerstand,
      updatedAt: now,
    });

    return await ctx.db.insert("brandstofRegistratie", {
      voertuigId: args.voertuigId,
      userId,
      datum: args.datum,
      liters: args.liters,
      kosten: args.kosten,
      kilometerstand: args.kilometerstand,
      locatie: args.locatie,
      createdAt: now,
    });
  },
});

// Werk een brandstof registratie bij
export const update = mutation({
  args: {
    id: v.id("brandstofRegistratie"),
    datum: v.optional(v.number()),
    liters: v.optional(v.number()),
    kosten: v.optional(v.number()),
    kilometerstand: v.optional(v.number()),
    locatie: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const record = await ctx.db.get(args.id);
    if (!record) {
      throw new Error("Brandstof registratie niet gevonden");
    }
    if (record.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot deze brandstof registratie");
    }

    // Bouw update object
    const updateData: {
      datum?: number;
      liters?: number;
      kosten?: number;
      kilometerstand?: number;
      locatie?: string;
    } = {};

    if (args.datum !== undefined) updateData.datum = args.datum;
    if (args.liters !== undefined) updateData.liters = args.liters;
    if (args.kosten !== undefined) updateData.kosten = args.kosten;
    if (args.kilometerstand !== undefined)
      updateData.kilometerstand = args.kilometerstand;
    if (args.locatie !== undefined) updateData.locatie = args.locatie;

    await ctx.db.patch(args.id, updateData);

    return args.id;
  },
});

// Verwijder een brandstof registratie
export const remove = mutation({
  args: { id: v.id("brandstofRegistratie") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const record = await ctx.db.get(args.id);
    if (!record) {
      throw new Error("Brandstof registratie niet gevonden");
    }
    if (record.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot deze brandstof registratie");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Bereken brandstof verbruik statistieken per voertuig
export const getVerbruikStatistieken = query({
  args: {
    voertuigId: v.id("voertuigen"),
    periode: v.optional(v.number()), // Aantal dagen terug kijken
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const voertuig = await ctx.db.get(args.voertuigId);
    if (!voertuig || voertuig.userId.toString() !== userId.toString()) {
      return null;
    }

    const periode = args.periode ?? 365; // Standaard 1 jaar
    const startDatum = Date.now() - periode * 24 * 60 * 60 * 1000;

    const records = await ctx.db
      .query("brandstofRegistratie")
      .withIndex("by_voertuig", (q) => q.eq("voertuigId", args.voertuigId))
      .collect();

    // Filter op periode
    const filteredRecords = records.filter(
      (record) => record.datum >= startDatum
    );

    if (filteredRecords.length === 0) {
      return {
        totaalLiters: 0,
        totaalKosten: 0,
        totaalKilometers: 0,
        gemiddeldVerbruik: 0, // L/100km
        gemiddeldePrijsPerLiter: 0,
        aantalTankbeurten: 0,
        periodeInDagen: periode,
      };
    }

    // Sorteer op kilometerstand
    const sorted = filteredRecords.sort(
      (a, b) => a.kilometerstand - b.kilometerstand
    );

    // Bereken totalen
    const totaalLiters = sorted.reduce((sum, r) => sum + r.liters, 0);
    const totaalKosten = sorted.reduce((sum, r) => sum + r.kosten, 0);

    // Bereken gereden kilometers (verschil tussen eerste en laatste)
    const eersteKm = sorted[0].kilometerstand;
    const laatsteKm = sorted[sorted.length - 1].kilometerstand;
    const totaalKilometers = laatsteKm - eersteKm;

    // Bereken gemiddeld verbruik (L/100km)
    // We gebruiken totaal liters minus eerste tankbeurt (die was om tank vol te maken)
    let verbruikLiters = totaalLiters;
    if (sorted.length > 1) {
      verbruikLiters -= sorted[0].liters; // Eerste tankbeurt niet meerekenen
    }
    const gemiddeldVerbruik =
      totaalKilometers > 0 ? (verbruikLiters / totaalKilometers) * 100 : 0;

    // Gemiddelde prijs per liter
    const gemiddeldePrijsPerLiter =
      totaalLiters > 0 ? totaalKosten / totaalLiters : 0;

    return {
      totaalLiters: Math.round(totaalLiters * 100) / 100,
      totaalKosten: Math.round(totaalKosten * 100) / 100,
      totaalKilometers,
      gemiddeldVerbruik: Math.round(gemiddeldVerbruik * 100) / 100,
      gemiddeldePrijsPerLiter: Math.round(gemiddeldePrijsPerLiter * 100) / 100,
      kostenPerKilometer:
        totaalKilometers > 0
          ? Math.round((totaalKosten / totaalKilometers) * 1000) / 1000
          : 0,
      aantalTankbeurten: sorted.length,
      periodeInDagen: periode,
    };
  },
});

// Haal overzicht van brandstofkosten op voor alle voertuigen
export const getKostenOverzicht = query({
  args: {
    periode: v.optional(v.number()), // Aantal dagen terug kijken
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const periode = args.periode ?? 30; // Standaard 30 dagen
    const startDatum = Date.now() - periode * 24 * 60 * 60 * 1000;

    // Haal alle voertuigen op
    const voertuigen = await ctx.db
      .query("voertuigen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Haal alle brandstof registraties op
    const records = await ctx.db
      .query("brandstofRegistratie")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter op periode
    const filteredRecords = records.filter(
      (record) => record.datum >= startDatum
    );

    // Groepeer per voertuig
    const voertuigMap = new Map(voertuigen.map((v) => [v._id, v]));
    const kostenPerVoertuig: {
      voertuigId: string;
      kenteken: string;
      merk: string;
      model: string;
      totaalKosten: number;
      totaalLiters: number;
      aantalTankbeurten: number;
    }[] = [];

    const voertuigGroups = new Map<
      string,
      { kosten: number; liters: number; aantal: number }
    >();

    for (const record of filteredRecords) {
      const current = voertuigGroups.get(record.voertuigId) || {
        kosten: 0,
        liters: 0,
        aantal: 0,
      };
      current.kosten += record.kosten;
      current.liters += record.liters;
      current.aantal += 1;
      voertuigGroups.set(record.voertuigId, current);
    }

    for (const [voertuigId, data] of voertuigGroups) {
      const voertuig = voertuigMap.get(voertuigId as typeof voertuigen[0]["_id"]);
      if (voertuig) {
        kostenPerVoertuig.push({
          voertuigId,
          kenteken: voertuig.kenteken,
          merk: voertuig.merk,
          model: voertuig.model,
          totaalKosten: Math.round(data.kosten * 100) / 100,
          totaalLiters: Math.round(data.liters * 100) / 100,
          aantalTankbeurten: data.aantal,
        });
      }
    }

    // Sorteer op kosten (hoogste eerst)
    kostenPerVoertuig.sort((a, b) => b.totaalKosten - a.totaalKosten);

    // Totalen
    const totaalKosten = filteredRecords.reduce((sum, r) => sum + r.kosten, 0);
    const totaalLiters = filteredRecords.reduce((sum, r) => sum + r.liters, 0);

    return {
      kostenPerVoertuig,
      totalen: {
        kosten: Math.round(totaalKosten * 100) / 100,
        liters: Math.round(totaalLiters * 100) / 100,
        tankbeurten: filteredRecords.length,
      },
      periodeInDagen: periode,
    };
  },
});

// Haal recente brandstof registraties op met voertuig details
export const getRecenteRegistraties = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const limit = args.limit ?? 10;

    const records = await ctx.db
      .query("brandstofRegistratie")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Sorteer op datum (nieuwste eerst)
    const sorted = records.sort((a, b) => b.datum - a.datum);
    const recent = sorted.slice(0, limit);

    // Haal voertuig details op
    const voertuigIds = [...new Set(recent.map((r) => r.voertuigId))];
    const voertuigen = await Promise.all(
      voertuigIds.map((id) => ctx.db.get(id))
    );
    const voertuigMap = new Map(
      voertuigen.filter(Boolean).map((v) => [v!._id, v])
    );

    return recent.map((record) => {
      const voertuig = voertuigMap.get(record.voertuigId);
      return {
        ...record,
        voertuig: voertuig
          ? {
              kenteken: voertuig.kenteken,
              merk: voertuig.merk,
              model: voertuig.model,
            }
          : null,
      };
    });
  },
});
