/**
 * Regressietests voor audit §3 — publieke Convex-functies zonder guard.
 *
 * Drie endpoints stonden open voor iedereen die de deployment-URL kent:
 *   - standaardtuinen.get            → elk template van elk bedrijf leesbaar
 *   - projectKosten.getBudgetStatus  → budget, kosten en marge per projectId
 *   - dagkaart.berekenReistijdenVoorDag → betaalde Google Maps-calls uitlokken
 *
 * Deze tests leggen de guards vast, zodat ze niet stilletjes terug kunnen
 * vallen naar het oude gedrag.
 *
 * Aangevuld na de adversariële review met de twee omwegen die de eerste ronde
 * open liet:
 *   - standaardtuinen.createOfferteFromTemplate → las hetzelfde template zonder
 *     eigendomscheck en schreef de inhoud in een eigen offerte
 *   - projectKosten.checkBudgetThreshold → cross-tenant notificatie-insert
 * plus de kostenrem op de Maps-action.
 */

import { describe, it, expect } from "vitest";
import {
  MockConvexStore,
  createMockCtx,
  createMockUser,
  createMockProject,
  createMockOfferte,
  createMockKlant,
} from "../../helpers/convex-mock";
import type {
  ActionCtx,
  MutationCtx,
  QueryCtx,
} from "../../../../convex/_generated/server";
import {
  createOfferteFromTemplate,
  get as getStandaardtuin,
} from "../../../../convex/standaardtuinen";
import {
  checkBudgetThreshold,
  getBudgetStatus,
} from "../../../../convex/projectKosten";
import {
  berekenReistijdenVoorDag,
  getOntbrekendeAdresParen,
} from "../../../../convex/dagkaart";
import { REISTIJD_MAX_PER_GEBRUIKER } from "../../../../convex/security";

// ─── Handler-extractie (zelfde patroon als de andere convex-tests) ───────────

type Handler<TArgs, TResult> = (ctx: QueryCtx, args: TArgs) => Promise<TResult>;

function handlerVan<TArgs, TResult>(fn: unknown): Handler<TArgs, TResult> {
  return (fn as { _handler: Handler<TArgs, TResult> })._handler;
}

const getStandaardtuinHandler = handlerVan<
  { id: string },
  Record<string, unknown> | null
>(getStandaardtuin);

const getBudgetStatusHandler = handlerVan<
  { projectId: string },
  { budget: number; percentage: number } | null
>(getBudgetStatus);

const getOntbrekendeAdresParenHandler = handlerVan<
  { teamId: string; datum: string },
  unknown
>(getOntbrekendeAdresParen);

// ─── standaardtuinen.get ─────────────────────────────────────────────────────

