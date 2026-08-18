// @vitest-environment node
/**
 * Tests voor `convex/opschonen.ts` — de opschoon-engine achter "Gevarenzone:
 * werkdata opschonen" (spec §7 van de Clerk-Organizations-migratie).
 *
 * Waarom deze tests zwaarder aangezet zijn dan gebruikelijk: dit is de enige
 * functie in de codebase die met opzet data vernietigt. Twee soorten fouten
 * kosten hier onherstelbaar werk:
 *   1. te veel wissen — een `bewaren`-tabel meepakken, of over de org-grens
 *      heen wissen (de buurman verliest zijn administratie);
 *   2. te weinig wissen — een tabel of kindtabel stilzwijgend overslaan, zodat
 *      er wezen achterblijven die naar niets meer verwijzen.
 *
 * De handlers draaien tegen de gedeelde index-bewuste mock (helpers/convex-mock.ts).
 * Die past `withIndex(...q.eq("orgId", …))` écht toe, dus "org A ziet org B niet"
 * is hier een echte assertie en geen formaliteit.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  preview,
  start,
  verwerkBatch,
  maakReferentiesSchoon,
  schoonReferentiesOp,
  BATCH,
  WIS_TABELLEN,
  FULL_SCAN_TABELLEN,
  ORG_INDEX,
  KINDEREN_VAN,
  REFERENTIE_VELDEN,
  type Referentie,
} from "../../../../convex/opschonen";
import {
  TABEL_CLASSIFICATIE,
  KIND_VAN,
} from "../../../../convex/lib/orgTabellen";
import schema from "../../../../convex/schema";
import {
  MockConvexStore,
  createMockCtx,
  seedMockOrganisatie,
  seedAndereOrganisatie,
  type MockCtx,
} from "../../helpers/convex-mock";

// ─── Handler-toegang ─────────────────────────────────────────────────────────
//
// `convex-test` zit niet in dit project; net als de andere convex-tests roepen
// we de geregistreerde handler direct aan via `_handler` (niet gepubliceerd in
// de types, vandaar de cast).

type AnyHandler = (ctx: unknown, args: unknown) => Promise<unknown>;
const handler = (fn: unknown) => (fn as { _handler: AnyHandler })._handler;

// ─── Fixtures ────────────────────────────────────────────────────────────────

let store: MockConvexStore;
let orgA: string;
let orgB: string;

/** Directie: `requireAdmin` laat alleen deze rol door. */
function seedDirectie(): void {
  store.insert("users", {
    clerkId: "clerk_test_user_123",
    email: "directie@toptuinen.nl",
    name: "Directie",
    role: "directie",
    createdAt: Date.now(),
  });
}

function ctxVoorOrgA(): MockCtx {
  return createMockCtx(store);
}

/**
 * Zet in beide organisaties dezelfde set rijen neer: één rij per wistabel,
 * één rij per kindtabel, één bewaarde klant en een full-scan-rij.
 * De aantallen zijn expres klein — de batchgrenzen worden apart getest.
 */
function seedWerkdata(orgId: string, merk: string): void {
  for (const tabel of WIS_TABELLEN) {
    store.insert(tabel, { orgId, merk });
  }
  // Kinderen hangen aan de ouderrij die we hierboven net hebben geschreven.
  for (const [ouder, kinderen] of Object.entries(KINDEREN_VAN)) {
    const ouderRij = store
      .getAll(ouder)
      .find((d) => d.orgId === orgId && d.merk === merk);
    for (const kind of kinderen) {
      store.insert(kind.tabel, { [kind.veld]: ouderRij!._id, merk });
    }
  }
  store.insert("klanten", { orgId, merk, naam: "Bewaarde klant" });
}

beforeEach(() => {
  store = new MockConvexStore();
  orgA = seedMockOrganisatie(store);
  orgB = seedAndereOrganisatie(store);
  seedDirectie();
});

