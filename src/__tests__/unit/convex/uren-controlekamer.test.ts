/**
 * Unit tests Controlekamer-backend (`convex/urenControle.ts`) plus de
 * opruimronde in `convex/urenRegistraties.ts`.
 * Plan: docs/design/plannen/uren-controlekamer-plan.md §2 (datacontract) en §3
 * (WS-A, opruimronde).
 *
 * Dekt:
 * - de drie vraagblokken van `getControleWeek` (achter / afwijkend / stil) plus
 *   de totalen, met de weekgrens maandag t/m zondag;
 * - tenant-scope: organisatie A ziet nooit een dag, ploeg of medewerker van B
 *   — voor élke nieuwe query; sinds fase 3 loopt die scope over `orgId` uit het
 *   Clerk-JWT (`org_id`-claim), niet meer over de bedrijfseigenaar-user;
 * - rolgezichten: kantoor krijgt de Controlekamer en de film, de voorman de
 *   ploegdag, de medewerker zijn eigen week, en niemand het gezicht van een
 *   ander;
 * - kwijting: "akkoord" is een logboek-entry, idempotent, en een heropening zet
 *   de dag terug in de wachtrij;
 * - de rolmodel-gelijktrekking: een projectleider ziet in `listGlobal` en
 *   `getGlobalStats` bedrijfsbreed, net als in `export.exportUren`.
 *
 * Zoals in weekplanning-tenant-scope.test.ts een eigen nep-db die de
 * index-constraints wél toepast: de gedeelde mock in helpers/convex-mock.ts
 * negeert `withIndex`, en juist de scoping ván die index is wat hier getest
 * wordt.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ConvexError } from "convex/values";
import {
  getControleWeek,
  getDagFilm,
  getMijnWeek,
  getPloegDag,
  keurDagGoed,
  keurWeekGoed,
  type ControleWeek,
  type DagFilm,
  type MijnWeek,
  type PloegDag,
} from "../../../../convex/urenControle";
import {
  getGlobalStats,
  list as listPerProject,
  listGlobal,
} from "../../../../convex/urenRegistraties";

// ─── Nep-Convex-database die indexen respecteert ─────────────────────────────

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

interface FakeCtx {
  db: FakeDb;
  auth: {
    getUserIdentity: () => Promise<{
      subject: string;
      org_id?: string;
    } | null>;
  };
}

type Handler<TArgs, TResult> = (ctx: FakeCtx, args: TArgs) => Promise<TResult>;

function handlerVan<TArgs, TResult>(fn: unknown): Handler<TArgs, TResult> {
  return (fn as { _handler: Handler<TArgs, TResult> })._handler;
}

const controleWeek = handlerVan<{ weekStart?: string }, ControleWeek>(
  getControleWeek
);
const dagFilm = handlerVan<{ datum: string }, DagFilm>(getDagFilm);
const mijnWeek = handlerVan<{ weekStart?: string }, MijnWeek | null>(getMijnWeek);
const ploegDag = handlerVan<{ datum?: string }, PloegDag | null>(getPloegDag);
const dagGoed = handlerVan<
  { medewerkerId: string; datum: string },
  { gekweten: boolean; alAkkoord: boolean }
>(keurDagGoed);
const weekGoed = handlerVan<{ weekStart?: string }, { gekweten: number }>(
  keurWeekGoed
);
const urenLijst = handlerVan<
  { startDate?: string; endDate?: string },
  Array<{ medewerker: string; uren: number }>
>(listGlobal);
const urenStats = handlerVan<
  { startDate?: string; endDate?: string },
  {
    urenTotaal: number;
    aantalRegistraties: number;
    perMedewerker: Array<{ naam: string; uren: number }>;
  }
>(getGlobalStats);
const urenPerProject = handlerVan<
  { projectId: string },
  Array<{ medewerker: string; uren: number }>
>(listPerProject);

// ─── Testdata: twee bedrijven, week 33 van 2026 (ma 10 t/m zo 16 aug) ───────

const WEEK_START = "2026-08-10"; // maandag
const MAANDAG = "2026-08-10";
const DINSDAG = "2026-08-11";
const WOENSDAG = "2026-08-12";
/** Vrijdag 14 augustus 2026, 10:00 Nederlandse tijd = "vandaag" in de tests. */
const NU = Date.parse("2026-08-14T08:00:00Z");

/** Clerk-organisaties: het `org_id`-claim dat requireOrg uit het JWT leest. */
const CLERK_ORG_A = "clerk_org_a";
const CLERK_ORG_B = "clerk_org_b";

