/**
 * Betalingsherinneringen & Aanmaningen (FAC-006, FAC-007)
 *
 * Handles payment reminders and collection letters for overdue invoices.
 * - Herinneringen: friendly reminders at configurable intervals (default 7, 14, 21 days)
 * - Aanmaningen: formal collection letters at configurable intervals (default 30, 45, 60 days)
 *   1e aanmaning (friendly), 2e aanmaning (formal), ingebrekestelling (legal)
 */

import { v, ConvexError } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireAuthUserId } from "./auth";
import { requireNotViewer } from "./roles";

/**
 * Determine the type of reminder/collection based on days overdue.
 */
function determineType(
  dagenVervallen: number,
  aanmaningDagen: number[]
): "herinnering" | "eerste_aanmaning" | "tweede_aanmaning" | "ingebrekestelling" {
  if (dagenVervallen >= aanmaningDagen[2]) return "ingebrekestelling";
  if (dagenVervallen >= aanmaningDagen[1]) return "tweede_aanmaning";
  if (dagenVervallen >= aanmaningDagen[0]) return "eerste_aanmaning";
  return "herinnering";
}

/**
 * Type labels for display in Dutch.
 */
export const typeLabels: Record<string, string> = {
  herinnering: "Betalingsherinnering",
  eerste_aanmaning: "1e Aanmaning",
  tweede_aanmaning: "2e Aanmaning",
  ingebrekestelling: "Ingebrekestelling",
};

/**
 * List all herinneringen/aanmaningen for a specific factuur.
 */
export const listByFactuur = query({
  args: { factuurId: v.id("facturen") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const items = await ctx.db
      .query("betalingsherinneringen")
      .withIndex("by_factuur", (q) => q.eq("factuurId", args.factuurId))
      .order("desc")
      .collect();

    // Only return items owned by the user
    return items.filter((item) => item.userId.toString() === userId.toString());
  },
});

/**
 * Get herinnering count for a factuur (for badge display).
 */
export const getCountByFactuur = query({
  args: { factuurId: v.id("facturen") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const items = await ctx.db
      .query("betalingsherinneringen")
      .withIndex("by_factuur", (q) => q.eq("factuurId", args.factuurId))
      .collect();

    const owned = items.filter((item) => item.userId.toString() === userId.toString());

    return {
      totaal: owned.length,
      herinneringen: owned.filter((i) => i.type === "herinnering").length,
      aanmaningen: owned.filter((i) => i.type !== "herinnering").length,
    };
  },
});

/**
 * Get overdue stats for facturen list display.
 * Returns a map of factuurId -> { dagenVervallen, aantalHerinneringen }.
 */
export const getOverdueStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Get all verzonden + vervallen facturen for the user
    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const overdueFacturen = facturen.filter(
      (f) =>
        (f.status === "verzonden" || f.status === "vervallen") &&
        now > f.vervaldatum &&
        !f.isCreditnota
    );

    // Build stats map
    const stats: Record<string, { dagenVervallen: number; aantalHerinneringen: number }> = {};

    for (const factuur of overdueFacturen) {
      const dagenVervallen = Math.floor(
        (now - factuur.vervaldatum) / (24 * 60 * 60 * 1000)
      );

      const herinneringen = await ctx.db
        .query("betalingsherinneringen")
        .withIndex("by_factuur", (q) => q.eq("factuurId", factuur._id))
        .collect();

      stats[factuur._id] = {
        dagenVervallen,
        aantalHerinneringen: herinneringen.length,
      };
    }

    return stats;
  },
});

/**
 * Manually send a betalingsherinnering for a specific factuur.
 * Used by the UI "Herinnering Sturen" button.
 */
