/**
 * De classificatiemap in convex/lib/orgTabellen.ts stuurt straks zowel de
 * opruimfunctie als de productie-migratie aan. Een tabel die daar ontbreekt of
 * een kindtabel die via een niet-bestaande index wordt opgeruimd, kost data.
 *
 * TypeScript dekt de helft af (`satisfies Record<TableNames, …>`), maar niet
 * alles: KIND_VAN gebruikt losse strings voor veld- en indexnamen, en die kent
 * de compiler niet. Daarom controleert deze test het schema-object zelf.
 * `defineSchema` levert bij runtime `{ tables: { <naam>: { indexes, validator } } }`
 * op; `indexes` is een array van `{ indexDescriptor, fields }`.
 */

import { describe, it, expect } from "vitest";
import schema from "../../../../convex/schema";
import type { TableNames } from "../../../../convex/_generated/dataModel";
import {
  TABEL_CLASSIFICATIE,
  KIND_VAN,
} from "../../../../convex/lib/orgTabellen";

interface SchemaIndex {
  indexDescriptor: string;
  fields: string[];
}

interface SchemaTabel {
  indexes: SchemaIndex[];
  validator: { fields: Record<string, { kind: string; tableName?: string }> };
}

const tabellen = (schema as unknown as { tables: Record<string, SchemaTabel> })
  .tables;

const schemaNamen = Object.keys(tabellen).sort();
const mapNamen = Object.keys(TABEL_CLASSIFICATIE).sort();

describe("TABEL_CLASSIFICATIE dekt het schema", () => {
  it("classificeert precies de tabellen die in het schema staan", () => {
    expect(mapNamen).toEqual(schemaNamen);
  });

  it("bevat de organisaties-tabel met een index op clerkOrgId", () => {
    const organisaties = tabellen.organisaties;
    expect(organisaties).toBeDefined();
    expect(
      organisaties.indexes.find((i) => i.indexDescriptor === "by_clerk_org_id")
        ?.fields,
    ).toEqual(["clerkOrgId"]);
  });
});

/**
 * Elke org-gescopeerde tabel moet zelf op `orgId` te bevragen zijn — anders kan
 * de migratie hem niet vullen en de opruimfunctie hem niet per organisatie
 * doorlopen (een full table scan is geen alternatief: die raakt andere tenants).
 *
 * Buiten scope, met opzet:
 *  - de KIND_VAN-tabellen: die hebben geen eigen orgId, hun scope loopt via de
 *    ouder (hierboven getest);
 *  - `notification_log`: staat nog volledig op clerkId-strings (recipientClerkId/
 *    senderClerkId), heeft geen tenant-veld en wordt full-table gewist;
 *  - `demoSeed`: dev-registry van {tabel, documentId, geseedOp} zonder
 *    tenant-veld; wordt eveneens full-table gewist.
 */
const ZONDER_ORG_ID = [
  "notification_log",
  "demoSeed",
] satisfies TableNames[];

// Tenant-velden waarop gescoopt wordt. De chat-tabellen voeren de bedrijfs-user
// onder een eigen naam (team_messages.companyId, chat_threads.companyUserId);
// hun by_org-indexen zijn de tweelingen van díe velden, niet van userId.
const TENANT_VELDEN = ["userId", "companyId", "companyUserId"];

