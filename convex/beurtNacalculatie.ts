/**
 * Beurt-nacalculatie — Convex-functies (PRD §3.4, slotstuk fase 2).
 *
 * Breidt de bestaande project-nacalculatie (convex/nacalculaties.ts, op
 * urenRegistraties) uit met ONDERHOUDSBEURTEN: werkelijke tijd per werkitem
 * uit bevestigde/ingediende urensegmenten (§2.6; werken / reistijd apart /
 * BES apart), afgezet tegen gepland (geschatteUren / bouwsteen-normtijden),
 * en per bouwsteen geaggregeerd tot normuur-suggesties.
 *
 * De mens beslist (PRD §2.5a): overnemen is een gewone kantoor-update van
 * het bouwsteen-record (met de bestaande uurtarief/prijs-op-datum-regels via
 * berekenPrijsPerBeurt). Geen cron, geen automatische aanpassingen; de
 * offerte-calculatie-engine blijft ongewijzigd.
 *
 * Rollen: kantoor-only (requireKantoor), net als het catalogusbeheer.
 * Pure rekenlogica: convex/beurtNacalculatieLogica.ts.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireOrgId } from "./auth";
import { requireKantoor } from "./roles";
import {
  aggregeerPerBouwsteen,
  bepaalNormuurSuggestie,
  DEFAULT_SUGGESTIE_DREMPEL_BEURTEN,
  huidigeNormVoorBouwsteen,
  NACALC_BEURT_STATUSSEN,
  NACALC_VOLLEDIGE_STATUSSEN,
  normuurVeldVoorBouwsteen,
  telSegmenten,
  verdeelWerktijdOverBouwstenen,
  type BeurtTaak,
  type BouwsteenBijdrage,
} from "./beurtNacalculatieLogica";

// ============================================
// Gedeelde datavergaring
// ============================================

const DATUM_PATROON = /^\d{4}-\d{2}-\d{2}$/;

function assertGeldigePeriode(vanDatum?: string, totDatum?: string): void {
  for (const datum of [vanDatum, totDatum]) {
    if (datum !== undefined && !DATUM_PATROON.test(datum)) {
      throw new ConvexError("Ongeldige datum (verwacht YYYY-MM-DD)");
    }
  }
  if (vanDatum && totDatum && totDatum < vanDatum) {
    throw new ConvexError("Tot-datum ligt vóór de van-datum");
  }
}

/**
 * Ingestelde suggestie-drempel (default 5 uitgevoerde beurten).
 *
 * De instellingen-rij hoort bij de ORGANISATIE: op by_user kreeg een collega
 * zonder eigen rij stilzwijgend de default in plaats van de bedrijfsdrempel.
 */
async function suggestieDrempel(
  db: QueryCtx["db"],
  orgId: Id<"organisaties">
): Promise<number> {
  const settings = await db
    .query("instellingen")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique();
  return (
    settings?.nacalculatieInstellingen?.suggestieDrempelBeurten ??
    DEFAULT_SUGGESTIE_DREMPEL_BEURTEN
  );
}

export interface BeurtNacalcRij {
  werkitemId: Id<"projecten">;
  naam: string;
  status: string;
  datum: string | null; // geplandeStart ?? voorzieneDatum
  klantNaam: string | null;
  geplandeUren: number | null;
  werkelijkeUren: number; // categorie "werken"
  reistijdUren: number; // apart (geen klantwerk)
  besUren: number; // afvalverwerker apart (§2.6)
  afwijkingUren: number | null; // werkelijk − gepland
}

/**
 * Verzamelt de beurt-nacalculatie: rijen per beurt + werktijd-bijdragen per
 * bouwsteen (alleen volledig uitgevoerde beurten voeden de aggregatie).
 */
