/**
 * De eenmalige datamigratie naar het organisatie-model (fase 6/8 van
 * docs/superpowers/plans/2026-08-18-clerk-organizations-migratie.md).
 *
 * Hij tilt de userId-tenancy naar orgId: alles wat van de eigenaar is krijgt
 * een `orgId`, alles wat van een ándere gebruiker was verdwijnt, en alle
 * transactiedata gaat schoon op. Draait op dev én prod — met de deployment-slug
 * als expliciete bevestiging, zodat "even op de verkeerde database" geen
 * mogelijkheid is.
 *
 * Commando's:
 *   npx convex run migrations/naarOrganisaties:voorTelling
 *   npx convex run migrations/naarOrganisaties:migreer \
 *     '{"bevestigDeployment":"affable-rook-669","clerkOrgId":"org_…","eigenaarEmail":"…"}'
 *   npx convex run migrations/naarOrganisaties:verifieerMigratie '{"clerkOrgId":"org_…"}'
 *
 * ── Wat waar vandaan komt ────────────────────────────────────────────────────
 * Welke tabel bewaard of gewist wordt staat NIET hier maar in
 * `convex/lib/orgTabellen.ts` (`TABEL_CLASSIFICATIE`, compile-time exhaustief
 * tegen het schema). Dit bestand voegt daar één ding aan toe: per bewaartabel
 * of hij een tenant-veld (`userId`) heeft of niet. Die driedeling wordt in
 * `naar-organisaties.test.ts` tegen `convex/schema.ts` gehouden, dus een nieuw
 * veld of een nieuwe tabel valt om in de tests en niet pas op productie.
 *
 * ── De vier stappen die je moet kennen ───────────────────────────────────────
 *
 * 1. ONTDUBBELING (`ontdubbelGeseedeRijen`, draait in `migreer` zelf).
 *    Op dev bestaat de organisaties-rij al, mét een geseede set
 *    instellingen/normuren/producten (schouw 18 aug). Die rijen dragen hetzelfde
 *    orgId dat de eigenaar-rijen zo dadelijk krijgen — laat je ze staan, dan
 *    zijn er straks twee instellingen-rijen per org en klapt élke `.unique()`
 *    op `instellingen.by_org`. Ze gaan er dus uit, want de eigenaar-rij bevat de
 *    echte bedrijfsgegevens en wint. Het onderscheid is niet "dev of prod" en
 *    ook geen inhoudsvergelijking, maar tijd: een geseede rij is aangemaakt
 *    ná (of tegelijk met) de organisatie-rij zelf; alle rijen van vóór de
 *    organisatie zijn per definitie eigen data. Daarmee is de stap generiek én
 *    veilig voor een half afgebroken run (rijen die al een orgId kregen zijn
 *    ouder dan de organisatie en blijven staan).
 *
 * 2. BATCHLOOP (`verwerkBatch`). Zelfde vorm als `opschonen.verwerkBatch`: de
 *    mutation plant zichzelf opnieuw in en de voortgangscursor zit in de args
 *    (`fase`, `tabelIndex`). Er is geen statustabel — `verifieerMigratie` is de
 *    voortgangsmeter.
 *
 * 3. GEEN `.filter()`. De loop leest per tabel `.collect()` (bewaartabellen:
 *    één tenant, hooguit duizenden rijen) en beslist in JS. Dat scheelt een
 *    afhankelijkheid van `q.eq(q.field("orgId"), undefined)`-semantiek en maakt
 *    de voortgang deterministisch: rijen die al klaar zijn worden een no-op, en
 *    een ronde die minder dan BATCH bewerkingen doet schuift door naar de
 *    volgende tabel. Wistabellen gaan wél met `.take(BATCH)` — daar is elke rij
 *    weg na behandeling en kan `locationData` niet in één collect passen.
 *
 * 4. SYSTEEMDEFAULTS BLIJVEN. `correctiefactoren`, `standaardtuinen` en
 *    `plantsoorten` kennen rijen zonder `userId`: dat zijn de systeembrede
 *    defaults. Ze krijgen géén orgId (dat is precies hun betekenis) en worden
 *    ook niet gewist. Zie `SYSTEEMDEFAULT_TABELLEN`.
 */