/** Draait de hele batchloop uit tot hij zichzelf niet meer inplant. */
async function draaiVolledigeRonde(ctx: MockCtx, orgId: string): Promise<number> {
  let args: Record<string, unknown> | null = { orgId, tabelIndex: 0 };
  let rondes = 0;
  while (args) {
    ctx.scheduler.runAfter.mockClear();
    const volgende: Array<[number, unknown, Record<string, unknown>]> = [];
    ctx.scheduler.runAfter.mockImplementation(
      (_ms: number, fn: unknown, a: Record<string, unknown>) => {
        volgende.push([_ms, fn, a]);
        return Promise.resolve();
      },
    );
    await handler(verwerkBatch)(ctx, args);
    rondes++;
    if (rondes > 5000) throw new Error("batchloop komt niet tot een einde");

    const gepland = volgende[0];
    if (!gepland) {
      args = null;
    } else if (gepland[2].tabelIndex === undefined) {
      // Laatste stap: de referentie-schoonmaak.
      await handler(maakReferentiesSchoon)(ctx, gepland[2]);
      args = null;
    } else {
      args = gepland[2];
    }
  }
  return rondes;
}

// ─── (a) preview ─────────────────────────────────────────────────────────────

describe("preview", () => {
  it("telt per tabel alleen de rijen van de eigen organisatie", async () => {
    seedWerkdata(orgA, "A");
    seedWerkdata(orgB, "B");

    const uit = (await handler(preview)(ctxVoorOrgA(), {})) as {
      telling: Record<string, number>;
      totaal: number;
      fullScanTabellen: string[];
    };

    for (const tabel of WIS_TABELLEN) {
      expect(uit.telling[tabel], `telling van ${tabel}`).toBe(1);
    }
    // Bewaarde tabellen komen niet in de telling voor.
    expect(uit.telling.klanten).toBeUndefined();
    expect(uit.telling.leveranciers).toBeUndefined();
  });

  it("telt kindrijen mee via hun ouder", async () => {
    seedWerkdata(orgA, "A");

    const uit = (await handler(preview)(ctxVoorOrgA(), {})) as {
      telling: Record<string, number>;
      totaal: number;
    };

    for (const kinderen of Object.values(KINDEREN_VAN)) {
      for (const kind of kinderen) {
        expect(uit.telling[kind.tabel], `telling van ${kind.tabel}`).toBe(1);
      }
    }
  });

  it("markeert de full-scan-tabellen apart", async () => {
    store.insert("notification_log", { recipientClerkId: "clerk_x" });
    store.insert("demoSeed", { tabel: "klanten", documentId: "x" });

    const uit = (await handler(preview)(ctxVoorOrgA(), {})) as {
      telling: Record<string, number>;
      totaal: number;
      fullScanTabellen: string[];
    };

    expect(uit.telling.notification_log).toBe(1);
    expect(uit.telling.demoSeed).toBe(1);
    expect(uit.fullScanTabellen.sort()).toEqual([...FULL_SCAN_TABELLEN].sort());
    expect(uit.totaal).toBe(2);
  });

  it("telt het totaal als de som van alle categorieën", async () => {
    seedWerkdata(orgA, "A");
    store.insert("notification_log", { recipientClerkId: "clerk_x" });

    const uit = (await handler(preview)(ctxVoorOrgA(), {})) as {
      telling: Record<string, number>;
      totaal: number;
    };

    const som = Object.values(uit.telling).reduce((a, b) => a + b, 0);
    expect(uit.totaal).toBe(som);
    expect(uit.totaal).toBeGreaterThan(WIS_TABELLEN.length);
  });

  it("weigert een gebruiker zonder directie-rol", async () => {
    store.getAll("users").forEach((u) => store.patch(u._id, { role: "voorman" }));
    await expect(handler(preview)(ctxVoorOrgA(), {})).rejects.toThrow(
      /admin rechten/i,
    );
  });

  it("weigert een sessie zonder actieve organisatie", async () => {
    const ctx = createMockCtx(store, { zonderOrg: true });
    await expect(handler(preview)(ctx, {})).rejects.toThrow();
  });
});

// ─── (b) start ───────────────────────────────────────────────────────────────