export const verstuurHandmatig = mutation({
  args: {
    factuurId: v.id("facturen"),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Get the factuur
    const factuur = await ctx.db.get(args.factuurId);
    if (!factuur) throw new ConvexError("Factuur niet gevonden");
    if (factuur.userId.toString() !== userId.toString()) {
      throw new ConvexError("Geen toegang tot deze factuur");
    }

    // Only for verzonden or vervallen facturen
    if (factuur.status !== "verzonden" && factuur.status !== "vervallen") {
      throw new ConvexError("Herinneringen kunnen alleen verstuurd worden voor verzonden of vervallen facturen");
    }

    // Calculate days overdue
    const dagenVervallen = Math.max(0, Math.floor((now - factuur.vervaldatum) / (24 * 60 * 60 * 1000)));

    // Get instellingen for aanmaning thresholds
    const instellingen = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const aanmaningDagen = instellingen?.herinneringInstellingen?.aanmaningDagen ?? [30, 45, 60];

    // Determine type based on days overdue
    const type = determineType(dagenVervallen, aanmaningDagen);

    // Get existing herinneringen to determine volgnummer
    const bestaande = await ctx.db
      .query("betalingsherinneringen")
      .withIndex("by_factuur", (q) => q.eq("factuurId", args.factuurId))
      .collect();

    const volgnummer = bestaande.filter((h) => h.type === type).length + 1;

    // Create the herinnering record
    const herinneringId = await ctx.db.insert("betalingsherinneringen", {
      factuurId: args.factuurId,
      userId,
      type,
      volgnummer,
      dagenVervallen,
      verstuurdAt: now,
      emailVerstuurd: true,
      notities: args.notities,
    });

    // Update factuur status to vervallen if still verzonden and overdue
    if (factuur.status === "verzonden" && dagenVervallen > 0) {
      await ctx.db.patch(args.factuurId, {
        status: "vervallen",
        updatedAt: now,
      });
    }

    return herinneringId;
  },
});

/**
 * Manually send an aanmaning with explicit level selection (FAC-007).
 * Used by the UI "Aanmaning Versturen" button with level picker.
 */
export const verstuurAanmaning = mutation({
  args: {
    factuurId: v.id("facturen"),
    type: v.union(
      v.literal("eerste_aanmaning"),
      v.literal("tweede_aanmaning"),
      v.literal("ingebrekestelling")
    ),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Get the factuur
    const factuur = await ctx.db.get(args.factuurId);
    if (!factuur) throw new ConvexError("Factuur niet gevonden");
    if (factuur.userId.toString() !== userId.toString()) {
      throw new ConvexError("Geen toegang tot deze factuur");
    }

    // Only for verzonden or vervallen facturen
    if (factuur.status !== "verzonden" && factuur.status !== "vervallen") {
      throw new ConvexError("Aanmaningen kunnen alleen verstuurd worden voor verzonden of vervallen facturen");
    }

    // Calculate days overdue
    const dagenVervallen = Math.max(0, Math.floor((now - factuur.vervaldatum) / (24 * 60 * 60 * 1000)));

    // Validate escalation order: check if previous levels have been sent
    const bestaande = await ctx.db
      .query("betalingsherinneringen")
      .withIndex("by_factuur", (q) => q.eq("factuurId", args.factuurId))
      .collect();

    const ownedBestaande = bestaande.filter((h) => h.userId.toString() === userId.toString());

    // Enforce escalation: can't skip levels
    if (args.type === "tweede_aanmaning") {
      const heeftEerste = ownedBestaande.some((h) => h.type === "eerste_aanmaning");
      if (!heeftEerste) {
        throw new ConvexError("Verstuur eerst een 1e aanmaning voordat u een 2e aanmaning kunt versturen");
      }
    }
    if (args.type === "ingebrekestelling") {
      const heeftTweede = ownedBestaande.some((h) => h.type === "tweede_aanmaning");
      if (!heeftTweede) {
        throw new ConvexError("Verstuur eerst een 2e aanmaning voordat u een ingebrekestelling kunt versturen");
      }
    }

    const volgnummer = ownedBestaande.filter((h) => h.type === args.type).length + 1;

    // Create the aanmaning record
    const aanmaningId = await ctx.db.insert("betalingsherinneringen", {
      factuurId: args.factuurId,
      userId,
      type: args.type,
      volgnummer,
      dagenVervallen,
      verstuurdAt: now,
      emailVerstuurd: true,
      notities: args.notities,
    });

    // Update factuur status to vervallen if still verzonden and overdue
    if (factuur.status === "verzonden" && dagenVervallen > 0) {
      await ctx.db.patch(args.factuurId, {
        status: "vervallen",
        updatedAt: now,
      });
    }

    return aanmaningId;
  },
});

/**
 * Get the current aanmaning level for a factuur (FAC-007).
 * Returns info about what has been sent and what the next level should be.
 */
