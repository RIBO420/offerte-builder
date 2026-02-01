import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

// ============================================
// Teams CRUD Operations
// ============================================

// Haal alle teams op voor de ingelogde gebruiker
export const list = query({
  args: {
    isActief: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    let teams = await ctx.db
      .query("teams")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter op actief status indien meegegeven
    if (args.isActief !== undefined) {
      teams = teams.filter((t) => t.isActief === args.isActief);
    }

    return teams;
  },
});

// Haal een enkel team op (met eigenaarschap verificatie)
export const get = query({
  args: { id: v.id("teams") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const team = await ctx.db.get(args.id);

    if (!team) return null;
    if (team.userId.toString() !== userId.toString()) {
      return null;
    }

    return team;
  },
});

// Haal team met medewerker details
export const getWithMedewerkers = query({
  args: { id: v.id("teams") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const team = await ctx.db.get(args.id);

    if (!team) return null;
    if (team.userId.toString() !== userId.toString()) {
      return null;
    }

    // Haal alle medewerker details op
    const medewerkers = await Promise.all(
      team.leden.map(async (medewerkerId) => {
        const medewerker = await ctx.db.get(medewerkerId);
        return medewerker;
      })
    );

    // Filter null waarden (verwijderde medewerkers)
    const validMedewerkers = medewerkers.filter((m) => m !== null);

    return {
      ...team,
      medewerkersDetails: validMedewerkers,
    };
  },
});

// Haal alle teams met medewerker details
export const listWithMedewerkers = query({
  args: {
    isActief: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    let teams = await ctx.db
      .query("teams")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter op actief status indien meegegeven
    if (args.isActief !== undefined) {
      teams = teams.filter((t) => t.isActief === args.isActief);
    }

    // Haal medewerker details op voor elk team
    const teamsWithMedewerkers = await Promise.all(
      teams.map(async (team) => {
        const medewerkers = await Promise.all(
          team.leden.map(async (medewerkerId) => {
            const medewerker = await ctx.db.get(medewerkerId);
            return medewerker;
          })
        );

        const validMedewerkers = medewerkers.filter((m) => m !== null);

        return {
          ...team,
          medewerkersDetails: validMedewerkers,
        };
      })
    );

    return teamsWithMedewerkers;
  },
});

