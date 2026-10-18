/**
 * Regressietests voor de Convex-reviewpunten van okt 2026 (buiten de
 * urenbron-kern, die in project-uren-bron.test.ts zit).
 */
import { describe, it, expect } from "vitest";
import { MockConvexStore, createMockCtx, createMockUser, seedMockOrganisatie } from "../../helpers/convex-mock";
import { kwartaalWeekBereik, listByQuarter } from "../../../../convex/weekPlanning";
import { urenUpdatePatch } from "../../../../convex/urenRegistraties";
import { formatUrenOmschrijving, getBudgetStatus, getBudgetVergelijking } from "../../../../convex/projectKosten";
import { getProjectSummary, reject } from "../../../../convex/kwaliteitsControles";
import { permanentlyDeleteProject } from "../../../../convex/softDelete";
import { laadDagBemanning, werkitemsInPeriode, werkitemsVoorMedewerkerUit } from "../../../../convex/lib/bezoekBemanning";

type AnyHandler = (ctx: unknown, args: unknown) => Promise<unknown>;
const handler = (fn: unknown) => (fn as { _handler: AnyHandler })._handler;

function opzet(role = "directie") {
  const store = new MockConvexStore();
  const orgId = seedMockOrganisatie(store);
  const vreemd = seedMockOrganisatie(store, { clerkOrgId: "org_vreemd" });
  store.insert("users", createMockUser({ role, name: "Ricardo Bos" }));
  const ctx = createMockCtx(store);
  return { store, ctx, orgId, vreemd };
}

describe("weekPlanning.listByQuarter — volledige randweken (MIDDEL 6)", () => {
  it("kwartaalWeekBereik loopt van maandag van de eerste tot zondag van de laatste ISO-week", () => {
    // Q4 2026: 1 okt = donderdag, 31 dec = donderdag
    expect(kwartaalWeekBereik(2026, 4)).toEqual({ startDatum: "2026-09-28", eindDatum: "2027-01-03" });
    // Q1 2027: 1 jan = vrijdag (ISO-week 53 van 2026), 31 mrt = woensdag
    expect(kwartaalWeekBereik(2027, 1)).toEqual({ startDatum: "2026-12-28", eindDatum: "2027-04-04" });
    // Q2 2026: 1 apr = woensdag, 30 jun = dinsdag
    expect(kwartaalWeekBereik(2026, 2)).toEqual({ startDatum: "2026-03-30", eindDatum: "2026-07-05" });
  });

  it("telt de dagen van een randweek buiten het kwartaal mee, met gelijke return-vorm en datumvolgorde", async () => {
    const { store, ctx, orgId } = opzet();
    const mw = store.insert("medewerkers", { orgId, naam: "Jan", isActief: true });
    const project = store.insert("projecten", { orgId, naam: "P", status: "gepland" });
    for (const datum of ["2026-12-28", "2026-12-29", "2027-01-01", "2027-03-31", "2027-04-02"]) {
      store.insert("weekPlanning", { projectId: project, medewerkerId: mw, datum, uren: 8 });
    }
    store.insert("weekPlanning", { projectId: project, medewerkerId: mw, datum: "2027-04-06", uren: 8 }); // buiten bereik

    const res = (await handler(listByQuarter)(ctx, { year: 2027, quarter: 1 })) as {
      weken: { weekNummer: number; startDatum: string; aantalTaken: number; geplandeUren: number; beschikbareUren: number; bezetting: number; aantalMedewerkers: number }[];
      totaalMedewerkers: number;
    };
    expect(res.totaalMedewerkers).toBe(1);
    expect(res.weken.map((w) => [w.weekNummer, w.startDatum, w.aantalTaken])).toEqual([
      [53, "2026-12-28", 3],
      [13, "2027-03-29", 2],
    ]);
    expect(Object.keys(res.weken[0]).sort()).toEqual(["aantalMedewerkers", "aantalTaken", "beschikbareUren", "bezetting", "geplandeUren", "startDatum", "weekNummer"]);
  });
});

