import { getDeltaChecklist, voegBenodigdheidToe, vinkAf, verwijderBenodigdheid } from "../../../../convex/materiaalDelta";
import { zoek as zoekVeldKlanten, maakUitvoeringsklus } from "../../../../convex/veldKlanten";
import { exportProjecten, exportMedewerkers } from "../../../../convex/export";
import { updatePlanning } from "../../../../convex/werkitems";
import { remove as verwijderProject, permanentlyDelete } from "../../../../convex/projecten";
import { getPeriode } from "../../../../convex/urenRapportage";
import { save as bewaarNacalculatie } from "../../../../convex/nacalculaties";
import { list as kostenLijst } from "../../../../convex/projectKosten";
import { projectUrenBron } from "../../../../convex/lib/projectUrenBron";
import { getProjectUrenBron, setProjectUrenBron } from "../../../../convex/urenRapportage";
import { beforeEach, describe, expect, it } from "vitest";
import { bevestigSegment, getEigenOpdracht, updateSegment, verwijderSegment, slaDagvoorstelOp, dienDagIn, heropenDag } from "../../../../convex/urenSegmenten";
import { bepaalKwijting } from "../../../../convex/lib/urenAfwijkingen";
import { bronCategorieNaarSegment, duurAfwijking } from "../../../../convex/veldLogica";

import { maakLosseKracht, mijnLosseKrachten, getLosseKrachtDag, logUrenVoorLosseKracht } from "../../../../convex/losseKrachten";

// Indexbewuste in-memory DB; serverhelpers/auth blijven echt.
interface FakeDoc {
  _id: string;
  _creationTime: number;
  [key: string]: unknown;
}

interface IndexQ {
  eq: (field: string, value: unknown) => IndexQ;
  gte: (field: string, value: unknown) => IndexQ;
  lte: (field: string, value: unknown) => IndexQ;
}

function createQueryBuilder(docs: FakeDoc[]) {
  let current = [...docs];

  const builder = {
    withIndex(_indexName: string, fn: (q: IndexQ) => IndexQ) {
      const predicates: Array<(doc: FakeDoc) => boolean> = [];
      const q: IndexQ = {
        eq: (field, value) => {
          predicates.push((doc) => doc[field] === value);
          return q;
        },
        gte: (field, value) => {
          predicates.push((doc) => (doc[field] as string) >= (value as string));
          return q;
        },
        lte: (field, value) => {
          predicates.push((doc) => (doc[field] as string) <= (value as string));
          return q;
        },
      };
      fn(q);
      current = current.filter((doc) => predicates.every((p) => p(doc)));
      return builder;
    },
    order(richting: "asc" | "desc") {
      current.sort((a, b) =>
        richting === "desc"
          ? b._creationTime - a._creationTime
          : a._creationTime - b._creationTime
      );
      return builder;
    },
    async collect(): Promise<FakeDoc[]> {
      return [...current];
    },
    async first(): Promise<FakeDoc | null> {
      return current[0] ?? null;
    },
    async take(n: number): Promise<FakeDoc[]> {
      return current.slice(0, n);
    },
    async unique(): Promise<FakeDoc | null> {
      if (current.length > 1) {
        throw new Error("unique() vond meerdere documenten");
      }
      return current[0] ?? null;
    },
  };

  return builder;
}

class FakeDb {
  private tables = new Map<string, FakeDoc[]>();
  private counter = 0;

  insertSync(table: string, data: Record<string, unknown>): string {
    this.counter += 1;
    const id = `${table}:${this.counter}`;
    const doc: FakeDoc = { ...data, _id: id, _creationTime: this.counter };
    const rows = this.tables.get(table) ?? [];
    rows.push(doc);
    this.tables.set(table, rows);
    return id;
  }

  rows(table: string): FakeDoc[] {
    return [...(this.tables.get(table) ?? [])];
  }

  private byId(id: string): FakeDoc | null {
    for (const rows of this.tables.values()) {
      const found = rows.find((d) => d._id === id);
      if (found) return found;
    }
    return null;
  }

  query(table: string) {
    return createQueryBuilder(this.rows(table));
  }

  async get(id: string): Promise<FakeDoc | null> {
    return this.byId(id);
  }

  async insert(table: string, data: Record<string, unknown>): Promise<string> {
    return this.insertSync(table, data);
  }

  async patch(id: string, updates: Record<string, unknown>): Promise<void> {
    const doc = this.byId(id);
    if (!doc) throw new Error(`Document ${id} bestaat niet`);
    Object.assign(doc, updates);
  }