// Maak een nieuw team aan
export const create = mutation({
  args: {
    naam: v.string(),
    beschrijving: v.optional(v.string()),
    leden: v.array(v.id("medewerkers")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Verifieer dat alle medewerkers bestaan en van deze gebruiker zijn
    for (const medewerkerId of args.leden) {
      const medewerker = await ctx.db.get(medewerkerId);
      if (!medewerker) {
        throw new Error(`Medewerker niet gevonden: ${medewerkerId}`);
      }
      if (medewerker.userId.toString() !== userId.toString()) {
        throw new Error("Geen toegang tot deze medewerker");
      }
    }

    return await ctx.db.insert("teams", {
      userId,
      naam: args.naam,
      beschrijving: args.beschrijving,
      leden: args.leden,
      isActief: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Werk een team bij
export const update = mutation({
  args: {
    id: v.id("teams"),
    naam: v.optional(v.string()),
    beschrijving: v.optional(v.string()),
    leden: v.optional(v.array(v.id("medewerkers"))),
    isActief: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const team = await ctx.db.get(args.id);
    if (!team) {
      throw new Error("Team niet gevonden");
    }
    if (team.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit team");
    }

    // Als leden worden bijgewerkt, verifieer eigenaarschap
    if (args.leden) {
      for (const medewerkerId of args.leden) {
        const medewerker = await ctx.db.get(medewerkerId);
        if (!medewerker) {
          throw new Error(`Medewerker niet gevonden: ${medewerkerId}`);
        }
        if (medewerker.userId.toString() !== userId.toString()) {
          throw new Error("Geen toegang tot deze medewerker");
        }
      }
    }

    // Bouw update object
    const updateData: {
      naam?: string;
      beschrijving?: string;
      leden?: typeof args.leden;
      isActief?: boolean;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.naam !== undefined) updateData.naam = args.naam;
    if (args.beschrijving !== undefined) updateData.beschrijving = args.beschrijving;
    if (args.leden !== undefined) updateData.leden = args.leden;
    if (args.isActief !== undefined) updateData.isActief = args.isActief;

    await ctx.db.patch(args.id, updateData);

    return args.id;
  },
});

// Voeg een medewerker toe aan een team
export const addLid = mutation({
  args: {
    teamId: v.id("teams"),
    medewerkerId: v.id("medewerkers"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer team eigenaarschap
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team niet gevonden");
    }
    if (team.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit team");
    }

    // Verifieer medewerker eigenaarschap
    const medewerker = await ctx.db.get(args.medewerkerId);
    if (!medewerker) {
      throw new Error("Medewerker niet gevonden");
    }
    if (medewerker.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot deze medewerker");
    }

    // Check of medewerker al lid is
    if (team.leden.includes(args.medewerkerId)) {
      throw new Error("Medewerker is al lid van dit team");
    }

    // Voeg medewerker toe
    await ctx.db.patch(args.teamId, {
      leden: [...team.leden, args.medewerkerId],
      updatedAt: Date.now(),
    });

    return args.teamId;
  },
});

// Verwijder een medewerker uit een team
export const removeLid = mutation({
  args: {
    teamId: v.id("teams"),
    medewerkerId: v.id("medewerkers"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer team eigenaarschap
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team niet gevonden");
    }
    if (team.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit team");
    }

    // Verwijder medewerker uit de lijst
    const nieuweLeden = team.leden.filter((id) => id !== args.medewerkerId);

    await ctx.db.patch(args.teamId, {
      leden: nieuweLeden,
      updatedAt: Date.now(),
    });

    return args.teamId;
  },
});

// Soft delete: zet isActief op false
export const remove = mutation({
  args: { id: v.id("teams") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const team = await ctx.db.get(args.id);
    if (!team) {
      throw new Error("Team niet gevonden");
    }
    if (team.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit team");
    }

    await ctx.db.patch(args.id, {
      isActief: false,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

// Permanent verwijderen
export const hardDelete = mutation({
  args: { id: v.id("teams") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const team = await ctx.db.get(args.id);
    if (!team) {
      throw new Error("Team niet gevonden");
    }
    if (team.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit team");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// ============================================
// Team Prestaties (Performance Metrics)
// ============================================

// Haal gecombineerde prestaties op voor een team
export const getTeamPrestaties = query({
  args: { id: v.id("teams") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const team = await ctx.db.get(args.id);

    if (!team) return null;
    if (team.userId.toString() !== userId.toString()) {
      return null;
    }

    // Haal alle medewerkers op
    const medewerkers = await Promise.all(
      team.leden.map(async (medewerkerId) => {
        return await ctx.db.get(medewerkerId);
      })
    );

    const validMedewerkers = medewerkers.filter((m) => m !== null);
    const activeMedewerkers = validMedewerkers.filter((m) => m.isActief);

    // Haal alle projecten op voor performance berekeningen
    const projecten = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Haal alle urenregistraties op
    const alleUrenRegistraties = [];
    for (const project of projecten) {
      const registraties = await ctx.db
        .query("urenRegistraties")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();
      alleUrenRegistraties.push(...registraties);
    }

    // Bereken team statistieken
    let totaalUren = 0;
    let totaalRegistraties = 0;

    // Verzamel uren per teamlid
    const urenPerLid: Record<string, number> = {};
    for (const medewerker of validMedewerkers) {
      const medewerkerNaam = medewerker.naam.toLowerCase();
      urenPerLid[medewerker._id] = 0;

      for (const registratie of alleUrenRegistraties) {
        if (registratie.medewerker.toLowerCase() === medewerkerNaam) {
          urenPerLid[medewerker._id] += registratie.uren;
          totaalUren += registratie.uren;
          totaalRegistraties++;
        }
      }
    }

    // Bereken totale capaciteit (gebaseerd op beschikbaarheid)
    let totaleCapaciteitPerWeek = 0;
    for (const medewerker of activeMedewerkers) {
      if (medewerker.beschikbaarheid) {
        totaleCapaciteitPerWeek += medewerker.beschikbaarheid.urenPerWeek;
      } else {
        // Default: 40 uur per week voor fulltime
        totaleCapaciteitPerWeek += 40;
      }
    }

    // Verzamel specialisaties van het team
    const teamSpecialisaties: Record<string, number> = {};
    for (const medewerker of validMedewerkers) {
      if (medewerker.specialisaties) {
        for (const spec of medewerker.specialisaties) {
          if (!teamSpecialisaties[spec.scope]) {
            teamSpecialisaties[spec.scope] = 0;
          }
          teamSpecialisaties[spec.scope]++;
        }
      }
    }

    // Bereken gemiddeld uurtarief
    let totaalTarief = 0;
    let tariefCount = 0;
    for (const medewerker of activeMedewerkers) {
      if (medewerker.uurtarief) {
        totaalTarief += medewerker.uurtarief;
        tariefCount++;
      }
    }
    const gemiddeldUurtarief = tariefCount > 0 ? totaalTarief / tariefCount : 0;

    return {
      team,
      medewerkers: validMedewerkers,
      statistieken: {
        aantalLeden: validMedewerkers.length,
        aantalActief: activeMedewerkers.length,
        totaalUren,
        totaalRegistraties,
        gemiddeldUurtarief,
        totaleCapaciteitPerWeek,
        urenPerLid,
        teamSpecialisaties,
      },
    };
  },
});

// Haal prestaties voor alle teams op (overzicht)
export const getAllTeamsPrestaties = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const activeTeams = teams.filter((t) => t.isActief);

    // Haal projecten en uren voor context
    const projecten = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const alleUrenRegistraties = [];
    for (const project of projecten) {
      const registraties = await ctx.db
        .query("urenRegistraties")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();
      alleUrenRegistraties.push(...registraties);
    }

    // Bereken statistieken per team
    const teamStats = await Promise.all(
      activeTeams.map(async (team) => {
        const medewerkers = await Promise.all(
          team.leden.map((id) => ctx.db.get(id))
        );
        const validMedewerkers = medewerkers.filter((m) => m !== null);
        const activeMedewerkers = validMedewerkers.filter((m) => m.isActief);

        // Bereken uren voor dit team
        let teamUren = 0;
        for (const medewerker of validMedewerkers) {
          const medewerkerNaam = medewerker.naam.toLowerCase();
          for (const registratie of alleUrenRegistraties) {
            if (registratie.medewerker.toLowerCase() === medewerkerNaam) {
              teamUren += registratie.uren;
            }
          }
        }

        return {
          team,
          aantalLeden: validMedewerkers.length,
          aantalActief: activeMedewerkers.length,
          totaalUren: teamUren,
        };
      })
    );

    return {
      teams: teamStats,
      totaalTeams: activeTeams.length,
      totaalMedewerkers: teamStats.reduce((sum, t) => sum + t.aantalLeden, 0),
    };
  },
});
