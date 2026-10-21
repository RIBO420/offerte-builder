/**
 * Vaste teksten op een offerte (HERO-nabouw fase 2): de waarden voor de
 * placeholders en de momentopname bij versturen.
 *
 * Opslag op de offerte (historische veldnamen):
 * - vrijeTeksten.aanhef      = inleiding, met placeholders
 * - vrijeTeksten.voorwaarden = afsluiting, met placeholders
 * - tekstenVastgelegd        = beide ingevuld, gezet bij "verzonden"
 */

import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import {
  blokkadeMelding,
  bouwTekstWaarden,
  vulDocumentTeksten,
  type DocumentSoort,
  type DocumentTeksten,
  type TekstWaarden,
} from "./documentTekst";
import { standaardTermijnschemaVoor } from "./termijnFacturatie";

export const STANDAARD_OFFERTE_GELDIGHEID_DAGEN = 30;
const STANDAARD_BETAALTERMIJN_DAGEN = 14;

export function offerteDocumentSoort(type: Doc<"offertes">["type"]): DocumentSoort {
  return type === "onderhoud" ? "offerte_onderhoud" : "offerte_aanleg";
}

/** Bibliotheekteksten → de velden op de offerte. */
export function naarVrijeTeksten(
  teksten: DocumentTeksten
): Doc<"offertes">["vrijeTeksten"] {
  if (!teksten.inleiding && !teksten.afsluiting) return undefined;
  return { aanhef: teksten.inleiding, voorwaarden: teksten.afsluiting };
}

export async function bouwOfferteTekstWaarden(
  ctx: QueryCtx | MutationCtx,
  offerte: Doc<"offertes">,
  opties: { datum: number; medewerkerNaam?: string }
): Promise<TekstWaarden> {
  const instellingen = offerte.orgId
    ? await ctx.db
        .query("instellingen")
        .withIndex("by_org", (q) => q.eq("orgId", offerte.orgId!))
        .unique()
    : null;
  const klantDoc = offerte.klantId ? await ctx.db.get(offerte.klantId) : null;
  const bedrijf = instellingen?.bedrijfsgegevens;

  return bouwTekstWaarden({
    bedrijf: bedrijf
      ? {
          ...bedrijf,
          betaaltermijnDagen:
            instellingen?.standaardBetalingstermijn ?? STANDAARD_BETAALTERMIJN_DAGEN,
        }
      : undefined,
    klant: {
      naam: offerte.klant?.naam ?? klantDoc?.naam,
      voornaam: klantDoc?.voornaam,
      achternaam: klantDoc?.achternaam,
      adres: offerte.klant?.adres,
      postcode: offerte.klant?.postcode,
      plaats: offerte.klant?.plaats,
      email: offerte.klant?.email,
      btwNummer: klantDoc?.btwNummer,
    },
    document: {
      nummer: offerte.offerteNummer,
      datum: opties.datum,
      bedragInclBtw: offerte.totalen.totaalInclBtw,
    },
    offerte: {
      geldigheidDagen:
        instellingen?.offerteGeldigheidDagen ?? STANDAARD_OFFERTE_GELDIGHEID_DAGEN,
      // Het schema van de offerte zelf; oudere offertes zonder schema vallen
      // terug op het standaardschema (alleen aanleg)
      termijnschema:
        offerte.termijnschema ??
        standaardTermijnschemaVoor(offerte.type, instellingen?.deelfactuurTemplates),
    },
    medewerker: { naam: opties.medewerkerNaam },
  });
}

/**
 * Teksten zoals ze op het document staan: de momentopname als die er is,
 * anders live ingevuld (concept/voorcalculatie).
 */
export async function getoondeOfferteTeksten(
  ctx: QueryCtx | MutationCtx,
  offerte: Doc<"offertes">,
  medewerkerNaam?: string
): Promise<{
  teksten: DocumentTeksten;
  ontbrekend: string[];
  vastgelegd: boolean;
  /** Waarden voor het voorbeeld in de editor */
  waarden: TekstWaarden;
}> {
  const waarden = await bouwOfferteTekstWaarden(ctx, offerte, {
    datum: offerte.verzondenAt ?? Date.now(),
    medewerkerNaam,
  });
  if (offerte.tekstenVastgelegd) {
    return {
      teksten: {
        inleiding: offerte.tekstenVastgelegd.aanhef,
        afsluiting: offerte.tekstenVastgelegd.voorwaarden,
      },
      ontbrekend: [],
      vastgelegd: true,
      waarden,
    };
  }
  const r = vulDocumentTeksten(
    {
      inleiding: offerte.vrijeTeksten?.aanhef,
      afsluiting: offerte.vrijeTeksten?.voorwaarden,
    },
    waarden
  );
  return { teksten: r.teksten, ontbrekend: r.ontbrekend, vastgelegd: false, waarden };
}

/**
 * Momentopname bij versturen. Gooit als er een veld leeg is of een veld niet
 * bestaat: dan gaat de offerte niet de deur uit.
 */
export async function legOfferteTekstenVast(
  ctx: MutationCtx,
  offerte: Doc<"offertes">,
  opties: { datum: number; medewerkerNaam?: string }
): Promise<Doc<"offertes">["tekstenVastgelegd"]> {
  if (!offerte.vrijeTeksten?.aanhef && !offerte.vrijeTeksten?.voorwaarden) {
    return undefined;
  }
  const waarden = await bouwOfferteTekstWaarden(ctx, offerte, opties);
  const r = vulDocumentTeksten(
    {
      inleiding: offerte.vrijeTeksten?.aanhef,
      afsluiting: offerte.vrijeTeksten?.voorwaarden,
    },
    waarden
  );
  const melding = blokkadeMelding(r.ontbrekend, r.onbekend);
  if (melding) {
    throw new ConvexError(`De offerte kan nog niet verstuurd worden. ${melding}`);
  }
  return {
    aanhef: r.teksten.inleiding,
    voorwaarden: r.teksten.afsluiting,
    op: opties.datum,
  };
}
