/**
 * Projecturenbron (review okt 2026): de beslisregel is één pure functie die
 * zowel het per-projectpad (`projectUrenBron`) als de org-brede scan
 * (`projectUrenVoorOrg`) gebruikt. Lijsten en aggregaties gooien nooit bij een
 * urenbronconflict; ze markeren het project en tellen het niet mee.
 */
import { describe, it, expect } from "vitest";
import { MockConvexStore, createMockCtx, seedMockOrganisatie } from "../../helpers/convex-mock";
import {
  kiesProjectUrenBron,
  medewerkerInConflict,
  projectUrenBron,
  projectUrenUitRijen,
  projectUrenVoorOrg,
  selecteerProjectUren,
} from "../../../../convex/lib/projectUrenBron";

type Ctx = Parameters<typeof projectUrenVoorOrg>[0];
const ORG = "organisaties:1" as never;

function legacy(over: Record<string, unknown> = {}) {
  return { _id: "urenRegistraties:x", orgId: ORG, projectId: "projecten:p", datum: "2026-10-01", uren: 2, medewerker: "Jan", bron: "handmatig", ...over } as never;
}
function segment(over: Record<string, unknown> = {}) {
  return { _id: "urenSegmenten:x", orgId: ORG, werkitemId: "projecten:p", datum: "2026-10-01", beginTijd: "08:00", eindTijd: "09:30", categorie: "werken", status: "bevestigd", medewerkerId: "medewerkers:1", ...over } as never;
}

describe("selecteerProjectUren — pure beslisregel", () => {
  const project = { orgId: ORG, urenBron: undefined };

  it("kiest het enige grootboek met telbare rijen", () => {
    expect(selecteerProjectUren(project, [legacy()], [])).toMatchObject({ status: "ok", bron: "legacy", minuten: 120 });
    expect(selecteerProjectUren(project, [], [segment()])).toMatchObject({ status: "ok", bron: "segmenten", minuten: 90 });
    expect(selecteerProjectUren(project, [], [])).toMatchObject({ status: "ok", bron: "legacy", minuten: 0, legacyAantal: 0 });
  });

  it("markeert beide grootboeken zonder keuze als conflict, zonder totaal en zonder regels", () => {
    const r = selecteerProjectUren(project, [legacy()], [segment()]);
    expect(r).toMatchObject({ status: "conflict", bron: null, minuten: null, legacyMinuten: 120, segmentMinuten: 90 });
    expect(r.regels).toEqual([]);
  });

  it("een expliciete keuze wint, ook bij beide grootboeken", () => {
    expect(selecteerProjectUren({ orgId: ORG, urenBron: "segmenten" }, [legacy()], [segment()])).toMatchObject({ status: "ok", bron: "segmenten", minuten: 90 });
    expect(selecteerProjectUren({ orgId: ORG, urenBron: "legacy" }, [legacy()], [segment()])).toMatchObject({ status: "ok", bron: "legacy", minuten: 120 });
  });

  it("pauze, concept en vreemde org tellen niet mee voor de keuze", () => {
    const nietTelbaar = [segment({ categorie: "pauze" }), segment({ status: "concept" }), segment({ orgId: "organisaties:2" })];
    expect(selecteerProjectUren(project, [legacy()], nietTelbaar)).toMatchObject({ status: "ok", bron: "legacy", segmentAantal: 0 });
  });

  it("rijen buiten de set (elders) beslissen mee over de bron maar niet over de regels", () => {
    expect(selecteerProjectUren(project, [legacy()], [], { segmenten: true })).toMatchObject({ status: "conflict" });
    expect(selecteerProjectUren(project, [], [segment()], { legacy: true })).toMatchObject({ status: "conflict" });
    expect(selecteerProjectUren(project, [], [segment()], { segmenten: true })).toMatchObject({ status: "ok", bron: "segmenten", minuten: 90 });
  });

  it("is consistent met kiesProjectUrenBron", () => {
    expect(kiesProjectUrenBron(undefined, 1, 1)).toEqual({ status: "conflict", bron: null });
  });
});

