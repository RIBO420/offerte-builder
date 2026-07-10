/**
 * Migratie: sanering Leads/Klanten-scheiding (PRD §1.3, fase 0)
 *
 * Saneert de tabel "klanten" conform het besluit in convex/leadsKlantenHelpers.ts
 * (de lead-funnel leeft uitsluitend op configuratorAanvragen; een rij in klanten
 * is per definitie een klant):
 *
 * 1. pipelineStatus "lead" wordt GELEEGD (undefined). Deze rijen zijn echte
 *    klanten (handmatig aangemaakt, geïmporteerd of via offerte) die alleen het
 *    verkeerde default-stadium droegen; zonder sanering vallen ze buiten de
 *    Klanten-lijst en -teller. Het juiste lifecycle-stadium volgt daarna vanzelf
 *    uit echte events (upgradeKlantPipeline is upgrade-only, ook vanaf undefined).
 * 2. email wordt genormaliseerd (trim + lowercase), zodat de case-insensitieve
 *    klant-match van markGewonnen via de by_email-index alle legacy-rijen vindt.
 *    Als normalisatie een e-mailadres oplevert dat al bij een andere klant
 *    bestaat, wordt dit GERAPPORTEERD (mogelijke duplicaat), niet samengevoegd.
 *
 * Gebatcht (paginated, 100 per transactie; vervolg-batches via de scheduler in
 * eigen transacties) en idempotent: reeds gesaneerde rijen worden overgeslagen,
 * dus de migratie kan veilig opnieuw draaien.
 *
 * Draaien via Convex dashboard of CLI (dry run eerst!):
 *   npx convex run migrations/saneerLeadsKlanten:saneerLeadsKlanten '{"dryRun": true}'
 *   npx convex run migrations/saneerLeadsKlanten:saneerLeadsKlanten
 *
 * Verificatie na afloop (moet aantalLeadStadium === 0 en
 * aantalNietGenormaliseerdeEmails === 0 geven):
 *   npx convex run migrations/saneerLeadsKlanten:verifieerSanering
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { normaliseerEmail } from "../leadsKlantenHelpers";

const BATCH_SIZE = 100;

export const saneerLeadsKlanten = internalMutation({
  args: {
    // Paginatie-cursor; leeg laten bij de eerste aanroep. Vervolg-batches
    // plannen zichzelf in via de scheduler (elke batch = eigen transactie).
    cursor: v.optional(v.union(v.string(), v.null())),
    // true = alleen rapporteren, niets schrijven
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;

    const page = await ctx.db
      .query("klanten")
      .paginate({ cursor: args.cursor ?? null, numItems: BATCH_SIZE });

    let leadStadiumGeleegd = 0;
    let emailGenormaliseerd = 0;
    let alCompleet = 0;
    const mogelijkeDuplicaten: string[] = [];

    for (const klant of page.page) {
      const patch: { pipelineStatus?: undefined; email?: string } = {};
      let leegtLeadStadium = false;
      let normaliseertEmail = false;

      // 1. Deprecated "lead"-stadium legen: een rij in klanten ís een klant.
      if (klant.pipelineStatus === "lead") {
        patch.pipelineStatus = undefined;
        leegtLeadStadium = true;
      }

      // 2. E-mail normaliseren voor de by_email-indexmatch van markGewonnen.
      const genormaliseerd = normaliseerEmail(klant.email);
      if (klant.email !== undefined && klant.email !== genormaliseerd) {
        // Duplicaat-detectie: bestaat het genormaliseerde adres al bij een
        // andere klant? Dan alleen rapporteren (samenvoegen is mensenwerk).
        if (genormaliseerd) {
          const bestaande = await ctx.db
            .query("klanten")
            .withIndex("by_email", (q) => q.eq("email", genormaliseerd))
            .collect();
          if (bestaande.some((k) => k._id !== klant._id)) {
            mogelijkeDuplicaten.push(klant._id);
            console.warn(
              `[Migratie saneerLeadsKlanten] Mogelijke duplicaat: klant ${klant._id} ` +
                `("${klant.naam}") normaliseert naar een e-mailadres dat al bestaat`
            );
          }
        }
        patch.email = genormaliseerd;
        normaliseertEmail = true;
      }

      if (!leegtLeadStadium && !normaliseertEmail) {
        alCompleet++;
        continue;
      }

      if (leegtLeadStadium) leadStadiumGeleegd++;
      if (normaliseertEmail) emailGenormaliseerd++;

      if (!dryRun) {
        await ctx.db.patch(klant._id, patch);
      }
    }

    const summary = {
      dryRun,
      batchGrootte: page.page.length,
      leadStadiumGeleegd,
      emailGenormaliseerd,
      alCompleet,
      mogelijkeDuplicaten,
      isDone: page.isDone,
      continueCursor: page.isDone ? null : page.continueCursor,
    };

    console.log(
      `[Migratie saneerLeadsKlanten] Batch verwerkt${dryRun ? " (dry run)" : ""}: ` +
        `${leadStadiumGeleegd} lead-stadium geleegd, ${emailGenormaliseerd} e-mail genormaliseerd, ` +
        `${alCompleet} al compleet, ${mogelijkeDuplicaten.length} mogelijke duplicaten` +
        (page.isDone ? " — KLAAR" : " — volgende batch ingepland")
    );

    // Volgende batch in een eigen transactie (productie-veilig bij grote tabellen)
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.saneerLeadsKlanten.saneerLeadsKlanten, {
        cursor: page.continueCursor,
        dryRun,
      });
    }

    return summary;
  },
});

/**
 * Verificatie: telt resterende rijen die de sanering nog nodig hebben.
 */
export const verifieerSanering = internalQuery({
  args: {},
  handler: async (ctx) => {
    const klanten = await ctx.db.query("klanten").collect();

    const aantalLeadStadium = klanten.filter((k) => k.pipelineStatus === "lead").length;
    const aantalNietGenormaliseerdeEmails = klanten.filter(
      (k) => k.email !== undefined && k.email !== normaliseerEmail(k.email)
    ).length;

    return {
      totaalKlanten: klanten.length,
      aantalLeadStadium,
      aantalNietGenormaliseerdeEmails,
    };
  },
});
