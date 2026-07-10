/**
 * Migratie: klanten.notities → klanttijdlijn (PRD §2.3, "één waarheid").
 *
 * Zet de bestaande inhoud van het vrije Notities-veld op de klantkaart om
 * naar één tijdlijn-entry per klant ("Genoteerd vóór tijdlijn: ..."). Het
 * schema-veld klanten.notities blijft bestaan (deprecated, verborgen in de
 * UI) — er wordt dus NIETS verwijderd; de migratie is puur additief.
 *
 * LET OP: configuratorAanvragen.notities (leads) valt bewust BUITEN deze
 * migratie — leads houden hun notities (PRD §2.3 gaat over de klantkaart).
 *
 * Eigenschappen:
 * - Gebatcht via paginatie (batchSize, cursor) — meerdere runs tot klaar=true.
 * - Idempotent: een klant met een bestaande "notitie_migratie"-entry wordt
 *   overgeslagen, ook over runs heen.
 * - Dry-run: dryRun=true telt alleen, schrijft niets.
 *
 * Draaien op dev:
 *   npx convex run tijdlijnMigratie:migreerNotities '{"dryRun":true}'
 *   npx convex run tijdlijnMigratie:migreerNotities '{}'
 *   (herhalen met de teruggegeven cursor tot klaar=true)
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

const DEFAULT_BATCH_SIZE = 100;

export type MigratieResultaat = {
  verwerkt: number;
  gemigreerd: number;
  overgeslagenLeeg: number;
  overgeslagenAlGemigreerd: number;
  dryRun: boolean;
  klaar: boolean;
  cursor: string | null;
};

/**
 * Kern van de migratie voor één klant. Exporteerbaar voor tests.
 * Geeft terug wat er (zou) gebeuren: "gemigreerd" | "leeg" | "al_gemigreerd".
 */
export async function migreerNotitieVoorKlant(
  ctx: MutationCtx,
  klant: Doc<"klanten">,
  dryRun: boolean
): Promise<"gemigreerd" | "leeg" | "al_gemigreerd"> {
  const notities = klant.notities?.trim();
  if (!notities) return "leeg";

  // Idempotentie: bestaat er al een migratie-entry voor deze klant?
  const bestaande = await ctx.db
    .query("klantTijdlijn")
    .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
    .collect();
  const alGemigreerd = bestaande.some(
    (e) =>
      e.eventType === "notitie_migratie" &&
      e.klantId.toString() === klant._id.toString()
  );
  if (alGemigreerd) return "al_gemigreerd";

  if (!dryRun) {
    // Timestamp = aanmaakdatum van de klant, zodat de entry onderaan de
    // tijdlijn staat ("genoteerd vóór tijdlijn"); createdAt = nu (audit).
    await ctx.db.insert("klantTijdlijn", {
      userId: klant.userId,
      klantId: klant._id,
      timestamp: klant.createdAt ?? Date.now(),
      auteurNaam: "Systeem",
      kanaal: "intern",
      eventType: "notitie_migratie",
      tekst: `Genoteerd vóór tijdlijn: ${notities}`,
      createdAt: Date.now(),
    });
  }
  return "gemigreerd";
}

export const migreerNotities = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args): Promise<MigratieResultaat> => {
    const dryRun = args.dryRun ?? false;
    const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE;

    const batch = await ctx.db
      .query("klanten")
      .paginate({ numItems: batchSize, cursor: args.cursor ?? null });

    let gemigreerd = 0;
    let overgeslagenLeeg = 0;
    let overgeslagenAlGemigreerd = 0;

    for (const klant of batch.page) {
      const uitkomst = await migreerNotitieVoorKlant(ctx, klant, dryRun);
      if (uitkomst === "gemigreerd") gemigreerd++;
      else if (uitkomst === "leeg") overgeslagenLeeg++;
      else overgeslagenAlGemigreerd++;
    }

    return {
      verwerkt: batch.page.length,
      gemigreerd,
      overgeslagenLeeg,
      overgeslagenAlGemigreerd,
      dryRun,
      klaar: batch.isDone,
      cursor: batch.isDone ? null : batch.continueCursor,
    };
  },
});
