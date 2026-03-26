/**
 * Directie Dashboard Queries (SOD-003)
 *
 * Aggregation queries for management/directie dashboard:
 * - Financial KPIs (revenue, outstanding invoices, margins)
 * - Operational metrics (utilization, project status, nacalculatie)
 * - Quarter-over-quarter comparisons
 */

import { query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

const QUARTER_MS = 90 * 24 * 60 * 60 * 1000; // ~90 days

function getQuarterBounds(date: Date): { start: number; end: number } {
  const quarter = Math.floor(date.getMonth() / 3);
  const start = new Date(date.getFullYear(), quarter * 3, 1).getTime();
  const end = new Date(date.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59, 999).getTime();
  return { start, end };
}

export const getDirectieStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    const now = new Date();
    const thisQ = getQuarterBounds(now);
    const prevQ = getQuarterBounds(new Date(now.getTime() - QUARTER_MS));

    // Fetch all data in parallel
    const [allOffertes, allProjecten, allFacturen, allUren] = await Promise.all([
      ctx.db.query("offertes").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("projecten").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("facturen").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("urenRegistraties").collect(),
    ]);

    // ── Financial KPIs ──────────────────────────────────────────────

    const acceptedOffertes = allOffertes.filter((o) => o.status === "geaccepteerd");
    const totalRevenue = acceptedOffertes.reduce(
      (sum, o) => sum + (o.totalen?.totaalInclBtw ?? 0),
      0
    );

    // Facturen: "definitief" = open/sent, "vervallen" = overdue
    const openFacturen = allFacturen.filter(
      (f) => f.status === "definitief" || f.status === "vervallen"
    );
    const openstaandBedrag = openFacturen.reduce(
      (sum, f) => sum + (f.totaalInclBtw ?? 0),
      0
    );

    const betaaldeFacturen = allFacturen.filter((f) => f.status === "betaald");
    const betaaldBedrag = betaaldeFacturen.reduce(
      (sum, f) => sum + (f.totaalInclBtw ?? 0),
      0
    );

    const vervaldeFacturen = allFacturen.filter((f) => f.status === "vervallen");
    const vervaldenBedrag = vervaldeFacturen.reduce(
      (sum, f) => sum + (f.totaalInclBtw ?? 0),
      0
    );

    // ── Operational KPIs ────────────────────────────────────────────

    const actieveProjecten = allProjecten.filter(
      (p) => p.status === "in_uitvoering" || p.status === "gepland"
    );
    const afgerondeProjecten = allProjecten.filter(
      (p) => p.status === "afgerond" || p.status === "gefactureerd"
    );

    // Utilization: hours logged this month
    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const urenDezeMaand = allUren
      .filter((u) => u.datum >= monthStartStr)
      .reduce((sum, u) => sum + (u.uren ?? 0), 0);

    // Offerte conversion rate
    const verzondenOffertes = allOffertes.filter(
      (o) => o.status === "verzonden" || o.status === "geaccepteerd" || o.status === "afgewezen"
    );
    const conversieRate =
      verzondenOffertes.length > 0
        ? (acceptedOffertes.length / verzondenOffertes.length) * 100
        : 0;

    // Average offerte value
    const gemOfferteWaarde =
      acceptedOffertes.length > 0
        ? totalRevenue / acceptedOffertes.length
        : 0;

    // ── Quarter Comparison ──────────────────────────────────────────

    const offertesThisQ = allOffertes.filter(
      (o) => o.createdAt >= thisQ.start && o.createdAt <= thisQ.end
    );
    const offertesPrevQ = allOffertes.filter(
      (o) => o.createdAt >= prevQ.start && o.createdAt <= prevQ.end
    );

    const acceptedThisQ = offertesThisQ.filter((o) => o.status === "geaccepteerd");
    const acceptedPrevQ = offertesPrevQ.filter((o) => o.status === "geaccepteerd");

    const revenueThisQ = acceptedThisQ.reduce(
      (sum, o) => sum + (o.totalen?.totaalInclBtw ?? 0),
      0
    );
    const revenuePrevQ = acceptedPrevQ.reduce(
      (sum, o) => sum + (o.totalen?.totaalInclBtw ?? 0),
      0
    );

    const facturenThisQ = allFacturen.filter(
      (f) => f.createdAt >= thisQ.start && f.createdAt <= thisQ.end
    );
    const facturenPrevQ = allFacturen.filter(
      (f) => f.createdAt >= prevQ.start && f.createdAt <= prevQ.end
    );

    const gefactureerdThisQ = facturenThisQ.reduce(
      (sum, f) => sum + (f.totaalInclBtw ?? 0),
      0
    );
    const gefactureerdPrevQ = facturenPrevQ.reduce(
      (sum, f) => sum + (f.totaalInclBtw ?? 0),
      0
    );

    // ── Project Status Distribution ─────────────────────────────────

    const projectStatusCounts = {
      gepland: allProjecten.filter((p) => p.status === "gepland").length,
      in_uitvoering: allProjecten.filter((p) => p.status === "in_uitvoering").length,
      afgerond: allProjecten.filter((p) => p.status === "afgerond").length,
      gefactureerd: allProjecten.filter((p) => p.status === "gefactureerd").length,
    };

    return {
      financieel: {
        totaleOmzet: totalRevenue,
        openstaandBedrag,
        betaaldBedrag,
        vervaldenBedrag,
        vervaldeAantal: vervaldeFacturen.length,
        gemOfferteWaarde,
      },
      operationeel: {
        actieveProjecten: actieveProjecten.length,
        afgerondeProjecten: afgerondeProjecten.length,
        totaalProjecten: allProjecten.length,
        urenDezeMaand,
        conversieRate,
        openOffertes: allOffertes.filter((o) => o.status === "verzonden").length,
        projectStatusCounts,
      },
      kwartaalVergelijking: {
        offertesThisQ: offertesThisQ.length,
        offertesPrevQ: offertesPrevQ.length,
        revenueThisQ,
        revenuePrevQ,
        gefactureerdThisQ,
        gefactureerdPrevQ,
        acceptedThisQ: acceptedThisQ.length,
        acceptedPrevQ: acceptedPrevQ.length,
      },
    };
  },
});