import { v, ConvexError } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id, TableNames } from "../_generated/dataModel";
import {
  TABEL_CLASSIFICATIE,
  KIND_VAN,
  type Classificatie,
} from "../lib/orgTabellen";
import { maakOrganisatieIntern } from "../organisaties";

// ─── Deployment-guard ────────────────────────────────────────────────────────
//
// Zelfde mechaniek als `convex/demoSeed.ts`, met één verschil: die weigert op
// productie, deze mág daar juist draaien. De bevestiging is daarom geen
// formaliteit maar de enige rem — hij moet exact gelijk zijn aan de deployment
// waarop de functie zich bevindt.

export const DEV_DEPLOYMENT = "affable-rook-669";
export const PROD_DEPLOYMENT = "impartial-dinosaur-829";
export const TOEGESTANE_DEPLOYMENTS: string[] = [
  DEV_DEPLOYMENT,
  PROD_DEPLOYMENT,
];

/**
 * Naam van de deployment waarop deze functie draait, uit de systeem-env-var
 * `CONVEX_CLOUD_URL` (https://<deployment>.convex.cloud). `null` als de URL
 * ontbreekt of niet te ontleden is.
 */
export function bepaalDeployment(): string | null {
  const url = process.env.CONVEX_CLOUD_URL ?? process.env.CONVEX_SITE_URL ?? "";
  const match = url.match(/^https?:\/\/([^./]+)\./);
  return match ? match[1] : null;
}

/**
 * Weiger te draaien tenzij de bevestiging de huidige deployment ís.
 *
 * Kan de deployment zichzelf niet identificeren (toekomstige Convex-versie die
 * de env-variabele hernoemt), dan blijft alleen de bevestiging over: die moet
 * dan tenminste een van de twee bekende deployments zijn. Faalt dicht.
 */
export function bewaakDeployment(bevestiging: string): string {
  const deployment = bepaalDeployment();

  if (deployment !== null) {
    if (deployment !== bevestiging) {
      throw new ConvexError(
        `Weigering: je bevestigde "${bevestiging}", maar deze functie draait ` +
          `op "${deployment}". Geef de deployment op waar je écht op staat.`,
      );
    }
    if (!TOEGESTANE_DEPLOYMENTS.includes(deployment)) {
      throw new ConvexError(
        `Weigering: onbekende deployment "${deployment}". De org-migratie ` +
          `draait alleen op ${DEV_DEPLOYMENT} of ${PROD_DEPLOYMENT}.`,
      );
    }
    return deployment;
  }

  if (!TOEGESTANE_DEPLOYMENTS.includes(bevestiging)) {
    throw new ConvexError(
      "Weigering: de deployment is niet vast te stellen (CONVEX_CLOUD_URL " +
        `ontbreekt) en "${bevestiging}" is geen bekende deployment. Gebruik ` +
        `${DEV_DEPLOYMENT} of ${PROD_DEPLOYMENT}.`,
    );
  }
  return bevestiging;
}

// ─── Tabelindeling ───────────────────────────────────────────────────────────

const ENTRIES = Object.entries(TABEL_CLASSIFICATIE) as [
  TableNames,
  Classificatie,
][];

/** Ouderrijen (of losse rijen) per aanroep van `verwerkBatch`. */
export const BATCH = 200;

/**
 * Bewaartabellen MET tenant-veld: rijen van de eigenaar krijgen `orgId`, rijen
 * van andere gebruikers gaan weg.
 */
export const EIGENAAR_TABELLEN: TableNames[] = [
  "klanten",
  "leveranciers",
  "instellingen",
  "producten",
  "normuren",
  "correctiefactoren",
  "standaardtuinen",
  "plantsoorten",
  "emailTemplates",
  "garantiePakketten",
  "boekhoudInstellingen",
  "medewerkers",
  "teams",
  "machines",
  "voertuigen",
  "voertuigUitrusting",
  "vervalItems",
  "afvalverwerkers",
  "transportbedrijven",
];