async function verzamelBeurtNacalculatie(
  ctx: QueryCtx,
  orgId: Id<"organisaties">,
  opties: { vanDatum?: string; totDatum?: string }
): Promise<{
  rijen: BeurtNacalcRij[];
  bijdragenPerBeurt: BouwsteenBijdrage[][];
}> {
  // Uitgevoerde/gefactureerde/deels uitgevoerde beurten van deze organisatie.
  // Belt & braces bovenop de indexquery: type/status/scope expliciet, en
  // dedupe per _id (zelfde patroon als planbord/dagkaart).
  const beurtenPerId = new Map<string, Doc<"projecten">>();
  for (const status of NACALC_BEURT_STATUSSEN) {
    const rows = await ctx.db
      .query("projecten")
      .withIndex("by_org_type_status", (q) =>
        q
          .eq("orgId", orgId)
          .eq("type", "onderhoudsbeurt")
          .eq("status", status)
      )
      .collect();
    for (const row of rows) {
      if (
        row.orgId?.toString() === orgId.toString() &&
        row.type === "onderhoudsbeurt" &&
        row.status === status
      ) {
        beurtenPerId.set(row._id.toString(), row);
      }
    }
  }

  const relevant = [...beurtenPerId.values()].filter((beurt) => {
    if (beurt.deletedAt || beurt.isArchived === true) return false;
    const datum = beurt.geplandeStart ?? beurt.voorzieneDatum ?? null;
    if (opties.vanDatum && (!datum || datum < opties.vanDatum)) return false;
    if (opties.totDatum && (!datum || datum > opties.totDatum)) return false;
    return true;
  });

  // Memoisatie per id — geen N+1 op dezelfde klant/bouwsteen/werkzaamheid
  const klantCache = new Map<string, Doc<"klanten"> | null>();
  const bouwsteenCache = new Map<string, Doc<"bouwstenen"> | null>();

  const rijen: BeurtNacalcRij[] = [];
  const bijdragenPerBeurt: BouwsteenBijdrage[][] = [];

  for (const beurt of relevant) {
    // Werkelijke tijd uit bevestigde/ingediende segmenten (§2.6)
    const segmenten = await ctx.db
      .query("urenSegmenten")
      .withIndex("by_werkitem", (q) => q.eq("werkitemId", beurt._id))
      .collect();
    // by_werkitem is bedrijfsoverstijgend → org-postfilter. Dit stond op het
    // legacy userId-bedrijfseigenaarsveld; de segmenten dragen sinds de
    // uren-sweep (6ea8d38) hun eigen orgId.
    const tijden = telSegmenten(
      segmenten.filter(
        (s) =>
          s.orgId?.toString() === orgId.toString() &&
          s.werkitemId?.toString() === beurt._id.toString()
      )
    );
    // Niets gelogd → geen nacalculatie (wat niet gelogd is bestaat niet, §2.6)
    if (
      tijden.werkenMinuten === 0 &&
      tijden.reistijdMinuten === 0 &&
      tijden.besMinuten === 0
    ) {
      continue;
    }

    // Taken: eigen bouwsteenregels, anders de contractwerkzaamheid
    // (zelfde afleiding als de dagkaart, convex/dagkaart.ts)
    let regels: { bouwsteenId?: Id<"bouwstenen">; omschrijving: string }[] =
      beurt.bouwsteenRegels ?? [];
    if (regels.length === 0 && beurt.contractWerkzaamheidId) {
      const werkzaamheid = await ctx.db.get(beurt.contractWerkzaamheidId);
      if (werkzaamheid) {
        regels = [
          {
            bouwsteenId: werkzaamheid.bouwsteenId,
            omschrijving: werkzaamheid.omschrijving,
          },
        ];
      }
    }
    const taken: BeurtTaak[] = [];
    for (const regel of regels) {
      let normUren: number | null = null;
      if (regel.bouwsteenId) {
        const key = regel.bouwsteenId.toString();
        if (!bouwsteenCache.has(key)) {
          bouwsteenCache.set(key, await ctx.db.get(regel.bouwsteenId));
        }
        const bouwsteen = bouwsteenCache.get(key) ?? null;
        normUren = bouwsteen ? huidigeNormVoorBouwsteen(bouwsteen) : null;
      }
      taken.push({ bouwsteenId: regel.bouwsteenId?.toString() ?? null, normUren });
    }

    // Gepland: geschatteUren van het werkitem, anders de som van de normuren
    const normSom = taken.reduce((som, t) => som + (t.normUren ?? 0), 0);
    const geplandeUren =
      beurt.geschatteUren ?? (normSom > 0 ? normSom : null);

    let klantNaam: string | null = null;
    if (beurt.klantId) {
      const key = beurt.klantId.toString();
      if (!klantCache.has(key)) {
        klantCache.set(key, await ctx.db.get(beurt.klantId));
      }
      klantNaam = klantCache.get(key)?.naam ?? null;
    }

    const werkelijkeUren = tijden.werkenMinuten / 60;
    rijen.push({
      werkitemId: beurt._id,
      naam: beurt.naam,
      status: beurt.status,
      datum: beurt.geplandeStart ?? beurt.voorzieneDatum ?? null,
      klantNaam,
      geplandeUren,
      werkelijkeUren,
      reistijdUren: tijden.reistijdMinuten / 60,
      besUren: tijden.besMinuten / 60,
      afwijkingUren:
        geplandeUren !== null ? werkelijkeUren - geplandeUren : null,
    });

    // Alleen VOLLEDIG uitgevoerde beurten voeden de bouwsteen-aggregatie
    // (deels uitgevoerd zou het gemiddelde vertekenen)
    if (
      (NACALC_VOLLEDIGE_STATUSSEN as readonly string[]).includes(beurt.status)
    ) {
      const bijdragen = verdeelWerktijdOverBouwstenen(
        taken,
        tijden.werkenMinuten
      );
      if (bijdragen) bijdragenPerBeurt.push(bijdragen);
    }
  }

  // Nieuwste eerst — consistent met de andere rapportagelijsten
  rijen.sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? ""));
  return { rijen, bijdragenPerBeurt };
}