const CLERK_DIRECTIE_A = "clerk_directie_a";
const CLERK_PROJECTLEIDER_A = "clerk_pl_a";
const CLERK_VOORMAN_A = "clerk_voorman_a";
const CLERK_MEDEWERKER_A = "clerk_medewerker_a";
const CLERK_DIRECTIE_B = "clerk_directie_b";

/** Welke gebruiker in welke organisatie zit — de claim-tabel van Clerk. */
const ORG_VAN_CLERK: Record<string, string> = {
  [CLERK_DIRECTIE_A]: CLERK_ORG_A,
  [CLERK_PROJECTLEIDER_A]: CLERK_ORG_A,
  [CLERK_VOORMAN_A]: CLERK_ORG_A,
  [CLERK_MEDEWERKER_A]: CLERK_ORG_A,
  [CLERK_DIRECTIE_B]: CLERK_ORG_B,
};

let db: FakeDb;
let ids: {
  orgA: string;
  orgB: string;
  userA: string;
  userB: string;
  anna: string;
  bram: string;
  zoe: string;
  teamGroen: string;
  teamBlauw: string;
  projectA: string;
  projectB: string;
};

function ctxVoor(clerkId: string): FakeCtx {
  return {
    db,
    auth: {
      getUserIdentity: async () => ({
        subject: clerkId,
        org_id: ORG_VAN_CLERK[clerkId],
      }),
    },
  };
}

/** Normale dag: 07:00–16:00 met pauze — 8,5 u werkende tijd, 1 u indirect. */
function normaleDagSegmenten(
  orgId: string,
  userId: string,
  medewerkerId: string,
  datum: string,
  werkitemId: string
): Array<Record<string, unknown>> {
  const basis = {
    orgId,
    userId,
    medewerkerId,
    datum,
    status: "ingediend" as const,
  };
  return [
    { ...basis, categorie: "reistijd", beginTijd: "07:00", eindTijd: "07:30", bron: "voorstel" },
    { ...basis, categorie: "werken", beginTijd: "07:30", eindTijd: "12:00", bron: "voorstel", werkitemId },
    { ...basis, categorie: "pauze", beginTijd: "12:00", eindTijd: "12:30", bron: "voorstel" },
    { ...basis, categorie: "werken", beginTijd: "12:30", eindTijd: "15:30", bron: "voorstel", werkitemId },
    { ...basis, categorie: "reistijd", beginTijd: "15:30", eindTijd: "16:00", bron: "voorstel" },
  ];
}

function seedSegmenten(rijen: Array<Record<string, unknown>>): void {
  const now = NU;
  for (const rij of rijen) {
    db.insertSync("urenSegmenten", { ...rij, createdAt: now, updatedAt: now });
  }
}