  async delete(id: string): Promise<void> {
    for (const [table, rows] of this.tables) {
      const idx = rows.findIndex((d) => d._id === id);
      if (idx !== -1) {
        rows.splice(idx, 1);
        this.tables.set(table, rows);
        return;
      }
    }
  }
}


let db: FakeDb;
let org: string, foreignOrg: string, medewerker: string, other: string, user: string;
const datum = "2026-09-12";
function context(role = "medewerker") {
  return { db, auth: { getUserIdentity: async () => ({ subject: role, org_id: "org-test" }) } };
}
async function run<T = unknown>(fn: unknown, args: Record<string, unknown>, role = "medewerker"): Promise<T> {
  return (fn as { _handler: (ctx: unknown, args: Record<string, unknown>) => Promise<T> })._handler(context(role), args);
}
const entry = { categorie: "laden", beginTijd: "07:00", eindTijd: "07:15" };
const batch = () => ({ datum, verwachteRevisie: 0, sleutel: "batch-test-0001", segmenten: [entry,
  { categorie: "loods", beginTijd: "07:15", eindTijd: "07:20" }] });
beforeEach(() => {
  db = new FakeDb();
  org = db.insertSync("organisaties", { clerkOrgId: "org-test", actief: true });
  foreignOrg = db.insertSync("organisaties", { clerkOrgId: "org-other", actief: true });
  medewerker = db.insertSync("medewerkers", { orgId: org, naam: "Test Worker", isActief: true });
  other = db.insertSync("medewerkers", { orgId: foreignOrg, naam: "Other", isActief: true });
  user = db.insertSync("users", { clerkId: "medewerker", role: "medewerker", linkedMedewerkerId: medewerker });
  db.insertSync("users", { clerkId: "directie", role: "directie", linkedMedewerkerId: medewerker });
  db.insertSync("users", { clerkId: "voorman", role: "voorman", linkedMedewerkerId: medewerker });
  db.insertSync("users", { clerkId: "voorman2", role: "voorman", linkedMedewerkerId: medewerker });
});