/** Suggestielijst opbouwen uit de aggregatie (gedeeld door beide queries). */
async function bouwSuggesties(
  ctx: QueryCtx,
  orgId: Id<"organisaties">,
  bijdragenPerBeurt: BouwsteenBijdrage[][],
  drempel: number
) {
  const aggregaties = aggregeerPerBouwsteen(bijdragenPerBeurt);
  const suggesties = [];
  for (const aggregatie of aggregaties) {
    const bouwsteen = await ctx.db.get(
      aggregatie.bouwsteenId as Id<"bouwstenen">
    );
    // Belt & braces: de ids komen uit de org-gescoopte beurten, maar een
    // bouwsteen van een andere organisatie hoort hier nooit in de lijst.
    if (
      !bouwsteen ||
      !bouwsteen.actief ||
      bouwsteen.orgId?.toString() !== orgId.toString()
    ) {
      continue;
    }
    const suggestie = bepaalNormuurSuggestie({
      aantalBeurten: aggregatie.aantalBeurten,
      gemiddeldeUren: aggregatie.gemiddeldeUren,
      huidigeNormUren: huidigeNormVoorBouwsteen(bouwsteen),
      drempel,
    });
    if (!suggestie) continue;
    suggesties.push({
      bouwsteenId: bouwsteen._id,
      naam: bouwsteen.naam,
      code: bouwsteen.code,
      normuurVeld: normuurVeldVoorBouwsteen(bouwsteen),
      ...suggestie,
    });
  }
  return suggesties.sort((a, b) => b.aantalBeurten - a.aantalBeurten);
}

// ============================================
// Queries (kantoor-only)
// ============================================

/**
 * Beurt-nacalculatie voor het Calculatie Analyse-tabblad: per beurt de
 * werkelijke tijd (werken / reistijd / BES apart) vs. gepland, plus de
 * per-bouwsteen-aggregatie en de bijbehorende normuur-suggesties.
 */
export const getBeurtNacalculatie = query({
  args: {
    vanDatum: v.optional(v.string()), // YYYY-MM-DD (inclusief)
    totDatum: v.optional(v.string()), // YYYY-MM-DD (inclusief)
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    assertGeldigePeriode(args.vanDatum, args.totDatum);

    const { rijen, bijdragenPerBeurt } = await verzamelBeurtNacalculatie(
      ctx,
      orgId,
      args
    );
    const drempel = await suggestieDrempel(ctx.db, orgId);
    const suggesties = await bouwSuggesties(
      ctx,
      orgId,
      bijdragenPerBeurt,
      drempel
    );
    return { beurten: rijen, suggesties, drempel };
  },
});

/**
 * Normuur-suggesties voor het catalogusbeheer (§2.5a): per bouwsteen met
 * voldoende data (≥ drempel volledig uitgevoerde beurten) de gemiddelde
 * werkelijke duur vs. de huidige norm. De mens beslist; overnemen loopt via
 * neemNormuurOver.
 */
export const getNormuurSuggesties = query({
  args: {},
  handler: async (ctx) => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    const { bijdragenPerBeurt } = await verzamelBeurtNacalculatie(
      ctx,
      orgId,
      {}
    );
    const drempel = await suggestieDrempel(ctx.db, orgId);
    const suggesties = await bouwSuggesties(
      ctx,
      orgId,
      bijdragenPerBeurt,
      drempel
    );
    return { suggesties, drempel };
  },
});

// ============================================
// Mutation — suggestie overnemen (kantoor beslist)
// ============================================

/**
 * Eén-klik-overnemen van een normuur-suggestie: een GEWONE update van het
 * bouwsteen-record (kantoor-only). Bij prijsmodel "uren" wordt urenPerBeurt
 * bijgewerkt — de prijs per beurt volgt dan vanzelf de bestaande
 * uurtarief/prijs-op-datum-regels (berekenPrijsPerBeurt); bij "vast" alleen
 * de hulpsuggestie normurenPerEenheid (het vaste bedrag blijft staan).
 */
export const neemNormuurOver = mutation({
  args: {
    bouwsteenId: v.id("bouwstenen"),
    uren: v.number(),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    if (!Number.isFinite(args.uren) || args.uren <= 0 || args.uren > 1000) {
      throw new ConvexError("Ongeldig normuur (moet groter dan 0 zijn)");
    }
    const bouwsteen = await ctx.db.get(args.bouwsteenId);
    // Schrijfguard: alleen bouwstenen uit de eigen catalogus.
    if (!bouwsteen || bouwsteen.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Bouwsteen niet gevonden");
    }
    const veld = normuurVeldVoorBouwsteen(bouwsteen);
    await ctx.db.patch(args.bouwsteenId, {
      [veld]: args.uren,
      updatedAt: Date.now(),
    });
    return args.bouwsteenId;
  },
});