function seedDag(
  orgId: string,
  userId: string,
  medewerkerId: string,
  datum: string,
  status: "open" | "ingediend"
): string {
  return db.insertSync("urenDagen", {
    orgId,
    userId,
    medewerkerId,
    datum,
    status,
    ingediendOp: status === "ingediend" ? NU : undefined,
    createdAt: NU,
    updatedAt: NU,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NU);
  db = new FakeDb();

  // De twee organisaties waar requireOrg via het org_id-claim op uitkomt.
  const orgA = db.insertSync("organisaties", {
    clerkOrgId: CLERK_ORG_A,
    naam: "Top Tuinen",
    actief: true,
    aangemaaktOp: NU,
  });
  const orgB = db.insertSync("organisaties", {
    clerkOrgId: CLERK_ORG_B,
    naam: "Ander bedrijf",
    actief: true,
    aangemaaktOp: NU,
  });

  const userA = db.insertSync("users", {
    clerkId: CLERK_DIRECTIE_A,
    email: "yannick@toptuinen.nl",
    name: "Yannick",
    role: "directie",
    createdAt: NU,
  });
  const userB = db.insertSync("users", {
    clerkId: CLERK_DIRECTIE_B,
    email: "ander@bedrijf.nl",
    name: "Ander bedrijf",
    role: "directie",
    createdAt: NU,
  });

  const anna = db.insertSync("medewerkers", {
    orgId: orgA,
    userId: userA,
    naam: "Anna Bakker",
    functie: "hovenier",
    isActief: true,
    createdAt: NU,
    updatedAt: NU,
  });
  const bram = db.insertSync("medewerkers", {
    orgId: orgA,
    userId: userA,
    naam: "Bram de Jong",
    functie: "voorman",
    isActief: true,
    createdAt: NU,
    updatedAt: NU,
  });
  const zoe = db.insertSync("medewerkers", {
    orgId: orgB,
    userId: userB,
    naam: "Zoë Vermeer",
    functie: "hovenier",
    isActief: true,
    createdAt: NU,
    updatedAt: NU,
  });

  // Kantoor-rol met medewerker-koppeling (projectleider) en de veldrollen
  db.insertSync("users", {
    clerkId: CLERK_PROJECTLEIDER_A,
    email: "mickey@toptuinen.nl",
    name: "Mickey",
    role: "projectleider",
    linkedMedewerkerId: bram,
    createdAt: NU,
  });
  db.insertSync("users", {
    clerkId: CLERK_VOORMAN_A,
    email: "bram@toptuinen.nl",
    name: "Bram de Jong",
    role: "voorman",
    linkedMedewerkerId: bram,
    createdAt: NU,
  });
  db.insertSync("users", {
    clerkId: CLERK_MEDEWERKER_A,
    email: "anna@toptuinen.nl",
    name: "Anna Bakker",
    role: "medewerker",
    linkedMedewerkerId: anna,
    createdAt: NU,
  });

  const teamGroen = db.insertSync("teams", {
    orgId: orgA,
    userId: userA,
    naam: "Groen",
    leden: [anna, bram],
    isActief: true,
    createdAt: NU,
    updatedAt: NU,
  });
  const teamBlauw = db.insertSync("teams", {
    orgId: orgB,
    userId: userB,
    naam: "Blauw",
    leden: [zoe],
    isActief: true,
    createdAt: NU,
    updatedAt: NU,
  });

  // Eén geplande werkitem-dag per bedrijf: maandag. Daardoor is maandag de
  // enige dag die "achter" kan zijn.
  const projectA = db.insertSync("projecten", {
    orgId: orgA,
    userId: userA,
    naam: "Tuin Dohmen",
    status: "gepland",
    teamId: teamGroen,
    geplandeStart: MAANDAG,
    geplandeEind: MAANDAG,
    createdAt: NU,
    updatedAt: NU,
  });
  const projectB = db.insertSync("projecten", {
    orgId: orgB,
    userId: userB,
    naam: "Tuin van der Berg",
    status: "gepland",
    teamId: teamBlauw,
    geplandeStart: MAANDAG,
    geplandeEind: MAANDAG,
    createdAt: NU,
    updatedAt: NU,
  });

  ids = {
    orgA,
    orgB,
    userA,
    userB,
    anna,
    bram,
    zoe,
    teamGroen,
    teamBlauw,
    projectA,
    projectB,
  };

  // Anna: dinsdag netjes ingediend (stil), woensdag een lange dag zonder pauze
  seedSegmenten(normaleDagSegmenten(orgA, userA, anna, DINSDAG, projectA));
  seedDag(orgA, userA, anna, DINSDAG, "ingediend");
  seedSegmenten([
    {
      orgId: orgA,
      userId: userA,
      medewerkerId: anna,
      datum: WOENSDAG,
      categorie: "werken",
      beginTijd: "06:00",
      eindTijd: "16:00",
      status: "ingediend",
      bron: "handmatig",
      werkitemId: projectA,
    },
  ]);
  seedDag(orgA, userA, anna, WOENSDAG, "ingediend");

  // Bedrijf B: exact dezelfde dagen voor Zoë — mag nooit bij A opduiken
  seedSegmenten(normaleDagSegmenten(orgB, userB, zoe, DINSDAG, projectB));
  seedDag(orgB, userB, zoe, DINSDAG, "ingediend");
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── getControleWeek: de drie vraagblokken ──────────────────────────────────

describe("getControleWeek — de drie vraagblokken", () => {
  it("verdeelt de week in achter / afwijkend / stil met Nederlands weeklabel", async () => {
    const week = await controleWeek(ctxVoor(CLERK_DIRECTIE_A), {
      weekStart: WEEK_START,
    });

    expect(week.weekStart).toBe(WEEK_START);
    expect(week.weekLabel).toBe("Week 33 · 10 t/m 16 augustus");

    // Stil: dinsdag van Anna — ingediend, geen reden, niet gekweten
    expect(week.stil).toHaveLength(1);
    expect(week.stil[0]).toMatchObject({
      naam: "Anna Bakker",
      datum: DINSDAG,
      status: "ingediend",
      totaalUren: 8.5,
    });
    expect(week.stil[0].segmenten).toHaveLength(5);
    // Label uit het werkitem, zodat de UI de klus kan noemen
    expect(week.stil[0].segmenten[1]).toMatchObject({
      categorie: "werken",
      label: "Tuin Dohmen",
    });

    // Afwijkend: woensdag — 10 uur aan één stuk, handmatig getypt
    expect(week.afwijkend).toHaveLength(1);
    expect(week.afwijkend[0].datum).toBe(WOENSDAG);
    expect(week.afwijkend[0].redenen.map((r) => r.type)).toEqual([
      "lange_dag",
      "geen_pauze",
    ]);

    // Achter: maandag was ingepland, niemand heeft ingediend
    expect(week.achter.map((a) => a.naam)).toEqual([
      "Anna Bakker",
      "Bram de Jong",
    ]);
    expect(week.achter[0].ontbrekendeDagen).toEqual([MAANDAG]);
    expect(week.achter[0].ploegLabel).toBe("Groen");

    expect(week.gekweten).toBe(0);
    expect(week.totalen).toEqual({
      uren: 18.5, // 8,5 (di) + 10 (wo)
      indirect: 1, // 2 × 30 min reistijd op dinsdag
      ingediend: 2,
      open: 2, // Anna en Bram op maandag
    });
  });

  it("laat vandaag en de toekomst buiten 'achter' (de dag is nog niet om)", async () => {
    // Extra werkitem-dag op vrijdag (= vandaag) en zaterdag
    db.insertSync("projecten", {
      orgId: ids.orgA,
      userId: ids.userA,
      naam: "Tuin Later",
      status: "gepland",
      teamId: ids.teamGroen,
      geplandeStart: "2026-08-14",
      geplandeEind: "2026-08-15",
      createdAt: NU,
      updatedAt: NU,
    });

    const week = await controleWeek(ctxVoor(CLERK_DIRECTIE_A), {
      weekStart: WEEK_START,
    });
    for (const regel of week.achter) {
      expect(regel.ontbrekendeDagen).toEqual([MAANDAG]);
    }
  });

  it("gebruikt de huidige week als weekStart ontbreekt", async () => {
    const week = await controleWeek(ctxVoor(CLERK_DIRECTIE_A), {});
    expect(week.weekStart).toBe(WEEK_START);
  });

  it("weigert een weekStart die geen maandag is", async () => {
    await expect(
      controleWeek(ctxVoor(CLERK_DIRECTIE_A), { weekStart: DINSDAG })
    ).rejects.toThrow(ConvexError);
    await expect(
      controleWeek(ctxVoor(CLERK_DIRECTIE_A), { weekStart: "10-08-2026" })
    ).rejects.toThrow(ConvexError);
  });
});

// ─── Tenant-scope ───────────────────────────────────────────────────────────

describe("tenant-scope van de nieuwe queries", () => {
  it("getControleWeek van bedrijf A bevat geen enkele dag van bedrijf B", async () => {
    const week = await controleWeek(ctxVoor(CLERK_DIRECTIE_A), {
      weekStart: WEEK_START,
    });
    const namen = [
      ...week.stil.map((d) => d.naam),
      ...week.afwijkend.map((d) => d.naam),
      ...week.achter.map((a) => a.naam),
    ];
    expect(namen).not.toContain("Zoë Vermeer");
    expect(namen.every((n) => n !== "Zoë Vermeer")).toBe(true);
  });

  it("bedrijf B ziet uitsluitend zijn eigen week", async () => {
    const week = await controleWeek(ctxVoor(CLERK_DIRECTIE_B), {
      weekStart: WEEK_START,
    });
    expect(week.stil.map((d) => d.naam)).toEqual(["Zoë Vermeer"]);
    expect(week.afwijkend).toHaveLength(0);
    expect(week.achter.map((a) => a.naam)).toEqual(["Zoë Vermeer"]);
    expect(week.totalen.uren).toBe(8.5);
  });

  it("getDagFilm toont alleen de ploegen en mensen van het eigen bedrijf", async () => {
    const filmA = await dagFilm(ctxVoor(CLERK_DIRECTIE_A), { datum: DINSDAG });
    expect(filmA.ploegen.map((p) => p.naam)).toEqual(["Groen"]);
    expect(filmA.ploegen[0].leden.map((l) => l.naam)).toEqual([
      "Anna Bakker",
      "Bram de Jong",
    ]);
    expect(filmA.los).toHaveLength(0);
    expect(JSON.stringify(filmA)).not.toContain("Zoë");

    const filmB = await dagFilm(ctxVoor(CLERK_DIRECTIE_B), { datum: DINSDAG });
    expect(filmB.ploegen.map((p) => p.naam)).toEqual(["Blauw"]);
    expect(JSON.stringify(filmB)).not.toContain("Anna");
  });

  it("keurDagGoed weigert een medewerker van een ander bedrijf", async () => {
    await expect(
      dagGoed(ctxVoor(CLERK_DIRECTIE_A), {
        medewerkerId: ids.zoe,
        datum: DINSDAG,
      })
    ).rejects.toThrow(/Medewerker niet gevonden/);
    expect(db.rows("urenLogboek")).toHaveLength(0);
  });

  it("getMijnWeek geeft alleen de eigen dagen, niet die van een ploeggenoot", async () => {
    const week = await mijnWeek(ctxVoor(CLERK_MEDEWERKER_A), {
      weekStart: WEEK_START,
    });
    expect(week).not.toBeNull();
    expect(week!.medewerker.naam).toBe("Anna Bakker");
    expect(week!.dagen.every((d) => d.naam === "Anna Bakker")).toBe(true);
  });
});

// ─── Rolgezichten ───────────────────────────────────────────────────────────

describe("rolgezichten op één route", () => {
  it("de Controlekamer en de film zijn kantoorwerk (directie én projectleider)", async () => {
    await expect(
      controleWeek(ctxVoor(CLERK_PROJECTLEIDER_A), { weekStart: WEEK_START })
    ).resolves.toMatchObject({ weekStart: WEEK_START });

    for (const clerk of [CLERK_VOORMAN_A, CLERK_MEDEWERKER_A]) {
      await expect(
        controleWeek(ctxVoor(clerk), { weekStart: WEEK_START })
      ).rejects.toThrow(/alleen voor kantoor/);
      await expect(dagFilm(ctxVoor(clerk), { datum: DINSDAG })).rejects.toThrow(
        /alleen voor kantoor/
      );
    }
  });

  it("de ploegdag is voor de voorman (en kantoor), niet voor een medewerker", async () => {
    const dag = await ploegDag(ctxVoor(CLERK_VOORMAN_A), { datum: DINSDAG });
    expect(dag).not.toBeNull();
    expect(dag!.ploeg.naam).toBe("Groen");
    expect(dag!.ploeg.voermanNaam).toBe("Bram de Jong");
    expect(dag!.leden.map((l) => l.naam)).toEqual([
      "Anna Bakker",
      "Bram de Jong",
    ]);
    // Anna heeft ingediend, Bram niet
    expect(dag!.leden.find((l) => l.naam === "Anna Bakker")!.status).toBe(
      "ingediend"
    );
    expect(dag!.totaalZin).toMatchObject({ uren: 8.5, nietIngediend: 1 });
    // Eigen dag is gemarkeerd voor de voorman
    expect(dag!.leden.find((l) => l.isEigenDag)!.naam).toBe("Bram de Jong");

    await expect(
      ploegDag(ctxVoor(CLERK_MEDEWERKER_A), { datum: DINSDAG })
    ).rejects.toThrow(/voorman en kantoor/);
  });

  it("kantoor zonder medewerker-koppeling krijgt null i.p.v. een fout", async () => {
    // Directie A heeft geen linkedMedewerkerId: geen "mijn week", geen ploeg
    await expect(
      mijnWeek(ctxVoor(CLERK_DIRECTIE_A), { weekStart: WEEK_START })
    ).resolves.toBeNull();
    await expect(
      ploegDag(ctxVoor(CLERK_DIRECTIE_A), { datum: DINSDAG })
    ).resolves.toBeNull();
  });

  it("getMijnWeek geeft zeven dagen, maandag t/m zondag, met status per dag", async () => {
    const week = (await mijnWeek(ctxVoor(CLERK_MEDEWERKER_A), {
      weekStart: WEEK_START,
    }))!;
    expect(week.weekLabel).toBe("Week 33 · 10 t/m 16 augustus");
    expect(week.dagen).toHaveLength(7);
    expect(week.dagen.map((d) => d.datum)).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
      "2026-08-16",
    ]);
    expect(week.dagen[0]).toMatchObject({ status: "open", totaalUren: 0 });
    expect(week.dagen[1]).toMatchObject({ status: "ingediend", totaalUren: 8.5 });
  });

  it("getMijnWeek toont kantoorcorrecties en akkoorden uit het logboek", async () => {
    db.insertSync("urenLogboek", {
      orgId: ids.orgA,
      userId: ids.userA,
      medewerkerId: ids.anna,
      datum: DINSDAG,
      actie: "segment_gecorrigeerd",
      details: "Segment gecorrigeerd: werken 07:30–11:30",
      door: ids.userA,
      createdAt: NU,
    });
    db.insertSync("urenLogboek", {
      orgId: ids.orgA,
      userId: ids.userA,
      medewerkerId: ids.anna,
      datum: DINSDAG,
      actie: "dag_ingediend",
      details: "Dag ingediend",
      door: ids.userA,
      createdAt: NU - 1000,
    });

    const week = (await mijnWeek(ctxVoor(CLERK_MEDEWERKER_A), {
      weekStart: WEEK_START,
    }))!;
    // "dag_ingediend" is geen correctie: dat deed hij zelf
    expect(week.correcties.map((c) => c.actie)).toEqual(["segment_gecorrigeerd"]);
    expect(week.correcties[0].datum).toBe(DINSDAG);
  });
});

