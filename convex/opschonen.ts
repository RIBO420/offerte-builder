/**
 * Werkdata opschonen — de "Gevarenzone" onderaan /instellingen (spec §7 van de
 * Clerk-Organizations-migratie).
 *
 * Eén ronde wist álle transactiedata van de éigen organisatie en laat leads,
 * klanten, leveranciers en alle configuratie/stamdata staan. Wat weg mag en wat
 * blijft staat niet hier maar in `convex/lib/orgTabellen.ts`
 * (`TABEL_CLASSIFICATIE`, compile-time exhaustief tegen het schema); de
 * productie-migratie hergebruikt straks precies dezelfde map. Dit bestand is
 * dus de motor, niet de waarheid — een tabel toevoegen doe je dáár.
 *
 * ── Vorm van een ronde ───────────────────────────────────────────────────────
 *   preview  (query)            telt wat er weg zou gaan
 *   start    (mutation)         eist de letterlijke bevestiging "OPSCHONEN"
 *   verwerkBatch (internal)     wist per aanroep hooguit BATCH ouderrijen en
 *                               plant zichzelf opnieuw in tot alles op is
 *   maakReferentiesSchoon       maakt dode verwijzingen leeg en stempelt
 *                               organisaties.laatsteOpschoning
 *
 * ── Drie keuzes die je moet kennen ───────────────────────────────────────────
 *
 * 1. GEEN status-tabel (YAGNI). Er is geen `opschoonRuns`-tabel en geen
 *    voortgangsdocument: de UI pollt gewoon `preview` tot `totaal` nul is. Dat
 *    is exact zo betrouwbaar als een teller die we zelf zouden bijhouden — de
 *    telling ís de voortgang — en het scheelt een tabel die na de ene keer dat
 *    iemand opschoont voor altijd blijft rondslingeren. `laatsteOpschoning` op
 *    de organisaties-rij is het enige spoor dat achterblijft.
 *
 * 2. De batchgrens telt ALLEEN ouderrijen. Een aanroep pakt BATCH ouderrijen,
 *    maar wist daarbovenop álle kinderen van die rijen (KIND_VAN). Een project
 *    met 300 planningtaken gaat dus in één keer, ook al is BATCH 200. Dat is
 *    bewust: een cascade halverwege afbreken laat wezen achter waar geen enkele
 *    query nog bij kan. De echte bovengrens is daarmee BATCH × (1 + kinderen
 *    per ouder); in de praktijk ver onder de mutation-limieten van Convex.
 *
 * 3. `notification_log` en `demoSeed` hebben geen orgId (clerkId-strings resp.
 *    dev-registry) en worden FULL TABLE gewist — deployment-breed dus, niet per
 *    organisatie. In de single-org-installatie van Top Tuinen komt dat op
 *    hetzelfde neer; `preview` markeert ze apart zodat de UI dat kan uitleggen
 *    voordat iemand op de knop drukt.
 */

import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id, TableNames } from "./_generated/dataModel";
import { AuthError, requireOrgId } from "./auth";
import { requireAdmin } from "./roles";
import {
  TABEL_CLASSIFICATIE,
  KIND_VAN,
  type Classificatie,
} from "./lib/orgTabellen";

// ─── Losse tabeltoegang ──────────────────────────────────────────────────────
//
// De engine loopt over tabelnamen die pas bij runtime bekend zijn. TypeScript
// kan `ctx.db.query(<variabele>)` niet narrowen — het documenttype hangt af van
// de literal — dus draait alles hier via één bewust losse vorm. De veld- en
// indexnamen die we dan gebruiken zijn niet ongecontroleerd: org-tabellen.test.ts
// en opschonen.test.ts checken ze tegen convex/schema.ts.

interface LosDoc {
  _id: string;
  [veld: string]: unknown;
}

interface LosseIndexQuery {
  eq(veld: string, waarde: unknown): LosseIndexQuery;
}

interface LosseQuery {
  withIndex(
    index: string,
    fn: (q: LosseIndexQuery) => unknown,
  ): LosseQuery;
  collect(): Promise<LosDoc[]>;
  take(n: number): Promise<LosDoc[]>;
}

