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
