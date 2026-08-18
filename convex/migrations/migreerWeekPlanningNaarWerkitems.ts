/**
 * Migratie: legacy planning (weekPlanning) → werkitem-planvelden (B1-restant,
 * PRD §2.2 stap 5a — principe 1: één record, twee weergaven).
 *
 * Wat er gebeurt per werkitem (tabel "projecten") ZONDER geplandeStart:
 * - geplandeStart/geplandeEind = min/max van de weekPlanning-datums (eenduidig);
 * - teamId alleen als precies één actief team ALLE ingeplande medewerkers
 *   bevat — anders wordt de rij GERAPPORTEERD, niet gegokt
 *   (afleidPlanningUitWeekPlanning in convex/planbordLogica.ts).
 *
 * NIET gemigreerd (by design, gerapporteerd):
 * - planningTaken: hebben geen datum/team — er is geen planning af te leiden;
 *   de tabel blijft bestaan als taken-checklist (schema-comment: deprecated
 *   voor planning).
 * - werkitems die al een geplandeStart hebben (idempotentie: de migratie kan
 *   veilig opnieuw draaien, bestaande planvelden worden nooit overschreven).
 * - weekPlanning-rijen zelf worden NIET verwijderd (lezen mag; het nieuwe
 *   bord schrijft uitsluitend naar werkitems).
 *
 * Deprecated schrijfpaden na deze migratie (zie ook schema-comments):
 * - convex/weekPlanning.ts mutations (planning per medewerker-dag);
 * - planningTaken-writes voor plandoeleinden.
 *
 * Gebatcht (100 projecten per transactie, vervolg via scheduler) en idempotent.
 *
 * Draaien via CLI (dry run eerst!):
 *   npx convex run migrations/migreerWeekPlanningNaarWerkitems:migreer '{"dryRun": true}'
 *   npx convex run migrations/migreerWeekPlanningNaarWerkitems:migreer
 * Verificatie:
 *   npx convex run migrations/migreerWeekPlanningNaarWerkitems:verifieer
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { Doc } from "../_generated/dataModel";
import { afleidPlanningUitWeekPlanning } from "../planbordLogica";

const BATCH_SIZE = 100;
const MAX_RAPPORT_RIJEN = 50;

const statsValidator = v.object({
  bekeken: v.number(),
  gemigreerd: v.number(),
  metTeam: v.number(),
  alGepland: v.number(),
  zonderWeekPlanning: v.number(),
  teamNietEenduidig: v.number(),
  rapport: v.array(
    v.object({
      projectId: v.string(),
      naam: v.string(),
      reden: v.string(),
    })
  ),
});

type Stats = {
  bekeken: number;
  gemigreerd: number;
  metTeam: number;
  alGepland: number;
  zonderWeekPlanning: number;
  teamNietEenduidig: number;
  rapport: { projectId: string; naam: string; reden: string }[];
};

const leegStats = (): Stats => ({
  bekeken: 0,
  gemigreerd: 0,
  metTeam: 0,
  alGepland: 0,
  zonderWeekPlanning: 0,
  teamNietEenduidig: 0,
  rapport: [],
});

export const migreer = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
    stats: v.optional(statsValidator),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    const stats: Stats = args.stats ?? leegStats();

    const page = await ctx.db
      .query("projecten")
      .paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null });

    // Teams per bedrijf (userId) — cache binnen de batch
    const teamsCache = new Map<string, Doc<"teams">[]>();

    for (const project of page.page) {
      if (project.deletedAt) continue;
      stats.bekeken++;

      // Idempotentie: bestaande planning nooit overschrijven
      if (project.geplandeStart !== undefined) {
        stats.alGepland++;
        continue;
      }

      const rijen = await ctx.db
        .query("weekPlanning")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();
      if (rijen.length === 0) {
        stats.zonderWeekPlanning++;
        continue;
      }

      const orgKey = project.orgId.toString();
      if (!teamsCache.has(orgKey)) {
        teamsCache.set(
          orgKey,
          await ctx.db
            .query("teams")
            .withIndex("by_org", (q) => q.eq("orgId", project.orgId))
            .collect()
        );
      }
      const teams = teamsCache.get(orgKey)!;

      const afgeleid = afleidPlanningUitWeekPlanning(rijen, teams);
      if (!afgeleid) {
        stats.zonderWeekPlanning++;
        continue;
      }

      if (!dryRun) {
        await ctx.db.patch(project._id, {
          geplandeStart: afgeleid.geplandeStart,
          geplandeEind: afgeleid.geplandeEind,
          ...(afgeleid.teamId ? { teamId: afgeleid.teamId } : {}),
          updatedAt: Date.now(),
        });
      }
      stats.gemigreerd++;
      if (afgeleid.teamId) {
        stats.metTeam++;
      } else {
        stats.teamNietEenduidig++;
        if (stats.rapport.length < MAX_RAPPORT_RIJEN) {
          stats.rapport.push({
            projectId: project._id.toString(),
            naam: project.naam,
            reden: afgeleid.redenGeenTeam ?? "team niet eenduidig",
          });
        }
      }
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.migreerWeekPlanningNaarWerkitems.migreer,
        { dryRun, cursor: page.continueCursor, stats }
      );
      return { status: "batch klaar, vervolg ingepland", dryRun, stats };
    }

    console.log(
      `[migreerWeekPlanningNaarWerkitems] klaar (dryRun=${dryRun}):`,
      JSON.stringify(stats)
    );
    return { status: "klaar", dryRun, stats };
  },
});

/**
 * Verificatie: telt werkitems die nog weekPlanning-rijen hebben maar geen
 * geplandeStart (zou na de migratie alleen nog gevallen zonder rijen of met
 * verwijderde projecten moeten zijn: verwacht 0).
 */
export const verifieer = internalQuery({
  args: {},
  handler: async (ctx) => {
    const alleRijen = await ctx.db.query("weekPlanning").collect();
    const projectIds = [...new Set(alleRijen.map((r) => r.projectId))];
    let zonderPlanvelden = 0;
    const voorbeelden: string[] = [];
    for (const projectId of projectIds) {
      const project = await ctx.db.get(projectId);
      if (project && !project.deletedAt && project.geplandeStart === undefined) {
        zonderPlanvelden++;
        if (voorbeelden.length < 10) voorbeelden.push(project.naam);
      }
    }
    return {
      weekPlanningRijen: alleRijen.length,
      projectenMetWeekPlanning: projectIds.length,
      nogZonderPlanvelden: zonderPlanvelden,
      voorbeelden,
    };
  },
});