describe("org-gescopeerde tabellen hebben orgId + een org-index", () => {
  const orgTabellen = (
    Object.entries(TABEL_CLASSIFICATIE) as [string, string][]
  )
    .filter(([, klasse]) => klasse === "bewaren" || klasse === "wissen")
    .map(([naam]) => naam)
    .filter((naam) => !(naam in KIND_VAN))
    // `satisfies TableNames[]` houdt de lijst compile-time eerlijk; de cast is
    // alleen nodig omdat .includes() dan een tabelnaam-literal wil, geen string.
    .filter((naam) => !(ZONDER_ORG_ID as readonly string[]).includes(naam));

  it("dekt de tabellen die orgId moeten hebben", () => {
    expect(orgTabellen.length).toBeGreaterThan(0);
    // Wie hier een tabel toevoegt zonder orgId, ziet dat meteen in de tests
    // hieronder — deze telling houdt alleen de scope zelf zichtbaar.
    expect(orgTabellen).not.toContain("notification_log");
    expect(orgTabellen).not.toContain("demoSeed");
  });

  it.each(orgTabellen)("%s heeft een orgId-veld naar organisaties", (naam) => {
    const tabel = tabellen[naam];
    expect(tabel, `tabel ${naam} bestaat niet in het schema`).toBeDefined();
    const veld = tabel.validator.fields.orgId;
    expect(veld, `veld orgId ontbreekt op ${naam}`).toBeDefined();
    expect(veld.tableName).toBe("organisaties");
  });

  it.each(orgTabellen)("%s heeft een index die op orgId begint", (naam) => {
    const orgIndexen = tabellen[naam].indexes.filter(
      (i) => i.fields[0] === "orgId",
    );
    expect(
      orgIndexen.length,
      `geen enkele index op ${naam} begint met orgId`,
    ).toBeGreaterThan(0);
  });

  // De by_org-indexen zijn de tweelingen van de tenant-indexen: bij het
  // omzetten (fase 6) moet elke bestaande tenant-query een orgId-equivalent
  // met dezelfde restvelden hebben, anders verdwijnt er stilzwijgend een pad.
  it.each(orgTabellen)("%s spiegelt elke tenant-index op orgId", (naam) => {
    const indexen = tabellen[naam].indexes;
    const ontbreekt = indexen
      .filter((i) => TENANT_VELDEN.includes(i.fields[0]))
      .filter(
        (i) =>
          !indexen.some(
            (org) =>
              org.fields[0] === "orgId" &&
              org.fields.slice(1).join("|") === i.fields.slice(1).join("|"),
          ),
      )
      .map((i) => i.indexDescriptor);
    expect(ontbreekt, `zonder org-tweeling op ${naam}`).toEqual([]);
  });
});

describe("KIND_VAN verwijst naar bestaande ouders en indexen", () => {
  const entries = Object.entries(KIND_VAN) as [
    string,
    { ouder: string; veld: string; index: string },
  ][];

  it("heeft entries om te controleren", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)("%s", (kind, { ouder, veld, index }) => {
    const kindTabel = tabellen[kind];
    expect(kindTabel, `kindtabel ${kind} bestaat niet in het schema`).toBeDefined();
    expect(tabellen[ouder], `oudertabel ${ouder} bestaat niet`).toBeDefined();

    // De index moet op de kindtabel bestaan en het verwijsveld moet het eerste
    // indexveld zijn — alleen dan kan `q.eq(veld, ouderId)` de rijen vinden.
    const gevonden = kindTabel.indexes.find(
      (i) => i.indexDescriptor === index,
    );
    expect(gevonden, `index ${index} ontbreekt op ${kind}`).toBeDefined();
    expect(gevonden!.fields[0]).toBe(veld);

    // En het veld moet ook echt naar de opgegeven ouder wijzen.
    const veldValidator = kindTabel.validator.fields[veld];
    expect(veldValidator, `veld ${veld} ontbreekt op ${kind}`).toBeDefined();
    expect(veldValidator.kind).toBe("id");
    expect(veldValidator.tableName).toBe(ouder);
  });

  // Een kind erft zijn lot van de ouder: verhuist `projecten` ooit naar
  // "bewaren" terwijl `planningTaken` op "wissen" blijft staan, dan wordt dat
  // kind stilzwijgend nooit meer opgeruimd — het loopt immers via de ouder.
  it.each(entries)(
    "%s heeft dezelfde classificatie als zijn ouder",
    (kind, { ouder }) => {
      const kindKlasse = TABEL_CLASSIFICATIE[kind as keyof typeof TABEL_CLASSIFICATIE];
      const ouderKlasse =
        TABEL_CLASSIFICATIE[ouder as keyof typeof TABEL_CLASSIFICATIE];
      expect(
        kindKlasse,
        `${kind} is "${kindKlasse}" maar ouder ${ouder} is "${ouderKlasse}"`,
      ).toBe(ouderKlasse);
    },
  );
});
