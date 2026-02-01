import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

/**
 * Medewerker Analytics API
 * Provides detailed performance and productivity insights for employees:
 * - Individual employee statistics
 * - Team performance comparisons
 * - Productivity trends over time
 */

// Haal uitgebreide statistieken op voor een specifieke medewerker
export const getMedewerkerStats = query({
  args: {
    medewerkerId: v.id("medewerkers"),
    periode: v.optional(
      v.object({
        van: v.number(), // timestamp
        tot: v.number(), // timestamp
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Haal medewerker op en verifieer eigenaarschap
    const medewerker = await ctx.db.get(args.medewerkerId);
    if (!medewerker) {
      throw new Error("Medewerker niet gevonden");
    }
    if (medewerker.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot deze medewerker");
    }

    // Haal alle urenregistraties op
    let urenRegistraties = await ctx.db.query("urenRegistraties").collect();

    // Filter op medewerker naam
    urenRegistraties = urenRegistraties.filter(
      (ur) => ur.medewerker === medewerker.naam
    );

    // Filter op periode indien opgegeven
    if (args.periode) {
      const vanDatum = new Date(args.periode.van).toISOString().slice(0, 10);
      const totDatum = new Date(args.periode.tot).toISOString().slice(0, 10);
      urenRegistraties = urenRegistraties.filter(
        (ur) => ur.datum >= vanDatum && ur.datum <= totDatum
      );
    }

    // Basisstatistieken
    const totaalUren = urenRegistraties.reduce((sum, ur) => sum + ur.uren, 0);
    const aantalRegistraties = urenRegistraties.length;
    const uniekeProjectIds = [
      ...new Set(urenRegistraties.map((ur) => ur.projectId.toString())),
    ];
    const aantalProjecten = uniekeProjectIds.length;

    // Haal projecten op
    const projecten = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Tel afgeronde projecten waar deze medewerker aan gewerkt heeft
    const afgerondeProjecten = projecten.filter(
      (p) =>
        uniekeProjectIds.includes(p._id.toString()) &&
        (p.status === "afgerond" ||
          p.status === "nacalculatie_compleet" ||
          p.status === "gefactureerd")
    );

    // Haal voorcalculaties op voor efficiëntie berekening
    const voorcalculaties = await ctx.db.query("voorcalculaties").collect();

    // Bereken efficiëntie ratio
    let totaalNormUren = 0;
    let totaalWerkelijkeUren = 0;

    for (const projectIdStr of uniekeProjectIds) {
      const project = afgerondeProjecten.find(
        (p) => p._id.toString() === projectIdStr
      );
      if (project) {
        const voorcalc = voorcalculaties.find(
          (vc) =>
            vc.projectId?.toString() === projectIdStr ||
            vc.offerteId?.toString() === project.offerteId.toString()
        );
        if (voorcalc) {
          // Bereken proportioneel deel van norm uren
          const projectUren = urenRegistraties
            .filter((ur) => ur.projectId.toString() === projectIdStr)
            .reduce((sum, ur) => sum + ur.uren, 0);

          // Haal alle uren voor dit project op (niet alleen van deze medewerker)
          const alleProjectUren = await ctx.db
            .query("urenRegistraties")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .collect();

          const totaalProjectUren = alleProjectUren.reduce(
            (sum, ur) => sum + ur.uren,
            0
          );

          if (totaalProjectUren > 0) {
            const proportie = projectUren / totaalProjectUren;
            totaalNormUren += voorcalc.normUrenTotaal * proportie;
            totaalWerkelijkeUren += projectUren;
          }
        }
      }
    }

    const efficiëntieRatio =
      totaalNormUren > 0
        ? Math.round((totaalNormUren / totaalWerkelijkeUren) * 100) / 100
        : null;

    // Uren per scope
    const urenPerScope: Record<string, number> = {};
    for (const ur of urenRegistraties) {
      if (ur.scope) {
        urenPerScope[ur.scope] = (urenPerScope[ur.scope] || 0) + ur.uren;
      }
    }

    // Uren per dag van de week
    const urenPerDag: Record<string, number> = {
      maandag: 0,
      dinsdag: 0,
      woensdag: 0,
      donderdag: 0,
      vrijdag: 0,
      zaterdag: 0,
      zondag: 0,
    };
    const dagNamen = [
      "zondag",
      "maandag",
      "dinsdag",
      "woensdag",
      "donderdag",
      "vrijdag",
      "zaterdag",
    ];

    for (const ur of urenRegistraties) {
      const datum = new Date(ur.datum);
      const dagNaam = dagNamen[datum.getDay()];
      urenPerDag[dagNaam] += ur.uren;
    }

    // Gemiddelde uren per werkdag
    const werkdagenTelling: Record<string, number> = {
      maandag: 0,
      dinsdag: 0,
      woensdag: 0,
      donderdag: 0,
      vrijdag: 0,
      zaterdag: 0,
      zondag: 0,
    };

    const uniekeDatums = [...new Set(urenRegistraties.map((ur) => ur.datum))];
    for (const datum of uniekeDatums) {
      const d = new Date(datum);
      const dagNaam = dagNamen[d.getDay()];
      werkdagenTelling[dagNaam]++;
    }

    const gemiddeldeUrenPerDag: Record<string, number> = {};
    for (const dag of Object.keys(urenPerDag)) {
      gemiddeldeUrenPerDag[dag] =
        werkdagenTelling[dag] > 0
          ? Math.round((urenPerDag[dag] / werkdagenTelling[dag]) * 100) / 100
          : 0;
    }

    return {
      medewerker: {
        _id: medewerker._id,
        naam: medewerker.naam,
        functie: medewerker.functie,
        contractType: medewerker.contractType,
        specialisaties: medewerker.specialisaties,
      },
      uren: {
        totaalUren,
        aantalRegistraties,
        gemiddeldeUrenPerRegistratie:
          aantalRegistraties > 0
            ? Math.round((totaalUren / aantalRegistraties) * 100) / 100
            : 0,
        urenPerScope,
        urenPerDag,
        gemiddeldeUrenPerDag,
      },
      projecten: {
        aantalProjecten,
        aantalAfgerond: afgerondeProjecten.length,
        gemiddeldeUrenPerProject:
          aantalProjecten > 0
            ? Math.round((totaalUren / aantalProjecten) * 100) / 100
            : 0,
      },
      efficiëntie: {
        ratio: efficiëntieRatio, // > 1 = sneller dan norm, < 1 = langzamer
        totaalNormUren: Math.round(totaalNormUren * 100) / 100,
        totaalWerkelijkeUren: Math.round(totaalWerkelijkeUren * 100) / 100,
        beoordeling:
          efficiëntieRatio === null
            ? "onbekend"
            : efficiëntieRatio >= 1.1
              ? "uitstekend"
              : efficiëntieRatio >= 0.95
                ? "goed"
                : efficiëntieRatio >= 0.8
                  ? "voldoende"
                  : "verbeterpunt",
      },
    };
  },
});

// Vergelijk prestaties van meerdere medewerkers (team performance)
export const getTeamPerformance = query({
  args: {
    medewerkerIds: v.optional(v.array(v.id("medewerkers"))), // Optioneel, anders alle actieve
    periode: v.optional(
      v.object({
        van: v.number(),
        tot: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Haal medewerkers op
    let medewerkers;
    if (args.medewerkerIds && args.medewerkerIds.length > 0) {
      // Specifieke medewerkers
      const results = await Promise.all(
        args.medewerkerIds.map((id) => ctx.db.get(id))
      );
      medewerkers = results.filter(
        (m) => m && m.userId.toString() === userId.toString()
      );
    } else {
      // Alle actieve medewerkers
      medewerkers = await ctx.db
        .query("medewerkers")
        .withIndex("by_user_actief", (q) =>
          q.eq("userId", userId).eq("isActief", true)
        )
        .collect();
    }

    if (medewerkers.length === 0) {
      return { medewerkers: [], samenvatting: null };
    }

    // Haal alle urenregistraties op
    let urenRegistraties = await ctx.db.query("urenRegistraties").collect();

    // Filter op periode indien opgegeven
    if (args.periode) {
      const vanDatum = new Date(args.periode.van).toISOString().slice(0, 10);
      const totDatum = new Date(args.periode.tot).toISOString().slice(0, 10);
      urenRegistraties = urenRegistraties.filter(
        (ur) => ur.datum >= vanDatum && ur.datum <= totDatum
      );
    }

    // Haal projecten en voorcalculaties op
    const projecten = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const voorcalculaties = await ctx.db.query("voorcalculaties").collect();

    // Bereken stats per medewerker
    const medewerkerStats = medewerkers.map((m) => {
      if (!m) return null;

      const medewerkerUren = urenRegistraties.filter(
        (ur) => ur.medewerker === m.naam
      );
      const totaalUren = medewerkerUren.reduce((sum, ur) => sum + ur.uren, 0);
      const uniekeProjectIds = [
        ...new Set(medewerkerUren.map((ur) => ur.projectId.toString())),
      ];
      const aantalProjecten = uniekeProjectIds.length;

      // Bereken efficiëntie
      let totaalNormUren = 0;
      let totaalWerkelijkeUren = 0;

      for (const projectIdStr of uniekeProjectIds) {
        const project = projecten.find(
          (p) =>
            p._id.toString() === projectIdStr &&
            (p.status === "afgerond" ||
              p.status === "nacalculatie_compleet" ||
              p.status === "gefactureerd")
        );
        if (project) {
          const voorcalc = voorcalculaties.find(
            (vc) =>
              vc.projectId?.toString() === projectIdStr ||
              vc.offerteId?.toString() === project.offerteId.toString()
          );
          if (voorcalc) {
            const projectUren = medewerkerUren
              .filter((ur) => ur.projectId.toString() === projectIdStr)
              .reduce((sum, ur) => sum + ur.uren, 0);

            const totaalProjectUren = urenRegistraties
              .filter((ur) => ur.projectId.toString() === projectIdStr)
              .reduce((sum, ur) => sum + ur.uren, 0);

            if (totaalProjectUren > 0) {
              const proportie = projectUren / totaalProjectUren;
              totaalNormUren += voorcalc.normUrenTotaal * proportie;
              totaalWerkelijkeUren += projectUren;
            }
          }
        }
      }

      const efficiëntieRatio =
        totaalNormUren > 0
          ? Math.round((totaalNormUren / totaalWerkelijkeUren) * 100) / 100
          : null;

      return {
        medewerker: {
          _id: m._id,
          naam: m.naam,
          functie: m.functie,
          contractType: m.contractType,
        },
        totaalUren,
        aantalProjecten,
        efficiëntieRatio,
        gemiddeldeUrenPerProject:
          aantalProjecten > 0
            ? Math.round((totaalUren / aantalProjecten) * 100) / 100
            : 0,
      };
    }).filter((s) => s !== null);

    // Bereken team samenvatting
    const totaalTeamUren = medewerkerStats.reduce(
      (sum, s) => sum + s.totaalUren,
      0
    );
    const gemiddeldeUrenPerMedewerker =
      medewerkerStats.length > 0
        ? Math.round((totaalTeamUren / medewerkerStats.length) * 100) / 100
        : 0;

    const efficiëntieRatios = medewerkerStats
      .map((s) => s.efficiëntieRatio)
      .filter((r): r is number => r !== null);

    const gemiddeldeEfficiëntie =
      efficiëntieRatios.length > 0
        ? Math.round(
            (efficiëntieRatios.reduce((sum, r) => sum + r, 0) /
              efficiëntieRatios.length) *
              100
          ) / 100
        : null;

    // Sorteer op totaal uren
    const gesorteerdeStats = [...medewerkerStats].sort(
      (a, b) => b.totaalUren - a.totaalUren
    );

    // Ranglijsten
    const topPerformers = gesorteerdeStats.slice(0, 3);
    const meestEfficiënt = [...medewerkerStats]
      .filter((s) => s.efficiëntieRatio !== null)
      .sort((a, b) => (b.efficiëntieRatio || 0) - (a.efficiëntieRatio || 0))
      .slice(0, 3);

    return {
      medewerkers: gesorteerdeStats,
      samenvatting: {
        aantalMedewerkers: medewerkerStats.length,
        totaalTeamUren,
        gemiddeldeUrenPerMedewerker,
        gemiddeldeEfficiëntie,
        topPerformers: topPerformers.map((p) => ({
          naam: p.medewerker.naam,
          uren: p.totaalUren,
        })),
        meestEfficiënt: meestEfficiënt.map((p) => ({
          naam: p.medewerker.naam,
          ratio: p.efficiëntieRatio,
        })),
      },
    };
  },
});

// Haal productiviteitstrend op (maandelijkse overzichten)
export const getProductiviteitTrend = query({
  args: {
    medewerkerId: v.optional(v.id("medewerkers")), // Optioneel, anders hele team
    aantalMaanden: v.optional(v.number()), // Default: 12
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const aantalMaanden = args.aantalMaanden || 12;

    // Als specifieke medewerker, verifieer eigenaarschap
    let medewerkerNamen: string[] = [];
    if (args.medewerkerId) {
      const medewerker = await ctx.db.get(args.medewerkerId);
      if (!medewerker || medewerker.userId.toString() !== userId.toString()) {
        throw new Error("Medewerker niet gevonden of geen toegang");
      }
      medewerkerNamen = [medewerker.naam];
    } else {
      // Alle medewerkers van deze gebruiker
      const medewerkers = await ctx.db
        .query("medewerkers")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      medewerkerNamen = medewerkers.map((m) => m.naam);
    }

    // Haal alle urenregistraties op
    const alleUrenRegistraties = await ctx.db
      .query("urenRegistraties")
      .collect();

    // Filter op medewerker(s)
    const urenRegistraties = alleUrenRegistraties.filter((ur) =>
      medewerkerNamen.includes(ur.medewerker)
    );

    // Haal projecten en voorcalculaties op voor efficiëntie
    const projecten = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const voorcalculaties = await ctx.db.query("voorcalculaties").collect();

    // Bereken trend per maand
    const now = new Date();
    const trends: {
      maand: string;
      uren: number;
      aantalRegistraties: number;
      aantalProjecten: number;
      efficiëntieRatio: number | null;
      gemiddeldeUrenPerDag: number;
    }[] = [];

    for (let i = aantalMaanden - 1; i >= 0; i--) {
      const maandDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const maandStr = maandDate.toISOString().slice(0, 7); // YYYY-MM

      // Filter registraties voor deze maand
      const maandRegistraties = urenRegistraties.filter((ur) =>
        ur.datum.startsWith(maandStr)
      );

      const totaalUren = maandRegistraties.reduce(
        (sum, ur) => sum + ur.uren,
        0
      );
      const aantalRegistraties = maandRegistraties.length;
      const uniekeProjectIds = [
        ...new Set(maandRegistraties.map((ur) => ur.projectId.toString())),
      ];
      const aantalProjecten = uniekeProjectIds.length;

      // Unieke werkdagen voor gemiddelde
      const uniekeDagen = [...new Set(maandRegistraties.map((ur) => ur.datum))];
      const gemiddeldeUrenPerDag =
        uniekeDagen.length > 0
          ? Math.round((totaalUren / uniekeDagen.length) * 100) / 100
          : 0;

      // Efficiëntie voor projecten die in deze maand afgerond zijn
      let totaalNormUren = 0;
      let totaalWerkelijkeUren = 0;

      for (const projectIdStr of uniekeProjectIds) {
        const project = projecten.find(
          (p) =>
            p._id.toString() === projectIdStr &&
            (p.status === "afgerond" ||
              p.status === "nacalculatie_compleet" ||
              p.status === "gefactureerd")
        );
        if (project) {
          const voorcalc = voorcalculaties.find(
            (vc) =>
              vc.projectId?.toString() === projectIdStr ||
              vc.offerteId?.toString() === project.offerteId.toString()
          );
          if (voorcalc) {
            const projectUren = maandRegistraties
              .filter((ur) => ur.projectId.toString() === projectIdStr)
              .reduce((sum, ur) => sum + ur.uren, 0);

            const totaalProjectUren = urenRegistraties
              .filter((ur) => ur.projectId.toString() === projectIdStr)
              .reduce((sum, ur) => sum + ur.uren, 0);

            if (totaalProjectUren > 0) {
              const proportie = projectUren / totaalProjectUren;
              totaalNormUren += voorcalc.normUrenTotaal * proportie;
              totaalWerkelijkeUren += projectUren;
            }
          }
        }
      }

      const efficiëntieRatio =
        totaalNormUren > 0
          ? Math.round((totaalNormUren / totaalWerkelijkeUren) * 100) / 100
          : null;

      trends.push({
        maand: maandStr,
        uren: totaalUren,
        aantalRegistraties,
        aantalProjecten,
        efficiëntieRatio,
        gemiddeldeUrenPerDag,
      });
    }

    // Bereken groei/daling percentages
    const trendMetGroei = trends.map((t, index) => {
      const vorigeMaand = index > 0 ? trends[index - 1] : null;
      const urenGroei =
        vorigeMaand && vorigeMaand.uren > 0
          ? Math.round(
              ((t.uren - vorigeMaand.uren) / vorigeMaand.uren) * 100 * 100
            ) / 100
          : null;

      return {
        ...t,
        urenGroeiPercentage: urenGroei,
      };
    });

    // Bereken gemiddelden over de hele periode
    const totaalUren = trends.reduce((sum, t) => sum + t.uren, 0);
    const maandenMetData = trends.filter((t) => t.uren > 0).length;
    const gemiddeldeUrenPerMaand =
      maandenMetData > 0
        ? Math.round((totaalUren / maandenMetData) * 100) / 100
        : 0;

    const efficiëntieRatios = trends
      .map((t) => t.efficiëntieRatio)
      .filter((r): r is number => r !== null);

    const gemiddeldeEfficiëntie =
      efficiëntieRatios.length > 0
        ? Math.round(
            (efficiëntieRatios.reduce((sum, r) => sum + r, 0) /
              efficiëntieRatios.length) *
              100
          ) / 100
        : null;

    // Identificeer beste en slechtste maand
    const maandenMetUren = trends.filter((t) => t.uren > 0);
    const besteMaand =
      maandenMetUren.length > 0
        ? maandenMetUren.reduce((best, t) => (t.uren > best.uren ? t : best))
        : null;
    const slechtesteMaand =
      maandenMetUren.length > 0
        ? maandenMetUren.reduce((worst, t) =>
            t.uren < worst.uren ? t : worst
          )
        : null;

    return {
      trends: trendMetGroei,
      samenvatting: {
        totaalUren,
        gemiddeldeUrenPerMaand,
        gemiddeldeEfficiëntie,
        besteMaand: besteMaand
          ? { maand: besteMaand.maand, uren: besteMaand.uren }
          : null,
        slechtesteMaand: slechtesteMaand
          ? { maand: slechtesteMaand.maand, uren: slechtesteMaand.uren }
          : null,
        trend:
          trendMetGroei.length >= 3
            ? trendMetGroei[trendMetGroei.length - 1].uren >
              trendMetGroei[trendMetGroei.length - 3].uren
              ? "stijgend"
              : trendMetGroei[trendMetGroei.length - 1].uren <
                  trendMetGroei[trendMetGroei.length - 3].uren
                ? "dalend"
                : "stabiel"
            : "onbekend",
      },
    };
  },
});