describe("standaardtuinen.get — auth + eigendomsscope", () => {
  function maakStore() {
    const store = new MockConvexStore();
    const eigenaarId = store.insert("users", createMockUser());
    // Systeemtemplate: geen userId → voor iedere ingelogde gebruiker zichtbaar
    const systeemId = store.insert("standaardtuinen", {
      naam: "Kleine stadstuin",
      type: "aanleg",
      scopes: [],
      defaultWaarden: {},
    });
    const eigenId = store.insert("standaardtuinen", {
      userId: eigenaarId,
      naam: "Eigen sjabloon",
      type: "aanleg",
      scopes: [],
      defaultWaarden: {},
    });
    const vreemdId = store.insert("standaardtuinen", {
      userId: "users:999",
      naam: "Sjabloon van ander bedrijf",
      type: "aanleg",
      scopes: [],
      defaultWaarden: {},
    });
    return { store, systeemId, eigenId, vreemdId };
  }

  it("geeft een systeemtemplate terug aan een ingelogde gebruiker", async () => {
    const { store, systeemId } = maakStore();
    const ctx = createMockCtx(store) as unknown as QueryCtx;
    const template = await getStandaardtuinHandler(ctx, { id: systeemId });
    expect(template?.naam).toBe("Kleine stadstuin");
  });

  it("geeft een eigen template terug", async () => {
    const { store, eigenId } = maakStore();
    const ctx = createMockCtx(store) as unknown as QueryCtx;
    const template = await getStandaardtuinHandler(ctx, { id: eigenId });
    expect(template?.naam).toBe("Eigen sjabloon");
  });

  it("geeft null voor een template van een ander bedrijf", async () => {
    // Bewust dezelfde uitkomst als bij een onbekend id: een aparte foutmelding
    // zou verraden dát het record bestaat.
    const { store, vreemdId } = maakStore();
    const ctx = createMockCtx(store) as unknown as QueryCtx;
    expect(await getStandaardtuinHandler(ctx, { id: vreemdId })).toBeNull();
  });

  it("weigert een niet-ingelogde aanroeper", async () => {
    const { store, systeemId } = maakStore();
    const mockCtx = createMockCtx(store);
    mockCtx.auth.getUserIdentity.mockResolvedValue(null);
    await expect(
      getStandaardtuinHandler(mockCtx as unknown as QueryCtx, { id: systeemId })
    ).rejects.toThrow(/ingelogd/);
  });

  it("geeft null bij een onbekend id (geen bestaanslek via foutmelding)", async () => {
    const { store } = maakStore();
    const ctx = createMockCtx(store) as unknown as QueryCtx;
    const template = await getStandaardtuinHandler(ctx, {
      id: "standaardtuinen:onbekend",
    });
    expect(template).toBeNull();
  });
});

// ─── standaardtuinen.createOfferteFromTemplate ───────────────────────────────
//
// Deze mutation omzeilde de guard in `get`: met alleen een template-id
// kopieerde ze scopes en defaultWaarden van een ander bedrijf in een offerte op
// naam van de aanroeper, die de inhoud daarna via zijn eigen offerte-queries
// gewoon kon uitlezen.

describe("standaardtuinen.createOfferteFromTemplate — eigendomscheck", () => {
  type Args = {
    templateId: string;
    offerteNummer: string;
    klant: { naam: string; adres: string; postcode: string; plaats: string };
    bereikbaarheid: "goed";
  };

  const handler = (
    createOfferteFromTemplate as unknown as {
      _handler: (ctx: MutationCtx, args: Args) => Promise<string>;
    }
  )._handler;

  function maakArgs(templateId: string): Args {
    return {
      templateId,
      offerteNummer: "OFF-2026-002",
      klant: {
        naam: "Jan de Vries",
        adres: "Tulpstraat 12",
        postcode: "1234 AB",
        plaats: "Amsterdam",
      },
      bereikbaarheid: "goed",
    };
  }

  function maakStore() {
    const store = new MockConvexStore();
    const eigenaarId = store.insert("users", createMockUser());
    const eigenId = store.insert("standaardtuinen", {
      userId: eigenaarId,
      naam: "Eigen sjabloon",
      type: "aanleg",
      scopes: ["grondwerk"],
      defaultWaarden: { grondwerk: { oppervlakte: 40 } },
    });
    const vreemdId = store.insert("standaardtuinen", {
      userId: "users:999",
      naam: "Sjabloon van ander bedrijf",
      type: "aanleg",
      scopes: ["geheim"],
      defaultWaarden: { geheim: true },
    });
    return { store, eigenId, vreemdId };
  }

  it("maakt een offerte uit een eigen template", async () => {
    const { store, eigenId } = maakStore();
    const ctx = createMockCtx(store) as unknown as MutationCtx;
    await handler(ctx, maakArgs(eigenId));
    expect(store.getAll("offertes")).toHaveLength(1);
    expect(store.getAll("offertes")[0].scopes).toEqual(["grondwerk"]);
  });

  it("kopieert geen template van een ander bedrijf", async () => {
    const { store, vreemdId } = maakStore();
    const ctx = createMockCtx(store) as unknown as MutationCtx;
    await expect(handler(ctx, maakArgs(vreemdId))).rejects.toThrow(
      /niet gevonden/i
    );
    expect(store.getAll("offertes")).toHaveLength(0);
  });
});

