import { describe, it, expect } from "vitest";
import { effectieveMateriaalRegels, materiaalSuggesties, STANDAARD_MATERIAAL_REGELS } from "../../../convex/lib/materiaalSuggesties";
import { exportMaandVensters } from "../../lib/hub-export";
describe("source materiaal keyword rules", () => {
  it("covers all public seed rules, stable dedup, and only suggests missing equipment", () => {
    expect(STANDAARD_MATERIAAL_REGELS).toHaveLength(33);
    const uit = materiaalSuggesties("Gras maaien, heg snoeien, blad en afval afvoeren", effectieveMateriaalRegels([]), ["grasmaaier"]);
    expect(uit.map(s => s.naam)).toEqual(expect.arrayContaining(["Heggenschaar", "Snoeischaar", "Bladblazer", "Aanhanger"]));
    expect(uit.filter(s => s.naam === "Heggenschaar")).toHaveLength(1);
    expect(uit.some(s => s.naam === "Grasmaaier")).toBe(false);
  });
  it("org overrides deactivate one rule without removing manual requirements", () => {
    const regels = effectieveMateriaalRegels([{ trefwoord: "gras", naam: "Grasmaaier", soort: "machine", actief: false }]);
    expect(materiaalSuggesties("gras", regels)).toEqual([]);
    expect(materiaalSuggesties("gras maaien", regels).map(s => s.naam)).toEqual(["Grasmaaier"]);
  });
});
describe("bounded yearly export reads", () => {
  it("covers leap year exactly with 12 month reads and no gaps or overlap", () => {
    const maanden = exportMaandVensters("2024-01-01", "2024-12-31");
    expect(maanden).toHaveLength(12); expect(maanden[1]).toEqual({ van: "2024-02-01", tot: "2024-02-29" });
    expect(maanden.reduce((n, m) => n + (Date.parse(m.tot) - Date.parse(m.van)) / 86400000 + 1, 0)).toBe(366);
    expect(exportMaandVensters("2026-01-15", "2026-02-12")).toEqual([{ van: "2026-01-15", tot: "2026-01-31" }, { van: "2026-02-01", tot: "2026-02-12" }]);
  });
});
