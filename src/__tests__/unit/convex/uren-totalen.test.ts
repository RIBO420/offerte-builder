import { describe, expect, it } from "vitest";
import { berekenUrenTotalen, verdeelPauzeOverKlanten, valideerUrenPeriode, type UrenRegel } from "../../../../convex/lib/urenTotalen";

const regel = (categorie: string, beginTijd: string, eindTijd: string, klantId?: string): UrenRegel =>
  ({ medewerkerId: "a", datum: "2026-09-12", categorie, beginTijd, eindTijd, klantId });

describe("veldrapportage — minuten met expliciete betekenis", () => {
  it("rekent de bronvoorbeeld-dag zonder loon en klantwerk te verwarren", () => {
    expect(berekenUrenTotalen([
      regel("loods", "07:00", "07:15"), regel("reistijd", "07:15", "08:00"),
      regel("werken", "08:00", "12:00"), regel("pauze", "12:00", "12:30"),
      regel("werken", "12:30", "15:15"), regel("afvalverwerker_bes", "15:15", "16:00"),
    ])).toMatchObject({ span: 540, geregistreerd: 540, bronBetaald: 510, klantwerk: 405, pauze: 30, indirect: 105 });
  });
  it("houdt een ongeregistreerd gat zichtbaar en berekent span per persoon/dag", () => {
    const regels = [regel("werken", "07:00", "09:00"), regel("werken", "14:00", "16:00")];
    expect(berekenUrenTotalen([...regels, { ...regels[0], medewerkerId: "b" }])).toMatchObject({ span: 660, geregistreerd: 360, bronBetaald: 660 });
  });
  it("behoudt indirecte categorieën en geeft nul bij een lege periode", () => {
    expect(berekenUrenTotalen([]).span).toBe(0);
    expect(berekenUrenTotalen([regel("laden", "08:00", "08:15")])).toMatchObject({ klantwerk: 0, indirect: 15, perCategorie: { laden: 15 } });
  });
  it("verdeelt pauze vóór klantfilter en behoudt iedere minuut", () => {
    const verdeling = verdeelPauzeOverKlanten([
      regel("werken", "08:00", "11:00", "A"), regel("werken", "11:00", "12:00", "B"),
      regel("pauze", "12:00", "12:31"), regel("pauze", "14:00", "14:15", "B"),
    ]);
    expect(verdeling.get("2026-09-12|A")).toBe(24);
    expect(verdeling.get("2026-09-12|B")).toBe(22);
  });
  it("wijst ongeldige tijden en kalenderdatums af", () => {
    expect(() => berekenUrenTotalen([regel("werken", "24:00", "25:00")])).toThrow();
    expect(() => valideerUrenPeriode("2026-02-30", "2026-03-12")).toThrow();
    expect(() => valideerUrenPeriode("2026-01-01", "2026-12-31")).not.toThrow();
  });
});
