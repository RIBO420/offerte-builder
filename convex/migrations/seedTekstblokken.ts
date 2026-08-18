/**
 * Migratie: startvulling tekstblokkenbibliotheek (PRD §2.5b)
 *
 * De echte HERO-standaardteksten kunnen pas na aanlevering door Romeo/
 * Yannick worden ingeladen. Deze seed maakt de bibliotheek direct
 * bruikbaar met drie neutrale voorbeeldblokken (aanhef, voorwaarden,
 * standaardtekst) — platte tekst, bewust zonder opmaak (principe 3).
 *
 * Idempotent: blokken worden op (categorie + naam) overgeslagen als ze
 * al bestaan, dus de migratie kan veilig opnieuw draaien.
 *
 * Draaien via Convex dashboard of CLI (dry run eerst!):
 *   npx convex run migrations/seedTekstblokken:seedTekstblokken '{"dryRun": true}'
 *   npx convex run migrations/seedTekstblokken:seedTekstblokken
 *
 * Verificatie na afloop (moet aantalBlokken >= 3 geven):
 *   npx convex run migrations/seedTekstblokken:verifieerSeed
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { TekstblokCategorie } from "../tekstblokken";

export interface TekstblokSeedRecord {
  naam: string;
  categorie: TekstblokCategorie;
  inhoud: string;
  volgorde: number;
}

/** Neutrale startvulling; HERO-teksten volgen na aanlevering (§7.2). */
export const TEKSTBLOKKEN_STARTVULLING: TekstblokSeedRecord[] = [
  {
    naam: "Standaard aanhef",
    categorie: "aanhef",
    volgorde: 0,
    inhoud:
      "Geachte {{klant_naam}},\n\n" +
      "Hartelijk dank voor uw aanvraag. Hierbij ontvangt u onze offerte " +
      "voor de besproken werkzaamheden. Wij hebben de werkzaamheden en " +
      "bijbehorende kosten hieronder voor u uitgewerkt.",
  },
  {
    naam: "Geldigheid en voorwaarden",
    categorie: "voorwaarden",
    volgorde: 0,
    inhoud:
      "Deze offerte is 30 dagen geldig vanaf de offertedatum. " +
      "Op al onze werkzaamheden zijn onze algemene voorwaarden van " +
      "toepassing. Genoemde bedragen zijn exclusief btw, tenzij anders " +
      "vermeld. Meerwerk wordt vooraf met u afgestemd.",
  },
  {
    naam: "Afsluiting offerte",
    categorie: "standaardtekst",
    volgorde: 0,
    inhoud:
      "Wij vertrouwen erop u hiermee een passend voorstel te doen. " +
      "Heeft u vragen over deze offerte, neem dan gerust contact met ons " +
      "op. Na uw akkoord nemen wij contact op om de planning af te stemmen.",
  },
];

export const seedTekstblokken = internalMutation({
  args: {
    // Sinds de org-migratie hoort een bibliotheek bij één organisatie.
    orgId: v.id("organisaties"),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;

    const bestaande = await ctx.db
      .query("tekstblokken")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const bestaandeSleutels = new Set(
      bestaande.map((b) => `${b.categorie}::${b.naam.trim().toLowerCase()}`)
    );

    let aangemaakt = 0;
    let overgeslagen = 0;
    const nu = Date.now();

    for (const record of TEKSTBLOKKEN_STARTVULLING) {
      const sleutel = `${record.categorie}::${record.naam.trim().toLowerCase()}`;
      if (bestaandeSleutels.has(sleutel)) {
        overgeslagen++;
        continue;
      }
      if (!dryRun) {
        await ctx.db.insert("tekstblokken", {
          orgId: args.orgId,
          naam: record.naam,
          categorie: record.categorie,
          inhoud: record.inhoud,
          actief: true,
          volgorde: record.volgorde,
          createdAt: nu,
          updatedAt: nu,
        });
      }
      aangemaakt++;
    }

    return { dryRun, aangemaakt, overgeslagen };
  },
});

export const verifieerSeed = internalQuery({
  args: {},
  handler: async (ctx) => {
    const blokken = await ctx.db.query("tekstblokken").collect();
    return {
      aantalBlokken: blokken.length,
      perCategorie: blokken.reduce<Record<string, number>>((acc, b) => {
        acc[b.categorie] = (acc[b.categorie] ?? 0) + 1;
        return acc;
      }, {}),
    };
  },
});