describe("F13 veldklanten en echte ongeplande uitvoering", () => {
  const invoer = () => ({ datum, sleutel: "veld-klant-0001", nieuweKlant: { naam: "Nieuwe klant", adres: "Tuinpad 1", plaats: "Breda" }, omschrijving: "Heg snoeien achtertuin", categorie: "onderhoud" });
  it("maakt eenmaal echte klant en eigen klus, replay blijft veilig na indienen", async () => {
    const first = await run<{ klantId: string; werkitemId: string }>(maakUitvoeringsklus, invoer());
    expect(db.rows("projecten")[0]).toMatchObject({ naam: "Heg snoeien achtertuin", uitvoeringCategorie: "onderhoud", klantId: first.klantId, toegewezenMedewerkerIds: [medewerker], klaarVoorFacturatie: false });
    expect(db.rows("projecten")[0].offerteId).toBeUndefined();
    db.insertSync("urenDagen", { orgId: org, medewerkerId: medewerker, datum, status: "ingediend" });
    expect(await run(maakUitvoeringsklus, invoer())).toEqual(first);
    expect(db.rows("klanten")).toHaveLength(1);
    expect(db.rows("projecten")).toHaveLength(1);
    expect(db.rows("veldKlantOpdrachten")).toHaveLength(1);
    expect(db.rows("facturen")).toHaveLength(0);
    expect(db.rows("urenSegmenten")).toHaveLength(0);
    await expect(run(maakUitvoeringsklus, { ...invoer(), omschrijving: "Andere klus" })).rejects.toThrow("andere invoer");
  });
  it("laat bestaande klant aan echte klus koppelen en normale werkuren registreren", async () => {
    const klantId = db.insertSync("klanten", { orgId: org, naam: "Bestaand", adres: "Straat 2", postcode: "", plaats: "Breda" });
    const { nieuweKlant: _nieuwe, ...args } = invoer();
    const result = await run<{ werkitemId: string }>(maakUitvoeringsklus, { ...args, klantId });
    await run(bevestigSegment, { datum, werkitemId: result.werkitemId, klantId, categorie: "werken", beginTijd: "10:00", eindTijd: "11:00" });
    expect(db.rows("urenSegmenten")[0]).toMatchObject({ werkitemId: result.werkitemId, werksoort: "Tuinonderhoud" });
    expect(db.rows("klanten")).toHaveLength(1);
  });
  it("weigert vreemde of gearchiveerde klanten zonder writes", async () => {
    const { nieuweKlant: _nieuwe, ...args } = invoer();
    for (const fields of [{ orgId: foreignOrg }, { orgId: org, isArchived: true }]) {
      const klantId = db.insertSync("klanten", { naam: "Niet kiesbaar", ...fields });
      await expect(run(maakUitvoeringsklus, { ...args, klantId })).rejects.toThrow("Klant niet gevonden");
    }
    expect(db.rows("projecten")).toHaveLength(0);
    expect(db.rows("veldKlantOpdrachten")).toHaveLength(0);
  });
  it("valideert kalenderdag, klantkeuze, tekst en dagslot vóór writes", async () => {
    await expect(run(maakUitvoeringsklus, { ...invoer(), datum: "2026-02-30" })).rejects.toThrow("Ongeldige datum");
    await expect(run(maakUitvoeringsklus, { ...invoer(), omschrijving: " " })).rejects.toThrow("Omschrijving");
    await expect(run(maakUitvoeringsklus, { ...invoer(), klantId: "klanten:123" })).rejects.toThrow("bestaande klant");
    db.insertSync("urenDagen", { orgId: org, medewerkerId: medewerker, datum, status: "ingediend" });
    await expect(run(maakUitvoeringsklus, invoer())).rejects.toThrow("ingediend");
    expect(db.rows("klanten")).toHaveLength(0);
  });
  it("houdt klantrollen, ontbrekende/uitgeschakelde koppeling en gewijzigde replay-actor buiten", async () => {
    db.insertSync("users", { clerkId: "klant", role: "klant", linkedMedewerkerId: medewerker });
    db.insertSync("users", { clerkId: "zonder", role: "medewerker" });
    await expect(run(zoekVeldKlanten, { datum }, "klant")).rejects.toThrow();
    await expect(run(maakUitvoeringsklus, invoer(), "zonder")).rejects.toThrow("gekoppelde medewerker");
    await run(maakUitvoeringsklus, invoer());
    await db.patch(medewerker, { isActief: false });
    await expect(run(maakUitvoeringsklus, invoer())).rejects.toThrow("actieve gekoppelde");
  });
  it("rangschikt eigen planning eerst, respecteert expliciet lege toewijzing en toont alleen minimale orgvelden", async () => {
    const a = db.insertSync("klanten", { orgId: org, naam: "A elders", adres: "", postcode: "", plaats: "Breda", email: "privaat@example.com" });
    const z = db.insertSync("klanten", { orgId: org, naam: "Z gepland", adres: "Tuin 1", postcode: "", plaats: "Breda" });
    db.insertSync("klanten", { orgId: foreignOrg, naam: "Vreemd" });
    db.insertSync("klanten", { orgId: org, naam: "Archief", isArchived: true });
    const team = db.insertSync("teams", { orgId: org, leden: [medewerker], isActief: true });
    db.insertSync("projecten", { orgId: org, klantId: a, naam: "Niet voor mij", geplandeStart: datum, teamId: team, toegewezenMedewerkerIds: [] });
    const werkitem = db.insertSync("projecten", { orgId: org, klantId: z, naam: "Mijn taak", geplandeStart: datum, toegewezenMedewerkerIds: [medewerker] });
    const result = await run<{ klanten: { klantId: string; gepland: boolean; werkitems: { werkitemId: string }[]; email?: string }[] }>(zoekVeldKlanten, { datum });
    expect(result.klanten.map(k => k.klantId)).toEqual([z, a]);
    expect(result.klanten[0].werkitems[0].werkitemId).toBe(werkitem);
    expect(result.klanten[1].gepland).toBe(false);
    expect(result.klanten.every(k => k.email === undefined)).toBe(true);
    const filtered = await run<typeof result>(zoekVeldKlanten, { datum, zoekterm: "A elders" });
    expect(filtered.klanten.map(k => k.klantId)).toEqual([a]);
  });
});

describe("Entiteitexports respecteren de projecturenbron", () => {
  it("exporteert gekozen segmenten in project- en medewerkerstatistiek en blokkeert bronconflict", async () => {
    const klantId = db.insertSync("klanten", { orgId: org, naam: "Losse klant", plaats: "Breda" });
    const project = db.insertSync("projecten", { orgId: org, klantId, naam: "Werk", urenBron: "segmenten", status: "in_uitvoering" });
    db.insertSync("urenRegistraties", { orgId: org, projectId: project, medewerker: "Test Worker", medewerkerId: medewerker, datum, uren: 9 });
    db.insertSync("urenSegmenten", { orgId: org, werkitemId: project, medewerkerId: medewerker, datum, categorie: "werken", beginTijd: "08:00", eindTijd: "10:00", status: "bevestigd" });
    const projects = await run<{ geregistreerdeUren: number; klantNaam: string }[]>(exportProjecten, {}, "directie");
    const people = await run<{ totaalUren: number }[]>(exportMedewerkers, {}, "directie");
    expect(projects[0].geregistreerdeUren).toBe(2);
    expect(projects[0].klantNaam).toBe("Losse klant");
    expect(people[0].totaalUren).toBe(2);
    await db.patch(project, { urenBron: undefined });
    await expect(run(exportProjecten, {}, "directie")).rejects.toThrow("Kies de urenbron");
    await expect(run(exportMedewerkers, {}, "directie")).rejects.toThrow("Kies de urenbron");
  });
});

