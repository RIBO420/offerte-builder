/**
 * Volledige versiesnapshot van een offerte (HERO-nabouw fase 6). De vrije
 * builder heeft meer per regel (inkoop, btw, korting, product) en eigen
 * teksten; zonder die velden verloor "terugzetten" ze.
 */

import type { Doc, Id } from "../_generated/dataModel";

type Regel = Doc<"offertes">["regels"][number];

export function snapshotRegels(regels: ReadonlyArray<Regel>) {
  return regels.map((r) => ({
    id: r.id,
    scope: r.scope,
    omschrijving: r.omschrijving,
    eenheid: r.eenheid,
    hoeveelheid: r.hoeveelheid,
    prijsPerEenheid: r.prijsPerEenheid,
    totaal: r.totaal,
    type: r.type,
    margePercentage: r.margePercentage,
    inkoopprijsPerEenheid: r.inkoopprijsPerEenheid,
    btwCode: r.btwCode,
    kortingPercentage: r.kortingPercentage,
    productId: r.productId,
    prijsOpRegel: r.prijsOpRegel,
    interneNotitie: r.interneNotitie,
    optioneel: r.optioneel,
  }));
}

export function snapshotExtra(o: Pick<
  Doc<"offertes">,
  "vrijeTeksten" | "kortingOpTotaal" | "termijnschema" | "begroteUren"
>) {
  return {
    vrijeTeksten: o.vrijeTeksten,
    kortingOpTotaal: o.kortingOpTotaal,
    termijnschema: o.termijnschema,
    begroteUren: o.begroteUren,
  };
}

/** Snapshotregels terug naar offerteregels (oude snapshots missen velden). */
export function regelsUitSnapshot(
  regels: Doc<"offerte_versions">["snapshot"]["regels"]
): Doc<"offertes">["regels"] {
  return regels.map((r) => ({
    ...r,
    type: r.type as Regel["type"],
    productId: r.productId as Id<"producten"> | undefined,
  }));
}
