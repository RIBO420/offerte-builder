/**
 * Batch-laden van gerelateerde documenten (audit §5 — N+1).
 *
 * Het probleem dat dit oplost: veel queries verrijken een lijst rijen met een
 * gerelateerd document (`klant`, `project`, `medewerker`, …) door per rij een
 * eigen `ctx.db.get` te doen. Bij 200 meldingen van 20 klanten zijn dat 200
 * db-calls waar er 20 nodig zijn, en in een `for`-lus lopen die ook nog eens
 * strikt na elkaar.
 *
 * Deze helpers halen de UNIEKE ids in één ronde op en geven een Map terug voor
 * O(1)-lookups. Zelfde data eruit, alleen minder db-werk. Dit is hetzelfde
 * idioom als `medewerkers.getMedewerkersMetPrestaties` al gebruikt.
 */

import type { GenericDatabaseReader } from "convex/server";
import type { DataModel, Doc, Id, TableNames } from "../_generated/dataModel";

/**
 * Minimale ctx-vorm die deze helpers nodig hebben. Een MutationCtx voldoet
 * ook: DatabaseWriter is een DatabaseReader.
 */
type LeesbareCtx = { db: GenericDatabaseReader<DataModel> };

/**
 * Haal de documenten voor `ids` op en geef ze terug als Map, gesleuteld op de
 * id-string. Dubbele ids worden één keer opgehaald; `undefined`/`null` worden
 * overgeslagen. Ids die niet (meer) bestaan ontbreken simpelweg in de Map —
 * behandel dat aanroepend net zoals een `db.get` die `null` teruggaf.
 */
export async function laadDocsMap<TableName extends TableNames>(
  ctx: LeesbareCtx,
  ids: ReadonlyArray<Id<TableName> | undefined | null>
): Promise<Map<string, Doc<TableName>>> {
  const uniek = new Map<string, Id<TableName>>();
  for (const id of ids) {
    if (id) uniek.set(id.toString(), id);
  }

  const sleutels = [...uniek.keys()];
  const docs = await Promise.all(
    [...uniek.values()].map((id) => ctx.db.get(id))
  );

  const map = new Map<string, Doc<TableName>>();
  docs.forEach((doc, i) => {
    if (doc) map.set(sleutels[i], doc);
  });
  return map;
}