describe("Hub dagopdracht en revisies", () => {
  it("herkent alleen het eigen create-receipt voor crashherstel van een formulier", async () => {
    const sleutel = "recovery-create-001";
    expect(await run(getEigenOpdracht, { sleutel })).toBeNull();
    const id = await run(bevestigSegment, { datum, ...entry, sleutel, verwachteRevisie: 0 });
    expect(await run(getEigenOpdracht, { sleutel })).toEqual({ segmentIds: [id], revisie: 1, datum });
    expect(await run(getEigenOpdracht, { sleutel, actie: "wijzigen" })).toBeNull();
    await run(updateSegment, { id, sleutel, verwachteRevisie: 1, eindTijd: "07:20" });
    expect(await run(getEigenOpdracht, { sleutel, actie: "wijzigen" })).toEqual({ segmentIds: [id], revisie: 2, datum });
    expect(await run(getEigenOpdracht, { sleutel }, "voorman")).toBeNull();
    await db.patch(user, { linkedMedewerkerId: other });
    await expect(run(getEigenOpdracht, { sleutel })).rejects.toThrow();
  });
  it("bewaart alle aangepaste blokken en replay exact eenmaal, ook na indienen", async () => {
    const first = await run<{ ids: string[]; revisie: number }>(slaDagvoorstelOp, batch());
    expect(first.ids).toHaveLength(2);
    expect(first.revisie).toBe(2);
    expect(db.rows("urenSegmenten").map((s) => s.categorie)).toEqual(["laden", "loods"]);
    expect(db.rows("urenSegmenten").every((s) => s.ingevoerdDoor === user)).toBe(true);
    await run(dienDagIn, { datum });
    expect(await run(slaDagvoorstelOp, batch())).toEqual(first);
    expect(db.rows("urenSegmenten")).toHaveLength(2);
    expect(db.rows("urenOpdrachten")).toHaveLength(1);
  });
  it("weigert sleutelhergebruik met andere inhoud", async () => {
    await run(slaDagvoorstelOp, batch());
    await expect(run(slaDagvoorstelOp, { ...batch(), segmenten: [entry] })).rejects.toThrow("andere invoer");
  });
  it("weigert achterhaalde revisie na oude enkelvoudige invoer", async () => {
    await run(bevestigSegment, { datum, ...entry });
    await expect(run(slaDagvoorstelOp, batch())).rejects.toThrow("intussen gewijzigd");
    expect(db.rows("urenOpdrachten")).toHaveLength(0);
  });
  it("weigert een nieuwe batch op slot, ook voor kantoor", async () => {
    await run(slaDagvoorstelOp, batch());
    await run(dienDagIn, { datum });
    await expect(run(slaDagvoorstelOp, { ...batch(), sleutel: "batch-test-0002", verwachteRevisie: 3 }, "directie")).rejects.toThrow("ingediend");
  });
  it("valideert de hele batch vóór de eerste insert", async () => {
    const bad = { ...batch(), segmenten: [entry, { categorie: "reistijd", beginTijd: "07:10", eindTijd: "08:00" }] };
    await expect(run(slaDagvoorstelOp, bad)).rejects.toThrow("overlappende");
    expect(db.rows("urenSegmenten")).toHaveLength(0);
    expect(db.rows("urenDagen")).toHaveLength(0);
  });
  it("houdt medewerker- en organisatiegrenzen ook bij batches", async () => {
    await expect(run(slaDagvoorstelOp, { ...batch(), medewerkerId: other })).rejects.toThrow();
    await expect(run(slaDagvoorstelOp, { ...batch(), medewerkerId: other }, "directie")).rejects.toThrow("Medewerker niet gevonden");
  });
  it("weigert vreemde klant in later batchblok zonder gedeeltelijke opslag", async () => {
    const klantId = db.insertSync("klanten", { orgId: foreignOrg });
    await expect(run(slaDagvoorstelOp, { ...batch(), segmenten: [entry,
      { categorie: "pauze", beginTijd: "08:00", eindTijd: "08:15", klantId }] })).rejects.toThrow("Klant niet gevonden");
    expect(db.rows("urenSegmenten")).toHaveLength(0);
  });
  it("wijziging, verwijderen, indienen en heropenen verhogen dezelfde revisie", async () => {
    const id = await run<string>(bevestigSegment, { datum, ...entry });
    await run(updateSegment, { id, eindTijd: "07:20", verwachteRevisie: 1 });
    await run(dienDagIn, { datum });
    await run(heropenDag, { datum, medewerkerId: medewerker }, "directie");
    await run(verwijderSegment, { id, verwachteRevisie: 4 });
    expect(db.rows("urenDagen")[0].revisie).toBe(5);
  });
  it("weigert onbestaande kalenderdag", async () => {
    await expect(run(slaDagvoorstelOp, { ...batch(), datum: "2026-02-30" })).rejects.toThrow("Ongeldige datum");
  });
});

