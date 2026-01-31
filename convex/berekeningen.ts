import { v } from "convex/values";
import { query, action } from "./_generated/server";
import { api } from "./_generated/api";
import { requireAuthUserId, getAuthenticatedUser } from "./auth";

// Helper type for regel
interface OfferteRegel {
  id: string;
  scope: string;
  omschrijving: string;
  eenheid: string;
  hoeveelheid: number;
  prijsPerEenheid: number;
  totaal: number;
  type: "materiaal" | "arbeid" | "machine";
}

/**
 * Round hours to nearest quarter (kwartier = 0.25)
 *
 * NOTE: This function is intentionally duplicated from src/lib/time-utils.ts
 * because Convex runs in an isolated environment and cannot import from src/.
 * Keep both implementations in sync if changes are needed.
 */
function roundToQuarter(hours: number): number {
  return Math.round(hours * 4) / 4;
}

// Combined query for all calculation data - reduces 4 round-trips to 1
// Fetches normuren, correctiefactoren, producten, and instellingen in a single query
export const getCalculationData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    // Fetch all data in parallel using Promise.all
    const [normuren, userCorrectieFactoren, systemCorrectieFactoren, producten, instellingen] = await Promise.all([
      // Normuren
      ctx.db
        .query("normuren")
        .withIndex("by_user_scope", (q) => q.eq("userId", userId))
        .collect(),
      // User correctiefactoren
      ctx.db
        .query("correctiefactoren")
        .withIndex("by_user_type", (q) => q.eq("userId", userId))
        .collect(),
      // System correctiefactoren (defaults)
      ctx.db
        .query("correctiefactoren")
        .filter((q) => q.eq(q.field("userId"), undefined))
        .collect(),
      // Producten
      ctx.db
        .query("producten")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      // Instellingen
      ctx.db
        .query("instellingen")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique(),
    ]);

    // Merge correctiefactoren: user overrides take precedence over system defaults
    const overrideMap = new Map(
      userCorrectieFactoren.map((f) => [`${f.type}-${f.waarde}`, f])
    );
    const correctiefactoren = systemCorrectieFactoren.map((f) => {
      const override = overrideMap.get(`${f.type}-${f.waarde}`);
      return override || f;
    });

    return {
      normuren,
      correctiefactoren,
      producten: producten.filter((p) => p.isActief),
      instellingen,
    };
  },
});

// Get correction factor value
export const getCorrectie = query({
  args: {
    userId: v.optional(v.id("users")),
    type: v.string(),
    waarde: v.string(),
  },
  handler: async (ctx, args) => {
    // Try user override first
    if (args.userId) {
      const userFactor = await ctx.db
        .query("correctiefactoren")
        .withIndex("by_user_type", (q) =>
          q.eq("userId", args.userId).eq("type", args.type)
        )
        .filter((q) => q.eq(q.field("waarde"), args.waarde))
        .unique();

      if (userFactor) return userFactor.factor;
    }

    // Fall back to system default
    const systemFactor = await ctx.db
      .query("correctiefactoren")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), undefined),
          q.eq(q.field("type"), args.type),
          q.eq(q.field("waarde"), args.waarde)
        )
      )
      .unique();

    return systemFactor?.factor || 1.0;
  },
});

// Get normuur for activity
export const getNormuur = query({
  args: {
    userId: v.id("users"),
    activiteit: v.string(),
    scope: v.string(),
  },
  handler: async (ctx, args) => {
    const normuur = await ctx.db
      .query("normuren")
      .withIndex("by_user_scope", (q) =>
        q.eq("userId", args.userId).eq("scope", args.scope)
      )
      .filter((q) => q.eq(q.field("activiteit"), args.activiteit))
      .unique();

    return normuur?.normuurPerEenheid || 0;
  },
});

