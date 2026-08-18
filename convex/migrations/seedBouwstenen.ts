/**
 * Migratie: startvulling bouwstenencatalogus (PRD bijlage A) + uurtarief €65
 *
 * Maakt de 23 bouwstenen uit bijlage A aan met naam, code-voorstel, categorie,
 * soort, seizoensvenster en bijzonderheden als opmerking. Prijzen, uren en
 * default-frequenties blijven bewust LEEG — die vult Mickey in de app (§7.1);
 * de indicaties uit bijlage A staan als tekst in de opmerking.
 *
 * Zet daarnaast het start-uurtarief van €65 ex btw (PRD §2.5a) als eerste
 * record in `uurtarieven`, alleen als de tabel nog leeg is.
 *
 * Idempotent: bouwstenen worden op code overgeslagen als ze al bestaan,
 * dus de migratie kan veilig opnieuw draaien.
 *
 * Draaien via Convex dashboard of CLI (dry run eerst!):
 *   npx convex run migrations/seedBouwstenen:seedBouwstenen '{"dryRun": true}'
 *   npx convex run migrations/seedBouwstenen:seedBouwstenen
 *
 * Verificatie na afloop (moet aantalBouwstenen === 23 geven):
 *   npx convex run migrations/seedBouwstenen:verifieerSeed
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { STANDAARD_UURTARIEF } from "../uurtarieven";
import type { BouwsteenCategorie, BouwsteenSoort } from "../bouwstenen";

export interface BouwsteenSeedRecord {
  naam: string;
  code: string;
  categorie: BouwsteenCategorie;
  soort: BouwsteenSoort;
  seizoensvensterVan?: number;
  seizoensvensterTot?: number;
  receptuurstappen?: { volgorde: number; omschrijving: string }[];
  opmerking?: string;
}

/** Ingangsdatum van het start-uurtarief: begin van het lopende jaar. */
export const START_UURTARIEF_INGANGSDATUM = "2026-01-01";

/**
 * Startvulling bijlage A (vastgesteld 7 juli 2026, review Romeo).
 * Alleen bij een expliciet maand-vertaalbaar venster worden
 * seizoensvensterVan/Tot gezet; overige seizoensteksten staan in de opmerking.
 */
export const BOUWSTENEN_STARTVULLING: BouwsteenSeedRecord[] = [
  // ── Gras & Gazon ──
  {
    naam: "Gazon maaien",
    code: "GM",
    categorie: "gras_gazon",
    soort: "terugkerend",
    seizoensvensterVan: 3,
    seizoensvensterTot: 11,
    opmerking: "Indicatie ±26×/jaar; groeiseizoen (±mrt–nov).",
  },
  {
    naam: "Bemesting",
    code: "BM",
    categorie: "gras_gazon",
    soort: "terugkerend",
    opmerking: "Indicatie 3–4×/jaar.",
  },
  {
    naam: "Gazonanalyse",
    code: "GA",
    categorie: "gras_gazon",
    soort: "eenmalig",
  },
  {
    naam: "Mollenbestrijding",
    code: "MB",
    categorie: "gras_gazon",
    soort: "op_afroep",
  },
  {
    naam: "Graskanten steken",
    code: "GK",
    categorie: "gras_gazon",
    soort: "terugkerend",
    opmerking: "Vaak met maaironde.",
  },
  {
    naam: "Verticuteren",
    code: "VC",
    categorie: "gras_gazon",
    soort: "terugkerend",
    opmerking: "Indicatie 1–2×/jaar; voorjaar/najaar.",
  },
  {
    naam: "Bijzaaien",
    code: "BZ",
    categorie: "gras_gazon",
    soort: "eenmalig",
    opmerking: "Doorgaans na verticuteren.",
  },
  // ── Borders & Beplanting ──
  {
    naam: "Borderonderhoud (schoffelen & wieden)",
    code: "BO",
    categorie: "borders_beplanting",
    soort: "terugkerend",
  },
  {
    naam: "Vaste planten terugknippen",
    code: "VP",
    categorie: "borders_beplanting",
    soort: "terugkerend",
    opmerking: "Indicatie 1–2×/jaar; najaar/voorjaar.",
  },
  {
    naam: "Mulchen / snippers aanvullen",
    code: "MU",
    categorie: "borders_beplanting",
    soort: "terugkerend",
    opmerking: "Indicatie jaarlijks; materiaalregel.",
  },
  {
    naam: "Plaagcontrole (o.a. buxusmot)",
    code: "PC",
    categorie: "borders_beplanting",
    soort: "terugkerend",
    opmerking: "Groeiseizoen.",
  },
  // ── Heggen & Bomen ──
  {
    naam: "Heggen snoeien",
    code: "HS",
    categorie: "heggen_bomen",
    soort: "terugkerend",
    opmerking:
      "Indicatie 2×/jaar; buiten broedseizoen (indicatief 15 mrt–15 jul; " +
      "wettelijk geldt de zorgplicht Wet natuurbescherming, geen vaste datums).",
  },
  {
    naam: "Bomen snoeien",
    code: "BS",
    categorie: "heggen_bomen",
    soort: "terugkerend",
    opmerking: "Seizoensgebonden per soort.",
  },
  // ── Bestrating & Terras ──
  {
    naam: "Onkruid bestrating / terras",
    code: "OB",
    categorie: "bestrating_terras",
    soort: "terugkerend",
    opmerking: "Chemievrij (professioneel glyfosaatverbod).",
  },
  {
    naam: "Voegen bijwerken",
    code: "VB",
    categorie: "bestrating_terras",
    soort: "eenmalig",
  },
  // ── Reiniging ──
  {
    naam: "Reinigingsbeurt (receptuur, 3 stappen)",
    code: "RB",
    categorie: "reiniging",
    soort: "terugkerend",
    receptuurstappen: [
      { volgorde: 1, omschrijving: "Onkruid machinaal borstelen" },
      {
        volgorde: 2,
        omschrijving: "Reinigen (Biomix of hogedruk, per ondergrond)",
      },
      { volgorde: 3, omschrijving: "Invegen" },
    ],
    opmerking:
      "Vaste stapvolgorde, komt ook op de werkbon. Blauwsteen: geen roterende " +
      "borstel op gezoet oppervlak; Biomix kan tijdelijke roodbruine verkleuring " +
      "geven die met naspoelen/regen verdwijnt.",
  },
  {
    naam: "Invegen — zand-keuzeregel",
    code: "IZ",
    categorie: "reiniging",
    soort: "keuzeregel",
    opmerking:
      "Klant kiest: onkruidvrij voegzand óf straatzand — twee prijzen in de offerte.",
  },
  // ── Seizoen ──
  {
    naam: "Bladruimen",
    code: "BL",
    categorie: "seizoen",
    soort: "terugkerend",
    seizoensvensterVan: 9,
    seizoensvensterTot: 12,
    opmerking: "Najaar.",
  },
  {
    naam: "Voorjaarsbeurt",
    code: "VJ",
    categorie: "seizoen",
    soort: "bundel",
    opmerking: "Indicatie 1×/jaar; samenstelling t.b.d. (§7.1).",
  },
  {
    naam: "Najaarsbeurt",
    code: "NJ",
    categorie: "seizoen",
    soort: "bundel",
    opmerking: "Indicatie 1×/jaar; samenstelling t.b.d. (§7.1).",
  },
  // ── Kosten & regels ──
  {
    naam: "Afvoer groenafval",
    code: "AG",
    categorie: "kosten_regels",
    soort: "kostenregel",
    opmerking:
      "Per beurt/container. Intern splitsen in stortkosten (per m³/kg, variabel) " +
      "en afvoertijd (uren, gemeten via BES-segment §2.6); op de offerte als één " +
      "regel te tonen.",
  },
  {
    naam: "Voorrijkosten",
    code: "VR",
    categorie: "kosten_regels",
    soort: "kostenregel",
    opmerking:
      "Per bezoek. Verplicht vooraf gemeld (informatieplicht consument).",
  },
  {
    naam: "Minimum-bezoektarief",
    code: "MT",
    categorie: "kosten_regels",
    soort: "kostenregel",
    opmerking:
      "Per bezoek. Ondergrens zodat een klein klusje nooit onder kostprijs rijdt.",
  },
];