describe("Correcties en bronafwijking", () => {
  it("blokkeert gewijzigde klantId uit andere organisatie", async () => {
    const id = await run<string>(bevestigSegment, { datum, ...entry });
    const klantId = db.insertSync("klanten", { orgId: foreignOrg });
    await expect(run(updateSegment, { id, klantId })).rejects.toThrow("Klant niet gevonden");
    expect(db.rows("urenSegmenten")[0].klantId).toBeUndefined();
  });
  it("laat na indienen alleen een eigen notitie toe met aparte audit", async () => {
    const id = await run<string>(bevestigSegment, { datum, ...entry });
    await run(dienDagIn, { datum });
    await run(updateSegment, { id, notitie: "Eigen toelichting" });
    expect(db.rows("urenSegmenten")[0]).toMatchObject({ notitie: "Eigen toelichting", status: "ingediend", eindTijd: "07:15" });
    expect(db.rows("urenLogboek").at(-1)?.actie).toBe("notitie_gewijzigd");
    await expect(run(updateSegment, { id, notitie: "Verborgen correctie", eindTijd: "08:00" })).rejects.toThrow("op slot");
  });
  it("verwerpt bewerking van andermans ingediende notitie", async () => {
    const id = db.insertSync("urenSegmenten", { orgId: org, medewerkerId: "medewerkers:ander", datum, ...entry, status: "ingediend" });
    await expect(run(updateSegment, { id, notitie: "Nee" })).rejects.toThrow("eigen segmenten");
  });
  it("kantoorcorrectie maakt kwijting ongeldig, notitie alleen niet", async () => {
    expect(bepaalKwijting([{ actie: "dag_akkoord", createdAt: 10 }, { actie: "segment_gecorrigeerd", createdAt: 11 }]).gekweten).toBe(false);
    expect(bepaalKwijting([{ actie: "dag_akkoord", createdAt: 10 }, { actie: "notitie_gewijzigd", createdAt: 11 }]).gekweten).toBe(true);
    expect(bepaalKwijting([{ actie: "segment_gecorrigeerd", createdAt: 11 }, { actie: "dag_akkoord", createdAt: 12 }]).gekweten).toBe(true);
    expect(bepaalKwijting([{ actie: "dag_akkoord", createdAt: 10 }, { actie: "segment_gecorrigeerd", createdAt: 10 }]).gekweten).toBe(false);
  });
  it("bewaart gestructureerde duurafwijking of expliciet overslaan", async () => {
    const values = { datum, categorie: "reistijd", beginTijd: "08:00", eindTijd: "09:16", geplandeBeginTijd: "07:00", geplandeEindTijd: "08:00" };
    await expect(run(bevestigSegment, values)).rejects.toThrow("15 minuten");
    await run(bevestigSegment, { ...values, afwijkingOvergeslagen: true });
    expect(db.rows("urenSegmenten")[0]).toMatchObject({ afwijkingMinuten: 16, afwijkingOvergeslagen: true });
  });
  it("onderscheidt duurverschil van aankomsttijd en drempel", () => {
    const plan = { beginTijd: "08:00", eindTijd: "09:00" };
    expect(duurAfwijking({ beginTijd: "09:00", eindTijd: "10:00" }, plan)).toEqual({ minuten: 0, redenNodig: false });
    expect(duurAfwijking({ beginTijd: "08:00", eindTijd: "09:15" }, plan).redenNodig).toBe(false);
    expect(duurAfwijking({ beginTijd: "08:00", eindTijd: "08:44" }, plan)).toEqual({ minuten: -16, redenNodig: true });
    expect(bronCategorieNaarSegment("loods")).toBe("loods");
    expect(bronCategorieNaarSegment("laden")).toBe("laden");
    expect(bronCategorieNaarSegment("onderhoud")).toBe("onderhoud_materiaal");
    expect(bronCategorieNaarSegment("constructor")).toBeNull();
  });
});