/**
 * Bewaartabellen ZONDER tenant-veld: alle rijen gaan naar de organisatie.
 *
 * `configuratorAanvragen` (de leads) staat hier omdat de publieke configurator
 * geen ingelogde gebruiker kent; de catalogus-achtige tabellen omdat ze altijd
 * al deployment-breed waren. In een single-org-installatie is "alles" gelijk
 * aan "van deze organisatie".
 */
export const TENANTLOZE_TABELLEN: TableNames[] = [
  "configuratorAanvragen",
  "bouwstenen",
  "tekstblokken",
  "mailTriggers",
  "uurtarieven",
];

/**
 * Bewaartabellen zonder eigen `orgId`-veld: die scopen via hun ouder
 * (`KIND_VAN`) en blijven bij de migratie ongemoeid.
 */
export const KIND_ZONDER_ORGID: TableNames[] = ["leadActiviteiten"];

/**
 * Tabellen met systeembrede defaults: rijen zónder `userId` zijn geen
 * tenantdata. Ze houden hun lege `userId` én krijgen geen `orgId` — dat
 * ontbreken ís de discriminator (plan Task 6.2 Step 4b zet hem later om).
 */
export const SYSTEEMDEFAULT_TABELLEN: TableNames[] = [
  "correctiefactoren",
  "standaardtuinen",
  "plantsoorten",
];

/** Alles wat "wissen" is, kindtabellen en orgId-loze tabellen inbegrepen. */
export const WIS_TABELLEN: TableNames[] = ENTRIES.filter(
  ([, klasse]) => klasse === "wissen",
).map(([naam]) => naam);

/**
 * Index waarmee we een bewaartabel op een bestaand `orgId` doorlopen
 * (alleen de ontdubbelstap gebruikt dit). Standaard `by_org`; alleen
 * `correctiefactoren` heeft er geen en gebruikt de samengestelde variant,
 * waarvan `orgId` een geldige prefix is. De test controleert dat tegen
 * convex/schema.ts.
 */
export const ORG_INDEX: Partial<Record<TableNames, string>> = {
  correctiefactoren: "by_org_type",
};

export interface KindTabel {
  tabel: TableNames;
  veld: string;
  index: string;
}

/** KIND_VAN omgedraaid: ouder → kinderen. Ongefilterd: wie weg gaat, gaat heel. */
export const KINDEREN_VAN: Record<string, KindTabel[]> = (() => {
  const uit: Record<string, KindTabel[]> = {};
  for (const [kind, relatie] of Object.entries(KIND_VAN)) {
    if (!relatie) continue;
    (uit[relatie.ouder] ??= []).push({
      tabel: kind as TableNames,
      veld: relatie.veld,
      index: relatie.index,
    });
  }
  return uit;
})();

// ─── Losse tabeltoegang ──────────────────────────────────────────────────────
//
// De loop draait over tabelnamen die pas bij runtime bekend zijn; TypeScript
// kan `ctx.db.query(<variabele>)` niet narrowen. Zelfde bewust losse vorm als
// convex/opschonen.ts, en net als daar worden de gebruikte veld- en indexnamen
// in de test tegen convex/schema.ts gehouden.

interface LosDoc {
  _id: string;
  _creationTime: number;
  [veld: string]: unknown;
}

interface LosseIndexQuery {
  eq(veld: string, waarde: unknown): LosseIndexQuery;
}

interface LosseQuery {
  withIndex(index: string, fn: (q: LosseIndexQuery) => unknown): LosseQuery;
  collect(): Promise<LosDoc[]>;
  take(n: number): Promise<LosDoc[]>;
}

function tabel(ctx: QueryCtx | MutationCtx, naam: string): LosseQuery {
  return (ctx.db.query as unknown as (n: string) => LosseQuery)(naam);
}

function verwijder(ctx: MutationCtx, id: string): Promise<void> {
  return ctx.db.delete(id as Id<TableNames>);
}

function zetOrgId(
  ctx: MutationCtx,
  id: string,
  orgId: Id<"organisaties">,
): Promise<void> {
  return ctx.db.patch(id as Id<TableNames>, { orgId } as never);
}

/**
 * Verwijder een rij mét zijn kinderen — kinderen eerst, want een ouder die al
 * weg is, is niet meer vindbaar. Retourneert het aantal verwijderde documenten.
 */
