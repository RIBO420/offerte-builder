/**
 * Eenmalige import van de HERO-artikelexport in het prijsboek (fase 5).
 * Alleen via de CLI, met het script scripts/hero-artikelen-import.mjs:
 *
 *   node scripts/hero-artikelen-import.mjs "<export.xlsx>" --org <orgId> [--uitvoeren] [--prod]
 *
 * Internal: geen gebruiker in de context, dus de org komt als argument mee
 * (uitzondering op regel 9, net als de andere backfills). Idempotent op het
 * HERO-artikelnummer: een tweede run werkt prijzen en teksten bij, maar laat
 * de aan/uit-stand en een door kantoor gekozen categorie staan. Alleen
 * artikelen die nog in de startcategorie "HERO" staan krijgen de afgeleide
 * categorie. Met `allesActief` gaan ook bestaande HERO-artikelen aan.
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
    /** Zet ook bestaande HERO-artikelen aan (nieuwe zijn altijd actief). */
    allesActief: v.optional(v.boolean()),
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
      aangezet: 0,
      dubbeleNaam: 0,
      naamBestaatAlInPrijsboek: 0,
    };
    const perCategorie: Record<string, number> = {};

    for (const plan of plannen) {
      if (eigenNamen.has(plan.naamGenormaliseerd)) telling.naamBestaatAlInPrijsboek++;
      if (plan.dubbeleNaam) telling.dubbeleNaam++;
      perCategorie[plan.categorie] = (perCategorie[plan.categorie] ?? 0) + 1;

      const velden = {
        productnaam: plan.productnaam,
        inkoopprijs: plan.inkoopprijs,
        verkoopprijs: plan.verkoopprijs,
        eenheid: plan.eenheid,
        btwCode: plan.btwCode,
        omschrijving: plan.omschrijving,
        gebruiksteller: plan.rij.gebruikt,
        prijsOpRegel: plan.prijsOpRegel,
        naamGenormaliseerd: plan.naamGenormaliseerd,
        updatedAt: nu,
      };

      const bestaand = opNummer.get(plan.rij.artikelnummer);
      if (bestaand) {
        telling.bijgewerkt++;
        const aanzetten = args.allesActief === true && !bestaand.isActief;
        if (aanzetten) telling.aangezet++;
        if (args.uitvoeren) {
          await ctx.db.patch(bestaand._id, {
            ...velden,
            ...(bestaand.categorie === HERO_CATEGORIE ? { categorie: plan.categorie } : {}),
            ...(aanzetten ? { isActief: true } : {}),
          });
        }
        continue;
      }

      telling.aangemaakt++;
      if (args.uitvoeren) {
        await ctx.db.insert("producten", {
          ...velden,
          orgId: args.orgId,
          categorie: plan.categorie,
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
      perCategorie,
    };
  },
});

/**
 * Zet alle artikelen die níét uit HERO komen uit (besluit Ricardo,
 * 22-10-2026: de HERO-set vervangt de oude voorbeeldartikelen). Uitzetten,
 * niet wissen: offertes kunnen naar een artikel verwijzen en kantoor kan ze
 * onder Uitgeschakeld terugzetten. Let op: de scope-calculator vindt dan geen
 * materiaalprijzen meer en laat die regels weg.
 *
 *   npx convex run heroArtikelImport:zetEigenArtikelenUit '{"orgId":"…"}' [--prod]
 */
export const zetEigenArtikelenUit = internalMutation({
  args: {
    orgId: v.id("organisaties"),
    uitvoeren: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actief = await ctx.db
      .query("producten")
      .withIndex("by_org_actief", (q) =>
        q.eq("orgId", args.orgId).eq("isActief", true)
      )
      .collect();
    const eigen = actief.filter((p) => p.heroArtikelnummer === undefined);
    if (args.uitvoeren) {
      const nu = Date.now();
      for (const p of eigen) {
        await ctx.db.patch(p._id, { isActief: false, updatedAt: nu });
      }
    }
    return {
      uitgevoerd: args.uitvoeren === true,
      uitgezet: eigen.length,
      namen: eigen.map((p) => p.productnaam),
    };
  },
});