describe("start", () => {
  it("weigert zonder de letterlijke bevestiging", async () => {
    const ctx = ctxVoorOrgA();
    await expect(
      handler(start)(ctx, { bevestiging: "opschonen" }),
    ).rejects.toThrow(/OPSCHONEN/);
    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("weigert een lege bevestiging", async () => {
    const ctx = ctxVoorOrgA();
    await expect(handler(start)(ctx, { bevestiging: "" })).rejects.toThrow();
    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("weigert een niet-directie ook mét de juiste bevestiging", async () => {
    store.getAll("users").forEach((u) => store.patch(u._id, { role: "projectleider" }));
    const ctx = ctxVoorOrgA();
    await expect(
      handler(start)(ctx, { bevestiging: "OPSCHONEN" }),
    ).rejects.toThrow(/admin rechten/i);
    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("plant de eerste batch in en meldt dat hij gestart is", async () => {
    const ctx = ctxVoorOrgA();
    const uit = await handler(start)(ctx, { bevestiging: "OPSCHONEN" });

    expect(uit).toEqual({ gestart: true });
    expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
    const [ms, , args] = ctx.scheduler.runAfter.mock.calls[0];
    expect(ms).toBe(0);
    expect(args).toEqual({ orgId: orgA, tabelIndex: 0 });
  });
});

// ─── (c) batchloop ───────────────────────────────────────────────────────────

describe("verwerkBatch", () => {
  it("wist per aanroep hooguit BATCH ouderrijen en plant zichzelf opnieuw in", async () => {
    const tabel = WIS_TABELLEN[0];
    for (let i = 0; i < BATCH + 7; i++) store.insert(tabel, { orgId: orgA });

    const ctx = ctxVoorOrgA();
    await handler(verwerkBatch)(ctx, { orgId: orgA, tabelIndex: 0 });

    expect(store.getAll(tabel)).toHaveLength(7);
    expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
    // Nog niet klaar met deze tabel: dezelfde index opnieuw.
    expect(ctx.scheduler.runAfter.mock.calls[0][2]).toEqual({
      orgId: orgA,
      tabelIndex: 0,
    });
  });

  it("schuift door naar de volgende tabel als er niets meer over is", async () => {
    const ctx = ctxVoorOrgA();
    await handler(verwerkBatch)(ctx, { orgId: orgA, tabelIndex: 0 });
    expect(ctx.scheduler.runAfter.mock.calls[0][2]).toEqual({
      orgId: orgA,
      tabelIndex: 1,
    });
  });

  it("wist de kinderen van een ouderrij samen met die rij", async () => {
    const ouder = "projecten";
    const index = WIS_TABELLEN.indexOf(ouder);
    const projectId = store.insert(ouder, { orgId: orgA });
    store.insert("planningTaken", { projectId });
    store.insert("weekPlanning", { projectId });
    // Kind van een ánder project: blijft staan zolang die ouder er is.
    const vreemdId = store.insert(ouder, { orgId: orgB });
    store.insert("planningTaken", { projectId: vreemdId });

    await handler(verwerkBatch)(ctxVoorOrgA(), {
      orgId: orgA,
      tabelIndex: index,
    });

    expect(store.getAll(ouder).map((d) => d._id)).toEqual([vreemdId]);
    expect(store.getAll("planningTaken")).toHaveLength(1);
    expect(store.getAll("planningTaken")[0].projectId).toBe(vreemdId);
    expect(store.getAll("weekPlanning")).toHaveLength(0);
  });

  it("gaat na de laatste org-tabel door met de full-scan-tabellen", async () => {
    store.insert("notification_log", { recipientClerkId: "clerk_x" });
    store.insert("demoSeed", { tabel: "klanten", documentId: "x" });

    const ctx = ctxVoorOrgA();
    for (
      let i = WIS_TABELLEN.length;
      i < WIS_TABELLEN.length + FULL_SCAN_TABELLEN.length;
      i++
    ) {
      await handler(verwerkBatch)(ctx, { orgId: orgA, tabelIndex: i });
    }

    expect(store.getAll("notification_log")).toHaveLength(0);
    expect(store.getAll("demoSeed")).toHaveLength(0);
  });

  it("draagt na de laatste tabel over aan de referentie-schoonmaak", async () => {
    const ctx = ctxVoorOrgA();
    const laatste = WIS_TABELLEN.length + FULL_SCAN_TABELLEN.length;
    await handler(verwerkBatch)(ctx, { orgId: orgA, tabelIndex: laatste });

    expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
    expect(ctx.scheduler.runAfter.mock.calls[0][2]).toEqual({ orgId: orgA });
  });

  it("laat alle bewaartabellen met rust in een volledige ronde", async () => {
    seedWerkdata(orgA, "A");
    const bewaard = (Object.entries(TABEL_CLASSIFICATIE) as [string, string][])
      .filter(([, k]) => k === "bewaren" || k === "persoonlijk" || k === "systeem")
      .map(([t]) => t);
    for (const tabel of bewaard) store.insert(tabel, { orgId: orgA });
    const voor = Object.fromEntries(
      bewaard.map((t) => [t, store.getAll(t).length]),
    );

    await draaiVolledigeRonde(ctxVoorOrgA(), orgA);

    for (const tabel of bewaard) {
      expect(store.getAll(tabel).length, `${tabel} is aangeraakt`).toBe(
        voor[tabel],
      );
    }
  });
});

// ─── (d) referentie-schoonmaak ───────────────────────────────────────────────

describe("maakReferentiesSchoon", () => {
  it("dekt precies de bewaren→wissen-verwijzingen uit het schema", () => {
    // Het schema is de bron: elk `v.id(<wistabel>)`-veld op een bewaartabel
    // moet in REFERENTIE_VELDEN staan, anders blijft er na het opschonen een
    // verwijzing naar een verdwenen document achter.
    interface Validator {
      kind: string;
      tableName?: string;
      fields?: Record<string, Validator>;
      value?: Validator;
      members?: Validator[];
      element?: Validator;
    }
    const tabellen = (
      schema as unknown as { tables: Record<string, { validator: Validator }> }
    ).tables;

    const gevonden: Referentie[] = [];
    const genest: string[] = [];
    const loop = (v: Validator, tabel: string, pad: string, diep: boolean) => {
      if (!v || typeof v !== "object") return;
      if (v.kind === "id" && v.tableName) {
        const doel = v.tableName as keyof typeof TABEL_CLASSIFICATIE;
        if (TABEL_CLASSIFICATIE[doel] === "wissen") {
          if (diep) genest.push(`${tabel}.${pad}`);
          else gevonden.push({ tabel, veld: pad, doel });
        }
      }
      if (v.fields) {
        for (const [k, sub] of Object.entries(v.fields)) {
          loop(sub, tabel, pad ? `${pad}.${k}` : k, diep || pad !== "");
        }
      }
      if (v.value) loop(v.value, tabel, pad, true);
      if (v.members) for (const m of v.members) loop(m, tabel, pad, diep);
      if (v.element) loop(v.element, tabel, `${pad}[]`, true);
    };
    for (const [tabel, def] of Object.entries(tabellen)) {
      const klasse = (TABEL_CLASSIFICATIE as Record<string, string>)[tabel];
      if (klasse !== "bewaren") continue;
      loop(def.validator, tabel, "", false);
    }

    const sleutel = (r: Referentie) => `${r.tabel}.${r.veld}->${r.doel}`;
    expect([...REFERENTIE_VELDEN].map(sleutel).sort()).toEqual(
      gevonden.map(sleutel).sort(),
    );
    // Een geneste of array-verwijzing kan de generieke patch niet leegmaken:
    // die vraagt om maatwerk. Duikt er ooit één op, dan valt deze test om.
    expect(genest).toEqual([]);
  });

  it("maakt dode verwijzingen leeg en laat levende staan", async () => {
    // De mechaniektest gebruikt een echt bestaand veld (klanten.voorkeursTeamId)
    // met een gefabriceerde lijst: vandaag wijst géén bewaartabel naar een
    // wistabel, dus zonder deze injectie zou de schoonmaakloop nooit draaien.
    const levendTeam = store.insert("teams", { orgId: orgA, naam: "Ploeg 1" });
    const doodTeam = store.insert("teams", { orgId: orgA, naam: "Weg" });
    const metDood = store.insert("klanten", {
      orgId: orgA,
      voorkeursTeamId: doodTeam,
    });
    const metLevend = store.insert("klanten", {
      orgId: orgA,
      voorkeursTeamId: levendTeam,
    });
    const zonder = store.insert("klanten", { orgId: orgA });
    const vanB = store.insert("klanten", {
      orgId: orgB,
      voorkeursTeamId: doodTeam,
    });
    store.delete(doodTeam);

    const lijst: Referentie[] = [
      { tabel: "klanten", veld: "voorkeursTeamId", doel: "teams" },
    ];
    const ctx = ctxVoorOrgA();
    const opgeruimd = await schoonReferentiesOp(
      ctx as never,
      orgA as never,
      lijst,
    );

    expect(opgeruimd).toBe(1);
    expect(store.get(metDood)!.voorkeursTeamId).toBeUndefined();
    expect(store.get(metLevend)!.voorkeursTeamId).toBe(levendTeam);
    expect(store.get(zonder)!.voorkeursTeamId).toBeUndefined();
    // De buurman houdt zijn (even dode) verwijzing: dat is zijn ronde, niet die van ons.
    expect(store.get(vanB)!.voorkeursTeamId).toBe(doodTeam);
  });

  it("stempelt laatsteOpschoning op de eigen organisatie", async () => {
    const voor = Date.now();
    await handler(maakReferentiesSchoon)(ctxVoorOrgA(), { orgId: orgA });

    const org = store.get(orgA)!;
    expect(typeof org.laatsteOpschoning).toBe("number");
    expect(org.laatsteOpschoning as number).toBeGreaterThanOrEqual(voor);
    expect(store.get(orgB)!.laatsteOpschoning).toBeUndefined();
  });

  it("plant niets meer in: de ronde is klaar", async () => {
    const ctx = ctxVoorOrgA();
    await handler(maakReferentiesSchoon)(ctx, { orgId: orgA });
    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
  });
});

// ─── (e) isolatie ────────────────────────────────────────────────────────────

describe("isolatie tussen organisaties", () => {
  it("laat organisatie B volledig intact na een ronde voor organisatie A", async () => {
    seedWerkdata(orgA, "A");
    seedWerkdata(orgB, "B");

    await draaiVolledigeRonde(ctxVoorOrgA(), orgA);

    for (const tabel of WIS_TABELLEN) {
      const over = store.getAll(tabel);
      expect(over.map((d) => d.merk), `${tabel} na ronde A`).toEqual(["B"]);
    }
    for (const kinderen of Object.values(KINDEREN_VAN)) {
      for (const kind of kinderen) {
        expect(
          store.getAll(kind.tabel).map((d) => d.merk),
          `${kind.tabel} na ronde A`,
        ).toEqual(["B"]);
      }
    }
    expect(store.getAll("klanten").map((d) => d.merk).sort()).toEqual(["A", "B"]);
  });

  it("laat organisatie A volledig intact na een ronde voor organisatie B", async () => {
    seedWerkdata(orgA, "A");
    seedWerkdata(orgB, "B");

    await draaiVolledigeRonde(ctxVoorOrgA(), orgB);

    for (const tabel of WIS_TABELLEN) {
      expect(store.getAll(tabel).map((d) => d.merk), `${tabel} na ronde B`).toEqual([
        "A",
      ]);
    }
    for (const kinderen of Object.values(KINDEREN_VAN)) {
      for (const kind of kinderen) {
        expect(
          store.getAll(kind.tabel).map((d) => d.merk),
          `${kind.tabel} na ronde B`,
        ).toEqual(["A"]);
      }
    }
    expect(store.get(orgB)!.laatsteOpschoning).toBeDefined();
    expect(store.get(orgA)!.laatsteOpschoning).toBeUndefined();
  });

  it("wist de eigen wisrijen wél volledig", async () => {
    seedWerkdata(orgA, "A");
    await draaiVolledigeRonde(ctxVoorOrgA(), orgA);

    for (const tabel of WIS_TABELLEN) {
      expect(store.getAll(tabel), `${tabel} niet leeg`).toHaveLength(0);
    }
    for (const kinderen of Object.values(KINDEREN_VAN)) {
      for (const kind of kinderen) {
        expect(store.getAll(kind.tabel), `${kind.tabel} niet leeg`).toHaveLength(0);
      }
    }
  });
});

// ─── (f) exhaustiviteit ──────────────────────────────────────────────────────

describe("exhaustiviteit tegenover TABEL_CLASSIFICATIE", () => {
  it("dekt exact de wissen-lijst, zonder overlap", () => {
    const uitClassificatie = (
      Object.entries(TABEL_CLASSIFICATIE) as [string, string][]
    )
      .filter(([, k]) => k === "wissen")
      .map(([t]) => t)
      .sort();

    const kinderen = Object.values(KINDEREN_VAN)
      .flat()
      .map((k) => k.tabel);
    const gedekt = [
      ...WIS_TABELLEN,
      ...FULL_SCAN_TABELLEN,
      ...kinderen,
    ] as string[];

    expect([...gedekt].sort()).toEqual(uitClassificatie);
    // Geen tabel mag twee keer langskomen: dat zou dubbele deletes betekenen.
    expect(new Set(gedekt).size).toBe(gedekt.length);
  });

  it("neemt geen enkele bewaar-, persoonlijke of systeemtabel mee", () => {
    const gedekt = new Set<string>([
      ...WIS_TABELLEN,
      ...FULL_SCAN_TABELLEN,
      ...Object.values(KINDEREN_VAN).flat().map((k) => k.tabel),
    ]);
    for (const [tabel, klasse] of Object.entries(TABEL_CLASSIFICATIE)) {
      if (klasse === "wissen") continue;
      expect(gedekt.has(tabel), `${tabel} (${klasse}) staat in de wislijst`).toBe(
        false,
      );
    }
  });

  it("cascadeert alleen kinderen die zelf ook gewist moeten worden", () => {
    // `leadActiviteiten` is een KIND_VAN-entry met classificatie "bewaren";
    // die hoort nadrukkelijk NIET in de cascade.
    const kinderen = Object.values(KINDEREN_VAN).flat().map((k) => k.tabel);
    expect(kinderen).not.toContain("leadActiviteiten");
    for (const kind of kinderen) {
      expect(
        TABEL_CLASSIFICATIE[kind as keyof typeof TABEL_CLASSIFICATIE],
      ).toBe("wissen");
    }
  });

  it("gebruikt voor elke wistabel een index die echt op orgId begint", () => {
    const tabellen = (
      schema as unknown as {
        tables: Record<
          string,
          { indexes: Array<{ indexDescriptor: string; fields: string[] }> }
        >;
      }
    ).tables;
    for (const tabel of WIS_TABELLEN) {
      const naam = ORG_INDEX[tabel] ?? "by_org";
      const index = tabellen[tabel].indexes.find(
        (i) => i.indexDescriptor === naam,
      );
      expect(index, `index ${naam} ontbreekt op ${tabel}`).toBeDefined();
      expect(index!.fields[0], `${tabel}.${naam} begint niet op orgId`).toBe(
        "orgId",
      );
    }
    // Geen overbodige overrides: die verbergen een hernoemde index.
    for (const tabel of Object.keys(ORG_INDEX)) {
      expect(WIS_TABELLEN, `${tabel} staat in ORG_INDEX maar niet in WIS_TABELLEN`)
        .toContain(tabel);
    }
  });

  it("verwijst met KINDEREN_VAN naar dezelfde ouders/indexen als KIND_VAN", () => {
    for (const [ouder, kinderen] of Object.entries(KINDEREN_VAN)) {
      for (const kind of kinderen) {
        expect(KIND_VAN[kind.tabel as keyof typeof KIND_VAN]).toEqual({
          ouder,
          veld: kind.veld,
          index: kind.index,
        });
      }
    }
  });
});