export const seedBouwstenen = internalMutation({
  args: {
    // Sinds de org-migratie hoort een catalogus bij één organisatie; de
    // aanroeper (CLI) geeft expliciet mee welke.
    orgId: v.id("organisaties"),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;

    const bestaande = await ctx.db
      .query("bouwstenen")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const bestaandeCodes = new Set(bestaande.map((b) => b.code));

    let aangemaakt = 0;
    let overgeslagen = 0;
    const nu = Date.now();

    for (const record of BOUWSTENEN_STARTVULLING) {
      if (bestaandeCodes.has(record.code)) {
        overgeslagen++;
        continue;
      }
      if (!dryRun) {
        await ctx.db.insert("bouwstenen", {
          orgId: args.orgId,
          naam: record.naam,
          code: record.code,
          categorie: record.categorie,
          soort: record.soort,
          seizoensvensterVan: record.seizoensvensterVan,
          seizoensvensterTot: record.seizoensvensterTot,
          receptuurstappen: record.receptuurstappen,
          opmerking: record.opmerking,
          // Prijsmodel-default is uurbasis (§2.5a); uren/prijzen vult Mickey
          prijsmodel: "uren",
          // Arbeid = 21% btw als default; per bouwsteen aanpasbaar
          btwCode: 21,
          actief: true,
          createdAt: nu,
          updatedAt: nu,
        });
      }
      aangemaakt++;
    }

    // Start-uurtarief €65 ex btw — alleen als er nog geen enkel tarief bestaat
    const bestaandeTarieven = await ctx.db
      .query("uurtarieven")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    let uurtariefGezet = false;
    if (bestaandeTarieven.length === 0) {
      if (!dryRun) {
        await ctx.db.insert("uurtarieven", {
          orgId: args.orgId,
          bedrag: STANDAARD_UURTARIEF,
          ingangsdatum: START_UURTARIEF_INGANGSDATUM,
          opmerking: "Startwaarde (PRD §2.5a, besluit 8 juli 2026)",
          createdAt: nu,
        });
      }
      uurtariefGezet = true;
    }

    return {
      dryRun,
      aangemaakt,
      overgeslagen,
      totaalInCatalogus: bestaande.length + aangemaakt,
      uurtariefGezet,
    };
  },
});

export const verifieerSeed = internalQuery({
  args: {},
  handler: async (ctx) => {
    const bouwstenen = await ctx.db.query("bouwstenen").collect();
    const tarieven = await ctx.db.query("uurtarieven").collect();
    return {
      aantalBouwstenen: bouwstenen.length,
      aantalActief: bouwstenen.filter((b) => b.actief).length,
      codes: bouwstenen.map((b) => b.code).sort(),
      aantalUurtarieven: tarieven.length,
      tarieven: tarieven.map((t) => ({
        bedrag: t.bedrag,
        ingangsdatum: t.ingangsdatum,
      })),
    };
  },
});