// Calculate grondwerk regels
export const berekenGrondwerk = action({
  args: {
    userId: v.id("users"),
    data: v.object({
      oppervlakte: v.number(),
      diepte: v.union(v.literal("licht"), v.literal("standaard"), v.literal("zwaar")),
      afvoerGrond: v.boolean(),
    }),
    bereikbaarheid: v.union(v.literal("goed"), v.literal("beperkt"), v.literal("slecht")),
    uurtarief: v.number(),
  },
  handler: async (ctx, args): Promise<OfferteRegel[]> => {
    const regels: OfferteRegel[] = [];
    const { data, uurtarief } = args;

    // Get correction factors
    const bereikbaarheidFactor = await ctx.runQuery(api.berekeningen.getCorrectie, {
      userId: args.userId,
      type: "bereikbaarheid",
      waarde: args.bereikbaarheid,
    });

    const diepteFactor = await ctx.runQuery(api.berekeningen.getCorrectie, {
      userId: args.userId,
      type: "diepte",
      waarde: data.diepte,
    });

    // Get normuren
    const normuurOntgraven = await ctx.runQuery(api.berekeningen.getNormuur, {
      userId: args.userId,
      activiteit: `Ontgraven ${data.diepte}`,
      scope: "grondwerk",
    });

    // Calculate ontgraven
    const urenOntgraven = data.oppervlakte * normuurOntgraven * bereikbaarheidFactor * diepteFactor;
    const kostenOntgraven = urenOntgraven * uurtarief;

    const roundedUrenOntgraven = roundToQuarter(urenOntgraven);
    regels.push({
      id: `grondwerk-ontgraven-${Date.now()}`,
      scope: "grondwerk",
      omschrijving: `Ontgraven (${data.diepte})`,
      eenheid: "uur",
      hoeveelheid: roundedUrenOntgraven,
      prijsPerEenheid: uurtarief,
      totaal: Math.round(roundedUrenOntgraven * uurtarief * 100) / 100,
      type: "arbeid",
    });

    // Machine uren (bij grotere oppervlaktes)
    if (data.oppervlakte > 20) {
      const machineUren = data.oppervlakte * 0.05 * diepteFactor;
      const roundedMachineUren = roundToQuarter(machineUren);
      const machineTarief = 75; // Standaard machine tarief
      regels.push({
        id: `grondwerk-machine-${Date.now()}`,
        scope: "grondwerk",
        omschrijving: "Machine-uren minigraver",
        eenheid: "uur",
        hoeveelheid: roundedMachineUren,
        prijsPerEenheid: machineTarief,
        totaal: Math.round(roundedMachineUren * machineTarief * 100) / 100,
        type: "machine",
      });
    }

    // Afvoer grond
    if (data.afvoerGrond) {
      const diepteInM = data.diepte === "licht" ? 0.2 : data.diepte === "standaard" ? 0.35 : 0.5;
      const volume = data.oppervlakte * diepteInM;
      const afvoerTarief = 35; // per m³

      const normuurAfvoer = await ctx.runQuery(api.berekeningen.getNormuur, {
        userId: args.userId,
        activiteit: "Grond afvoeren",
        scope: "grondwerk",
      });

      const urenAfvoer = volume * normuurAfvoer * bereikbaarheidFactor;
      const roundedUrenAfvoer = roundToQuarter(urenAfvoer);

      regels.push({
        id: `grondwerk-afvoer-arbeid-${Date.now()}`,
        scope: "grondwerk",
        omschrijving: "Grond laden voor afvoer",
        eenheid: "uur",
        hoeveelheid: roundedUrenAfvoer,
        prijsPerEenheid: uurtarief,
        totaal: Math.round(roundedUrenAfvoer * uurtarief * 100) / 100,
        type: "arbeid",
      });

      regels.push({
        id: `grondwerk-afvoer-kosten-${Date.now()}`,
        scope: "grondwerk",
        omschrijving: "Afvoerkosten grond",
        eenheid: "m³",
        hoeveelheid: Math.round(volume * 100) / 100,
        prijsPerEenheid: afvoerTarief,
        totaal: Math.round(volume * afvoerTarief * 100) / 100,
        type: "materiaal",
      });
    }

    return regels;
  },
});