describe("urenRegistraties.update — velden wissen (aanvulling 3)", () => {
  it("undefined laat staan, null of lege tekst wist", () => {
    expect(urenUpdatePatch({ uren: 2 })).toEqual({ uren: 2 });
    const wis = urenUpdatePatch({ scope: null, notities: "  ", taakId: null });
    expect(Object.keys(wis).sort()).toEqual(["notities", "scope", "taakId"]);
    expect(wis).toEqual({ scope: undefined, notities: undefined, taakId: undefined });
    expect(urenUpdatePatch({ scope: "bestrating", notities: "ok" })).toEqual({ scope: "bestrating", notities: "ok" });
  });
});

describe("projectKosten — budget op de projectpagina gooit niet (aanvulling 1/2, LAAG)", () => {
  function metProject(extra: Record<string, unknown> = {}) {
    const o = opzet();
    const offerte = o.store.insert("offertes", { orgId: o.orgId, type: "aanleg", totalen: { totaalExBtw: 1000, arbeidskosten: 500, materiaalkosten: 400 }, regels: [] });
    const project = o.store.insert("projecten", { orgId: o.orgId, naam: "Tuin", status: "in_uitvoering", offerteId: offerte, ...extra });
    o.store.insert("voorcalculaties", { orgId: o.orgId, projectId: project, normUrenTotaal: 10 });
    const conflict = () => {
      o.store.insert("urenRegistraties", { orgId: o.orgId, projectId: project, datum: "2026-10-01", uren: 2, medewerker: "Jan", bron: "handmatig" });
      o.store.insert("urenSegmenten", { orgId: o.orgId, werkitemId: project, medewerkerId: "medewerkers:9", datum: "2026-10-01", categorie: "werken", beginTijd: "08:00", eindTijd: "09:00", status: "bevestigd", bron: "handmatig", createdAt: 0, updatedAt: 0 });
    };
    return { ...o, project, conflict };
  }

  it("urenbronconflict → { error: URENBRON_CONFLICT, data: null } en budgetstatus null", async () => {
    const { ctx, project, conflict } = metProject();
    conflict();
    expect(await handler(getBudgetVergelijking)(ctx, { projectId: project })).toEqual({ error: "URENBRON_CONFLICT", data: null });
    expect(await handler(getBudgetStatus)(ctx, { projectId: project })).toBeNull();
  });

  it("verwijderd of vreemd project → null i.p.v. throw", async () => {
    const { store, ctx, vreemd, project } = metProject();
    const vreemdProject = store.insert("projecten", { orgId: vreemd, naam: "Ander", status: "gepland" });
    await store.delete?.(project);
    expect(await handler(getBudgetVergelijking)(ctx, { projectId: vreemdProject })).toBeNull();
    expect(await handler(getProjectSummary)(ctx, { projectId: vreemdProject })).toBeNull();
    expect(await handler(getBudgetVergelijking)(ctx, { projectId: "projecten:weg" })).toBeNull();
    expect(await handler(getProjectSummary)(ctx, { projectId: "projecten:weg" })).toBeNull();
  });

  it("zonder conflict blijft de vorm data.gepland/werkelijk gelijk", async () => {
    const { store, ctx, orgId, project } = metProject();
    store.insert("urenRegistraties", { orgId, projectId: project, datum: "2026-10-01", uren: 2, medewerker: "Jan", bron: "handmatig" });
    const res = (await handler(getBudgetVergelijking)(ctx, { projectId: project })) as { error: null; data: { gepland: { uren: number }; werkelijk: { uren: number } } };
    expect(res.error).toBeNull();
    expect(res.data.gepland.uren).toBe(10);
    expect(res.data.werkelijk.uren).toBe(2);
  });

  it("arbeidsomschrijving rondt uren af op 2 decimalen in Nederlandse notatie", () => {
    expect(formatUrenOmschrijving(8.583333333333334)).toBe("8,58");
    expect(formatUrenOmschrijving(8)).toBe("8");
  });
});

describe("kwaliteitsControles.reject — afkeurder uit de auth (aanvulling 4)", () => {
  it("slaat de naam van de ingelogde gebruiker op, niet de client-waarde", async () => {
    const { store, ctx, orgId } = opzet();
    const project = store.insert("projecten", { orgId, naam: "Tuin", status: "in_uitvoering" });
    const controle = store.insert("kwaliteitsControles", { orgId, projectId: project, scope: "bestrating", checklistItems: [], status: "open", createdAt: 0, updatedAt: 0 });
    await handler(reject)(ctx, { id: controle, reden: "Voegen open", afgekeurdDoor: "Iemand anders" });
    expect(store.get(controle)).toMatchObject({ status: "afgekeurd", opmerkingen: "Voegen open", afgekeurdDoor: "Ricardo Bos" });
    expect(typeof store.get(controle)?.afgekeurdAt).toBe("number");
  });
});

