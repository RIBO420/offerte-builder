import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { bouwHubExport, vulHubSjabloon, vulWerkblad, type HubExportRegel, type HubExportType } from "../../lib/hub-export";
import { kiesProjectUrenBron } from "../../../convex/lib/projectUrenBron";
const basis = { medewerkerId: "m1", medewerkerNaam: "Sven", datum: "2026-09-01", klantId: "a", klantNaam: "A", categorie: "werken", beginTijd: "08:00", eindTijd: "10:00", werksoort: "Onderhoud" };
const regels: HubExportRegel[] = [basis, { ...basis, klantId: "b", klantNaam: "B", beginTijd: "10:00", eindTijd: "16:00" }, { ...basis, categorie: "pauze", klantId: null, klantNaam: null, beginTijd: "16:00", eindTijd: "16:30" }];
const opties = { van: "2026-09-01", tot: "2026-09-30" };

describe("Hub Excel parity", () => {
  it("payroll sums person-day span minus breaks, travel included, customer filter prohibited", () => {
    const data = [basis, { ...basis, categorie: "reistijd", beginTijd: "11:00", eindTijd: "12:00" }, regels[2]];
    const c = bouwHubExport("salaris", data, opties)["xl/worksheets/sheet2.xml"];
    expect(c.B6).toEqual({ num: 8 }); expect(c.C6).toEqual({ num: 1 }); expect(c.H6).toEqual({ num: .5 });
    expect(() => bouwHubExport("salaris", regels, { ...opties, klantId: "a" })).toThrow("niet op klant");
  });
  it("F41/F44 exports any employee subset without shortening their days or including excluded people", () => {
    const data = ["m1", "m2", "m3"].flatMap((id, i) => regels.map(r => ({ ...r, medewerkerId: id, medewerkerNaam: `Werker ${i + 1}` })));
    const selected = { ...opties, medewerkerIds: ["m1", "m3"] };
    const salary = bouwHubExport("salaris", data, selected)["xl/worksheets/sheet2.xml"];
    expect(salary.A6).toEqual({ text: "Werker 1" }); expect(salary.A7).toEqual({ text: "Werker 3" });
    expect(salary.B6).toEqual({ num: 8 }); expect(salary.B7).toEqual({ num: 8 }); expect(salary.A8).toBeUndefined();
    const annual = bouwHubExport("jaarrapportage", data, selected);
    expect(annual["xl/worksheets/sheet5.xml"]).toEqual({ A7: { text: "Werker 1" }, A8: { text: "Werker 3" } });
    expect(Object.values(annual["xl/worksheets/sheet2.xml"])).not.toContainEqual({ text: "Werker 2" });
    expect(() => bouwHubExport("salaris", data, { ...selected, klantIds: ["a", "b"] })).toThrow("niet op klant");
    expect(() => bouwHubExport("salaris", data, { ...selected, klantIds: [] })).toThrow("niet op klant");
  });
  it("F42 allocates before multi-customer filtering and never redistributes excluded worker/customer pauses", () => {
    const data = [
      basis,
      { ...basis, klantId: "b", klantNaam: "B", beginTijd: "10:00", eindTijd: "12:00" },
      { ...basis, klantId: "c", klantNaam: "C", beginTijd: "12:00", eindTijd: "14:00" },
      { ...regels[2], beginTijd: "14:00", eindTijd: "14:30" },
      { ...regels[2], klantId: "b", klantNaam: "B", beginTijd: "14:30", eindTijd: "14:40" },
      { ...basis, medewerkerId: "m2", medewerkerNaam: "Niet gekozen", eindTijd: "09:00" },
      { ...regels[2], medewerkerId: "m2", medewerkerNaam: "Niet gekozen", beginTijd: "09:00", eindTijd: "10:00" },
    ];
    const afvoer = ["a", "b", "c"].map(klantId => ({ id: klantId, revision: 1, datum: basis.datum, klantId, keuze: "half", bedragCent: klantId === "b" ? null : 1000 }));
    const cells = bouwHubExport("facturatie", data, { ...opties, medewerkerIds: ["m1"], klantIds: ["a", "c"], facturatieInhoud: "werkpauze", afvoer });
    const work = cells["xl/worksheets/sheet4.xml"];
    expect(work.C3).toEqual({ text: "A" }); expect(work.C4).toEqual({ text: "C" }); expect(work.C5).toBeUndefined();
    expect(work.H3).toEqual({ num: 2.10 }); expect(work.H4).toEqual({ num: 2.10 });
    expect(work.O3).toEqual({ num: 10 }); expect(work.O4).toEqual({ num: 10 });
    expect(Object.values(cells["xl/worksheets/sheet2.xml"])).not.toContainEqual({ text: "Niet gekozen" });
    expect(cells["xl/worksheets/sheet5.xml"]).toEqual({ A7: { text: "A" }, A8: { text: "C" } });
    const annual = bouwHubExport("jaarrapportage", data, { ...opties, medewerkerIds: ["m1"], klantIds: ["a", "c"] });
    expect(annual["xl/worksheets/sheet4.xml"]).toEqual({ A7: { text: "A" }, A8: { text: "C" } });
  });
  it("never interprets empty or unknown explicit selections as everyone", () => {
    expect(() => bouwHubExport("facturatie", regels, { ...opties, medewerkerIds: [] })).toThrow("ten minste");
    expect(() => bouwHubExport("facturatie", regels, { ...opties, klantIds: [] })).toThrow("ten minste");
    expect(() => bouwHubExport("salaris", regels, { ...opties, medewerkerIds: ["unknown"] })).toThrow("Geen uren");
    expect(() => bouwHubExport("facturatie", regels, { ...opties, klantId: "a", klantIds: ["b"] })).toThrow("één klantselectie");
  });
  it.each(["salaris", "facturatie", "jaarrapportage"] as const)("F41/F42/F44 selected %s workbook retains all original formulas", async type => {
    const data = ["m1", "m2", "m3"].flatMap((id, i) => regels.map(r => ({ ...r, medewerkerId: id, medewerkerNaam: `Werker ${i + 1}` })));
    const cells = bouwHubExport(type, data, { ...opties, medewerkerIds: ["m1", "m3"], ...(type === "salaris" ? {} : { klantIds: ["a"] }) });
    const bytes = readFileSync(`public/templates/hub/${type}.xlsx`);
    const original = await JSZip.loadAsync(bytes);
    const output = await JSZip.loadAsync(await vulHubSjabloon(bytes, type, cells));
    for (const [pad, file] of Object.entries(original.files)) {
      if (file.dir) continue;
      const before = await file.async("string"), after = await output.file(pad)!.async("string");
      if (!cells[pad]) expect(after).toEqual(before);
      else expect(after.match(/<f(?:\s[^>]*)?>[\s\S]*?<\/f>/g)).toEqual(before.match(/<f(?:\s[^>]*)?>[\s\S]*?<\/f>/g));
    }
    const registrations = await output.file("xl/worksheets/sheet2.xml")!.async("string");
    expect(registrations).toContain("Werker 1"); expect(registrations).toContain("Werker 3"); expect(registrations).not.toContain("Werker 2");
  });
  it("allocates break BEFORE customer filter and expresses override as hours.minutes", () => {
    const c = bouwHubExport("facturatie", regels, { ...opties, klantId: "a", pauzeDoorbelasten: true });
    expect(c["xl/worksheets/sheet4.xml"].H3).toEqual({ num: 2.07 });
    expect(c["xl/worksheets/sheet4.xml"].O3).toBeUndefined();
    expect(c["xl/worksheets/sheet2.xml"].E5).toEqual({ text: "Werken" });
  });
  it("F43 exports all, work-only or work-and-break with allocation before both filters", () => {
    const data = [...regels, { ...basis, categorie: "reistijd", klantId: null, klantNaam: null, beginTijd: "07:00", eindTijd: "08:00" }, { ...basis, categorie: "pauze", klantId: "b", klantNaam: "B", beginTijd: "16:30", eindTijd: "16:40" }];
    const all = bouwHubExport("facturatie", data, { ...opties, facturatieInhoud: "alles" });
    expect(Object.values(all["xl/worksheets/sheet2.xml"])).toContainEqual({ text: "Reistijd" });
    const work = bouwHubExport("facturatie", data, { ...opties, facturatieInhoud: "werk" });
    expect(Object.values(work["xl/worksheets/sheet2.xml"])).not.toContainEqual({ text: "Pauze" });
    expect(Object.values(work["xl/worksheets/sheet2.xml"])).not.toContainEqual({ text: "Reistijd" });
    expect(work["xl/worksheets/sheet4.xml"].H3).toBeUndefined();
    const afvoer = [{ id: "a1", revision: 1, datum: basis.datum, klantId: "a", keuze: "kwart", bedragCent: 1000 }, { id: "b1", revision: 1, datum: basis.datum, klantId: "b", keuze: "vol", bedragCent: null }];
    const withBreak = bouwHubExport("facturatie", data, { ...opties, facturatieInhoud: "werkpauze", klantId: "a", afvoer });
    expect(Object.values(withBreak["xl/worksheets/sheet2.xml"])).toContainEqual({ text: "Pauze" });
    expect(Object.values(withBreak["xl/worksheets/sheet2.xml"])).not.toContainEqual({ text: "Reistijd" });
    expect(withBreak["xl/worksheets/sheet4.xml"].H3).toEqual({ num: 2.07 });
    expect(withBreak["xl/worksheets/sheet4.xml"].O3).toEqual({ num: 10 });
    expect(bouwHubExport("salaris", data, { ...opties, facturatieInhoud: "werk" })).toEqual(bouwHubExport("salaris", data, opties));
  });
  it.each(["alles", "werk", "werkpauze"] as const)("F43 actual %s invoice template keeps every formula", async inhoud => {
    const bytes = readFileSync("public/templates/hub/facturatie.xlsx");
    const original = await JSZip.loadAsync(bytes);
    const cells = bouwHubExport("facturatie", regels, { ...opties, facturatieInhoud: inhoud });
    const output = await JSZip.loadAsync(await vulHubSjabloon(bytes, "facturatie", cells));
    for (const [pad, file] of Object.entries(original.files)) {
      if (file.dir) continue;
      const before = await file.async("string"), after = await output.file(pad)!.async("string");
      if (!cells[pad]) expect(after).toEqual(before);
      else expect(after.match(/<f(?:\s[^>]*)?>[\s\S]*?<\/f>/g)).toEqual(before.match(/<f(?:\s[^>]*)?>[\s\S]*?<\/f>/g));
    }
  });
  it("leaves formula-derived hours untouched by default and exports completion", () => {
    const c = bouwHubExport("facturatie", regels, { ...opties, bezoeken: [{ datum: basis.datum, klantId: "a", afgerond: false }] });
    expect(c["xl/worksheets/sheet4.xml"].H3).toBeUndefined(); expect(c["xl/worksheets/sheet4.xml"].G3).toEqual({ text: "Nee" });
    expect(c["xl/worksheets/sheet2.xml"].E7).toEqual({ text: "Pauze" });
  });
  it("charges a shared disposal record once, preserves its revision and blocks undecided prices", () => {
    const afvoer = { id: "afvoer-1", revision: 3, datum: basis.datum, klantId: "a", keuze: "half", bedragCent: 2625 };
    const c = bouwHubExport("facturatie", [basis, { ...basis, medewerkerId: "m2", medewerkerNaam: "Piet" }], { ...opties, afvoer: [afvoer, afvoer] });
    expect(c["xl/worksheets/sheet4.xml"].O3).toEqual({ num: 26.25 });
    expect(c["xl/worksheets/sheet4.xml"].S3).toEqual({ text: "Stortkosten € 26,25 (afvoer-1 v3)" });
    expect(() => bouwHubExport("facturatie", [basis], { ...opties, afvoer: [{ ...afvoer, bedragCent: null }] })).toThrow("nog geen vastgesteld bedrag");
  });
  it("retains exact fractional annual hours and blocks ambiguous identity names", () => {
    const c = bouwHubExport("jaarrapportage", [{ ...basis, eindTijd: "08:20" }], opties);
    expect(c["xl/worksheets/sheet2.xml"].H2).toEqual({ num: 1 / 3 });
    expect(() => bouwHubExport("facturatie", [basis, { ...basis, klantId: "duplicate" }], opties)).toThrow("unieke namen");
  });
  it("fails loudly on capacity and formula replacement", () => {
    expect(() => bouwHubExport("salaris", Array.from({ length: 26 }, (_, i) => ({ ...basis, medewerkerId: String(i) })), opties)).toThrow("25");
    expect(() => vulWerkblad('<sheetData><row r="1"><c r="A1"><f>SUM(B1)</f><v>0</v></c></row></sheetData>', { A1: { num: 4 } })).toThrow("formule");
    expect(() => vulWerkblad("<sheetData></sheetData>", { A1: { num: 4 } })).toThrow("ontbreekt");
  });
  it.each(["salaris", "facturatie", "jaarrapportage"] as HubExportType[])("fills actual %s template preserving every formula and unedited entry", async type => {
    const bytes = readFileSync(`public/templates/hub/${type}.xlsx`);
    const original = await JSZip.loadAsync(bytes);
    const cellen = bouwHubExport(type, regels, opties);
    const output = await JSZip.loadAsync(await vulHubSjabloon(bytes, type, cellen));
    for (const [pad, file] of Object.entries(original.files)) {
      if (file.dir) continue;
      const before = await file.async("string"), after = await output.file(pad)!.async("string");
      if (!cellen[pad]) expect(after).toEqual(before);
      else expect(after.match(/<f(?:\s[^>]*)?>[\s\S]*?<\/f>/g)).toEqual(before.match(/<f(?:\s[^>]*)?>[\s\S]*?<\/f>/g));
    }
    expect(await output.file("xl/worksheets/sheet2.xml")!.async("string")).toContain("Sven");
  });
  it("grows a realistic annual dataset with original date/time formats", async () => {
    const bytes = readFileSync("public/templates/hub/jaarrapportage.xlsx");
    const rows = Array.from({ length: 1000 }, () => ({ ...basis, eindTijd: "08:20" }));
    const output = await JSZip.loadAsync(await vulHubSjabloon(bytes, "jaarrapportage", bouwHubExport("jaarrapportage", rows, opties)));
    const xml = await output.file("xl/worksheets/sheet2.xml")!.async("string");
    expect(xml).toContain('r="A1001" s="35"'); expect(xml).toContain('r="F1001" s="36"'); expect(xml).toContain('r="H1001" s="37"');
    expect(xml.match(/<row r="1001"/g)).toHaveLength(1);
  });
  it("grows annual sparse rows and encodes formula-like text literally", () => {
    const xml = vulWerkblad('<sheetData><row r="2"><c r="A2" s="3"/></row></sheetData>', { B2: { text: '=HYPERLINK("x")' }, A100: { num: 1 } }, true);
    expect(xml).toContain('t="inlineStr"'); expect(xml).toContain('&quot;x&quot;'); expect(xml).toContain('<row r="100">');
  });
});

describe("project labour ledger selection", () => {
  it("selects a single source automatically but never adds two sources", () => {
    expect(kiesProjectUrenBron(undefined, 1, 0)).toEqual({ status: "ok", bron: "legacy" });
    expect(kiesProjectUrenBron(undefined, 0, 1)).toEqual({ status: "ok", bron: "segmenten" });
    expect(kiesProjectUrenBron(undefined, 1, 1)).toEqual({ status: "conflict", bron: null });
    expect(kiesProjectUrenBron("segmenten", 1, 1)).toEqual({ status: "ok", bron: "segmenten" });
    expect(kiesProjectUrenBron("legacy", 1, 1)).toEqual({ status: "ok", bron: "legacy" });
  });
});
