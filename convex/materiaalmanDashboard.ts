/**
 * Materiaalman Dashboard Queries (SOD-001)
 *
 * Aggregation queries for materiaalman role:
 * - Vehicle/machine status and defects
 * - Upcoming inspections (APK, insurance)
 * - Open purchase orders
 * - Stock alerts
 */

import { query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export const getMateriaalmanStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();
    const in30Days = now + 30 * DAY_MS;

    const [voertuigen, machines, inkooporders, voorraad, qcChecks] = await Promise.all([
      ctx.db.query("voertuigen").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("machines").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("inkooporders").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("voorraad").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("kwaliteitsControles").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);

    // ── Voertuigen status ───────────────────────────────────────────

    const voertuigenInOnderhoud = voertuigen.filter((v) => v.status === "onderhoud");
    const voertuigenInactief = voertuigen.filter((v) => v.status === "inactief");
    const voertuigenActief = voertuigen.filter((v) => v.status === "actief");

    // Naderende APK/verzekering vervaldatums
    const naderendeKeuringen: Array<{
      id: string;
      kenteken: string;
      merk: string;
      model: string;
      type: "apk" | "verzekering";
      vervaldatum: number;
      isVervallen: boolean;
    }> = [];

    for (const v of voertuigen) {
      if (v.apkVervaldatum && v.apkVervaldatum <= in30Days) {
        naderendeKeuringen.push({
          id: v._id,
          kenteken: v.kenteken,
          merk: v.merk,
          model: v.model,
          type: "apk",
          vervaldatum: v.apkVervaldatum,
          isVervallen: v.apkVervaldatum < now,
        });
      }
      if (v.verzekeringsVervaldatum && v.verzekeringsVervaldatum <= in30Days) {
        naderendeKeuringen.push({
          id: v._id,
          kenteken: v.kenteken,
          merk: v.merk,
          model: v.model,
          type: "verzekering",
          vervaldatum: v.verzekeringsVervaldatum,
          isVervallen: v.verzekeringsVervaldatum < now,
        });
      }
    }

    // Sort: vervallen first, then by date
    naderendeKeuringen.sort((a, b) => {
      if (a.isVervallen && !b.isVervallen) return -1;
      if (!a.isVervallen && b.isVervallen) return 1;
      return a.vervaldatum - b.vervaldatum;
    });

    // ── Blokkades (niet inzetbaar) ──────────────────────────────────

    const blokkades: Array<{
      naam: string;
      reden: string;
      prioriteit: "hoog" | "middel" | "laag";
    }> = [];

    for (const v of voertuigenInOnderhoud) {
      blokkades.push({
        naam: `${v.merk} ${v.model} (${v.kenteken})`,
        reden: "In onderhoud",
        prioriteit: "hoog",
      });
    }
    for (const v of voertuigenInactief) {
      blokkades.push({
        naam: `${v.merk} ${v.model} (${v.kenteken})`,
        reden: "Inactief",
        prioriteit: "middel",
      });
    }
    for (const m of machines.filter((m) => !m.isActief)) {
      blokkades.push({
        naam: m.naam,
        reden: "Machine niet actief",
        prioriteit: "middel",
      });
    }

    // ── Inkooporders ────────────────────────────────────────────────

    const openOrders = inkooporders.filter(
      (o) => o.status === "besteld" || o.status === "concept"
    );

    // ── Voorraad alerts ─────────────────────────────────────────────

    const lowStock = voorraad.filter(
      (v) => v.minVoorraad && v.hoeveelheid < v.minVoorraad
    );

    // ── QC Status ───────────────────────────────────────────────────

    const openQC = qcChecks.filter(
      (q) => q.status === "open" || q.status === "in_uitvoering"
    );
    const afgekeurdQC = qcChecks.filter((q) => q.status === "afgekeurd");

    return {
      vloot: {
        totaal: voertuigen.length,
        actief: voertuigenActief.length,
        inOnderhoud: voertuigenInOnderhoud.length,
        inactief: voertuigenInactief.length,
      },
      machines: {
        totaal: machines.length,
        actief: machines.filter((m) => m.isActief).length,
      },
      naderendeKeuringen: naderendeKeuringen.slice(0, 10),
      blokkades,
      inkooporders: {
        open: openOrders.length,
        items: await Promise.all(openOrders.slice(0, 5).map(async (o) => {
          const leverancier = await ctx.db.get(o.leverancierId);
          return {
            id: o._id,
            leverancier: leverancier?.naam ?? "Onbekend",
            status: o.status,
            totaal: o.totaal ?? 0,
            createdAt: o.createdAt,
          };
        })),
      },
      voorraadAlerts: lowStock.length,
      qcStatus: {
        open: openQC.length,
        afgekeurd: afgekeurdQC.length,
      },
    };
  },
});