describe("projectUrenVoorOrg — één scan, nooit gooien", () => {
  function opzet() {
    const store = new MockConvexStore();
    const orgId = seedMockOrganisatie(store);
    const vreemd = seedMockOrganisatie(store, { clerkOrgId: "org_vreemd" });
    const ctx = createMockCtx(store) as unknown as Ctx;
    const jan = store.insert("medewerkers", { orgId, naam: "Jan", isActief: true });
    const piet = store.insert("medewerkers", { orgId, naam: "Piet", isActief: true });
    const project = (naam: string, extra: Record<string, unknown> = {}) =>
      store.insert("projecten", { orgId, naam, status: "in_uitvoering", ...extra });
    const reg = (projectId: string, datum: string, uren: number, medewerkerId: string, naam = "Jan", org = orgId) =>
      store.insert("urenRegistraties", { orgId: org, projectId, datum, uren, medewerker: naam, medewerkerId, bron: "handmatig" });
    const seg = (werkitemId: string, datum: string, medewerkerId: string, extra: Record<string, unknown> = {}) =>
      store.insert("urenSegmenten", { orgId, werkitemId, medewerkerId, datum, categorie: "werken", beginTijd: "08:00", eindTijd: "10:00", status: "bevestigd", bron: "handmatig", createdAt: 0, updatedAt: 0, ...extra });
    return { store, ctx, orgId, vreemd, jan, piet, project, reg, seg };
  }

  it("telt goede projecten, slaat een conflictproject over en meldt het (geen throw)", async () => {
    const { ctx, orgId, jan, piet, project, reg, seg } = opzet();
    const goed = project("Goed");
    const conflict = project("Conflict");
    reg(goed, "2026-10-01", 3, jan);
    reg(conflict, "2026-10-02", 4, piet, "Piet");
    seg(conflict, "2026-10-02", piet);

    const scan = await projectUrenVoorOrg(ctx, orgId as never);
    expect(scan.registraties.map((r) => r.uren)).toEqual([3]);
    expect(scan.registraties[0].medewerker).toBe("Jan");
    expect(scan.conflicten).toEqual([expect.objectContaining({ projectId: conflict, naam: "Conflict", legacyMinuten: 240, segmentMinuten: 120 })]);
    expect(scan.perProject.get(goed)).toMatchObject({ status: "ok", bron: "legacy" });
    expect(medewerkerInConflict(scan, { _id: piet as never, naam: "Piet" })).toBe(true);
    expect(medewerkerInConflict(scan, { _id: jan as never, naam: "Jan" })).toBe(false);
  });

  it("geeft dezelfde bron als het per-projectpad", async () => {
    const { store, ctx, orgId, jan, project, reg, seg } = opzet();
    const a = project("A", { urenBron: "segmenten" });
    reg(a, "2026-10-01", 3, jan);
    seg(a, "2026-10-01", jan);
    const scan = await projectUrenVoorOrg(ctx, orgId as never);
    const los = await projectUrenBron(ctx, store.get(a) as never);
    expect(scan.perProject.get(a)).toEqual(los);
    expect(scan.registraties.map((r) => [r.uren, r.bronTabel])).toEqual([[2, "urenSegmenten"]]);
  });

  it("ziet in een begrensde periode ook een conflict met rijen búíten de periode", async () => {
    const { ctx, orgId, jan, project, reg, seg } = opzet();
    const p = project("Langlopend");
    reg(p, "2026-07-01", 5, jan); // vóór de periode
    seg(p, "2026-10-05", jan); // in de periode
    const scan = await projectUrenVoorOrg(ctx, orgId as never, { vanaf: "2026-10-01", tot: "2026-10-31" });
    expect(scan.conflicten.map((c) => c.projectId)).toEqual([p]);
    expect(scan.registraties).toEqual([]);
  });

  it("telt in een periode alleen de rijen binnen de periode, en bepaalt de bron van ookProjectIds zonder rijen", async () => {
    const { ctx, orgId, jan, project, reg, seg } = opzet();
    const p = project("Normaal");
    reg(p, "2026-09-30", 8, jan);
    reg(p, "2026-10-01", 2, jan);
    const gepland = project("Gepland, nog geen uren vandaag");
    reg(gepland, "2026-09-01", 1, jan);
    seg(gepland, "2026-09-02", jan);
    const scan = await projectUrenVoorOrg(ctx, orgId as never, { vanaf: "2026-10-01", tot: "2026-10-01", ookProjectIds: [gepland as never] });
    expect(scan.registraties.map((r) => r.uren)).toEqual([2]);
    expect(scan.conflicten.map((c) => c.projectId)).toEqual([gepland]);
  });

  it("negeert rijen van andere organisaties en projecten buiten de voorgeladen set", async () => {
    const { store, ctx, orgId, vreemd, jan, project, reg } = opzet();
    const eigen = project("Eigen");
    const anderProject = project("Niet in set");
    reg(eigen, "2026-10-01", 1, jan);
    reg(anderProject, "2026-10-01", 9, jan);
    reg(eigen, "2026-10-01", 50, jan, "Jan", vreemd);
    const scan = await projectUrenVoorOrg(ctx, orgId as never, { projecten: [store.get(eigen) as never] });
    expect(scan.registraties.map((r) => r.uren)).toEqual([1]);
  });

  it("projectUrenUitRijen (onvolledige set) controleert het andere grootboek met een bestaanscheck", async () => {
    const { ctx, orgId, jan, piet, project, reg, seg } = opzet();
    const p = project("Gedeeld");
    seg(p, "2026-10-01", piet); // collega logde segmenten
    reg(p, "2026-10-01", 3, jan);
    const janRijen = [{ _id: "x", orgId, projectId: p, datum: "2026-10-01", uren: 3, medewerker: "Jan", medewerkerId: jan, bron: "handmatig" }];
    const scan = await projectUrenUitRijen(ctx, orgId as never, janRijen as never, [], { volledig: false });
    expect(scan.conflicten.map((c) => c.projectId)).toEqual([p]);
    expect(scan.registraties).toEqual([]);
  });
});