// Calculate bestrating regels (inclusief verplichte onderbouw)
export const berekenBestrating = action({
  args: {
    userId: v.id("users"),
    data: v.object({
      oppervlakte: v.number(),
      typeBestrating: v.union(v.literal("tegel"), v.literal("klinker"), v.literal("natuursteen")),
      snijwerk: v.union(v.literal("laag"), v.literal("gemiddeld"), v.literal("hoog")),
      onderbouw: v.object({
        type: v.union(v.literal("zandbed"), v.literal("zand_fundering"), v.literal("zware_fundering")),
        dikteOnderlaag: v.number(),
        opsluitbanden: v.boolean(),
      }),
    }),
    bereikbaarheid: v.union(v.literal("goed"), v.literal("beperkt"), v.literal("slecht")),
    uurtarief: v.number(),
  },
  handler: async (ctx, args): Promise<OfferteRegel[]> => {
    const regels: OfferteRegel[] = [];
    const { data, uurtarief } = args;

    // Get correction factors
    const bereikbaarheidFactor = await ctx.runQuery(api.berekeningen.getCorrectie, {
      userId: args.userId,
      type: "bereikbaarheid",
      waarde: args.bereikbaarheid,
    });

    const snijwerkFactor = await ctx.runQuery(api.berekeningen.getCorrectie, {
      userId: args.userId,
      type: "snijwerk",
      waarde: data.snijwerk,
    });

    // Onderbouw materialen
    const dikteM = data.onderbouw.dikteOnderlaag / 100;
    const volumeZand = data.oppervlakte * dikteM * 1.1; // 10% verlies
    const zandPrijs = 25; // per m³

    regels.push({
      id: `bestrating-zand-${Date.now()}`,
      scope: "bestrating",
      omschrijving: `Zandbed ${data.onderbouw.dikteOnderlaag}cm`,
      eenheid: "m³",
      hoeveelheid: Math.round(volumeZand * 100) / 100,
      prijsPerEenheid: zandPrijs,
      totaal: Math.round(volumeZand * zandPrijs * 100) / 100,
      type: "materiaal",
    });

    // Extra fundering materiaal indien nodig
    if (data.onderbouw.type !== "zandbed") {
      const volumeFundering = data.oppervlakte * 0.15 * 1.1;
      const funderingPrijs = data.onderbouw.type === "zware_fundering" ? 45 : 35;

      regels.push({
        id: `bestrating-fundering-${Date.now()}`,
        scope: "bestrating",
        omschrijving: `Funderingsmateriaal (${data.onderbouw.type.replace("_", " ")})`,
        eenheid: "m³",
        hoeveelheid: Math.round(volumeFundering * 100) / 100,
        prijsPerEenheid: funderingPrijs,
        totaal: Math.round(volumeFundering * funderingPrijs * 100) / 100,
        type: "materiaal",
      });
    }

    // Onderbouw arbeid
    const normuurZand = await ctx.runQuery(api.berekeningen.getNormuur, {
      userId: args.userId,
      activiteit: "Zandbed aanbrengen",
      scope: "bestrating",
    });

    const urenOnderbouw = data.oppervlakte * normuurZand * bereikbaarheidFactor;
    const roundedUrenOnderbouw = roundToQuarter(urenOnderbouw);
    regels.push({
      id: `bestrating-onderbouw-arbeid-${Date.now()}`,
      scope: "bestrating",
      omschrijving: "Aanbrengen onderbouw",
      eenheid: "uur",
      hoeveelheid: roundedUrenOnderbouw,
      prijsPerEenheid: uurtarief,
      totaal: Math.round(roundedUrenOnderbouw * uurtarief * 100) / 100,
      type: "arbeid",
    });

    // Opsluitbanden
    if (data.onderbouw.opsluitbanden) {
      const omtrek = Math.sqrt(data.oppervlakte) * 4; // Geschatte omtrek
      const opsluitbandPrijs = 8; // per meter

      const normuurOpsluit = await ctx.runQuery(api.berekeningen.getNormuur, {
        userId: args.userId,
        activiteit: "Opsluitbanden plaatsen",
        scope: "bestrating",
      });

      regels.push({
        id: `bestrating-opsluitbanden-mat-${Date.now()}`,
        scope: "bestrating",
        omschrijving: "Opsluitbanden",
        eenheid: "m",
        hoeveelheid: Math.round(omtrek * 100) / 100,
        prijsPerEenheid: opsluitbandPrijs,
        totaal: Math.round(omtrek * opsluitbandPrijs * 100) / 100,
        type: "materiaal",
      });

      const urenOpsluit = omtrek * normuurOpsluit * bereikbaarheidFactor;
      const roundedUrenOpsluit = roundToQuarter(urenOpsluit);
      regels.push({
        id: `bestrating-opsluitbanden-arbeid-${Date.now()}`,
        scope: "bestrating",
        omschrijving: "Plaatsen opsluitbanden",
        eenheid: "uur",
        hoeveelheid: roundedUrenOpsluit,
        prijsPerEenheid: uurtarief,
        totaal: Math.round(roundedUrenOpsluit * uurtarief * 100) / 100,
        type: "arbeid",
      });
    }

    // Bestrating leggen
    const activiteit = `${data.typeBestrating.charAt(0).toUpperCase() + data.typeBestrating.slice(1)}s leggen`;
    const normuurLeggen = await ctx.runQuery(api.berekeningen.getNormuur, {
      userId: args.userId,
      activiteit,
      scope: "bestrating",
    });

    const urenLeggen = data.oppervlakte * normuurLeggen * bereikbaarheidFactor * snijwerkFactor;
    const roundedUrenLeggen = roundToQuarter(urenLeggen);
    regels.push({
      id: `bestrating-leggen-${Date.now()}`,
      scope: "bestrating",
      omschrijving: `Leggen ${data.typeBestrating} (snijwerk: ${data.snijwerk})`,
      eenheid: "uur",
      hoeveelheid: roundedUrenLeggen,
      prijsPerEenheid: uurtarief,
      totaal: Math.round(roundedUrenLeggen * uurtarief * 100) / 100,
      type: "arbeid",
    });

    return regels;
  },
});