export async function verwijderMetKinderen(
  ctx: MutationCtx,
  tabelNaam: string,
  rij: LosDoc,
): Promise<number> {
  let gewist = 0;
  for (const kind of KINDEREN_VAN[tabelNaam] ?? []) {
    const kinderen = await tabel(ctx, kind.tabel)
      .withIndex(kind.index, (q) => q.eq(kind.veld, rij._id))
      .collect();
    for (const kindRij of kinderen) {
      await verwijder(ctx, kindRij._id);
      gewist++;
    }
  }
  await verwijder(ctx, rij._id);
  return gewist + 1;
}

// ─── (a) voorTelling ─────────────────────────────────────────────────────────

/**
 * De drie getallen die na afloop gelijk moeten zijn gebleven.
 *
 * Niet meer dan dit: klanten, leveranciers en leads zijn de data waarvan verlies
 * onherstelbaar is. De rest is configuratie (opnieuw in te voeren) of
 * transactiedata (gaat met opzet weg).
 */
export const voorTelling = internalQuery({
  args: {},
  handler: async (ctx) => ({
    deployment: bepaalDeployment(),
    klanten: (await tabel(ctx, "klanten").collect()).length,
    leveranciers: (await tabel(ctx, "leveranciers").collect()).length,
    leads: (await tabel(ctx, "configuratorAanvragen").collect()).length,
  }),
});

// ─── (b) eigenaar zoeken ─────────────────────────────────────────────────────

function normaliseerEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * De user-rij van de eigenaar. Hard falen bij nul of meerdere treffers: met de
 * verkeerde eigenaar wist deze migratie precies de data die bewaard moest
 * blijven.
 *
 * Eerst de index op het genormaliseerde adres; levert dat niets op, dan een
 * scan die zelf normaliseert (de users-tabel bewaart het adres zoals Clerk het
 * aanlevert — een hoofdletter erin mag geen migratie blokkeren). De tabel is
 * klein genoeg om te scannen; dit gebeurt één keer per run.
 */
export async function vindEigenaar(
  ctx: QueryCtx | MutationCtx,
  eigenaarEmail: string,
): Promise<LosDoc> {
  const genormaliseerd = normaliseerEmail(eigenaarEmail);

  let treffers = await tabel(ctx, "users")
    .withIndex("by_email", (q) => q.eq("email", genormaliseerd))
    .collect();

  if (treffers.length === 0) {
    treffers = (await tabel(ctx, "users").collect()).filter(
      (user) => normaliseerEmail(String(user.email ?? "")) === genormaliseerd,
    );
  }

  if (treffers.length === 0) {
    throw new ConvexError(
      `Weigering: geen gebruiker gevonden met e-mail "${genormaliseerd}". ` +
        "Zonder eigenaar weet de migratie niet welke data bewaard moet blijven.",
    );
  }
  if (treffers.length > 1) {
    throw new ConvexError(
      `Weigering: ${treffers.length} gebruikers met e-mail "${genormaliseerd}" ` +
        "(ids: " +
        treffers.map((t) => t._id).join(", ") +
        "). Ruim de dubbele user-rij eerst op; anders raakt de migratie de " +
        "data van de verkeerde eigenaar.",
    );
  }
  return treffers[0];
}

// ─── (c) ontdubbeling ────────────────────────────────────────────────────────

export interface OntdubbelResultaat {
  /** Per tabel het aantal verwijderde geseede rijen; alleen wat niet nul is. */
  verwijderd: Record<string, number>;
  totaal: number;
}

/**
 * Haal de rijen weg die bij het aanmaken van de organisatie zijn geseed.
 *
 * Zie keuze 1 in de kop: geseed = draagt dit orgId én is aangemaakt op of ná
 * `organisaties.aangemaaktOp`. Eigen data van vóór de organisatie blijft staan,
 * ook als een eerdere (afgebroken) run er al een orgId op had gezet.
 */