// ─── projectKosten.getBudgetStatus ───────────────────────────────────────────

describe("projectKosten.getBudgetStatus — eigendomscheck", () => {
  function maakStore() {
    const store = new MockConvexStore();
    const eigenaarId = store.insert("users", createMockUser());
    const klantId = store.insert("klanten", createMockKlant(eigenaarId));
    const offerteId = store.insert(
      "offertes",
      createMockOfferte(eigenaarId, klantId)
    );
    const eigenProjectId = store.insert(
      "projecten",
      createMockProject(eigenaarId, offerteId)
    );
    const vreemdProjectId = store.insert(
      "projecten",
      createMockProject("users:999", offerteId)
    );
    return { store, eigenProjectId, vreemdProjectId };
  }

  it("geeft de budgetstatus van een eigen project", async () => {
    const { store, eigenProjectId } = maakStore();
    const ctx = createMockCtx(store) as unknown as QueryCtx;
    const status = await getBudgetStatusHandler(ctx, {
      projectId: eigenProjectId,
    });
    // totaalExBtw uit createMockOfferte = 3600, nog geen kosten geboekt
    expect(status?.budget).toBe(3600);
    expect(status?.percentage).toBe(0);
  });

  it("lekt geen budget van een project van een ander bedrijf", async () => {
    // `null`, geen throw: de projectdetailpagina vuurt deze query parallel met
    // projecten.getWithDetails, die ook null geeft. Een throw wint die race en
    // zet de gebruiker in de error-boundary in plaats van op "Project niet
    // gevonden".
    const { store, vreemdProjectId } = maakStore();
    const ctx = createMockCtx(store) as unknown as QueryCtx;
    expect(
      await getBudgetStatusHandler(ctx, { projectId: vreemdProjectId })
    ).toBeNull();
  });

  it("geeft null bij een onbekend projectId in plaats van te gooien", async () => {
    const { store } = maakStore();
    const ctx = createMockCtx(store) as unknown as QueryCtx;
    expect(
      await getBudgetStatusHandler(ctx, { projectId: "projecten:onbekend" })
    ).toBeNull();
  });

  it("weigert een niet-ingelogde aanroeper", async () => {
    const { store, eigenProjectId } = maakStore();
    const mockCtx = createMockCtx(store);
    mockCtx.auth.getUserIdentity.mockResolvedValue(null);
    await expect(
      getBudgetStatusHandler(mockCtx as unknown as QueryCtx, {
        projectId: eigenProjectId,
      })
    ).rejects.toThrow(/ingelogd|toegang/i);
  });
});

// ─── projectKosten.checkBudgetThreshold ──────────────────────────────────────
//
// Deze mutation had alleen `requireAuthUserId`: elke ingelogde gebruiker kon
// met een vreemd projectId een notificatie inserten in de meldingenlijst van
// een ander bedrijf, mét de projectnaam in titel en bericht.

describe("projectKosten.checkBudgetThreshold — eigendomscheck", () => {
  const handler = (
    checkBudgetThreshold as unknown as {
      _handler: (ctx: MutationCtx, args: { projectId: string }) => Promise<void>;
    }
  )._handler;

  it("schrijft geen notificatie op een project van een ander bedrijf", async () => {
    const store = new MockConvexStore();
    const eigenaarId = store.insert("users", createMockUser());
    const klantId = store.insert("klanten", createMockKlant("users:999"));
    const offerteId = store.insert(
      "offertes",
      createMockOfferte("users:999", klantId)
    );
    const vreemdProjectId = store.insert(
      "projecten",
      createMockProject("users:999", offerteId)
    );
    expect(eigenaarId).toBeTruthy();

    const ctx = createMockCtx(store) as unknown as MutationCtx;
    await expect(
      handler(ctx, { projectId: vreemdProjectId })
    ).rejects.toThrow(/geen toegang/i);
    expect(store.getAll("notifications")).toHaveLength(0);
  });
});

