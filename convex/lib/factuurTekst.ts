/**
 * Vaste teksten op een factuur (HERO-nabouw fase 2): standaard bij aanmaken,
 * waarden voor de placeholders, en de momentopname bij definitief/versturen.
 *
 * De waarden komen uit de snapshots op de factuur zelf (bedrijf, klant),
 * zodat de tekst klopt met de rest van het document.
 */

import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  blokkadeMelding,
  bouwTekstWaarden,
  vulDocumentTeksten,
  type DocumentSoort,
  type DocumentTeksten,
  type TekstWaarden,
} from "./documentTekst";
import { haalStandaardTeksten } from "../tekstblokken";

const DAG_MS = 24 * 60 * 60 * 1000;

/** Standaardteksten + soort voor een nieuwe factuur (spreiden in de insert). */
export async function factuurTekstVelden(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organisaties">,
  documentSoort: DocumentSoort
): Promise<{ documentSoort: DocumentSoort; teksten?: DocumentTeksten }> {
  const teksten = await haalStandaardTeksten(ctx, orgId, documentSoort);
  return {
    documentSoort,
    teksten: teksten.inleiding || teksten.afsluiting ? teksten : undefined,
  };
}

export async function bouwFactuurTekstWaarden(
  ctx: QueryCtx | MutationCtx,
  factuur: Doc<"facturen">,
  medewerkerNaam?: string
): Promise<TekstWaarden> {
  const klantDoc = factuur.klantId ? await ctx.db.get(factuur.klantId) : null;
  const [offerte, origineel] = await Promise.all([
    factuur.offerteId ? ctx.db.get(factuur.offerteId) : null,
    factuur.referentieFactuurId ? ctx.db.get(factuur.referentieFactuurId) : null,
  ]);
  const betaaltermijnDagen = Math.max(
    0,
    Math.round((factuur.vervaldatum - factuur.factuurdatum) / DAG_MS)
  );

  return bouwTekstWaarden({
    bedrijf: { ...factuur.bedrijf, betaaltermijnDagen },
    klant: {
      ...factuur.klant,
      voornaam: klantDoc?.voornaam,
      achternaam: klantDoc?.achternaam,
      btwNummer: klantDoc?.btwNummer,
    },
    document: {
      nummer: factuur.factuurnummer,
      datum: factuur.factuurdatum,
      bedragInclBtw: factuur.totaalInclBtw,
    },
    factuur: {
      vervaldatum: factuur.vervaldatum,
      // Creditfactuur verwijst naar de originele factuur, de rest naar de offerte
      referentie: origineel?.factuurnummer ?? offerte?.offerteNummer,
    },
    // Zonder afzender (automatische facturen) ondertekent het bedrijf
    medewerker: { naam: medewerkerNaam ?? factuur.bedrijf.naam },
  });
}

function vul(factuur: Doc<"facturen">, waarden: TekstWaarden) {
  return vulDocumentTeksten(factuur.teksten ?? {}, waarden);
}

/** Teksten zoals ze op de PDF staan, plus wat het versturen nog tegenhoudt. */
export async function getoondeFactuurTeksten(
  ctx: QueryCtx | MutationCtx,
  factuur: Doc<"facturen">,
  medewerkerNaam?: string
): Promise<{
  teksten: DocumentTeksten;
  ontbrekend: string[];
  vastgelegd: boolean;
  waarden: TekstWaarden;
}> {
  const waarden = await bouwFactuurTekstWaarden(ctx, factuur, medewerkerNaam);
  if (factuur.tekstenVastgelegd) {
    const { inleiding, afsluiting } = factuur.tekstenVastgelegd;
    return { teksten: { inleiding, afsluiting }, ontbrekend: [], vastgelegd: true, waarden };
  }
  const r = vul(factuur, waarden);
  return { teksten: r.teksten, ontbrekend: r.ontbrekend, vastgelegd: false, waarden };
}

/**
 * Melding als de teksten nog niet vast te leggen zijn, anders undefined.
 * De facturatie-engine gebruikt dit om bij ontbrekende gegevens niet
 * automatisch te versturen maar de factuur als concept te laten staan.
 */
export async function factuurTekstenBlokkade(
  ctx: QueryCtx | MutationCtx,
  factuur: Doc<"facturen">
): Promise<string | undefined> {
  if (factuur.tekstenVastgelegd || !factuur.teksten) return undefined;
  const r = vul(factuur, await bouwFactuurTekstWaarden(ctx, factuur));
  return blokkadeMelding(r.ontbrekend, r.onbekend);
}

/** Momentopname; gooit bij een leeg of onbekend veld. */
export async function legFactuurTekstenVast(
  ctx: MutationCtx,
  factuur: Doc<"facturen">,
  opties: { datum: number; medewerkerNaam?: string }
): Promise<Doc<"facturen">["tekstenVastgelegd"]> {
  if (factuur.tekstenVastgelegd) return factuur.tekstenVastgelegd;
  if (!factuur.teksten?.inleiding && !factuur.teksten?.afsluiting) return undefined;
  const r = vul(factuur, await bouwFactuurTekstWaarden(ctx, factuur, opties.medewerkerNaam));
  const melding = blokkadeMelding(r.ontbrekend, r.onbekend);
  if (melding) {
    throw new ConvexError(
      `Factuur ${factuur.factuurnummer} kan nog niet definitief. ${melding}`
    );
  }
  return { ...r.teksten, op: opties.datum };
}