function tabel(ctx: QueryCtx | MutationCtx, naam: string): LosseQuery {
  return (ctx.db.query as unknown as (n: string) => LosseQuery)(naam);
}

function verwijder(ctx: MutationCtx, id: string): Promise<void> {
  return ctx.db.delete(id as Id<TableNames>);
}

// ─── Wat wordt er gewist ─────────────────────────────────────────────────────

/** Ouderrijen per aanroep van `verwerkBatch`; kinderen tellen niet mee (zie kop). */
export const BATCH = 200;

/** Tabellen zonder orgId: die gaan full-table, deployment-breed. */
export const FULL_SCAN_TABELLEN = ["notification_log", "demoSeed"] as const;

const ENTRIES = Object.entries(TABEL_CLASSIFICATIE) as [
  TableNames,
  Classificatie,
][];

/**
 * De org-gescopeerde wistabellen, in schemavolgorde.
 *
 * Buiten deze lijst vallen met opzet de kindtabellen (die gaan via hun ouder,
 * zie KINDEREN_VAN) en de full-scan-tabellen (die hebben geen orgId).
 */
export const WIS_TABELLEN: TableNames[] = ENTRIES.filter(
  ([tabelNaam, klasse]) =>
    klasse === "wissen" &&
    !(tabelNaam in KIND_VAN) &&
    !(FULL_SCAN_TABELLEN as readonly string[]).includes(tabelNaam),
).map(([tabelNaam]) => tabelNaam);

/**
 * Index waarmee we een wistabel op de eigen organisatie doorlopen.
 *
 * Standaard heet die `by_org`. Dertien tabellen hebben alleen een samengestelde
 * org-index (`by_org_datum`, `by_org_status`, …); een `q.eq("orgId", …)` is een
 * geldige prefix daarvan, dus die werkt net zo goed. De test controleert per
 * tabel dat de hier genoemde index bestaat én op orgId begint.
 */
export const ORG_INDEX: Partial<Record<TableNames, string>> = {
  conceptMails: "by_org_status",
  teamBemanning: "by_org_datum",
  afwezigheidsblokken: "by_org_start",
  planbordLogboek: "by_org_createdAt",
  reistijdCache: "by_org_sleutel",
  dagkaartAfwijkingen: "by_org_datum",
  teamBusOverrides: "by_org_datum",
  middelReserveringen: "by_org_datum",
  urenSegmenten: "by_org_datum",
  urenDagen: "by_org_datum",
  urenLogboek: "by_org_createdAt",
  materiaalChecks: "by_org_datum",
  klantTaken: "by_org_status",
  dagLogboek: "by_org_user_datum",
  klantBestanden: "by_klant", // fields: ["orgId", "klantId"]
};

export interface KindTabel {
  tabel: TableNames;
  veld: string;
  index: string;
}

/**
 * KIND_VAN, omgedraaid naar ouder → kinderen, en gefilterd op classificatie.
 *
 * Alleen kinderen die zélf "wissen" zijn cascaderen mee. `leadActiviteiten` is
 * ook een KIND_VAN-entry maar staat op "bewaren" (het hangt onder de bewaarde
 * `configuratorAanvragen`) en hoort hier dus nadrukkelijk niet in.
 */
export const KINDEREN_VAN: Record<string, KindTabel[]> = (() => {
  const uit: Record<string, KindTabel[]> = {};
  for (const [kind, relatie] of Object.entries(KIND_VAN)) {
    if (!relatie) continue;
    if (TABEL_CLASSIFICATIE[kind as keyof typeof TABEL_CLASSIFICATIE] !== "wissen") {
      continue;
    }
    (uit[relatie.ouder] ??= []).push({
      tabel: kind as TableNames,
      veld: relatie.veld,
      index: relatie.index,
    });
  }
  return uit;
})();

/** De volgorde die `verwerkBatch` afloopt: eerst per org, dan full-table. */
const ALLE_TABELLEN: string[] = [...WIS_TABELLEN, ...FULL_SCAN_TABELLEN];

// ─── Referentie-schoonmaak ───────────────────────────────────────────────────

export interface Referentie {
  /** Bewaarde tabel waarop het veld staat. */
  tabel: string;
  /** Top-level veldnaam (geneste of array-verwijzingen kunnen we niet generiek patchen). */
  veld: string;
  /** Wistabel waar het veld naar wijst. */
  doel: string;
}