// ─── dagkaart.berekenReistijdenVoorDag ───────────────────────────────────────

describe("dagkaart.berekenReistijdenVoorDag — geen Maps-calls zonder auth", () => {
  type ActionHandler = (
    ctx: ActionCtx,
    args: { teamId: string; datum: string }
  ) => Promise<{ berekend: number; bron: string }>;

  const actionHandler = (
    berekenReistijdenVoorDag as unknown as { _handler: ActionHandler }
  )._handler;

  function maakActionCtx(identiteit: { subject: string } | null) {
    const aanroepen: string[] = [];
    const ctx = {
      auth: { getUserIdentity: async () => identiteit },
      runQuery: async () => {
        aanroepen.push("runQuery");
        return { ontbrekend: [], standaardMinuten: 20 };
      },
      runMutation: async () => {
        aanroepen.push("runMutation");
        return null;
      },
    } as unknown as ActionCtx;
    return { ctx, aanroepen };
  }

  it("faalt vóór elke query/Maps-call als er geen identiteit is", async () => {
    const { ctx, aanroepen } = maakActionCtx(null);
    await expect(
      actionHandler(ctx, { teamId: "teams:1", datum: "2026-08-12" })
    ).rejects.toThrow(/ingelogd/);
    expect(aanroepen).toEqual([]);
  });

  it("laat een ingelogde aanroeper door naar de interne query", async () => {
    const { ctx, aanroepen } = maakActionCtx({ subject: "clerk_test_user_123" });
    const resultaat = await actionHandler(ctx, {
      teamId: "teams:1",
      datum: "2026-08-12",
    });
    expect(aanroepen).toContain("runQuery");
    // Zonder GOOGLE_MAPS_API_KEY blijft dit bewust een no-op (fase 1-gedrag)
    expect(resultaat.berekend).toBe(0);
  });

  it("remt een ingelogde aanroeper af die blijft herberekenen", async () => {
    // De Maps-sleutel is deployment-breed: de rekening is van de app-eigenaar,
    // niet van de tenant die de calls uitlokt.
    const subject = "clerk_driftige_planner";
    for (let poging = 0; poging < REISTIJD_MAX_PER_GEBRUIKER; poging++) {
      const { ctx } = maakActionCtx({ subject });
      await actionHandler(ctx, { teamId: "teams:1", datum: "2026-08-12" });
    }

    const { ctx, aanroepen } = maakActionCtx({ subject });
    await expect(
      actionHandler(ctx, { teamId: "teams:1", datum: "2026-08-12" })
    ).rejects.toThrow(/te veel/i);
    expect(aanroepen).toEqual([]);
  });
});

describe("dagkaart.getOntbrekendeAdresParen — rolcheck", () => {
  function maakStore(rol: string) {
    const store = new MockConvexStore();
    store.insert("users", createMockUser({ role: rol }));
    return store;
  }

  it("weigert een klant (mag geen betaalde Maps-calls uitlokken)", async () => {
    const ctx = createMockCtx(maakStore("klant")) as unknown as QueryCtx;
    await expect(
      getOntbrekendeAdresParenHandler(ctx, {
        teamId: "teams:1",
        datum: "2026-08-12",
      })
    ).rejects.toThrow(/schrijfrechten|toegang/i);
  });

  it("laat een medewerker door de rolcheck heen (strandt pas op teameigendom)", async () => {
    const ctx = createMockCtx(maakStore("medewerker")) as unknown as QueryCtx;
    await expect(
      getOntbrekendeAdresParenHandler(ctx, {
        teamId: "teams:1",
        datum: "2026-08-12",
      })
    ).rejects.toThrow(/Team niet gevonden/);
  });
});