// ─── Ploegenfilm ────────────────────────────────────────────────────────────

describe("getDagFilm — filmstrip en dagtotaal", () => {
  it("geeft een strip van tien werkdagen met daglabel in het Nederlands", async () => {
    const film = await dagFilm(ctxVoor(CLERK_DIRECTIE_A), { datum: DINSDAG });
    expect(film.dagLabel).toBe("dinsdag 11 augustus 2026");
    expect(film.strip).toHaveLength(10);
    expect(film.strip.at(-1)!.datum).toBe(DINSDAG);
    expect(film.strip.map((d) => d.datum)).not.toContain("2026-08-08"); // zaterdag
    expect(film.strip.at(-1)!.kortLabel).toBe("di 11 aug");
  });

  it("markeert een dag met een afwijking als afwijkend en een lege dag als open", async () => {
    const film = await dagFilm(ctxVoor(CLERK_DIRECTIE_A), { datum: WOENSDAG });
    const woensdag = film.strip.find((d) => d.datum === WOENSDAG)!;
    expect(woensdag.status).toBe("afwijkend");
    // Maandag: niemand heeft iets → geen ingediende dagen, dus geen werk aan
    const maandag = film.strip.find((d) => d.datum === MAANDAG)!;
    expect(maandag.status).toBe("compleet");
  });

  it("telt het dagtotaal en wie er nog niet heeft ingediend", async () => {
    const film = await dagFilm(ctxVoor(CLERK_DIRECTIE_A), { datum: DINSDAG });
    expect(film.totaalZin).toEqual({ uren: 8.5, indirect: 1, nietIngediend: 1 });
  });

  it("plaatst een medewerker zonder ploeg in 'los'", async () => {
    const cor = db.insertSync("medewerkers", {
      orgId: ids.orgA,
      userId: ids.userA,
      naam: "Cor Losser",
      functie: "zzp",
      isActief: true,
      createdAt: NU,
      updatedAt: NU,
    });
    seedSegmenten([
      {
        orgId: ids.orgA,
        userId: ids.userA,
        medewerkerId: cor,
        datum: DINSDAG,
        categorie: "werken",
        beginTijd: "08:00",
        eindTijd: "12:00",
        status: "ingediend",
        bron: "handmatig",
        werkitemId: ids.projectA,
      },
    ]);
    seedDag(ids.orgA, ids.userA, cor, DINSDAG, "ingediend");

    const film = await dagFilm(ctxVoor(CLERK_DIRECTIE_A), { datum: DINSDAG });
    expect(film.los.map((d) => d.naam)).toEqual(["Cor Losser"]);
    expect(film.ploegen[0].leden.map((l) => l.naam)).not.toContain("Cor Losser");
  });

  it("gebruikt de bemanning van die dag boven de vaste teamleden", async () => {
    db.insertSync("teamBemanning", {
      orgId: ids.orgA,
      userId: ids.userA,
      teamId: ids.teamGroen,
      datum: DINSDAG,
      medewerkerIds: [ids.anna],
      createdAt: NU,
      updatedAt: NU,
    });
    const film = await dagFilm(ctxVoor(CLERK_DIRECTIE_A), { datum: DINSDAG });
    expect(film.ploegen[0].leden.map((l) => l.naam)).toEqual(["Anna Bakker"]);
  });
});

