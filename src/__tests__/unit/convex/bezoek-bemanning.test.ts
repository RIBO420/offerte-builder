import { describe, expect, it } from "vitest";
import type { MutationCtx } from "../../../../convex/_generated/server";
import type { Id } from "../../../../convex/_generated/dataModel";
import { effectieveBezoekLeden, bezoekLedenVoor, werkitemsVoorMedewerkerDag } from "../../../../convex/lib/bezoekBemanning";
import { getVeldDag, bevestigAlleVoorstellen } from "../../../../convex/urenSegmenten";
import { getVoorDag, meldAfronding, stelBemanningIn } from "../../../../convex/werkbezoek";
import { leesDekking } from "../../../../convex/veldDekking";
import { MockConvexStore, createMockCtx, createMockUser, seedMockOrganisatie } from "../../helpers/convex-mock";
function call<T>(fn: unknown, ctx: MutationCtx, args: unknown) { return (fn as { _handler: (ctx: MutationCtx, args: unknown) => Promise<T> })._handler(ctx, args); }
function fixture() {
  const store = new MockConvexStore(), orgId = seedMockOrganisatie(store) as Id<"organisaties">;
  const sam = store.insert("medewerkers", { orgId, naam: "Sam", isActief: true }) as Id<"medewerkers">;
  const kim = store.insert("medewerkers", { orgId, naam: "Kim", isActief: true }) as Id<"medewerkers">;
  const solo = store.insert("medewerkers", { orgId, naam: "Solo", isActief: true }) as Id<"medewerkers">;
  const userId = store.insert("users", createMockUser({ orgId, role: "medewerker", linkedMedewerkerId: sam }));
  const teamId = store.insert("teams", { orgId, naam: "Ploeg", leden: [sam, kim], isActief: true }) as Id<"teams">;
  const datum = "2026-09-12";
  const item = (naam: string, extra: Record<string, unknown> = {}) => store.insert("projecten", { orgId, teamId, type: "onderhoudsbeurt", status: "gepland", naam, geplandeStart: datum, geplandeStartTijd: "08:00", duurOverrideMinuten: 60, ...extra }) as Id<"projecten">;
  const ctx = createMockCtx(store) as unknown as MutationCtx;
  return { store, orgId, sam, kim, solo, userId, teamId, datum, item, ctx };
}
describe("bezoekbemanning: expliciet wint van teamdag", () => {
  it("onderscheidt undefined en expliciet leeg", () => {
    expect(effectieveBezoekLeden({}, ["sam"])).toEqual(["sam"]);
    expect(effectieveBezoekLeden({ toegewezenMedewerkerIds: [] }, ["sam"])).toEqual([]);
    expect(effectieveBezoekLeden({ toegewezenMedewerkerIds: ["kim"] }, ["sam"])).toEqual(["kim"]);
  });
  it("toont en bevestigt voor Sam alleen zijn eigen stops; uitsluiting is ook schrijfautorisatie", async () => {
    const f = fixture(), eigen = f.item("Sam", { toegewezenMedewerkerIds: [f.sam] }), ander = f.item("Kim", { toegewezenMedewerkerIds: [f.kim] });
    f.item("Nog niemand", { toegewezenMedewerkerIds: [] });
    const dag = await call<{ stops: Array<{ werkitemId: string }>; voorstellen: Array<{ werkitemId?: string }> }>(getVeldDag, f.ctx, { datum: f.datum });
    expect(dag.stops.map(s => s.werkitemId)).toEqual([eigen]);
    expect(dag.voorstellen.filter(s => s.werkitemId).map(s => s.werkitemId)).not.toContain(ander);
    expect((await call<{ bezoeken: unknown[] }>(getVoorDag, f.ctx, { datum: f.datum })).bezoeken).toHaveLength(1);
    await expect(call(meldAfronding, f.ctx, { werkitemId: ander, datum: f.datum, afgerond: true, sleutel: "not-assigned" })).rejects.toThrow("niet toegewezen");
    await call(bevestigAlleVoorstellen, f.ctx, { datum: f.datum });
    const werk = f.store.getAll("urenSegmenten").filter(s => s.categorie === "werken");
    expect(werk.map(s => s.werkitemId)).toEqual([eigen]);
  });
  it("geeft teamloze en cross-team expliciete medewerker een echte dag en voorstel", async () => {
    const f = fixture(), buiten = f.item("Buiten eigen ploeg", { toegewezenMedewerkerIds: [f.solo] }), solo = f.item("Zonder ploeg", { teamId: undefined, toegewezenMedewerkerIds: [f.solo], geplandeStartTijd: "10:00" });
    f.store.patch(f.userId, { linkedMedewerkerId: f.solo });
    const dag = await call<{ team: unknown; stops: Array<{ werkitemId: string }>; voorstellen: unknown[] }>(getVeldDag, f.ctx, { datum: f.datum });
    expect(dag.team).toBeNull(); expect(dag.stops.map(s => s.werkitemId)).toEqual([buiten, solo]); expect(dag.voorstellen.length).toBeGreaterThan(0);
    await call(bevestigAlleVoorstellen, f.ctx, { datum: f.datum });
    expect(f.store.getAll("urenSegmenten").filter(s => s.categorie === "werken").map(s => s.werkitemId)).toEqual([buiten, solo]);
  });
  it("erkent eigen fysieke retour bij een expliciet bezoek buiten de eigen ploeg", async () => {
    const f = fixture(); f.item("Bij andere ploeg helpen", { toegewezenMedewerkerIds: [f.solo] });
    f.store.patch(f.userId, { linkedMedewerkerId: f.solo });
    f.store.insert("aanhangerRetouren", { orgId: f.orgId, datum: f.datum, verantwoordelijkeMedewerkerId: f.solo, keuze: "geen_aanhanger" });
    const dag = await call<{ bezoeken: Array<{ ontbreekt: string[] }> }>(getVoorDag, f.ctx, { datum: f.datum });
    expect(dag.bezoeken).toHaveLength(1); expect(dag.bezoeken[0].ontbreekt).not.toContain("aanhanger");
  });
  it("laat kantoor expliciet leeg maken, conflict afvangen en terugkeren naar de ploegdag", async () => {
    const f = fixture(), id = f.item("Ploegdag");
    await expect(call(stelBemanningIn, f.ctx, { werkitemId: id, datum: f.datum, medewerkerIds: [], verwachteMedewerkerIds: null })).rejects.toThrow("Alleen kantoor");
    f.store.patch(f.userId, { role: "projectleider" });
    await call(stelBemanningIn, f.ctx, { werkitemId: id, datum: f.datum, medewerkerIds: [], verwachteMedewerkerIds: null });
    expect(f.store.get(id)?.toegewezenMedewerkerIds).toEqual([]);
    await expect(call(stelBemanningIn, f.ctx, { werkitemId: id, datum: f.datum, medewerkerIds: [f.sam], verwachteMedewerkerIds: null })).rejects.toThrow("intussen gewijzigd");
    await call(stelBemanningIn, f.ctx, { werkitemId: id, datum: f.datum, verwachteMedewerkerIds: [] });
    expect(f.store.get(id)?.toegewezenMedewerkerIds).toBeUndefined();
    expect(f.store.getAll("werkbezoekHistorie")).toHaveLength(2);
  });
  it("gebruikt dagoverride alleen bij ontbrekende bezoekoverride en houdt dekking gelijk", async () => {
    const f = fixture(), teamWerk = f.item("Teamdag"), samWerk = f.item("Expliciet Sam", { toegewezenMedewerkerIds: [f.sam] });
    f.item("Leeg", { toegewezenMedewerkerIds: [] });
    f.store.insert("teamBemanning", { orgId: f.orgId, teamId: f.teamId, datum: f.datum, medewerkerIds: [f.kim] });
    const doc = await f.ctx.db.get(teamWerk);
    expect(await bezoekLedenVoor(f.ctx.db, doc!, f.datum)).toEqual([f.kim]);
    expect((await werkitemsVoorMedewerkerDag(f.ctx.db, f.orgId, f.sam, f.datum)).map(i => i._id)).toEqual([samWerk]);
    const dekking = await leesDekking(f.ctx, f.orgId, f.datum, f.datum);
    expect(dekking.find(r => r.medewerkerId === f.sam)?.bezoeken.map(b => b.werkitemId)).toEqual([samWerk]);
    expect(dekking.find(r => r.medewerkerId === f.kim)?.bezoeken.map(b => b.werkitemId)).toEqual([teamWerk]);
  });
});
