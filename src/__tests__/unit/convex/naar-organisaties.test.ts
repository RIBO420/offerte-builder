// @vitest-environment node
/**
 * Tests voor `convex/migrations/naarOrganisaties.ts` — de eenmalige datamigratie
 * naar het org-model (fase 6/8 van het Clerk-Organizations-plan).
 *
 * Deze functie draait één keer, op productie, op data die nergens anders meer
 * bestaat. Twee soorten fouten zijn onherstelbaar:
 *   1. te veel wissen — een eigenaar-rij aanzien voor die van een andere
 *      gebruiker, of een systeemdefault meepakken;
 *   2. half migreren — een bewaartabel zonder orgId achterlaten, waarna elke
 *      org-gescopeerde query hem niet meer ziet (data "weg" zonder delete).
 *
 * Daarom drie lagen: schema-poorten (de tabelindeling klopt met
 * convex/schema.ts), een volledige run tegen de index-bewuste mock
 * (helpers/convex-mock.ts) en de weigeringen.
 *
 * De scheduler-loop draaien we zelf uit: `ctx.scheduler.runAfter` legt de
 * geplande aanroep in een wachtrij, `draaiLoop` werkt die af tot hij leeg is.
 * Dat is dezelfde volgorde als Convex zou uitvoeren, met een harde bovengrens
 * zodat een niet-vorderende loop omvalt in plaats van te hangen.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getFunctionName } from "convex/server";
import {
  BATCH,
  EIGENAAR_TABELLEN,
  TENANTLOZE_TABELLEN,
  KIND_ZONDER_ORGID,
  SYSTEEMDEFAULT_TABELLEN,
  WIS_TABELLEN,
  ORG_INDEX,
  FASEN,
  bepaalDeployment,
  bewaakDeployment,
  ontdubbelVoorraad,
  verwijderMetKinderen,
  vindEigenaar,
  voorTelling,
  migreer,
  verwerkBatch,
  rondAf,
  verifieerMigratie,
  DEV_DEPLOYMENT,
  PROD_DEPLOYMENT,
} from "../../../../convex/migrations/naarOrganisaties";
import { TABEL_CLASSIFICATIE } from "../../../../convex/lib/orgTabellen";
import schema from "../../../../convex/schema";
import {
  MockConvexStore,
  createMockCtx,
  seedMockOrganisatie,
  TEST_CLERK_ORG_ID,
  type MockCtx,
} from "../../helpers/convex-mock";
import type { MutationCtx } from "../../../../convex/_generated/server";
import type { Id } from "../../../../convex/_generated/dataModel";

// ─── Handler-toegang ─────────────────────────────────────────────────────────

type AnyHandler = (ctx: unknown, args: unknown) => Promise<unknown>;
const handler = (fn: unknown) => (fn as { _handler: AnyHandler })._handler;

// ─── Schemahulp ──────────────────────────────────────────────────────────────

interface Veld {
  fieldType: { type: string };
  optional: boolean;
}

function veldenVan(tabelNaam: string): Record<string, Veld> {
  const tabellen = (
    schema as unknown as {
      tables: Record<string, { export: () => { documentType: unknown } }>;
    }
  ).tables;
  const documentType = JSON.parse(
    JSON.stringify(tabellen[tabelNaam].export().documentType),
  ) as { value?: Record<string, Veld> };
  return documentType.value ?? {};
}

function indexenVan(tabelNaam: string): Record<string, string[]> {
  const tabellen = (
    schema as unknown as {
      tables: Record<
        string,
        {
          export: () => {
            indexes?: Array<{ indexDescriptor: string; fields: string[] }>;
          };
        }
      >;
    }
  ).tables;
  const uit: Record<string, string[]> = {};
  for (const index of tabellen[tabelNaam].export().indexes ?? []) {
    uit[index.indexDescriptor] = index.fields;
  }
  return uit;
}

const BEWAARTABELLEN = Object.entries(TABEL_CLASSIFICATIE)
  .filter(([, klasse]) => klasse === "bewaren")
  .map(([naam]) => naam);

// ─── Tijdlijn van de fixtures ────────────────────────────────────────────────
//
// De ontdubbeling onderscheidt geseede rijen van eigen data op aanmaakmoment.
// Met echte klokwaarden valt dat binnen één milliseconde niet te testen, dus
// zetten de fixtures `_creationTime` expliciet.

const T_EIGEN = 1_000_000; // eigen data: van vóór de organisatie
const T_ORG = 2_000_000; // moment waarop de organisatie is aangemaakt
const T_SEED = 2_000_100; // door seedOrgDefaults geseede rijen

const EIGENAAR_EMAIL = "ricardobos43@gmail.com";

let store: MockConvexStore;
let ctx: MockCtx;
let wachtrij: Array<{ naam: string; args: Record<string, unknown> }>;
let orgId: string;
let eigenaarId: string;
let andereId: string;
let oudeCloudUrl: string | undefined;

function maakCtx(): MockCtx {
  const nieuw = createMockCtx(store);
  nieuw.scheduler.runAfter.mockImplementation(
    (_vertraging: number, fn: unknown, args: Record<string, unknown>) => {
      wachtrij.push({ naam: getFunctionName(fn as never), args });
      return Promise.resolve();
    },
  );
  return nieuw;
}

/** Werkt de geplande aanroepen af tot de wachtrij leeg is. */
async function draaiLoop(maxRondes = 500): Promise<number> {
  let rondes = 0;
  while (wachtrij.length > 0) {
    if (++rondes > maxRondes) {
      throw new Error(
        `Loop vordert niet: meer dan ${maxRondes} rondes (laatste: ${wachtrij[0].naam})`,
      );
    }
    const taak = wachtrij.shift()!;
    if (taak.naam.endsWith(":verwerkBatch")) {
      await handler(verwerkBatch)(ctx, taak.args);
    } else if (taak.naam.endsWith(":rondAf")) {
      await handler(rondAf)(ctx, taak.args);
    } else {
      throw new Error(`Onverwachte geplande functie: ${taak.naam}`);
    }
  }
  return rondes;
}