export async function ontdubbelGeseedeRijen(
  ctx: MutationCtx,
  orgId: Id<"organisaties">,
  aangemaaktOp: number,
): Promise<OntdubbelResultaat> {
  const verwijderd: Record<string, number> = {};
  let totaal = 0;

  for (const naam of EIGENAAR_TABELLEN) {
    const rijen = await tabel(ctx, naam)
      .withIndex(ORG_INDEX[naam] ?? "by_org", (q) => q.eq("orgId", orgId))
      .collect();
    let aantal = 0;
    for (const rij of rijen) {
      if (rij._creationTime < aangemaaktOp) continue;
      aantal += await verwijderMetKinderen(ctx, naam, rij);
    }
    if (aantal > 0) {
      verwijderd[naam] = aantal;
      totaal += aantal;
    }
  }

  return { verwijderd, totaal };
}

// ─── (d) migreer ─────────────────────────────────────────────────────────────

export const migreer = internalMutation({
  args: {
    /** Exact de deployment waarop dit draait — dev óf prod. */
    bevestigDeployment: v.string(),
    /** Clerk-organisatie uit scripts/clerk-org-setup.mjs (`org_…`). */
    clerkOrgId: v.string(),
    /** E-mail van de gebruiker wiens data de organisatie wordt. */
    eigenaarEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const deployment = bewaakDeployment(args.bevestigDeployment);
    const eigenaar = await vindEigenaar(ctx, args.eigenaarEmail);

    const orgId = await maakOrganisatieIntern(ctx, {
      clerkOrgId: args.clerkOrgId,
      naam: "Top Tuinen",
      slug: "top-tuinen",
      eigenaarUserId: eigenaar._id as Id<"users">,
      // Zie MaakOrganisatieArgs.seedDefaults: seeden zou een tweede
      // instellingen-rij met dit orgId opleveren.
      seedDefaults: false,
    });

    const organisatie = await ctx.db.get(orgId);
    if (!organisatie) {
      throw new ConvexError("Organisatie verdween direct na het aanmaken.");
    }
    if (organisatie.migratieVoltooidOp !== undefined) {
      return {
        deployment,
        orgId,
        alVoltooid: true,
        voltooidOp: organisatie.migratieVoltooidOp,
        gestart: false,
        melding:
          "De migratie is hier al gedraaid; er is niets gedaan. Een tweede " +
          "ronde zou de ontdubbelstap over data heen laten lopen die ná de " +
          "migratie is aangemaakt.",
      };
    }

    const ontdubbeld = await ontdubbelGeseedeRijen(
      ctx,
      orgId,
      organisatie.aangemaaktOp,
    );

    await ctx.scheduler.runAfter(
      0,
      internal.migrations.naarOrganisaties.verwerkBatch,
      {
        orgId,
        eigenaarId: eigenaar._id as Id<"users">,
        fase: 0,
        tabelIndex: 0,
      },
    );

    return {
      deployment,
      orgId,
      eigenaarId: eigenaar._id,
      alVoltooid: false,
      ontdubbeld,
      gestart: true,
    };
  },
});

// ─── (e) batchloop ───────────────────────────────────────────────────────────

type FaseActie = "eigenaarRijen" | "alleRijen" | "wissen";

export interface Fase {
  naam: string;
  actie: FaseActie;
  tabellen: TableNames[];
}

/**
 * De volgorde van de run.
 *
 * Eigenaar-rijen krijgen hun orgId in dezelfde pas waarin de rijen van andere
 * gebruikers verdwijnen: het is per rij dezelfde beslissing ("van wie is dit?")
 * en dat scheelt een tweede keer dezelfde tabel doorlopen.
 */
export const FASEN: Fase[] = [
  {
    naam: "eigenaar-rijen naar orgId, andere gebruikers wissen",
    actie: "eigenaarRijen",
    tabellen: EIGENAAR_TABELLEN,
  },
  {
    naam: "tenantloze bewaartabellen naar orgId",
    actie: "alleRijen",
    tabellen: TENANTLOZE_TABELLEN,
  },
  {
    naam: "werkdata wissen",
    actie: "wissen",
    tabellen: WIS_TABELLEN,
  },
];

