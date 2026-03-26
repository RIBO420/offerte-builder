/**
 * Voorman Dashboard Queries (SOD-002)
 *
 * Daily planning view for voorman role:
 * - Today's projects with team, vehicle, machines
 * - Team hours overview (who filled in, who didn't)
 * - Project todos
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const getVoormanStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const today = todayStr();

    // Get today's planning entries
    const dagPlanning = await ctx.db
      .query("weekPlanning")
      .withIndex("by_datum", (q) => q.eq("datum", today))
      .collect();

    // Get unique project IDs for today
    const projectIds = [...new Set(dagPlanning.map((p) => p.projectId))];

    // Fetch projects, medewerkers, voertuigen in parallel
    // Use by_datum index to fetch only today's uren instead of full table scan
    const [projecten, allMedewerkers, urenVandaag] = await Promise.all([
      Promise.all(projectIds.map((id) => ctx.db.get(id))),
      ctx.db.query("medewerkers").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("urenRegistraties").withIndex("by_datum", (q) => q.eq("datum", today)).collect(),
    ]);

    // Build project overviews
    const projectOverzichten = await Promise.all(
      projectIds.map(async (projectId) => {
        const project = projecten.find((p) => p?._id === projectId);
        if (!project) return null;

        const entries = dagPlanning.filter((p) => p.projectId === projectId);
        const medewerkerIds = entries.map((e) => e.medewerkerId);

        // Get medewerker details
        const teamLeden = await Promise.all(
          medewerkerIds.map(async (mId) => {
            const mw = allMedewerkers.find((m) => m._id === mId) ?? await ctx.db.get(mId);
            const heeftUren = urenVandaag.some(
              (u) => u.medewerker === mId && u.projectId === projectId
            );
            return {
              id: mId,
              naam: mw?.naam ?? "Onbekend",
              functie: mw?.functie ?? "",
              heeftUren,
            };
          })
        );

        // Get voertuig if assigned
        const voertuigIds = [...new Set(entries.map((e) => e.voertuigId).filter(Boolean))];
        const voertuigen = await Promise.all(
          voertuigIds.map(async (vId) => {
            if (!vId) return null;
            const v = await ctx.db.get(vId);
            return v ? { kenteken: v.kenteken, merk: v.merk, model: v.model } : null;
          })
        );

        // Get planning tasks for this project
        const taken = await ctx.db
          .query("planningTaken")
          .withIndex("by_project", (q) => q.eq("projectId", projectId))
          .collect();

        const openTaken = taken.filter((t) => t.status !== "afgerond");

        return {
          id: projectId,
          naam: project.naam,
          klantNaam: "",
          status: project.status,
          team: teamLeden,
          voertuigen: voertuigen.filter(Boolean),
          taken: {
            totaal: taken.length,
            open: openTaken.length,
            items: openTaken.slice(0, 5).map((t) => ({
              naam: t.taakNaam,
              scope: t.scope,
              status: t.status,
            })),
          },
        };
      })
    );

    // Team uren overzicht
    const urenOverzicht = allMedewerkers
      .filter((m) => m.isActief)
      .map((mw) => {
        const gepland = dagPlanning.some((p) => p.medewerkerId === mw._id);
        const ingevuld = urenVandaag.some((u) => u.medewerker === mw._id);
        return {
          id: mw._id,
          naam: mw.naam,
          functie: mw.functie ?? "",
          gepland,
          ingevuld,
        };
      })
      .filter((m) => m.gepland); // Only show planned medewerkers

    return {
      datum: today,
      projecten: projectOverzichten.filter(Boolean),
      urenOverzicht,
      totaalGepland: dagPlanning.length,
    };
  },
});