describe("Losse krachten zonder app-account", () => {
  const create = { naam: "Externe Tester", herkomstPlatform: "Bureau Test", sleutel: "persoon-001" };
  async function kracht() { return await run<string>(maakLosseKracht, create, "voorman"); }
  it("voorman maakt persoon zonder account eenmaal en ziet alleen eigen lijst", async () => {
    const id = await kracht();
    expect(await kracht()).toBe(id);
    expect(await run(mijnLosseKrachten, {}, "voorman")).toEqual([{ _id: id, naam: create.naam, herkomstPlatform: create.herkomstPlatform }]);
    expect(await run(mijnLosseKrachten, {}, "voorman2")).toEqual([]);
    expect(db.rows("users")).toHaveLength(4);
    expect(await run(getLosseKrachtDag, { medewerkerId: id, datum }, "voorman")).toMatchObject({ revisie: 0, status: "open", segmenten: [] });
  });
  it("gewone medewerker kan geen losse kracht aanmaken", async () => {
    await expect(run(maakLosseKracht, create)).rejects.toThrow("voorman");
  });
  it("voorman logt herhaalbaar alleen voor een eigen accountloze kracht", async () => {
    const id = await kracht();
    const args = { medewerkerId: id, datum, ...entry, sleutel: "losse-uren-001", verwachteRevisie: 0 };
    const result = await run(logUrenVoorLosseKracht, args, "voorman");
    expect(await run(logUrenVoorLosseKracht, args, "voorman")).toEqual(result);
    expect(db.rows("urenSegmenten")).toHaveLength(1);
    expect(db.rows("urenSegmenten")[0].medewerkerId).toBe(id);
    await expect(run(logUrenVoorLosseKracht, args, "voorman2")).rejects.toThrow("niet beschikbaar");
    await expect(run(logUrenVoorLosseKracht, { ...args, medewerkerId: medewerker }, "voorman")).rejects.toThrow("niet beschikbaar");
  });
  it("accountkoppeling blokkeert de beperkte route ook zonder clerkUserId op persoon", async () => {
    const id = await kracht();
    db.insertSync("users", { clerkId: "net-gekoppeld", role: "medewerker", linkedMedewerkerId: id });
    await expect(run(logUrenVoorLosseKracht, { medewerkerId: id, datum, ...entry, sleutel: "losse-uren-001", verwachteRevisie: 0 }, "voorman")).rejects.toThrow("heeft een account");
    expect(await run(mijnLosseKrachten, {}, "voorman")).toEqual([]);
  });
  it("dubbele tijd met andere sleutel en vergrendelde dag blijven geblokkeerd", async () => {
    const id = await kracht();
    const args = { medewerkerId: id, datum, ...entry, sleutel: "losse-uren-001", verwachteRevisie: 0 };
    await run(logUrenVoorLosseKracht, args, "voorman");
    await expect(run(logUrenVoorLosseKracht, { ...args, sleutel: "losse-uren-002", verwachteRevisie: 1 }, "voorman")).rejects.toThrow("overlapt");
    await run(dienDagIn, { datum, medewerkerId: id }, "directie");
    await expect(run(logUrenVoorLosseKracht, { ...args, sleutel: "losse-uren-003", verwachteRevisie: 2 }, "voorman")).rejects.toThrow("ingediend");
  });
});


describe("offline single-command receipts", () => {
  it("replays create after submit without duplicate hours and rejects changed payload", async () => {
    const args = { datum, ...entry, sleutel: "offline-create-001", verwachteRevisie: 0 };
    const id = await run(bevestigSegment, args);
    await run(dienDagIn, { datum });
    expect(await run(bevestigSegment, args)).toBe(id);
    expect(db.rows("urenSegmenten")).toHaveLength(1);
    await expect(run(bevestigSegment, { ...args, eindTijd: "07:20" })).rejects.toThrow("andere invoer");
  });
  it("replays update without duplicate audit or revision and requires revision for offline writes", async () => {
    await expect(run(bevestigSegment, { datum, ...entry, sleutel: "offline-create-001" })).rejects.toThrow("dagrevisie");
    const id = await run(bevestigSegment, { datum, ...entry });
    const args = { id, eindTijd: "07:20", sleutel: "offline-update-001", verwachteRevisie: 1 };
    await run(updateSegment, args);
    const logs = db.rows("urenLogboek").length;
    expect(await run(updateSegment, args)).toBe(id);
    expect(db.rows("urenDagen")[0].revisie).toBe(2);
    expect(db.rows("urenLogboek")).toHaveLength(logs);
    await expect(run(updateSegment, { ...args, notitie: "andere inhoud" })).rejects.toThrow("andere invoer");
  });
});