describe("softDelete.permanentlyDeleteProject — historie blijft in de prullenbak (MIDDEL 5)", () => {
  it("laat deletedAt staan en archiveert niet als er uitvoeringshistorie is", async () => {
    const { store, ctx, orgId } = opzet();
    const project = store.insert("projecten", { orgId, naam: "Weg", status: "afgerond", deletedAt: 1 });
    store.insert("urenRegistraties", { orgId, projectId: project, datum: "2026-01-01", uren: 1, medewerker: "Jan", bron: "handmatig" });
    expect(await handler(permanentlyDeleteProject)(ctx, { id: project, orgId })).toBeNull();
    expect(store.get(project)).toMatchObject({ deletedAt: 1 });
    expect(store.get(project)?.isArchived).toBeUndefined();
  });

  it("purget een project zonder historie nog steeds", async () => {
    const { store, ctx, orgId } = opzet();
    const project = store.insert("projecten", { orgId, naam: "Leeg", status: "gepland", deletedAt: 1 });
    expect(await handler(permanentlyDeleteProject)(ctx, { id: project, orgId })).toBe(project);
    expect(store.get(project)).toBeNull();
  });
});

describe("bezoekBemanning — begrensde dagdata (HOOG 3)", () => {
  it("vindt startende, eendaagse en lang lopende items, maar niet afgelopen of toekomstige", async () => {
    const { store, ctx, orgId, vreemd } = opzet();
    const db = (ctx as unknown as { db: Parameters<typeof werkitemsInPeriode>[0] }).db;
    const maak = (naam: string, geplandeStart?: string, geplandeEind?: string, org = orgId) =>
      store.insert("projecten", { orgId: org, naam, status: "gepland", geplandeStart, geplandeEind });
    maak("Vandaag", "2026-10-18");
    maak("Lang lopend", "2026-06-01", "2026-12-31");
    maak("Afgelopen", "2026-10-01", "2026-10-17");
    maak("Toekomst", "2026-10-19", "2026-10-25");
    maak("Ongepland");
    maak("Vreemd", "2026-10-18", undefined, vreemd);
    const items = await werkitemsInPeriode(db, orgId as never, "2026-10-18", "2026-10-18");
    expect(items.map((i) => i.naam).sort()).toEqual(["Lang lopend", "Vandaag"]);
  });

  it("filtert per medewerker uit één keer geladen dagdata (team-dagbemanning en expliciete toewijzing)", async () => {
    const { store, ctx, orgId } = opzet();
    const db = (ctx as unknown as { db: Parameters<typeof laadDagBemanning>[0] }).db;
    const jan = store.insert("medewerkers", { orgId, naam: "Jan" });
    const piet = store.insert("medewerkers", { orgId, naam: "Piet" });
    const team = store.insert("teams", { orgId, naam: "A", leden: [jan], isActief: true });
    store.insert("teamBemanning", { orgId, teamId: team, datum: "2026-10-18", medewerkerIds: [jan, piet] });
    store.insert("projecten", { orgId, naam: "Teamklus", status: "gepland", geplandeStart: "2026-10-18", teamId: team });
    store.insert("projecten", { orgId, naam: "Alleen Jan", status: "gepland", geplandeStart: "2026-10-18", teamId: team, toegewezenMedewerkerIds: [jan] });
    store.insert("projecten", { orgId, naam: "Vervallen", status: "vervallen", geplandeStart: "2026-10-18", teamId: team });
    const dag = await laadDagBemanning(db, orgId as never, "2026-10-18");
    expect(werkitemsVoorMedewerkerUit(dag, jan as never).map((i) => i.naam)).toEqual(["Alleen Jan", "Teamklus"]);
    expect(werkitemsVoorMedewerkerUit(dag, piet as never).map((i) => i.naam)).toEqual(["Teamklus"]);
  });
});
