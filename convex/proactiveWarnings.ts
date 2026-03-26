/**
 * Proactive Warnings Engine (SOD-004)
 *
 * Combines planning + fleet + projects to detect conflicts:
 * - Double-booked medewerkers or voertuigen
 * - Missing equipment for planned work
 * - Approaching deadlines
 * - Overdue invoices
 * - Vehicles needing inspection
 */

import { query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

const DAY_MS = 24 * 60 * 60 * 1000;

interface Warning {
  id: string;
  type: "conflict" | "deadline" | "materieel" | "financieel" | "keuring";
  prioriteit: "hoog" | "middel" | "laag";
  titel: string;
  beschrijving: string;
  actie?: string;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateStr(offset: number): string {
  const d = new Date(Date.now() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const getWarnings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const today = todayStr();
    const nextWeek = dateStr(7 * DAY_MS);
    const now = Date.now();

    const [planning, projecten, voertuigen, facturen, medewerkers] = await Promise.all([
      ctx.db.query("weekPlanning").withIndex("by_datum", (q) => q.gte("datum", today)).collect(),
      ctx.db.query("projecten").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("voertuigen").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("facturen").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("medewerkers").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);

    // Only look at planning within next week
    const weekPlanning = planning.filter((p) => p.datum <= nextWeek);
    const warnings: Warning[] = [];

    // ── 1. Double-booked medewerkers ────────────────────────────────

    const medewerkerDagen = new Map<string, Array<{ datum: string; projectId: string }>>();
    for (const entry of weekPlanning) {
      const key = entry.medewerkerId;
      if (!medewerkerDagen.has(key)) medewerkerDagen.set(key, []);
      medewerkerDagen.get(key)!.push({ datum: entry.datum, projectId: entry.projectId });
    }

    for (const [mId, entries] of medewerkerDagen) {
      const dagMap = new Map<string, string[]>();
      for (const e of entries) {
        if (!dagMap.has(e.datum)) dagMap.set(e.datum, []);
        dagMap.get(e.datum)!.push(e.projectId);
      }
      for (const [datum, pIds] of dagMap) {
        if (pIds.length > 1) {
          const mw = medewerkers.find((m) => m._id === mId);
          warnings.push({
            id: `double-${mId}-${datum}`,
            type: "conflict",
            prioriteit: "hoog",
            titel: `Dubbele planning: ${mw?.naam ?? "Medewerker"}`,
            beschrijving: `${mw?.naam ?? "Medewerker"} staat op ${datum} bij ${pIds.length} projecten ingepland`,
            actie: "Herplan één van de projecten",
          });
        }
      }
    }

    // ── 2. Double-booked voertuigen ─────────────────────────────────

    const voertuigDagen = new Map<string, Array<{ datum: string; projectId: string }>>();
    for (const entry of weekPlanning) {
      if (!entry.voertuigId) continue;
      const key = entry.voertuigId;
      if (!voertuigDagen.has(key)) voertuigDagen.set(key, []);
      voertuigDagen.get(key)!.push({ datum: entry.datum, projectId: entry.projectId });
    }

    for (const [vId, entries] of voertuigDagen) {
      const dagMap = new Map<string, string[]>();
      for (const e of entries) {
        if (!dagMap.has(e.datum)) dagMap.set(e.datum, []);
        dagMap.get(e.datum)!.push(e.projectId);
      }
      for (const [datum, pIds] of dagMap) {
        if (pIds.length > 1) {
          const v = voertuigen.find((veh) => veh._id === vId);
          warnings.push({
            id: `double-veh-${vId}-${datum}`,
            type: "conflict",
            prioriteit: "hoog",
            titel: `Dubbele voertuigplanning: ${v?.kenteken ?? "Voertuig"}`,
            beschrijving: `${v?.kenteken ?? "Voertuig"} staat op ${datum} bij ${pIds.length} projecten`,
            actie: "Wijs een ander voertuig toe",
          });
        }
      }
    }

    // ── 3. Vehicles in onderhoud but planned ────────────────────────

    const onderhoudVoertuigen = new Set(
      voertuigen.filter((v) => v.status === "onderhoud" || v.status === "inactief").map((v) => v._id)
    );
    for (const entry of weekPlanning) {
      if (entry.voertuigId && onderhoudVoertuigen.has(entry.voertuigId)) {
        const v = voertuigen.find((veh) => veh._id === entry.voertuigId);
        warnings.push({
          id: `onderhoud-veh-${entry.voertuigId}-${entry.datum}`,
          type: "materieel",
          prioriteit: "hoog",
          titel: `Niet-inzetbaar voertuig gepland`,
          beschrijving: `${v?.kenteken ?? "Voertuig"} (${v?.status}) staat gepland op ${entry.datum}`,
          actie: "Wijs een beschikbaar voertuig toe",
        });
      }
    }

    // ── 4. Approaching APK/insurance ────────────────────────────────

    const in14Days = now + 14 * DAY_MS;
    for (const v of voertuigen) {
      if (v.apkVervaldatum && v.apkVervaldatum < in14Days && v.apkVervaldatum > now - DAY_MS) {
        warnings.push({
          id: `apk-${v._id}`,
          type: "keuring",
          prioriteit: v.apkVervaldatum < now ? "hoog" : "middel",
          titel: `APK ${v.apkVervaldatum < now ? "verlopen" : "verloopt binnenkort"}: ${v.kenteken}`,
          beschrijving: `${v.merk} ${v.model} — APK ${v.apkVervaldatum < now ? "is verlopen" : "verloopt binnen 14 dagen"}`,
          actie: "Plan APK keuring",
        });
      }
    }

    // ── 5. Overdue invoices ─────────────────────────────────────────

    const vervaldeFacturen = facturen.filter((f) => f.status === "vervallen");
    if (vervaldeFacturen.length > 0) {
      const totaal = vervaldeFacturen.reduce((sum, f) => sum + (f.totaalInclBtw ?? 0), 0);
      warnings.push({
        id: "overdue-invoices",
        type: "financieel",
        prioriteit: vervaldeFacturen.length >= 3 ? "hoog" : "middel",
        titel: `${vervaldeFacturen.length} vervallen facturen`,
        beschrijving: `Totaal openstaand: €${Math.round(totaal).toLocaleString("nl-NL")}`,
        actie: "Verstuur aanmaningen",
      });
    }

    // ── 6. Projects without active planning ─────────────────────────

    const actieveProjecten = projecten.filter((p) => p.status === "in_uitvoering");
    const geplandeProjectIds = new Set(weekPlanning.map((p) => p.projectId));
    const ongeplandeProjecten = actieveProjecten.filter(
      (p) => !geplandeProjectIds.has(p._id)
    );
    for (const p of ongeplandeProjecten.slice(0, 3)) {
      warnings.push({
        id: `no-planning-${p._id}`,
        type: "deadline",
        prioriteit: "laag",
        titel: `Project zonder planning: ${p.naam}`,
        beschrijving: `${p.naam} is actief maar heeft geen planning deze week`,
        actie: "Plan medewerkers in",
      });
    }

    // Sort: hoog first, then middel, then laag
    const priorityOrder = { hoog: 0, middel: 1, laag: 2 };
    warnings.sort((a, b) => priorityOrder[a.prioriteit] - priorityOrder[b.prioriteit]);

    return warnings.slice(0, 15);
  },
});