export const getAanmaningStatus = query({
  args: { factuurId: v.id("facturen") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const items = await ctx.db
      .query("betalingsherinneringen")
      .withIndex("by_factuur", (q) => q.eq("factuurId", args.factuurId))
      .collect();

    const owned = items.filter((item) => item.userId.toString() === userId.toString());

    const heeftHerinnering = owned.some((i) => i.type === "herinnering");
    const heeftEerste = owned.some((i) => i.type === "eerste_aanmaning");
    const heeftTweede = owned.some((i) => i.type === "tweede_aanmaning");
    const heeftIngebrekestelling = owned.some((i) => i.type === "ingebrekestelling");

    // Determine next available aanmaning level
    let volgendNiveau: "eerste_aanmaning" | "tweede_aanmaning" | "ingebrekestelling" | null = null;
    if (!heeftEerste) {
      volgendNiveau = "eerste_aanmaning";
    } else if (!heeftTweede) {
      volgendNiveau = "tweede_aanmaning";
    } else if (!heeftIngebrekestelling) {
      volgendNiveau = "ingebrekestelling";
    }

    // Determine the highest sent level
    let hoogsteNiveau: string | null = null;
    if (heeftIngebrekestelling) hoogsteNiveau = "ingebrekestelling";
    else if (heeftTweede) hoogsteNiveau = "tweede_aanmaning";
    else if (heeftEerste) hoogsteNiveau = "eerste_aanmaning";
    else if (heeftHerinnering) hoogsteNiveau = "herinnering";

    return {
      totaalVerstuurd: owned.length,
      heeftHerinnering,
      heeftEerste,
      heeftTweede,
      heeftIngebrekestelling,
      volgendNiveau,
      hoogsteNiveau,
      laatsteVerstuurd: owned.length > 0
        ? owned.sort((a, b) => b.verstuurdAt - a.verstuurdAt)[0]
        : null,
    };
  },
});

/**
 * Internal mutation: Process automatic reminders for all overdue invoices.
 * Called by the daily cron job.
 */
export const processAutomatischeHerinneringen = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let verwerkt = 0;

    // Get all verzonden facturen that are overdue
    const verzondenFacturen = await ctx.db
      .query("facturen")
      .withIndex("by_status", (q) => q.eq("status", "verzonden"))
      .collect();

    const vervallenFacturen = await ctx.db
      .query("facturen")
      .withIndex("by_status", (q) => q.eq("status", "vervallen"))
      .collect();

    const overdueFacturen = [...verzondenFacturen, ...vervallenFacturen].filter(
      (f) => now > f.vervaldatum && !f.isCreditnota
    );

    for (const factuur of overdueFacturen) {
      const dagenVervallen = Math.floor((now - factuur.vervaldatum) / (24 * 60 * 60 * 1000));

      // Get user's instellingen
      const instellingen = await ctx.db
        .query("instellingen")
        .withIndex("by_user", (q) => q.eq("userId", factuur.userId))
        .unique();

      if (!instellingen?.herinneringInstellingen?.automatischVersturen) {
        continue; // Skip if automatic sending is not enabled
      }

      const herinneringDagen = instellingen.herinneringInstellingen.herinneringDagen ?? [7, 14, 21];
      const aanmaningDagen = instellingen.herinneringInstellingen.aanmaningDagen ?? [30, 45, 60];
      const alleDagen = [...herinneringDagen, ...aanmaningDagen].sort((a, b) => a - b);

      // Get existing herinneringen for this factuur
      const bestaande = await ctx.db
        .query("betalingsherinneringen")
        .withIndex("by_factuur", (q) => q.eq("factuurId", factuur._id))
        .collect();

      // Check if we should send a new herinnering at this point
      // Find the highest threshold that has been crossed
      const toepasselijkeDagen = alleDagen.filter((d) => dagenVervallen >= d);
      if (toepasselijkeDagen.length === 0) continue;

      // Check if we already sent for the latest applicable threshold
      const laatsteDag = toepasselijkeDagen[toepasselijkeDagen.length - 1];
      const alVerstuurd = bestaande.some((h) => {
        // Check if a herinnering was already sent for approximately this threshold
        const threshold = alleDagen.find((d) => Math.abs(h.dagenVervallen - d) <= 2);
        return threshold === laatsteDag;
      });

      if (alVerstuurd) continue;

      // Determine type
      const type = determineType(dagenVervallen, aanmaningDagen);
      const volgnummer = bestaande.filter((h) => h.type === type).length + 1;

      // Create the herinnering record
      await ctx.db.insert("betalingsherinneringen", {
        factuurId: factuur._id,
        userId: factuur.userId,
        type,
        volgnummer,
        dagenVervallen,
        verstuurdAt: now,
        emailVerstuurd: true,
        notities: `Automatisch verstuurd na ${dagenVervallen} dagen`,
      });

      // Update factuur status to vervallen if still verzonden
      if (factuur.status === "verzonden") {
        await ctx.db.patch(factuur._id, {
          status: "vervallen",
          updatedAt: now,
        });
      }

      verwerkt++;
    }

    return { verwerkt };
  },
});
