/**
 * Auto-archivering: een verzonden offerte of factuur landt vanzelf in de
 * Bestanden-tab van het klantdossier.
 *
 * De klacht die dit oplost: "die offerte van vorig jaar — waar staat die?".
 * Verzonden documenten stonden alleen in hun eigen module, dus wie het dossier
 * opensloeg zag ze niet. Nu schrijft élk verstuurpad hier één regel weg.
 *
 * ── Drie regels ──────────────────────────────────────────────────────────────
 * 1. NIET BLOKKEREND. Net als `logTijdlijnEvent`: mislukt het archiveren, dan
 *    gaat het versturen gewoon door. Een dossierregel is nooit belangrijker dan
 *    de factuur die de deur uit moet.
 * 2. IDEMPOTENT. Opnieuw versturen (of een bulk die deels overdoet) mag geen
 *    tweede rij opleveren — we kijken eerst op `by_offerte`/`by_factuur`.
 * 3. STORAGE IS OPTIONEEL. Dit project genereert de PDF bij het downloaden en
 *    bewaart hem niet in Convex-storage. Zonder `storageId` is de rij een
 *    verwijzing: de UI linkt door naar de offerte/factuur zelf. Komt er later
 *    wél een opgeslagen PDF, dan geef je hem hier mee en verandert er verder
 *    niets.
 */

import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export interface ArchiveerArgs {
  klantId: Id<"klanten">;
  /** Weglaten = afleiden uit de klant (zelfde patroon als logTijdlijnEvent). */
  orgId?: Id<"organisaties">;
  bron: "offerte" | "factuur";
  /** OF-2026-014 / F-2026-003; komt letterlijk in de meta-regel te staan. */
  nummer: string;
  offerteId?: Id<"offertes">;
  factuurId?: Id<"facturen">;
  storageId?: Id<"_storage">;
  geuploadDoorId?: Id<"users">;
}

export function titelVoorDocument(
  bron: "offerte" | "factuur",
  nummer: string
): string {
  return bron === "offerte" ? `Offerte ${nummer}` : `Factuur ${nummer}`;
}

export async function archiveerVerzondenDocument(
  ctx: MutationCtx,
  args: ArchiveerArgs
): Promise<Id<"klantBestanden"> | null> {
  try {
    const orgId = args.orgId ?? (await ctx.db.get(args.klantId))?.orgId;
    if (!orgId) {
      // Klant weg of zonder org: de rij zou dakloos zijn en buiten elke scope
      // vallen. Loggen en doorlopen.
      console.error(
        `[klantBestanden] archivering zonder org-scope (${args.bron} ${args.nummer})`
      );
      return null;
    }

    // Convex-regel 4: `offerteId`/`factuurId` zijn optioneel, dus alleen de
    // index in met een waarde die er écht is.
    const bestaand = args.offerteId
      ? await ctx.db
          .query("klantBestanden")
          .withIndex("by_offerte", (q) => q.eq("offerteId", args.offerteId))
          .first()
      : args.factuurId
        ? await ctx.db
            .query("klantBestanden")
            .withIndex("by_factuur", (q) => q.eq("factuurId", args.factuurId))
            .first()
        : null;
    if (bestaand) return bestaand._id;

    return await ctx.db.insert("klantBestanden", {
      orgId,
      klantId: args.klantId,
      soort: "document",
      titel: titelVoorDocument(args.bron, args.nummer),
      storageId: args.storageId,
      bron: args.bron,
      offerteId: args.offerteId,
      factuurId: args.factuurId,
      nummer: args.nummer,
      geuploadDoorId: args.geuploadDoorId,
      timestamp: Date.now(),
    });
  } catch (fout) {
    console.error("[klantBestanden] archivering mislukt", fout);
    return null;
  }
}