/**
 * Velden op BEWAARDE rijen die naar GEWISTE rijen wijzen.
 *
 * Vandaag is die lijst leeg, en dat is een bevinding, geen omissie: in
 * convex/schema.ts wijst géén enkel `v.id(...)`-veld van een bewaartabel naar
 * een wistabel. De verwijzingen lopen precies andersom (offertes → klanten,
 * projecten → offertes), en de verwijzingen die bewaartabellen onderling wél
 * hebben — `configuratorAanvragen.gekoppeldKlantId`, `klanten.voorkeursTeamId`,
 * `bouwstenen.productIds` — blijven per spec §7 gewoon staan.
 *
 * De spec noemt `configuratorAanvragen.offerteId` en klant-/medewerkervelden
 * naar offertes/projecten/facturen; die velden bestaan in dit schema niet. Wat
 * wél de link legt zijn statusvelden zonder id (`klanten.pipelineStatus`,
 * `configuratorAanvragen.status = "offerte_verstuurd"`, activiteitregels in
 * `leadActiviteiten`). Dat is geschiedenis, geen dode verwijzing: die blijft
 * staan, precies zoals de bewaarlijst bedoelt.
 *
 * De lijst wordt in opschonen.test.ts tegen het schema gehouden: voegt iemand
 * ooit `klanten.laatsteOfferteId: v.id("offertes")` toe, dan valt die test om
 * en moet de referentie hier bij.
 */
export const REFERENTIE_VELDEN: Referentie[] = [];

/**
 * Maakt per referentie de velden leeg waarvan het doeldocument weg is.
 *
 * Apart van de mutation zodat de mechaniek testbaar blijft ook wanneer
 * REFERENTIE_VELDEN (nog) leeg is. Retourneert het aantal opgeruimde velden.
 */
export async function schoonReferentiesOp(
  ctx: MutationCtx,
  orgId: Id<"organisaties">,
  referenties: Referentie[],
): Promise<number> {
  let opgeruimd = 0;
  for (const referentie of referenties) {
    const index =
      ORG_INDEX[referentie.tabel as TableNames] ?? "by_org";
    const rijen = await tabel(ctx, referentie.tabel)
      .withIndex(index, (q) => q.eq("orgId", orgId))
      .collect();
    for (const rij of rijen) {
      const waarde = rij[referentie.veld];
      if (waarde === undefined || waarde === null) continue;
      // Nog aanwezig? Dan is het geen dode verwijzing en blijft hij staan.
      if (await ctx.db.get(waarde as Id<TableNames>)) continue;
      await ctx.db.patch(rij._id as Id<TableNames>, {
        [referentie.veld]: undefined,
      } as never);
      opgeruimd++;
    }
  }
  return opgeruimd;
}

// ─── (a) preview ─────────────────────────────────────────────────────────────

/**
 * Wat zou er weggaan? Telt per tabel, inclusief kindrijen via hun ouder.
 *
 * Dit is ook de voortgangsmeter: de UI pollt deze query tijdens een lopende
 * ronde tot `totaal` nul is (zie keuze 1 in de kop van dit bestand).
 *
 * De telling gebruikt `.collect()` en niet een goedkopere schatting: Convex
 * kent geen count, en een preview die ernaast zit is bij een onomkeerbare actie
 * erger dan een preview die even duurt.
 */
export const preview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const orgId = await requireOrgId(ctx);

    const telling: Record<string, number> = {};
    let totaal = 0;
    const tel = (naam: string, aantal: number) => {
      telling[naam] = (telling[naam] ?? 0) + aantal;
      totaal += aantal;
    };

    for (const naam of WIS_TABELLEN) {
      const rijen = await tabel(ctx, naam)
        .withIndex(ORG_INDEX[naam] ?? "by_org", (q) => q.eq("orgId", orgId))
        .collect();
      tel(naam, rijen.length);

      for (const kind of KINDEREN_VAN[naam] ?? []) {
        let aantal = 0;
        for (const rij of rijen) {
          const kinderen = await tabel(ctx, kind.tabel)
            .withIndex(kind.index, (q) => q.eq(kind.veld, rij._id))
            .collect();
          aantal += kinderen.length;
        }
        tel(kind.tabel, aantal);
      }
    }

    for (const naam of FULL_SCAN_TABELLEN) {
      tel(naam, (await tabel(ctx, naam).collect()).length);
    }

    return {
      telling,
      totaal,
      /** Deze categorieën zijn deployment-breed, niet per organisatie. */
      fullScanTabellen: [...FULL_SCAN_TABELLEN] as string[],
    };
  },
});