// Calculate heggen onderhoud (volume berekening L×H×B)
export const berekenHeggenOnderhoud = action({
  args: {
    userId: v.id("users"),
    data: v.object({
      lengte: v.number(),
      hoogte: v.number(),
      breedte: v.number(),
      snoei: v.union(v.literal("zijkanten"), v.literal("bovenkant"), v.literal("beide")),
      afvoerSnoeisel: v.boolean(),
    }),
    bereikbaarheid: v.union(v.literal("goed"), v.literal("beperkt"), v.literal("slecht")),
    achterstalligheid: v.union(v.literal("laag"), v.literal("gemiddeld"), v.literal("hoog")),
    uurtarief: v.number(),
  },
  handler: async (ctx, args): Promise<OfferteRegel[]> => {
    const regels: OfferteRegel[] = [];
    const { data, uurtarief } = args;

    // Volume berekening (KRITISCH: alle 3 dimensies verplicht)
    const volume = data.lengte * data.hoogte * data.breedte;

    // Get correction factors
    const bereikbaarheidFactor = await ctx.runQuery(api.berekeningen.getCorrectie, {
      userId: args.userId,
      type: "bereikbaarheid",
      waarde: args.bereikbaarheid,
    });

    const achterstalligFactor = await ctx.runQuery(api.berekeningen.getCorrectie, {
      userId: args.userId,
      type: "achterstalligheid",
      waarde: args.achterstalligheid,
    });

    const snoeiFactor = await ctx.runQuery(api.berekeningen.getCorrectie, {
      userId: args.userId,
      type: "snoei",
      waarde: data.snoei,
    });

    // Hoogte correctie (>2m = ladder/hoogwerker nodig)
    let hoogteFactor = 1.0;
    if (data.hoogte > 2) {
      hoogteFactor = await ctx.runQuery(api.berekeningen.getCorrectie, {
        userId: args.userId,
        type: "hoogte",
        waarde: data.hoogte > 3 ? "hoog" : "middel",
      });
    }

    // Normuur snoeien
    const normuurSnoeien = await ctx.runQuery(api.berekeningen.getNormuur, {
      userId: args.userId,
      activiteit: "Heg snoeien",
      scope: "heggen_onderhoud",
    });

    const urenSnoeien = volume * normuurSnoeien * bereikbaarheidFactor * achterstalligFactor * snoeiFactor * hoogteFactor;
    const roundedUrenSnoeien = roundToQuarter(urenSnoeien);

    regels.push({
      id: `heggen-snoeien-${Date.now()}`,
      scope: "heggen",
      omschrijving: `Heg snoeien ${data.lengte}m × ${data.hoogte}m × ${data.breedte}m (${data.snoei})`,
      eenheid: "uur",
      hoeveelheid: roundedUrenSnoeien,
      prijsPerEenheid: uurtarief,
      totaal: Math.round(roundedUrenSnoeien * uurtarief * 100) / 100,
      type: "arbeid",
    });

    // Afvoer snoeisel
    if (data.afvoerSnoeisel) {
      const snoeiselVolume = volume * 0.3; // Geschat 30% van heg volume
      const afvoerTarief = 25;

      const normuurAfvoer = await ctx.runQuery(api.berekeningen.getNormuur, {
        userId: args.userId,
        activiteit: "Snoeisel afvoeren",
        scope: "heggen_onderhoud",
      });

      const urenAfvoer = snoeiselVolume * normuurAfvoer * bereikbaarheidFactor;
      const roundedUrenAfvoerHeggen = roundToQuarter(urenAfvoer);

      regels.push({
        id: `heggen-afvoer-arbeid-${Date.now()}`,
        scope: "heggen",
        omschrijving: "Snoeisel verzamelen en laden",
        eenheid: "uur",
        hoeveelheid: roundedUrenAfvoerHeggen,
        prijsPerEenheid: uurtarief,
        totaal: Math.round(roundedUrenAfvoerHeggen * uurtarief * 100) / 100,
        type: "arbeid",
      });

      regels.push({
        id: `heggen-afvoer-kosten-${Date.now()}`,
        scope: "heggen",
        omschrijving: "Afvoerkosten snoeisel",
        eenheid: "m³",
        hoeveelheid: Math.round(snoeiselVolume * 100) / 100,
        prijsPerEenheid: afvoerTarief,
        totaal: Math.round(snoeiselVolume * afvoerTarief * 100) / 100,
        type: "materiaal",
      });
    }

    return regels;
  },
});