function rijen(tabel: string) {
  return store.getAll(tabel);
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

/**
 * De stand van dev/prod vlak vóór de migratie: één eigenaar met alle echte
 * data, één collega met wat stray rijen, systeemdefaults, leads zonder
 * eigenaar, een berg werkdata — en (dev, schouw 18 aug) een organisatie die al
 * bestaat mét geseede instellingen/normuren/producten.
 */
function seedVoorMigratie(): void {
  eigenaarId = store.insert("users", {
    clerkId: "clerk_eigenaar",
    email: EIGENAAR_EMAIL,
    name: "Ricardo",
    role: "directie",
    createdAt: T_EIGEN,
  });
  andereId = store.insert("users", {
    clerkId: "clerk_collega",
    email: "collega@toptuinen.nl",
    name: "Collega",
    role: "medewerker",
    createdAt: T_EIGEN,
  });

  orgId = seedMockOrganisatie(store, {
    aangemaaktOp: T_ORG,
    _creationTime: T_ORG,
  });

  // ── eigen data van de eigenaar (bewaartabellen met tenant-veld) ──
  store.insert("klanten", {
    userId: eigenaarId,
    naam: "Klant A",
    adres: "Tulpstraat 1",
    postcode: "1234 AB",
    plaats: "Utrecht",
    createdAt: T_EIGEN,
    updatedAt: T_EIGEN,
    _creationTime: T_EIGEN,
  });
  store.insert("klanten", {
    userId: eigenaarId,
    naam: "Klant B",
    adres: "Tulpstraat 2",
    postcode: "1234 AB",
    plaats: "Utrecht",
    createdAt: T_EIGEN,
    updatedAt: T_EIGEN,
    _creationTime: T_EIGEN,
  });
  store.insert("leveranciers", {
    userId: eigenaarId,
    naam: "De Beijer",
    _creationTime: T_EIGEN,
  });
  store.insert("instellingen", {
    userId: eigenaarId,
    uurtarief: 62.5,
    standaardMargePercentage: 22,
    btwPercentage: 21,
    bedrijfsgegevens: { naam: "Top Tuinen", adres: "", postcode: "", plaats: "" },
    offerteNummerPrefix: "TT-",
    laatsteOfferteNummer: 417,
    _creationTime: T_EIGEN,
  });
  store.insert("normuren", {
    userId: eigenaarId,
    activiteit: "Eigen norm",
    scope: "grondwerk",
    normuurPerEenheid: 0.3,
    eenheid: "m²",
    _creationTime: T_EIGEN,
  });
  store.insert("producten", {
    userId: eigenaarId,
    productnaam: "Eigen product",
    categorie: "Bestrating",
    inkoopprijs: 1,
    verkoopprijs: 2,
    eenheid: "stuk",
    isActief: true,
    createdAt: T_EIGEN,
    updatedAt: T_EIGEN,
    _creationTime: T_EIGEN,
  });
  store.insert("correctiefactoren", {
    userId: eigenaarId,
    type: "bereikbaarheid",
    waarde: "slecht",
    factor: 1.2,
    updatedAt: T_EIGEN,
    _creationTime: T_EIGEN,
  });

  // ── systeemdefault: géén userId, moet ongemoeid blijven ──
  store.insert("correctiefactoren", {
    type: "bereikbaarheid",
    waarde: "goed",
    factor: 1.0,
    updatedAt: T_EIGEN,
    _creationTime: T_EIGEN,
  });

  // ── rijen van de andere gebruiker: gaan weg ──
  store.insert("klanten", {
    userId: andereId,
    naam: "Klant van collega",
    adres: "Elders 3",
    postcode: "9999 ZZ",
    plaats: "Groningen",
    createdAt: T_EIGEN,
    updatedAt: T_EIGEN,
    _creationTime: T_EIGEN,
  });
  store.insert("medewerkers", {
    userId: andereId,
    naam: "Stray medewerker",
    _creationTime: T_EIGEN,
  });

  // ── door maakOrganisatie geseede org-rijen (dev) ──
  store.insert("instellingen", {
    userId: eigenaarId,
    orgId,
    uurtarief: 45,
    standaardMargePercentage: 15,
    btwPercentage: 21,
    bedrijfsgegevens: { naam: "", adres: "", postcode: "", plaats: "" },
    offerteNummerPrefix: "OFF-",
    laatsteOfferteNummer: 0,
    _creationTime: T_SEED,
  });
  for (const activiteit of ["Ontgraven licht", "Tegels leggen"]) {
    store.insert("normuren", {
      userId: eigenaarId,
      orgId,
      activiteit,
      scope: "grondwerk",
      normuurPerEenheid: 0.15,
      eenheid: "m²",
      _creationTime: T_SEED,
    });
  }
  for (const productnaam of ["Betontegel 30x30 grijs", "Straatzand"]) {
    store.insert("producten", {
      userId: eigenaarId,
      orgId,
      productnaam,
      categorie: "Bestrating",
      inkoopprijs: 1.5,
      verkoopprijs: 3.5,
      eenheid: "stuk",
      isActief: true,
      createdAt: T_SEED,
      updatedAt: T_SEED,
      _creationTime: T_SEED,
    });
  }

  // ── tenantloze bewaartabellen ──
  for (const referentie of ["AAN-001", "AAN-002"]) {
    const leadId = store.insert("configuratorAanvragen", {
      type: "aanleg",
      status: "nieuw",
      referentie,
      klantNaam: `Lead ${referentie}`,
      createdAt: T_EIGEN,
      updatedAt: T_EIGEN,
      _creationTime: T_EIGEN,
    });
    store.insert("leadActiviteiten", {
      leadId,
      type: "notitie",
      beschrijving: "Gebeld",
      createdAt: T_EIGEN,
      _creationTime: T_EIGEN,
    });
  }
  store.insert("bouwstenen", {
    naam: "Maaien",
    code: "MAA",
    categorie: "gras",
    soort: "beurt",
    eenheid: "m²",
    actief: true,
    createdAt: T_EIGEN,
    updatedAt: T_EIGEN,
    _creationTime: T_EIGEN,
  });
  store.insert("tekstblokken", {
    naam: "Voorwaarden",
    categorie: "offerte",
    inhoud: "…",
    actief: true,
    createdAt: T_EIGEN,
    updatedAt: T_EIGEN,
    _creationTime: T_EIGEN,
  });
  store.insert("mailTriggers", {
    event: "offerte_verzonden",
    naam: "Offerte verzonden",
    onderwerp: "Uw offerte",
    inhoud: "…",
    actief: true,
    createdAt: T_EIGEN,
    updatedAt: T_EIGEN,
    _creationTime: T_EIGEN,
  });
  store.insert("uurtarieven", {
    bedrag: 65,
    ingangsdatum: T_EIGEN,
    createdAt: T_EIGEN,
    _creationTime: T_EIGEN,
  });

  // ── werkdata: gaat volledig weg ──
  const offerteId = store.insert("offertes", {
    userId: eigenaarId,
    type: "aanleg",
    status: "concept",
    offerteNummer: "OFF-1",
    createdAt: T_EIGEN,
    updatedAt: T_EIGEN,
    _creationTime: T_EIGEN,
  });
  store.insert("offerte_messages", {
    offerteId,
    afzender: "klant",
    bericht: "Vraag",
    createdAt: T_EIGEN,
    _creationTime: T_EIGEN,
  });
  store.insert("offertes", {
    userId: andereId,
    type: "onderhoud",
    status: "concept",
    offerteNummer: "OFF-2",
    createdAt: T_EIGEN,
    updatedAt: T_EIGEN,
    _creationTime: T_EIGEN,
  });
  const projectId = store.insert("projecten", {
    userId: eigenaarId,
    naam: "Project 1",
    status: "gepland",
    createdAt: T_EIGEN,
    updatedAt: T_EIGEN,
    _creationTime: T_EIGEN,
  });
  store.insert("planningTaken", {
    projectId,
    omschrijving: "Taak",
    createdAt: T_EIGEN,
    _creationTime: T_EIGEN,
  });
  store.insert("voorraad", {
    userId: eigenaarId,
    productId: "producten:999",
    hoeveelheid: 10,
    laatsteBijwerking: T_EIGEN,
    _creationTime: T_EIGEN,
  });
  store.insert("voorraad", {
    userId: eigenaarId,
    productId: "producten:999",
    hoeveelheid: 5,
    laatsteBijwerking: T_EIGEN,
    _creationTime: T_EIGEN + 1,
  });
  // Tabellen zonder tenant-veld die tóch leeg moeten eindigen.
  store.insert("demoSeed", {
    tabel: "klanten",
    documentId: "klanten:1",
    geseedOp: T_EIGEN,
    _creationTime: T_EIGEN,
  });
  store.insert("notification_log", {
    recipientClerkId: "clerk_eigenaar",
    channelType: "push",
    status: "sent",
    createdAt: T_EIGEN,
    _creationTime: T_EIGEN,
  });
}

function migreerArgs(overrides: Record<string, unknown> = {}) {
  return {
    bevestigDeployment: DEV_DEPLOYMENT,
    clerkOrgId: TEST_CLERK_ORG_ID,
    eigenaarEmail: EIGENAAR_EMAIL,
    ...overrides,
  };
}

beforeEach(() => {
  oudeCloudUrl = process.env.CONVEX_CLOUD_URL;
  process.env.CONVEX_CLOUD_URL = `https://${DEV_DEPLOYMENT}.convex.cloud`;
  store = new MockConvexStore();
  wachtrij = [];
  ctx = maakCtx();
  seedVoorMigratie();
});

afterEach(() => {
  if (oudeCloudUrl === undefined) delete process.env.CONVEX_CLOUD_URL;
  else process.env.CONVEX_CLOUD_URL = oudeCloudUrl;
});

// ─── Poort 1: de tabelindeling klopt met het schema ──────────────────────────

describe("naarOrganisaties — tabelindeling tegen convex/schema.ts", () => {
  it("deelt élke bewaartabel in precies één categorie in", () => {
    const ingedeeld = [
      ...EIGENAAR_TABELLEN,
      ...TENANTLOZE_TABELLEN,
      ...KIND_ZONDER_ORGID,
    ];
    expect(new Set(ingedeeld).size).toBe(ingedeeld.length);
    expect([...ingedeeld].sort()).toEqual([...BEWAARTABELLEN].sort());
  });

  it("heeft op elke bewaartabel een orgId-veld en géén userId meer", () => {
    for (const naam of [...EIGENAAR_TABELLEN, ...TENANTLOZE_TABELLEN]) {
      const velden = veldenVan(naam);
      expect(velden.userId, `${naam} heeft nog een userId`).toBeUndefined();
      expect(velden.orgId, `${naam}.orgId ontbreekt`).toBeDefined();
    }
  });

  it("laat alleen tabellen zónder orgId-veld over als kind", () => {
    for (const naam of KIND_ZONDER_ORGID) {
      expect(veldenVan(naam).orgId).toBeUndefined();
    }
  });

  it("kent systeemdefaults exact waar orgId optioneel is", () => {
    // Sinds fase 6 is `orgId` de discriminator: ontbreekt hij, dan is de rij
    // systeembreed. Alleen daar mag het veld nog optioneel zijn.
    for (const naam of SYSTEEMDEFAULT_TABELLEN) {
      expect(EIGENAAR_TABELLEN).toContain(naam);
      expect(veldenVan(naam).orgId.optional, `${naam}.orgId`).toBe(true);
    }
    for (const naam of [...EIGENAAR_TABELLEN, ...TENANTLOZE_TABELLEN]) {
      if (veldenVan(naam).orgId.optional) {
        expect(SYSTEEMDEFAULT_TABELLEN).toContain(naam);
      }
    }
  });

  it("gebruikt voor de ontdubbeling een bestaande index die op orgId begint", () => {
    for (const naam of EIGENAAR_TABELLEN) {
      const index = ORG_INDEX[naam] ?? "by_org";
      const velden = indexenVan(naam)[index];
      expect(velden, `${naam}.${index} bestaat niet`).toBeDefined();
      expect(velden[0], `${naam}.${index} begint niet op orgId`).toBe("orgId");
    }
  });

  it("wist precies de tabellen die als wissen zijn geclassificeerd", () => {
    const verwacht = Object.entries(TABEL_CLASSIFICATIE)
      .filter(([, klasse]) => klasse === "wissen")
      .map(([naam]) => naam);
    expect([...WIS_TABELLEN].sort()).toEqual([...verwacht].sort());
  });

  it("raakt persoonlijke tabellen en users/organisaties niet aan", () => {
    const aangeraakt = new Set(FASEN.flatMap((fase) => fase.tabellen));
    for (const [naam, klasse] of Object.entries(TABEL_CLASSIFICATIE)) {
      if (klasse === "persoonlijk" || klasse === "systeem") {
        expect(aangeraakt.has(naam as never)).toBe(false);
      }
    }
  });
});

// ─── Poort 2: de deployment-guard ────────────────────────────────────────────

describe("naarOrganisaties — deployment-guard", () => {
  it("herkent de deployment uit CONVEX_CLOUD_URL", () => {
    expect(bepaalDeployment()).toBe(DEV_DEPLOYMENT);
  });

  it("laat dev én prod door zolang de bevestiging klopt", () => {
    expect(bewaakDeployment(DEV_DEPLOYMENT)).toBe(DEV_DEPLOYMENT);

    process.env.CONVEX_CLOUD_URL = `https://${PROD_DEPLOYMENT}.convex.cloud`;
    expect(bewaakDeployment(PROD_DEPLOYMENT)).toBe(PROD_DEPLOYMENT);
  });

  it("weigert een bevestiging die niet de huidige deployment is", () => {
    expect(() => bewaakDeployment(PROD_DEPLOYMENT)).toThrow(
      /bevestigde "impartial-dinosaur-829".*draait op "affable-rook-669"/,
    );
  });

  it("weigert een onbekende deployment", () => {
    process.env.CONVEX_CLOUD_URL = "https://vreemde-vogel-1.convex.cloud";
    expect(() => bewaakDeployment("vreemde-vogel-1")).toThrow(
      /onbekende deployment/i,
    );
  });

  it("valt dicht als de deployment niet vast te stellen is", () => {
    delete process.env.CONVEX_CLOUD_URL;
    delete process.env.CONVEX_SITE_URL;
    expect(bepaalDeployment()).toBeNull();
    expect(() => bewaakDeployment("iets-anders")).toThrow(/niet vast te stellen/i);
    expect(bewaakDeployment(PROD_DEPLOYMENT)).toBe(PROD_DEPLOYMENT);
  });

  it("start niet met de verkeerde bevestiging en laat de data ongemoeid", async () => {
    await expect(
      handler(migreer)(ctx, migreerArgs({ bevestigDeployment: PROD_DEPLOYMENT })),
    ).rejects.toThrow(/Weigering/);

    expect(wachtrij).toHaveLength(0);
    expect(rijen("klanten")).toHaveLength(3);
    expect(rijen("instellingen")).toHaveLength(2);
  });
});

// ─── Poort 3: de eigenaar ────────────────────────────────────────────────────

describe("naarOrganisaties — eigenaar zoeken", () => {
  it("vindt de eigenaar op een genormaliseerd adres", async () => {
    const eigenaar = await vindEigenaar(
      ctx as unknown as MutationCtx,
      "  Ricardobos43@Gmail.com ",
    );
    expect(eigenaar._id).toBe(eigenaarId);
  });

  it("faalt hard op een onbekend adres", async () => {
    await expect(
      vindEigenaar(ctx as unknown as MutationCtx, "niemand@toptuinen.nl"),
    ).rejects.toThrow(/geen gebruiker gevonden/i);
  });

  it("faalt hard bij twee user-rijen met hetzelfde adres", async () => {
    store.insert("users", {
      clerkId: "clerk_dubbel",
      email: EIGENAAR_EMAIL,
      name: "Ricardo (dubbel)",
      role: "directie",
      createdAt: T_EIGEN,
    });

    await expect(handler(migreer)(ctx, migreerArgs())).rejects.toThrow(
      /2 gebruikers met e-mail/i,
    );
    expect(wachtrij).toHaveLength(0);
    expect(rijen("klanten")).toHaveLength(3);
  });
});

// ─── Poort 4: de volledige run ───────────────────────────────────────────────

describe("naarOrganisaties — volledige run", () => {
  let voor: { klanten: number; leveranciers: number; leads: number };
  let resultaat: Record<string, unknown>;

  beforeEach(async () => {
    voor = (await handler(voorTelling)(ctx, {})) as typeof voor;
    resultaat = (await handler(migreer)(ctx, migreerArgs())) as Record<
      string,
      unknown
    >;
    await draaiLoop();
  });

  it("telt vooraf alles wat bewaard moet blijven", () => {
    expect(voor).toMatchObject({ klanten: 3, leveranciers: 1, leads: 2 });
  });

  it("geeft de eigenaar-rijen het orgId van de organisatie", () => {
    const klanten = rijen("klanten");
    expect(klanten).toHaveLength(2);
    expect(klanten.every((k) => k.orgId === orgId)).toBe(true);
    expect(klanten.map((k) => k.naam).sort()).toEqual(["Klant A", "Klant B"]);
    expect(rijen("leveranciers")[0].orgId).toBe(orgId);
  });

  it("verwijdert de rijen van andere gebruikers", () => {
    expect(rijen("klanten").some((k) => k.userId === andereId)).toBe(false);
    expect(rijen("medewerkers")).toHaveLength(0);
  });

  it("laat systeemdefaults staan, zonder orgId", () => {
    const factoren = rijen("correctiefactoren");
    expect(factoren).toHaveLength(2);
    const systeem = factoren.find((f) => f.userId === undefined);
    expect(systeem).toBeDefined();
    expect(systeem!.orgId).toBeUndefined();
    expect(factoren.find((f) => f.userId === eigenaarId)!.orgId).toBe(orgId);
  });

  it("ontdubbelt de geseede rijen: de eigenaar-rij wint", () => {
    const instellingen = rijen("instellingen");
    expect(instellingen).toHaveLength(1);
    expect(instellingen[0].uurtarief).toBe(62.5); // de echte bedrijfsgegevens
    expect(instellingen[0].orgId).toBe(orgId);

    const normuren = rijen("normuren");
    expect(normuren).toHaveLength(1);
    expect(normuren[0].activiteit).toBe("Eigen norm");
    expect(normuren[0].orgId).toBe(orgId);

    const producten = rijen("producten");
    expect(producten).toHaveLength(1);
    expect(producten[0].productnaam).toBe("Eigen product");
    expect(producten[0].orgId).toBe(orgId);

    expect(resultaat.ontdubbeld).toMatchObject({
      totaal: 5,
      verwijderd: { instellingen: 1, normuren: 2, producten: 2 },
    });
  });

  it("hangt alle leads aan de organisatie en laat hun activiteiten staan", () => {
    const leads = rijen("configuratorAanvragen");
    expect(leads).toHaveLength(2);
    expect(leads.every((l) => l.orgId === orgId)).toBe(true);
    expect(rijen("leadActiviteiten")).toHaveLength(2);
  });

  it("hangt de tenantloze catalogus aan de organisatie", () => {
    for (const naam of ["bouwstenen", "tekstblokken", "mailTriggers", "uurtarieven"]) {
      const gevonden = rijen(naam);
      expect(gevonden.length, naam).toBeGreaterThan(0);
      expect(gevonden.every((r) => r.orgId === orgId), naam).toBe(true);
    }
  });

  it("laat elke wistabel leeg achter, inclusief kinderen en tenantloze tabellen", () => {
    for (const naam of WIS_TABELLEN) {
      expect(rijen(naam), naam).toHaveLength(0);
    }
  });

  it("stempelt de organisatie als voltooid", () => {
    const organisatie = rijen("organisaties")[0];
    expect(organisatie.migratieVoltooidOp).toBeTypeOf("number");
  });

  it("rapporteert een groene verificatie", async () => {
    const rapport = (await handler(verifieerMigratie)(ctx, {
      clerkOrgId: TEST_CLERK_ORG_ID,
    })) as Record<string, unknown>;

    expect(rapport).toMatchObject({
      naTelling: { klanten: 2, leveranciers: 1, leads: voor.leads },
      zonderOrgId: {},
      totaalZonderOrgId: 0,
      instellingenPerOrg: 1,
      voorraadDuplicaten: 0,
      werkdata: {},
      werkdataRestant: 0,
      klaar: true,
    });
    // De systeemdefault hoort juist zónder orgId te blijven staan.
    expect(rapport.systeemdefaults).toMatchObject({ correctiefactoren: 1 });
    // Klanten: precies de ene rij van de collega minder dan de voortelling.
    expect(voor.klanten - 2).toBe(1);
  });

  it("doet bij een tweede aanroep niets meer", async () => {
    const tweede = (await handler(migreer)(ctx, migreerArgs())) as Record<
      string,
      unknown
    >;

    expect(tweede.alVoltooid).toBe(true);
    expect(tweede.gestart).toBe(false);
    expect(wachtrij).toHaveLength(0);
    expect(rijen("instellingen")).toHaveLength(1);
    expect(rijen("instellingen")[0].uurtarief).toBe(62.5);
  });
});

// ─── Poort 5: batching ───────────────────────────────────────────────────────

describe("naarOrganisaties — batching", () => {
  it("verwerkt een tabel groter dan BATCH in meerdere rondes", async () => {
    for (let i = 0; i < BATCH + 25; i++) {
      store.insert("klanten", {
        userId: eigenaarId,
        naam: `Massa ${i}`,
        adres: "Straat",
        postcode: "1234 AB",
        plaats: "Utrecht",
        createdAt: T_EIGEN,
        updatedAt: T_EIGEN,
        _creationTime: T_EIGEN,
      });
    }

    await handler(migreer)(ctx, migreerArgs());
    await draaiLoop();

    const klanten = rijen("klanten");
    expect(klanten).toHaveLength(BATCH + 27);
    expect(klanten.every((k) => k.orgId === orgId)).toBe(true);
  });
});

// ─── Poort 6: losse onderdelen ───────────────────────────────────────────────

describe("naarOrganisaties — voorraad-dedupe", () => {
  it("telt hoeveelheden op en houdt de oudste rij over", async () => {
    const eersteId = store.insert("voorraad", {
      orgId,
      productId: "producten:1",
      hoeveelheid: 4,
      laatsteBijwerking: T_EIGEN,
      _creationTime: T_EIGEN,
    });
    store.insert("voorraad", {
      orgId,
      productId: "producten:1",
      hoeveelheid: 6,
      laatsteBijwerking: T_EIGEN,
      _creationTime: T_EIGEN + 10,
    });
    store.insert("voorraad", {
      orgId,
      productId: "producten:2",
      hoeveelheid: 3,
      laatsteBijwerking: T_EIGEN,
      _creationTime: T_EIGEN,
    });

    const uitkomst = await ontdubbelVoorraad(
      ctx as unknown as MutationCtx,
      orgId as Id<"organisaties">,
    );

    expect(uitkomst.samengevoegd).toBe(1);
    const perProduct = rijen("voorraad").filter((r) => r.orgId === orgId);
    expect(perProduct).toHaveLength(2);
    const samengevoegd = perProduct.find((r) => r._id === eersteId);
    expect(samengevoegd!.hoeveelheid).toBe(10);
  });
});

describe("naarOrganisaties — verwijderMetKinderen", () => {
  it("wist de kinderen vóór de ouder", async () => {
    const leadId = rijen("configuratorAanvragen")[0]._id;
    const lead = store.get(leadId)!;

    const gewist = await verwijderMetKinderen(
      ctx as unknown as MutationCtx,
      "configuratorAanvragen",
      lead as unknown as { _id: string; _creationTime: number },
    );

    expect(gewist).toBe(2); // ouder + één activiteit
    expect(store.get(leadId)).toBeNull();
    expect(
      rijen("leadActiviteiten").some((a) => a.leadId === leadId),
    ).toBe(false);
    // De andere lead en zijn activiteit blijven staan.
    expect(rijen("configuratorAanvragen")).toHaveLength(1);
    expect(rijen("leadActiviteiten")).toHaveLength(1);
  });
});