describe("selected project labour ledger and org boundaries", () => {
  it("returns visible mixed conflict then uses only explicit selected source", async () => {
    const projectId = db.insertSync("projecten", { orgId: org, naam: "Werk" });
    db.insertSync("urenRegistraties", { projectId, datum, medewerker: "Test Worker", uren: 8 });
    db.insertSync("urenSegmenten", { orgId: org, werkitemId: projectId, medewerkerId: medewerker, datum, categorie: "werken", beginTijd: "08:00", eindTijd: "10:00" });
    // Foreign linked rows cannot contaminate the selected ledger.
    db.insertSync("urenSegmenten", { orgId: foreignOrg, werkitemId: projectId, medewerkerId: other, datum, categorie: "werken", beginTijd: "10:00", eindTijd: "12:00" });
    const info = await run<{ status: string; minuten: number | null }>(getProjectUrenBron, { projectId }, "directie");
    expect(info.status).toBe("conflict"); expect(info.minuten).toBeNull();
    await expect(run(setProjectUrenBron, { projectId, bron: "segmenten" })).rejects.toThrow("Alleen kantoor");
    await run(setProjectUrenBron, { projectId, bron: "segmenten" }, "directie");
    expect(await run(getProjectUrenBron, { projectId }, "directie")).toMatchObject({ status: "ok", minuten: 120 });
    const selected = await projectUrenBron(context() as never, await db.get(projectId) as never);
    expect(selected.regels).toHaveLength(1);
    await run(setProjectUrenBron, { projectId, bron: "legacy" }, "directie");
    expect(await run(getProjectUrenBron, { projectId }, "directie")).toMatchObject({ status: "ok", minuten: 480 });
    const foreign = db.insertSync("projecten", { orgId: foreignOrg });
    await expect(run(setProjectUrenBron, { projectId: foreign, bron: "segmenten" }, "directie")).rejects.toThrow("Project niet gevonden");
  });
});


describe("project costs consume selected minutes", () => {
  it("uses stable employee rate and excludes pause/concept/foreign rows; conflict never becomes zero", async () => {
    const projectId = db.insertSync("projecten", { orgId: org, naam: "Tuin", urenBron: "segmenten" });
    await db.patch(medewerker, { uurtarief: 60 });
    db.insertSync("urenRegistraties", { orgId: org, projectId, datum, medewerker: "Test Worker", uren: 8 });
    const basis = { orgId: org, werkitemId: projectId, medewerkerId: medewerker, datum, categorie: "werken", status: "bevestigd", beginTijd: "08:00", eindTijd: "10:00" };
    const id = db.insertSync("urenSegmenten", basis);
    db.insertSync("urenSegmenten", { ...basis, categorie: "pauze" });
    db.insertSync("urenSegmenten", { ...basis, status: "concept" });
    const kosten = await run<Array<{ id: string; totaal: number; bron: string }>>(kostenLijst, { projectId }, "directie");
    expect(kosten).toHaveLength(1); expect(kosten[0]).toMatchObject({ id, totaal: 120, bron: "urenSegmenten" });
    await db.patch(projectId, { urenBron: undefined });
    await expect(run(kostenLijst, { projectId }, "directie")).rejects.toThrow("URENBRON_CONFLICT");
  });
});


it("rejects stale submitted nacalculation hours even after source selection", async () => {
  const projectId = db.insertSync("projecten", { orgId: org, naam: "Werk", urenBron: "segmenten" });
  db.insertSync("urenSegmenten", { orgId: org, werkitemId: projectId, medewerkerId: medewerker, datum, categorie: "werken", status: "bevestigd", beginTijd: "08:00", eindTijd: "10:00" });
  await expect(run(bewaarNacalculatie, { projectId, werkelijkeUren: 8, werkelijkeDagen: 1, werkelijkeMachineKosten: 0, afwijkingUren: 0, afwijkingPercentage: 0, afwijkingenPerScope: {} }, "directie")).rejects.toThrow("intussen gewijzigd");
  expect(db.rows("nacalculaties")).toHaveLength(0);
});