/**
 * Doet één batch en plant de volgende in.
 *
 * `fase`/`tabelIndex` zijn de hele voortgangsstaat (geen statustabel, zelfde
 * keuze als opschonen). Zolang een ronde BATCH bewerkingen haalt blijft hij op
 * dezelfde tabel; komt hij er minder tegen, dan is die tabel klaar.
 */
export const verwerkBatch = internalMutation({
  args: {
    orgId: v.id("organisaties"),
    eigenaarId: v.id("users"),
    fase: v.number(),
    tabelIndex: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.fase >= FASEN.length) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.naarOrganisaties.rondAf,
        { orgId: args.orgId },
      );
      return { fase: null, tabel: null, bewerkt: 0, klaar: true };
    }

    const fase = FASEN[args.fase];
    if (args.tabelIndex >= fase.tabellen.length) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.naarOrganisaties.verwerkBatch,
        { ...args, fase: args.fase + 1, tabelIndex: 0 },
      );
      return { fase: fase.naam, tabel: null, bewerkt: 0, klaar: false };
    }

    const naam = fase.tabellen[args.tabelIndex];
    let bewerkt = 0;

    if (fase.actie === "wissen") {
      // Alles gaat weg, ook rijen zonder userId of orgId: dit is transactiedata
      // en de gaten uit de audit (rijen zonder tenant-veld) verdwijnen hiermee.
      for (const rij of await tabel(ctx, naam).take(BATCH)) {
        bewerkt += await verwijderMetKinderen(ctx, naam, rij);
        if (bewerkt >= BATCH) break;
      }
    } else {
      const rijen = await tabel(ctx, naam).collect();
      for (const rij of rijen) {
        if (bewerkt >= BATCH) break;

        if (fase.actie === "alleRijen") {
          if (rij.orgId !== undefined) continue;
          await zetOrgId(ctx, rij._id, args.orgId);
          bewerkt++;
          continue;
        }

        // fase.actie === "eigenaarRijen"
        if (rij.userId === undefined) continue; // systeemdefault: blijft staan
        if (rij.userId === args.eigenaarId) {
          if (rij.orgId !== undefined) continue;
          await zetOrgId(ctx, rij._id, args.orgId);
          bewerkt++;
          continue;
        }
        bewerkt += await verwijderMetKinderen(ctx, naam, rij);
      }
    }

    // Volle batch? Dan zit er waarschijnlijk meer in deze tabel.
    const tabelIndex = bewerkt >= BATCH ? args.tabelIndex : args.tabelIndex + 1;
    await ctx.scheduler.runAfter(
      0,
      internal.migrations.naarOrganisaties.verwerkBatch,
      { ...args, tabelIndex },
    );

    return { fase: fase.naam, tabel: naam, bewerkt, klaar: false };
  },
});

// ─── (f) voorraad-dedupe + afronding ─────────────────────────────────────────

/**
 * Voeg dubbele voorraadrijen per product samen — hoeveelheden optellen, de
 * oudste rij wint.
 *
 * Na de migratie is voorraad uniek per org+product (`by_org_product` +
 * `.unique()`, eis uit review 3.6). In de standaardstroom is `voorraad` een
 * wistabel en dus al leeg als deze stap draait; hij staat er als vangnet voor
 * het geval de classificatie ooit naar `bewaren` gaat en om de uniciteitseis
 * afdwingbaar getest te houden. `voorraadMutaties` is transactiedata en wordt
 * sowieso gewist, dus daar hoeft niets omgehangen.
 */
export async function ontdubbelVoorraad(
  ctx: MutationCtx,
  orgId: Id<"organisaties">,
): Promise<{ samengevoegd: number }> {
  const rijen = await tabel(ctx, "voorraad")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();

  const perProduct = new Map<string, LosDoc[]>();
  for (const rij of rijen) {
    const sleutel = String(rij.productId);
    const groep = perProduct.get(sleutel) ?? [];
    groep.push(rij);
    perProduct.set(sleutel, groep);
  }

  let samengevoegd = 0;
  for (const groep of perProduct.values()) {
    if (groep.length < 2) continue;
    const gesorteerd = [...groep].sort(
      (a, b) => a._creationTime - b._creationTime,
    );
    const [winnaar, ...rest] = gesorteerd;
    let totaal = Number(winnaar.hoeveelheid ?? 0);
    for (const rij of rest) {
      totaal += Number(rij.hoeveelheid ?? 0);
      await verwijder(ctx, rij._id);
      samengevoegd++;
    }
    await ctx.db.patch(winnaar._id as Id<TableNames>, {
      hoeveelheid: totaal,
      laatsteBijwerking: Date.now(),
    } as never);
  }

  return { samengevoegd };
}