// ─── Kwijting ───────────────────────────────────────────────────────────────

describe("kwijting — akkoord als logboek-entry, idempotent", () => {
  it("keurt één dag goed en haalt hem uit 'stil'", async () => {
    const uitkomst = await dagGoed(ctxVoor(CLERK_DIRECTIE_A), {
      medewerkerId: ids.anna,
      datum: DINSDAG,
    });
    expect(uitkomst).toEqual({ gekweten: true, alAkkoord: false });

    const logboek = db.rows("urenLogboek");
    expect(logboek).toHaveLength(1);
    expect(logboek[0]).toMatchObject({
      orgId: ids.orgA,
      medewerkerId: ids.anna,
      datum: DINSDAG,
      actie: "dag_akkoord",
    });
    expect(logboek[0].details).toContain("Anna Bakker");

    const week = await controleWeek(ctxVoor(CLERK_DIRECTIE_A), {
      weekStart: WEEK_START,
    });
    expect(week.stil).toHaveLength(0);
    expect(week.gekweten).toBe(1);
    // De afwijkende dag blijft staan: die vraagt nog een blik
    expect(week.afwijkend).toHaveLength(1);
  });

  it("is idempotent: tweemaal akkoord levert één logboek-entry", async () => {
    await dagGoed(ctxVoor(CLERK_DIRECTIE_A), {
      medewerkerId: ids.anna,
      datum: DINSDAG,
    });
    const tweede = await dagGoed(ctxVoor(CLERK_DIRECTIE_A), {
      medewerkerId: ids.anna,
      datum: DINSDAG,
    });
    expect(tweede).toEqual({ gekweten: false, alAkkoord: true });
    expect(db.rows("urenLogboek")).toHaveLength(1);
  });

  it("een heropening ná het akkoord zet de dag terug in de wachtrij", async () => {
    await dagGoed(ctxVoor(CLERK_DIRECTIE_A), {
      medewerkerId: ids.anna,
      datum: DINSDAG,
    });
    db.insertSync("urenLogboek", {
      orgId: ids.orgA,
      userId: ids.userA,
      medewerkerId: ids.anna,
      datum: DINSDAG,
      actie: "dag_heropend",
      details: "Dag heropend door kantoor",
      door: ids.userA,
      createdAt: NU + 1000,
    });
    // De dag staat weer open (heropenDag zet urenDagen op "open"), dus hij
    // hoort in 'achter' en niet meer bij de gekweten dagen.
    await db.patch(
      db.rows("urenDagen").find(
        (r) => r.medewerkerId === ids.anna && r.datum === DINSDAG
      )!._id,
      { status: "open" }
    );

    const week = await controleWeek(ctxVoor(CLERK_DIRECTIE_A), {
      weekStart: WEEK_START,
    });
    expect(week.gekweten).toBe(0);
    expect(week.stil).toHaveLength(0);
    const anna = week.achter.find((a) => a.naam === "Anna Bakker")!;
    expect(anna.ontbrekendeDagen).toContain(DINSDAG);
  });

  it("een heropende én opnieuw ingediende dag komt terug als afwijking 'heropend'", async () => {
    db.insertSync("urenLogboek", {
      orgId: ids.orgA,
      userId: ids.userA,
      medewerkerId: ids.anna,
      datum: DINSDAG,
      actie: "dag_heropend",
      details: "Dag heropend door kantoor",
      door: ids.userA,
      createdAt: NU,
    });
    const week = await controleWeek(ctxVoor(CLERK_DIRECTIE_A), {
      weekStart: WEEK_START,
    });
    const dinsdag = week.afwijkend.find((d) => d.datum === DINSDAG)!;
    expect(dinsdag.redenen.map((r) => r.type)).toEqual(["heropend"]);
    expect(week.stil).toHaveLength(0);
  });

  it("weigert akkoord op een dag die niet is ingediend", async () => {
    await expect(
      dagGoed(ctxVoor(CLERK_DIRECTIE_A), {
        medewerkerId: ids.anna,
        datum: MAANDAG,
      })
    ).rejects.toThrow(/ingediende dag/);
    expect(db.rows("urenLogboek")).toHaveLength(0);
  });

  it("kwijting is kantoorwerk: voorman en medewerker mogen niet", async () => {
    for (const clerk of [CLERK_VOORMAN_A, CLERK_MEDEWERKER_A]) {
      await expect(
        dagGoed(ctxVoor(clerk), { medewerkerId: ids.anna, datum: DINSDAG })
      ).rejects.toThrow(/alleen voor kantoor/);
      await expect(
        weekGoed(ctxVoor(clerk), { weekStart: WEEK_START })
      ).rejects.toThrow(/alleen voor kantoor/);
    }
    expect(db.rows("urenLogboek")).toHaveLength(0);
  });

  it("keurWeekGoed kweit alleen de stille dagen en is idempotent", async () => {
    const eerste = await weekGoed(ctxVoor(CLERK_DIRECTIE_A), {
      weekStart: WEEK_START,
    });
    expect(eerste).toEqual({ gekweten: 1 }); // alleen dinsdag, niet woensdag
    expect(db.rows("urenLogboek")).toHaveLength(1);

    const tweede = await weekGoed(ctxVoor(CLERK_DIRECTIE_A), {
      weekStart: WEEK_START,
    });
    expect(tweede).toEqual({ gekweten: 0 });
    expect(db.rows("urenLogboek")).toHaveLength(1);

    const week = await controleWeek(ctxVoor(CLERK_DIRECTIE_A), {
      weekStart: WEEK_START,
    });
    expect(week.stil).toHaveLength(0);
    expect(week.afwijkend).toHaveLength(1);
    expect(week.gekweten).toBe(1);
  });

  it("keurWeekGoed van bedrijf A raakt de dagen van bedrijf B niet", async () => {
    await weekGoed(ctxVoor(CLERK_DIRECTIE_A), { weekStart: WEEK_START });
    const logboek = db.rows("urenLogboek");
    expect(logboek.every((r) => r.orgId === ids.orgA)).toBe(true);
    expect(logboek.every((r) => r.medewerkerId !== ids.zoe)).toBe(true);

    // Bedrijf B ziet zijn stille dag nog gewoon staan
    const weekB = await controleWeek(ctxVoor(CLERK_DIRECTIE_B), {
      weekStart: WEEK_START,
    });
    expect(weekB.stil).toHaveLength(1);
    expect(weekB.gekweten).toBe(0);
  });
});