// ─── (b) start ───────────────────────────────────────────────────────────────

export const start = mutation({
  args: { bevestiging: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const orgId = await requireOrgId(ctx);

    if (args.bevestiging !== "OPSCHONEN") {
      throw new AuthError(
        'Typ letterlijk OPSCHONEN om het wissen van alle werkdata te bevestigen.',
      );
    }

    await ctx.scheduler.runAfter(0, internal.opschonen.verwerkBatch, {
      orgId,
      tabelIndex: 0,
    });

    return { gestart: true };
  },
});

// ─── (c) batchloop ───────────────────────────────────────────────────────────

/**
 * Wist één batch en plant de volgende in.
 *
 * `tabelIndex` wijst in ALLE_TABELLEN. Zolang een aanroep een volle batch
 * ophaalt blijft hij op dezelfde tabel staan; komt hij er minder dan BATCH
 * tegen, dan is die tabel leeg en schuift hij door. Voorbij de laatste tabel
 * draagt hij over aan de referentie-schoonmaak.
 */
export const verwerkBatch = internalMutation({
  args: { orgId: v.id("organisaties"), tabelIndex: v.number() },
  handler: async (ctx, args) => {
    if (args.tabelIndex >= ALLE_TABELLEN.length) {
      await ctx.scheduler.runAfter(0, internal.opschonen.maakReferentiesSchoon, {
        orgId: args.orgId,
      });
      return { tabel: null, gewist: 0, klaar: true };
    }

    const naam = ALLE_TABELLEN[args.tabelIndex];
    const isFullScan = (FULL_SCAN_TABELLEN as readonly string[]).includes(naam);

    const rijen = isFullScan
      ? await tabel(ctx, naam).take(BATCH)
      : await tabel(ctx, naam)
          .withIndex(ORG_INDEX[naam as TableNames] ?? "by_org", (q) =>
            q.eq("orgId", args.orgId),
          )
          .take(BATCH);

    const kinderen = KINDEREN_VAN[naam] ?? [];
    let gewist = 0;
    for (const rij of rijen) {
      // Eerst de kinderen: een ouder die al weg is, is niet meer vindbaar.
      for (const kind of kinderen) {
        const kindRijen = await tabel(ctx, kind.tabel)
          .withIndex(kind.index, (q) => q.eq(kind.veld, rij._id))
          .collect();
        for (const kindRij of kindRijen) {
          await verwijder(ctx, kindRij._id);
          gewist++;
        }
      }
      await verwijder(ctx, rij._id);
      gewist++;
    }

    // Volle batch? Dan zit er waarschijnlijk meer in deze tabel.
    const volgende =
      rijen.length === BATCH ? args.tabelIndex : args.tabelIndex + 1;
    await ctx.scheduler.runAfter(0, internal.opschonen.verwerkBatch, {
      orgId: args.orgId,
      tabelIndex: volgende,
    });

    return { tabel: naam, gewist, klaar: false };
  },
});

// ─── (d) referentie-schoonmaak ───────────────────────────────────────────────

/**
 * Sluitstuk van een ronde: dode verwijzingen weg, en een stempel op de
 * organisatie zodat "wanneer is er voor het laatst opgeschoond?" beantwoordbaar
 * blijft zonder aparte logtabel.
 */
export const maakReferentiesSchoon = internalMutation({
  args: { orgId: v.id("organisaties") },
  handler: async (ctx, args) => {
    const opgeruimd = await schoonReferentiesOp(
      ctx,
      args.orgId,
      REFERENTIE_VELDEN,
    );
    await ctx.db.patch(args.orgId, { laatsteOpschoning: Date.now() });
    return { opgeruimd, klaar: true };
  },
});