describe("material suggestions and historical planning", () => {
  it("accepts suggestion once, preserves manual need after changed instructions, records checks without stock writes", async () => {
    const werkitemId = db.insertSync("projecten", { orgId: org, naam: "Gras maaien" });
    const args = { werkitemId, datum };
    const voor = await run<{ suggesties: {naam:string}[] }>(getDeltaChecklist, args, "directie");
    expect(voor.suggesties.map(s => s.naam)).toContain("Grasmaaier");
    const id = await run(voegBenodigdheidToe, { ...args, naam: "Grasmaaier", soort: "machine", bron: "suggestie" }, "directie");
    expect(await run(voegBenodigdheidToe, { ...args, naam: "Grasmaaier", soort: "machine", bron: "suggestie" }, "directie")).toBe(id);
    await run(voegBenodigdheidToe, { ...args, naam: "Veiligheidsbril", soort: "materiaal", bron: "handmatig" }, "directie");
    await db.patch(werkitemId, { naam: "Snoeien" });
    await run(vinkAf, { ...args, item: "Veiligheidsbril" }, "directie");
    const na = await run<{ delta: {naam:string;afgevinkt:boolean}[] }>(getDeltaChecklist, args, "directie");
    expect(na.delta).toEqual(expect.arrayContaining([expect.objectContaining({ naam: "Veiligheidsbril", afgevinkt: true })]));
    expect(db.rows("voorraadMutaties")).toHaveLength(0);
    await expect(run(getDeltaChecklist, args)).rejects.toThrow("niet toegewezen");
    await run(verwijderBenodigdheid, { id, datum }, "directie");
    expect(db.rows("materiaalChecks")).toHaveLength(1);
  });
  it("derives work subtype from plan and preserves saved subtype on a later time correction", async () => {
    const werkitemId = db.insertSync("projecten", { orgId: org, naam: "Tuin", uitvoeringCategorie: "aanleg" });
    const id = await run<string>(bevestigSegment, { datum, categorie: "werken", beginTijd: "08:00", eindTijd: "10:00", werkitemId });
    expect((await db.get(id))?.werksoort).toBe("Tuinaanleg");
    await db.patch(werkitemId, { uitvoeringCategorie: "onderhoud" });
    await run(updateSegment, { id, eindTijd: "10:15" });
    expect((await db.get(id))?.werksoort).toBe("Tuinaanleg");
    await expect(run(bevestigSegment, { datum, categorie: "anders", beginTijd: "12:00", eindTijd: "12:15", werksoort: "Vrije tekst" })).rejects.toThrow("geldige activiteit");
  });
  it("validates combined planning patch before writes and archives executed jobs instead of erasing history", async () => {
    const id = db.insertSync("projecten", { orgId: org, naam: "Tuin", geplandeStart: "2026-09-12", geplandeEind: "2026-09-14" });
    await expect(run(updatePlanning, { id, geplandeEind: "2026-09-10" }, "directie")).rejects.toThrow("vóór");
    expect((await db.get(id))?.geplandeEind).toBe("2026-09-14");
    db.insertSync("urenSegmenten", { orgId: org, werkitemId: id, medewerkerId: medewerker, datum, categorie: "werken", beginTijd: "08:00", eindTijd: "09:00", status: "bevestigd" });
    await run(verwijderProject, { id }, "directie");
    expect(await db.get(id)).toMatchObject({ isArchived: true, deletedAt: undefined });
    await expect(run(permanentlyDelete, { id }, "directie")).rejects.toThrow("uitvoeringshistorie");
    expect(db.rows("urenSegmenten")).toHaveLength(1);
  });
  it("personal export never returns another worker and office yearly scan requires monthly reads", async () => {
    const otherOwn = db.insertSync("medewerkers", { orgId: org, naam: "Other private" });
    await run(bevestigSegment, { datum, ...entry });
    db.insertSync("urenSegmenten", { orgId: org, medewerkerId: otherOwn, datum, ...entry, status: "bevestigd", notitie: "private-other" });
    const rapport = await run<{registraties:{medewerkerId:string;notitie:string|null}[]}>(getPeriode, { van: datum, tot: datum, bereik: "eigen" });
    expect(rapport.registraties).toHaveLength(1); expect(rapport.registraties[0].medewerkerId).toBe(medewerker);
    expect(JSON.stringify(rapport)).not.toContain("private-other");
    await expect(run(getPeriode, { van: "2026-01-01", tot: "2026-12-31", bereik: "organisatie" }, "directie")).rejects.toThrow("maanddelen");
  });
});
