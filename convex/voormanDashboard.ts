/**
 * Voorman Dashboard Queries (SOD-002)
 *
 * Daily planning view for voorman role:
 * - Today's projects with team, vehicle, machines
 * - Team hours overview (who filled in, who didn't)
 * - Project todos
 */

import { query } from "./_generated/server";
import { requireAuthUserId } from "./auth";
import { laadDocsMap } from "./lib/batchLoad";
import type { Doc } from "./_generated/dataModel";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const getVoormanStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const today = todayStr();

    // Tenant-lek gedicht (audit §2): `weekPlanning` en `urenRegistraties`
    // werden alleen op datum gefilterd — `by_datum` heeft geen userId, dus het
    // dashboard toonde de planning en uren van ÁLLE bedrijven van die dag.
    // De projecten van dit bedrijf zijn de tenant-grens: alleen planningrijen
    // en urenregistraties die aan een eigen project hangen, tellen mee. (Niet
    // via `urenRegistraties.by_user_datum`, want `userId` is daar optioneel en
    // pre-backfill-rijen zouden stil wegvallen.)
    const [dagPlanningRuw, urenVandaagRuw, eigenProjecten, allMedewerkers] =
      await Promise.all([
        ctx.db
          .query("weekPlanning")
          .withIndex("by_datum", (q) => q.eq("datum", today))
          .collect(),
        ctx.db
          .query("urenRegistraties")
          .withIndex("by_datum", (q) => q.eq("datum", today))
          .collect(),
        ctx.db
          .query("projecten")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
        ctx.db
          .query("medewerkers")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
      ]);

    const eigenProjectIds = new Set(
      eigenProjecten.map((p) => p._id.toString())
    );
    const dagPlanning = dagPlanningRuw.filter((p) =>
      eigenProjectIds.has(p.projectId.toString())
    );
    const urenVandaag = urenVandaagRuw.filter((u) =>
      eigenProjectIds.has(u.projectId.toString())
    );

    // Get unique project IDs for today
    const projectIds = [...new Set(dagPlanning.map((p) => p.projectId))];
    const projectMap = new Map(
      eigenProjecten.map((p) => [p._id.toString(), p] as const)
    );

    // N+1 weg (audit §5): medewerkers en voertuigen één keer vóór de lus in een
    // Map zetten. Voorheen deed elk teamlid en elk voertuig zijn eigen get,
    // ook als dezelfde medewerker op vier projecten van vandaag stond.
    const medewerkerMap = new Map<string, Doc<"medewerkers">>();
    for (const mw of allMedewerkers) {
      medewerkerMap.set(mw._id.toString(), mw);
    }
    // Vangnet voor medewerkers die niet in de by_user-lijst zitten (bv. net
    // aangepast), maar alleen binnen de eigen tenant — een medewerker van een
    // ander bedrijf komt er niet meer bij.
    const ontbrekendeMedewerkers = await laadDocsMap(
      ctx,
      dagPlanning
        .map((p) => p.medewerkerId)
        .filter((id) => !medewerkerMap.has(id.toString()))
    );
    for (const mw of ontbrekendeMedewerkers.values()) {
      if (mw.userId.toString() === userId.toString()) {
        medewerkerMap.set(mw._id.toString(), mw);
      }
    }

    const voertuigMap = await laadDocsMap(
      ctx,
      dagPlanning.map((p) => p.voertuigId)
    );

    // Build project overviews
    const projectOverzichten = await Promise.all(
      projectIds.map(async (projectId) => {
        const project = projectMap.get(projectId.toString());
        if (!project) return null;

        const entries = dagPlanning.filter((p) => p.projectId === projectId);
        const medewerkerIds = entries.map((e) => e.medewerkerId);

        // Get medewerker details
        const teamLeden = medewerkerIds.map((mId) => {
          const mw = medewerkerMap.get(mId.toString());
          // `urenRegistraties.medewerker` is een NAAM-string; de getypte
          // `medewerkerId` is optioneel (mobiel vult hem, import niet). De
          // vergelijking stond op `u.medewerker === mId` — naam tegen id, dus
          // altijd false: het vinkje "uren ingevuld" ging nooit aan.
          const heeftUren = urenVandaag.some(
            (u) =>
              u.projectId === projectId &&
              (u.medewerkerId?.toString() === mId.toString() ||
                (mw !== undefined && u.medewerker === mw.naam))
          );
          return {
            id: mId,
            naam: mw?.naam ?? "Onbekend",
            functie: mw?.functie ?? "",
            heeftUren,
          };
        });

        // Get voertuig if assigned
        const voertuigIds = [...new Set(entries.map((e) => e.voertuigId).filter(Boolean))];
        const voertuigen = voertuigIds.map((vId) => {
          if (!vId) return null;
          const v = voertuigMap.get(vId.toString());
          return v ? { kenteken: v.kenteken, merk: v.merk, model: v.model } : null;
        });

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
        // Zelfde naam-vs-id-verwarring als hierboven: naam of getypte id.
        const ingevuld = urenVandaag.some(
          (u) =>
            u.medewerkerId?.toString() === mw._id.toString() ||
            u.medewerker === mw.naam
        );
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