// ─── Opruimronde: rolmodel van de oude engine ───────────────────────────────

describe("rolmodel oude engine — projectleider ziet bedrijfsbreed", () => {
  beforeEach(() => {
    for (const rij of [
      { medewerker: "Anna Bakker", uren: 4, datum: DINSDAG },
      { medewerker: "Bram de Jong", uren: 6, datum: WOENSDAG },
    ]) {
      db.insertSync("urenRegistraties", {
        orgId: ids.orgA,
        userId: ids.userA,
        projectId: ids.projectA,
        datum: rij.datum,
        medewerker: rij.medewerker,
        uren: rij.uren,
        bron: "handmatig",
      });
    }
    // Bedrijf B heeft ook uren op dezelfde dag
    db.insertSync("urenRegistraties", {
      orgId: ids.orgB,
      userId: ids.userB,
      projectId: ids.projectB,
      datum: DINSDAG,
      medewerker: "Zoë Vermeer",
      uren: 8,
      bron: "handmatig",
    });
  });

  it("listGlobal: projectleider ziet alle uren van het bedrijf, net als directie", async () => {
    const alsDirectie = await urenLijst(ctxVoor(CLERK_DIRECTIE_A), {});
    expect(alsDirectie.map((u) => u.medewerker).sort()).toEqual([
      "Anna Bakker",
      "Bram de Jong",
    ]);

    // Vóór de gelijktrekking zag de projectleider hier alleen "Bram de Jong",
    // terwijl de export op dezelfde pagina álles gaf.
    const alsProjectleider = await urenLijst(ctxVoor(CLERK_PROJECTLEIDER_A), {});
    expect(alsProjectleider.map((u) => u.medewerker).sort()).toEqual([
      "Anna Bakker",
      "Bram de Jong",
    ]);
  });

  it("listGlobal: een medewerker ziet nog steeds alleen zijn eigen uren", async () => {
    const alsMedewerker = await urenLijst(ctxVoor(CLERK_MEDEWERKER_A), {});
    expect(alsMedewerker.map((u) => u.medewerker)).toEqual(["Anna Bakker"]);
  });

  it("listGlobal blijft binnen de tenant", async () => {
    const alsDirectieB = await urenLijst(ctxVoor(CLERK_DIRECTIE_B), {});
    expect(alsDirectieB.map((u) => u.medewerker)).toEqual(["Zoë Vermeer"]);
  });

  // De projectvariant loopt via `by_project`, niet via `by_org`: de tenant-
  // grens zit dáár in de projectcontrole (getProjectVanOrg) en niet in de
  // index. Zonder deze assertie zou een projectId uit een gelekte URL de uren
  // van de buurman gewoon teruggeven.
  it("list per project: bedrijf A komt niet bij een project van bedrijf B", async () => {
    const eigen = await urenPerProject(ctxVoor(CLERK_DIRECTIE_A), {
      projectId: ids.projectA,
    });
    expect(eigen.map((u) => u.medewerker).sort()).toEqual([
      "Anna Bakker",
      "Bram de Jong",
    ]);

    await expect(
      urenPerProject(ctxVoor(CLERK_DIRECTIE_A), { projectId: ids.projectB })
    ).rejects.toThrow(ConvexError);
  });

  it("getGlobalStats: projectleider bedrijfsbreed én periode-bewust", async () => {
    const alles = await urenStats(ctxVoor(CLERK_PROJECTLEIDER_A), {});
    expect(alles.urenTotaal).toBe(10);
    expect(alles.aantalRegistraties).toBe(2);

    // Alleen dinsdag: 4 uur van Anna
    const alleenDinsdag = await urenStats(ctxVoor(CLERK_PROJECTLEIDER_A), {
      startDate: DINSDAG,
      endDate: DINSDAG,
    });
    expect(alleenDinsdag.urenTotaal).toBe(4);
    expect(alleenDinsdag.aantalRegistraties).toBe(1);
    expect(alleenDinsdag.perMedewerker).toEqual([{ naam: "Anna Bakker", uren: 4 }]);
  });

  it("getGlobalStats: medewerker blijft bij zijn eigen uren", async () => {
    const eigen = await urenStats(ctxVoor(CLERK_MEDEWERKER_A), {});
    expect(eigen.urenTotaal).toBe(4);
    expect(eigen.perMedewerker).toEqual([{ naam: "Anna Bakker", uren: 4 }]);
  });
});