/** Sluitstuk: voorraad ontdubbelen en de organisatie stempelen. */
export const rondAf = internalMutation({
  args: { orgId: v.id("organisaties") },
  handler: async (ctx, args) => {
    const { samengevoegd } = await ontdubbelVoorraad(ctx, args.orgId);
    await ctx.db.patch(args.orgId, { migratieVoltooidOp: Date.now() });
    return { samengevoegd, klaar: true };
  },
});

// ─── (g) verificatie ─────────────────────────────────────────────────────────

/**
 * Het rapport waarop je de run afrekent.
 *
 * Groen is: `totaalZonderOrgId` = 0, `instellingenPerOrg` = 1,
 * `voorraadDuplicaten` = 0, `werkdataRestant` = 0 en de tellingen gelijk aan
 * `voorTelling`. `systeemdefaults` hoort juist NIET nul te zijn als er defaults
 * in het schema zitten — die blijven bewust orgId-loos.
 */
export const verifieerMigratie = internalQuery({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const organisatie = await ctx.db
      .query("organisaties")
      .withIndex("by_clerk_org_id", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();
    if (!organisatie) {
      throw new ConvexError(
        `Geen organisatie met clerkOrgId "${args.clerkOrgId}".`,
      );
    }
    const orgId = organisatie._id;

    const naTelling = {
      klanten: (await tabel(ctx, "klanten").collect()).length,
      leveranciers: (await tabel(ctx, "leveranciers").collect()).length,
      leads: (await tabel(ctx, "configuratorAanvragen").collect()).length,
    };

    const zonderOrgId: Record<string, number> = {};
    const systeemdefaults: Record<string, number> = {};
    let totaalZonderOrgId = 0;

    for (const naam of [...EIGENAAR_TABELLEN, ...TENANTLOZE_TABELLEN]) {
      const isSysteemdefault = SYSTEEMDEFAULT_TABELLEN.includes(naam);
      let open = 0;
      let defaults = 0;
      for (const rij of await tabel(ctx, naam).collect()) {
        if (rij.orgId !== undefined) continue;
        if (isSysteemdefault && rij.userId === undefined) {
          defaults++;
          continue;
        }
        open++;
      }
      if (open > 0) {
        zonderOrgId[naam] = open;
        totaalZonderOrgId += open;
      }
      if (defaults > 0) systeemdefaults[naam] = defaults;
    }

    const instellingen = await tabel(ctx, "instellingen")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    const voorraad = await tabel(ctx, "voorraad")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const perProduct = new Map<string, number>();
    for (const rij of voorraad) {
      const sleutel = String(rij.productId);
      perProduct.set(sleutel, (perProduct.get(sleutel) ?? 0) + 1);
    }
    const voorraadDuplicaten = [...perProduct.values()].filter(
      (n) => n > 1,
    ).length;

    const werkdata: Record<string, number> = {};
    let werkdataRestant = 0;
    for (const naam of WIS_TABELLEN) {
      const aantal = (await tabel(ctx, naam).collect()).length;
      if (aantal > 0) {
        werkdata[naam] = aantal;
        werkdataRestant += aantal;
      }
    }

    return {
      deployment: bepaalDeployment(),
      orgId,
      migratieVoltooidOp: organisatie.migratieVoltooidOp ?? null,
      naTelling,
      zonderOrgId,
      totaalZonderOrgId,
      systeemdefaults,
      instellingenPerOrg: instellingen.length,
      voorraadDuplicaten,
      werkdata,
      werkdataRestant,
      klaar:
        organisatie.migratieVoltooidOp !== undefined &&
        totaalZonderOrgId === 0 &&
        instellingen.length === 1 &&
        voorraadDuplicaten === 0 &&
        werkdataRestant === 0,
    };
  },
});