// Calculate borders onderhoud (met verplichte intensiteit)
export const berekenBordersOnderhoud = action({
  args: {
    userId: v.id("users"),
    data: v.object({
      borderOppervlakte: v.number(),
      onderhoudsintensiteit: v.union(v.literal("weinig"), v.literal("gemiddeld"), v.literal("veel")),
      onkruidVerwijderen: v.boolean(),
      snoeiInBorders: v.union(v.literal("geen"), v.literal("licht"), v.literal("zwaar")),
      bodem: v.union(v.literal("open"), v.literal("bedekt")),
      afvoerGroenafval: v.boolean(),
    }),
    bereikbaarheid: v.union(v.literal("goed"), v.literal("beperkt"), v.literal("slecht")),
    achterstalligheid: v.union(v.literal("laag"), v.literal("gemiddeld"), v.literal("hoog")),
    uurtarief: v.number(),
  },
  handler: async (ctx, args): Promise<OfferteRegel[]> => {
    const regels: OfferteRegel[] = [];
    const { data, uurtarief } = args;

    // Get correction factors
    const bereikbaarheidFactor = await ctx.runQuery(api.berekeningen.getCorrectie, {
      userId: args.userId,
      type: "bereikbaarheid",
      waarde: args.bereikbaarheid,
    });

    const achterstalligFactor = await ctx.runQuery(api.berekeningen.getCorrectie, {
      userId: args.userId,
      type: "achterstalligheid",
      waarde: args.achterstalligheid,
    });

    const intensiteitFactor = await ctx.runQuery(api.berekeningen.getCorrectie, {
      userId: args.userId,
      type: "intensiteit",
      waarde: data.onderhoudsintensiteit,
    });

    const bodemFactor = await ctx.runQuery(api.berekeningen.getCorrectie, {
      userId: args.userId,
      type: "bodem",
      waarde: data.bodem,
    });

    // Wieden
    if (data.onkruidVerwijderen) {
      const activiteit = `Wieden ${data.onderhoudsintensiteit}`;
      const normuurWieden = await ctx.runQuery(api.berekeningen.getNormuur, {
        userId: args.userId,
        activiteit,
        scope: "borders_onderhoud",
      });

      const urenWieden = data.borderOppervlakte * normuurWieden * bereikbaarheidFactor * achterstalligFactor * bodemFactor;
      const roundedUrenWieden = roundToQuarter(urenWieden);

      regels.push({
        id: `borders-wieden-${Date.now()}`,
        scope: "borders",
        omschrijving: `Onkruid verwijderen (intensiteit: ${data.onderhoudsintensiteit})`,
        eenheid: "uur",
        hoeveelheid: roundedUrenWieden,
        prijsPerEenheid: uurtarief,
        totaal: Math.round(roundedUrenWieden * uurtarief * 100) / 100,
        type: "arbeid",
      });
    }

    // Snoei in borders
    if (data.snoeiInBorders !== "geen") {
      const activiteit = `Snoei ${data.snoeiInBorders}`;
      const normuurSnoei = await ctx.runQuery(api.berekeningen.getNormuur, {
        userId: args.userId,
        activiteit,
        scope: "borders_onderhoud",
      });

      const urenSnoei = data.borderOppervlakte * normuurSnoei * bereikbaarheidFactor * intensiteitFactor;
      const roundedUrenSnoei = roundToQuarter(urenSnoei);

      regels.push({
        id: `borders-snoei-${Date.now()}`,
        scope: "borders",
        omschrijving: `Snoeiwerk in borders (${data.snoeiInBorders})`,
        eenheid: "uur",
        hoeveelheid: roundedUrenSnoei,
        prijsPerEenheid: uurtarief,
        totaal: Math.round(roundedUrenSnoei * uurtarief * 100) / 100,
        type: "arbeid",
      });
    }

    // Afvoer groenafval
    if (data.afvoerGroenafval) {
      const geschatVolume = data.borderOppervlakte * 0.05 * intensiteitFactor;
      const afvoerTarief = 25;

      regels.push({
        id: `borders-afvoer-${Date.now()}`,
        scope: "borders",
        omschrijving: "Afvoerkosten groenafval",
        eenheid: "m³",
        hoeveelheid: Math.round(geschatVolume * 100) / 100,
        prijsPerEenheid: afvoerTarief,
        totaal: Math.round(geschatVolume * afvoerTarief * 100) / 100,
        type: "materiaal",
      });
    }

    return regels;
  },
});
