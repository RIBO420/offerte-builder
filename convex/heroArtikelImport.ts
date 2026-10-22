/**
 * Eenmalige import van de HERO-artikelexport in het prijsboek (fase 5).
 * Alleen via de CLI, met het script scripts/hero-artikelen-import.mjs:
 *
 *   node scripts/hero-artikelen-import.mjs "<export.xlsx>" --org <orgId> [--uitvoeren] [--prod]
 *
 * Internal: geen gebruiker in de context, dus de org komt als argument mee
 * (uitzondering op regel 9, net als de andere backfills). Idempotent op het
 * HERO-artikelnummer: een tweede run werkt prijzen en teksten bij, maar laat
 * de aan/uit-stand staan die kantoor intussen gekozen heeft.
 */
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { HERO_CATEGORIE, planHeroArtikelen } from "./lib/heroArtikelen";
import { normaliseerProductnaam } from "./producten";

const heroRijValidator = v.object({
  artikelnummer: v.string(),
  naam: v.string(),
  beschrijving: v.optional(v.string()),
  eenheid: v.optional(v.string()),
  btw: v.optional(v.string()),
  inkoopprijs: v.number(),
  standaardmarge: v.number(),
  vk1: v.number(),
  gebruikt: v.number(),
});

export const importeer = internalMutation({
  args: {
    orgId: v.id("organisaties"),
    rijen: v.array(heroRijValidator),
    /** Zonder deze vlag telt de import alleen wat hij zou doen. */
    uitvoeren: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Organisatie niet gevonden");

    const bestaande = await ctx.db
      .query("producten")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const opNummer = new Map(
      bestaande
        .filter((p) => p.heroArtikelnummer !== undefined)
        .map((p) => [p.heroArtikelnummer!, p])
    );

    // Eigen artikelen (niet uit HERO) met dezelfde naam: niet samenvoegen,
    // wel tellen zodat kantoor weet dat er dubbelen naast elkaar staan
    const eigenNamen = new Set(
      bestaande
        .filter((p) => p.heroArtikelnummer === undefined)
        .map((p) => p.naamGenormaliseerd ?? normaliseerProductnaam(p.productnaam))
    );

    const plannen = planHeroArtikelen(args.rijen);
    const nu = Date.now();
    const telling = {
      aangemaakt: 0,
      bijgewerkt: 0,
      actief: 0,
      uitWeinigGebruikt: 0,
      uitDubbeleNaam: 0,
      naamBestaatAlInPrijsboek: 0,
    };

    for (const plan of plannen) {
      if (eigenNamen.has(plan.naamGenormaliseerd)) telling.naamBestaatAlInPrijsboek++;
      if (plan.isActief) telling.actief++;
      else if (plan.redenUit === "dubbele_naam") telling.uitDubbeleNaam++;
      else telling.uitWeinigGebruikt++;

      const velden = {
        productnaam: plan.productnaam,
        inkoopprijs: plan.inkoopprijs,
        verkoopprijs: plan.verkoopprijs,
        eenheid: plan.eenheid,
        btwCode: plan.btwCode,
        omschrijving: plan.rij.beschrijving?.trim() || undefined,
        gebruiksteller: plan.rij.gebruikt,
        prijsOpRegel: plan.prijsOpRegel,
        naamGenormaliseerd: plan.naamGenormaliseerd,
        updatedAt: nu,
      };

      const bestaand = opNummer.get(plan.rij.artikelnummer);
      if (bestaand) {
        telling.bijgewerkt++;
        if (args.uitvoeren) await ctx.db.patch(bestaand._id, velden);
        continue;
      }

      telling.aangemaakt++;
      if (args.uitvoeren) {
        await ctx.db.insert("producten", {
          ...velden,
          orgId: args.orgId,
          categorie: HERO_CATEGORIE,
          verliespercentage: 0,
          isActief: plan.isActief,
          heroArtikelnummer: plan.rij.artikelnummer,
          createdAt: nu,
        });
      }
    }

    return {
      uitgevoerd: args.uitvoeren === true,
      rijen: args.rijen.length,
      ...telling,
    };
  },
});
