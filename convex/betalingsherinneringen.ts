/**
 * Betalingsherinneringen & Aanmaningen (FAC-006, FAC-007)
 *
 * Handles payment reminders and collection letters for overdue invoices.
 * - Herinneringen: friendly reminders at configurable intervals (default 7, 14, 21 days)
 * - Aanmaningen: formal collection letters at configurable intervals (default 30, 45, 60 days)
 *   1e aanmaning (friendly), 2e aanmaning (formal), ingebrekestelling (legal)
 *
 * FASE 2 (PRD §3.2): het AUTOMATISCHE pad (processAutomatischeHerinneringen
 * + de bijbehorende cron) is VERVANGEN door de debiteurenladder in
 * convex/debiteuren.ts — één bron van waarheid, dus hier geen cron meer.
 * De handmatige mutations (verstuurHandmatig/verstuurAanmaning) blijven
 * bestaan voor kantoor; hun records tellen in de ladder mee als afgedekte
 * treden (tredeNiveauVanRecord in debiteurenLogica.ts), zodat de ladder
 * nooit dubbelt met wat kantoor al verstuurde.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrgContext, requireOrgId } from "./auth";
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
  tweede_herinnering: "Tweede herinnering",
  eerste_aanmaning: "1e Aanmaning",
  tweede_aanmaning: "2e Aanmaning",
  ingebrekestelling: "Ingebrekestelling",
  interne_taak: "Interne taak (bellen/aanmaning)",
};

/**
 * List all herinneringen/aanmaningen for a specific factuur.
 */
export const listByFactuur = query({
  args: { factuurId: v.id("facturen") },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);

    const items = await ctx.db
      .query("betalingsherinneringen")
      .withIndex("by_factuur", (q) => q.eq("factuurId", args.factuurId))
      .order("desc")
      .collect();

    // by_factuur is niet org-gescoped: alleen de eigen organisatie teruggeven
    return items.filter((item) => item.orgId?.toString() === orgId.toString());
  },
});

/**
 * Get herinnering count for a factuur (for badge display).
 */
export const getCountByFactuur = query({
  args: { factuurId: v.id("facturen") },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);

    const items = await ctx.db
      .query("betalingsherinneringen")
      .withIndex("by_factuur", (q) => q.eq("factuurId", args.factuurId))
      .collect();

    // by_factuur is niet org-gescoped: alleen de eigen organisatie tellen
    const owned = items.filter(
      (item) => item.orgId?.toString() === orgId.toString()
    );

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
    const orgId = await requireOrgId(ctx);
    const now = Date.now();

    // Get all verzonden + vervallen facturen for the organisatie
    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
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
    const { org, user } = await requireOrgContext(ctx);
    const now = Date.now();

    // Get the factuur
    const factuur = await ctx.db.get(args.factuurId);
    if (!factuur) throw new ConvexError("Factuur niet gevonden");
    if (factuur.orgId?.toString() !== org._id.toString()) {
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
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
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
      orgId: org._id,
      userId: user._id,
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
    const { org, user } = await requireOrgContext(ctx);
    const now = Date.now();

    // Get the factuur
    const factuur = await ctx.db.get(args.factuurId);
    if (!factuur) throw new ConvexError("Factuur niet gevonden");
    if (factuur.orgId?.toString() !== org._id.toString()) {
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

    const ownedBestaande = bestaande.filter(
      (h) => h.orgId?.toString() === org._id.toString()
    );

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
      orgId: org._id,
      userId: user._id,
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
    const orgId = await requireOrgId(ctx);

    const items = await ctx.db
      .query("betalingsherinneringen")
      .withIndex("by_factuur", (q) => q.eq("factuurId", args.factuurId))
      .collect();

    // by_factuur is niet org-gescoped: alleen de eigen organisatie tellen
    const owned = items.filter(
      (item) => item.orgId?.toString() === orgId.toString()
    );

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

// processAutomatischeHerinneringen is verwijderd (fase 2, PRD §3.2): het
// automatische pad loopt nu via de debiteurenladder-cron in
// convex/debiteuren.ts (verwerkLadder). Bestaande records in deze tabel
// blijven gewoon leesbaar en tellen in de ladder mee als afgedekte treden.
