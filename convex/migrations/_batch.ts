/**
 * Scaffolding voor de eenmalige migraties: de twee snelheden waar ze allemaal
 * op draaien, en het bijhouden van voorbeelden in het rapport.
 *
 * ## De regel waar dit bestand om bestaat
 *
 * Convex staat **één gepagineerde query per functie-aanroep** toe. Doorlussen
 * over pagina's binnen één mutation kan dus niet — de eerste versie van
 * `splitsKlantNaam` deed dat wel, was groen in de test en crashte in de
 * dev-deployment. Vandaar twee snelheden, met opzet:
 *
 * - `dryRun: true` leest de hele tabel in één `collect` en is meteen klaar
 *   (`isDone: true`, geen cursor). Kantoor beoordeelt zo álle twijfelgevallen
 *   vóór er iets geschreven wordt, niet de eerste 100. Een dry run schrijft
 *   niets, dus het kost alleen leeswerk.
 * - `dryRun: false` verwerkt één pagina per aanroep en geeft een
 *   `continueCursor` terug; daarmee start de operator de volgende batch, elke
 *   batch in een eigen transactie.
 *
 * `leesAlleOfBatch` doet precies die keuze, en niets anders: wat er met de
 * documenten gebeurt (tellen, patchen, rapporteren) blijft in de migratie zelf
 * staan, want dat is per migratie het interessante deel.
 *
 * Alleen voor eenmalige migraties. Gewone queries pagineren met de
 * `paginationOptsValidator` van Convex; die hebben dit niet nodig.
 */

import type { Doc, TableNames } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/**
 * Documenten per transactie bij een echte run. 100 is bewust laag: ruim binnen
 * de schrijflimiet van een Convex-transactie, en klein genoeg om een batch
 * opnieuw te kunnen draaien zonder dat het spannend wordt.
 */
export const MIGRATIE_BATCH_GROOTTE = 100;

/** Hooguit zoveel voorbeelden in het rapport — anders wordt de output onleesbaar. */
export const MAX_VOORBEELDEN = 50;

/** Wat één aanroep te verwerken kreeg, plus waar de volgende batch begint. */
export type MigratieLezing<T> = {
  documenten: T[];
  /** True = er is niets meer te doen; de operator is klaar. */
  isDone: boolean;
  /** Alleen gevuld als er nog een batch volgt. */
  continueCursor: string | null;
};

/**
 * Het enige stuk ctx dat deze helper nodig heeft: lezen. Een `MutationCtx`
 * voldoet ook — een writer ís een reader.
 */
export type MigratieLeesCtx = { db: QueryCtx["db"] };

/**
 * De hele tabel (dry run) of precies één pagina (echte run).
 *
 * Let op de asymmetrie, die hoort er te zijn: in de dry run-tak staat bewust
 * géén `paginate`, en in de echte tak staat er precies één — nooit in een lus.
 */
export async function leesAlleOfBatch<Tabel extends TableNames>(
  ctx: MigratieLeesCtx,
  tabel: Tabel,
  opties: {
    dryRun: boolean;
    /** Leeg bij de eerste aanroep, daarna de `continueCursor` uit het rapport. */
    cursor?: string | null;
    batchGrootte?: number;
  }
): Promise<MigratieLezing<Doc<Tabel>>> {
  if (opties.dryRun) {
    // Eén leesquery over de hele tabel. Met enkele honderden klanten blijft
    // dit ver onder de leeslimiet van een Convex-transactie.
    const documenten = await ctx.db.query(tabel).collect();
    return { documenten, isDone: true, continueCursor: null };
  }

  const pagina = await ctx.db.query(tabel).paginate({
    cursor: opties.cursor ?? null,
    numItems: opties.batchGrootte ?? MIGRATIE_BATCH_GROOTTE,
  });

  return {
    documenten: pagina.page,
    isDone: pagina.isDone,
    continueCursor: pagina.isDone ? null : pagina.continueCursor,
  };
}

/** Een voorbeeldlijst die vanzelf ophoudt met groeien. */
export type Voorbeeldlijst<T> = {
  voegToe: (voorbeeld: T) => void;
  /** De verzamelde voorbeelden; hooguit `max` stuks. */
  lijst: T[];
};

/**
 * Verzamelt hooguit `max` voorbeelden voor het rapport (standaard
 * `MAX_VOORBEELDEN`). Het tellen zelf blijft bij de migratie: het rapport
 * noemt altijd het échte aantal, met deze lijst als steekproef om na te lopen.
 */
export function verzamelVoorbeelden<T>(
  max: number = MAX_VOORBEELDEN
): Voorbeeldlijst<T> {
  const lijst: T[] = [];

  return {
    voegToe: (voorbeeld) => {
      if (lijst.length < max) lijst.push(voorbeeld);
    },
    lijst,
  };
}
