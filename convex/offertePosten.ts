/**
 * Posten hergebruiken in de vrije builder (HERO-nabouw fase 6, SHOULD):
 * - een vrije offerte als sjabloon bewaren (met de regels zelf);
 * - posten overnemen uit een sjabloon of een eerdere offerte (HERO: "Uit
 *   welk ander document moeten artikelen worden overgenomen?").
 *
 * Overnemen gebeurt in de editor (client): de query's leveren de regels, de
 * builder geeft ze nieuwe id's en slaat op via vrijeOfferte.updateVrijeRegels.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getOwnedOfferte, requireOrg, requireOrgId } from "./auth";
import { requireNotViewer } from "./roles";
import { klantNaam } from "./lib/offerteKlant";

export const sjabloonVanOfferte = mutation({
  args: {
    offerteId: v.id("offertes"),
    naam: v.string(),
    omschrijving: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const org = await requireOrg(ctx);
    const offerte = await getOwnedOfferte(ctx, args.offerteId);
    if (!args.naam.trim()) throw new ConvexError("Geef het sjabloon een naam");
    if (offerte.regels.length === 0) throw new ConvexError("Deze offerte heeft nog geen regels");
    return await ctx.db.insert("standaardtuinen", {
      orgId: org._id,
      naam: args.naam.trim(),
      omschrijving: args.omschrijving?.trim() || undefined,
      type: offerte.type,
      scopes: offerte.scopes ?? [],
      defaultWaarden: offerte.scopeData,
      regels: offerte.regels,
    });
  },
});

/** Sjablonen met regels en recente offertes (dezelfde klant eerst). */
export const bronnen = query({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);
    const huidig = await getOwnedOfferte(ctx, args.offerteId);

    const sjablonen = (
      await ctx.db
        .query("standaardtuinen")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    )
      .filter((s) => (s.regels?.length ?? 0) > 0)
      .map((s) => ({
        _id: s._id,
        naam: s.naam,
        aantalRegels: s.regels!.length,
        netto: Math.round(s.regels!.reduce((t, r) => t + r.totaal, 0) * 100) / 100,
      }));

    const offertes = (
      await ctx.db
        .query("offertes")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .order("desc")
        .take(300)
    )
      .filter((o) => o._id !== huidig._id && !o.isArchived && o.regels.length > 0)
      .map((o) => ({
        _id: o._id,
        offerteNummer: o.offerteNummer,
        klantNaam: o.klant ? klantNaam(o.klant) : null,
        datum: o.createdAt,
        aantalRegels: o.regels.length,
        netto: o.totalen.totaalExBtw,
        zelfdeKlant: !!huidig.klantId && o.klantId === huidig.klantId,
      }))
      .sort((a, b) => Number(b.zelfdeKlant) - Number(a.zelfdeKlant) || b.datum - a.datum)
      .slice(0, 60);

    return { sjablonen, offertes };
  },
});

export const regelsVan = query({
  args: {
    sjabloonId: v.optional(v.id("standaardtuinen")),
    offerteId: v.optional(v.id("offertes")),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);
    if (args.sjabloonId) {
      const s = await ctx.db.get(args.sjabloonId);
      if (!s || s.orgId?.toString() !== orgId.toString()) throw new ConvexError("Sjabloon niet gevonden");
      return s.regels ?? [];
    }
    if (args.offerteId) {
      const o = await getOwnedOfferte(ctx, args.offerteId);
      return o.regels;
    }
    return [];
  },
});
