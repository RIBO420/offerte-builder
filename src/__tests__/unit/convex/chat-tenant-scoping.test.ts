/**
 * Regressietests voor audit §2 — cross-tenant lek in convex/chat.ts.
 *
 * De DM-queries scanden `direct_messages` volledig en selecteerden alleen op
 * clerkId. Een medewerker die van werkgever wisselt houdt zijn clerkId, dus
 * berichten uit het vórige bedrijf bleven zichtbaar en meetellen. Alle
 * leesqueries lopen nu eerst via de `by_user`-index op het eigen bedrijf.
 *
 * Let op: de gedeelde `MockConvexStore` in helpers/convex-mock.ts negeert
 * `withIndex` (het geeft de builder ongewijzigd terug). Een test daarop zou
 * ook slagen mét het lek. Daarom staat hier een eigen, index-bewuste mock:
 * `withIndex` past de eq-eisen daadwerkelijk toe, precies zoals Convex doet —
 * inclusief het feit dat een rij zónder `userId` buiten de range
 * `userId === companyId` valt (de fail-closed keuze tijdens de backfill).
 */

import { describe, it, expect } from "vitest";
import type { MutationCtx } from "../../../../convex/_generated/server";
import {
  getDirectMessages,
  getDMConversations,
  getUnreadCounts,
  sendDirectMessage,
} from "../../../../convex/chat";

// ─── Index-bewuste mini-mock ─────────────────────────────────────────────────

type TestDoc = Record<string, unknown> & {
  _id: string;
  _creationTime: number;
};

interface IndexHelper {
  eq: (veld: string, waarde: unknown) => IndexHelper;
}

interface FilterHelper {
  field: (naam: string) => unknown;
  eq: (a: unknown, b: unknown) => boolean;
  neq: (a: unknown, b: unknown) => boolean;
  lt: (a: unknown, b: unknown) => boolean;
  and: (...delen: boolean[]) => boolean;
  or: (...delen: boolean[]) => boolean;
}

function maakFilterHelper(doc: TestDoc): FilterHelper {
  return {
    field: (naam) => doc[naam],
    eq: (a, b) => a === b,
    neq: (a, b) => a !== b,
    lt: (a, b) => (a as number) < (b as number),
    and: (...delen) => delen.every(Boolean),
    or: (...delen) => delen.some(Boolean),
  };
}

function maakQueryBuilder(docs: TestDoc[]) {
  let huidige = [...docs];

  const builder = {
    withIndex(_naam: string, fn: (q: IndexHelper) => IndexHelper) {
      const eisen: Array<[string, unknown]> = [];
      const helper: IndexHelper = {
        eq: (veld, waarde) => {
          eisen.push([veld, waarde]);
          return helper;
        },
      };
      fn(helper);
      // Zoals een echte index-range: een ontbrekend veld is undefined en matcht
      // dus niet met een concrete waarde.
      huidige = huidige.filter((doc) =>
        eisen.every(([veld, waarde]) => doc[veld] === waarde)
      );
      return builder;
    },
    filter(fn: (q: FilterHelper) => boolean) {
      huidige = huidige.filter((doc) => fn(maakFilterHelper(doc)));
      return builder;
    },
    order(richting: "asc" | "desc") {
      huidige = [...huidige].sort((a, b) => {
        const aTijd = typeof a.createdAt === "number" ? a.createdAt : a._creationTime;
        const bTijd = typeof b.createdAt === "number" ? b.createdAt : b._creationTime;
        return richting === "desc" ? bTijd - aTijd : aTijd - bTijd;
      });
      return builder;
    },
    async collect() {
      return [...huidige];
    },
    async take(n: number) {
      return huidige.slice(0, n);
    },
    async unique() {
      return huidige[0] ?? null;
    },
    async first() {
      return huidige[0] ?? null;
    },
  };

  return builder;
}

class TestStore {
  private tabellen = new Map<string, TestDoc[]>();
  private teller = 0;

  insert(tabel: string, data: Record<string, unknown>): string {
    this.teller++;
    const doc: TestDoc = {
      ...data,
      _id: `${tabel}:${this.teller}`,
      _creationTime: this.teller,
    };
    const rijen = this.tabellen.get(tabel) ?? [];
    rijen.push(doc);
    this.tabellen.set(tabel, rijen);
    return doc._id;
  }

  get(id: string): TestDoc | null {
    for (const rijen of this.tabellen.values()) {
      const gevonden = rijen.find((d) => d._id === id);
      if (gevonden) return gevonden;
    }
    return null;
  }

  getAll(tabel: string): TestDoc[] {
    return [...(this.tabellen.get(tabel) ?? [])];
  }
}

function maakCtx(store: TestStore, clerkId: string) {
  return {
    db: {
      get: async (id: string) => store.get(id),
      query: (tabel: string) => maakQueryBuilder(store.getAll(tabel)),
      insert: async (tabel: string, data: Record<string, unknown>) =>
        store.insert(tabel, data),
      patch: async () => undefined,
      delete: async () => undefined,
    },
    auth: {
      getUserIdentity: async () => ({ subject: clerkId }),
    },
    scheduler: {
      runAfter: async () => undefined,
    },
  };
}

// ─── Handler-extractie (zelfde patroon als de andere convex-tests) ───────────

type Handler<TArgs, TResult> = (ctx: MutationCtx, args: TArgs) => Promise<TResult>;

function handlerVan<TArgs, TResult>(fn: unknown): Handler<TArgs, TResult> {
  return (fn as { _handler: Handler<TArgs, TResult> })._handler;
}

type Bericht = { message: string; userId?: string };

const getDirectMessagesHandler = handlerVan<
  { withUserId: string; limit?: number },
  Bericht[]
>(getDirectMessages);

const getDMConversationsHandler = handlerVan<
  Record<string, never>,
  Array<{ partnerId: string; partnerName: string; unreadCount: number }>
>(getDMConversations);

const getUnreadCountsHandler = handlerVan<
  Record<string, never>,
  { dm: number; total: number }
>(getUnreadCounts);

const sendDirectMessageHandler = handlerVan<
  { toUserId: string; message: string },
  { messageId: string }
>(sendDirectMessage);

// ─── Scenario ────────────────────────────────────────────────────────────────

const CLERK_MEDEWERKER = "clerk_med";
const CLERK_DIRECTIE_A = "clerk_directie_a";
const CLERK_DIRECTIE_B = "clerk_directie_b";

/**
 * Bedrijf A is de huidige werkgever van de medewerker, bedrijf B de vorige.
 * De medewerker houdt bij die wissel zijn clerkId — precies het scenario dat
 * de oude clerkId-only queries lieten lekken.
 */
function maakScenario() {
  const store = new TestStore();

  const directieAId = store.insert("users", {
    clerkId: CLERK_DIRECTIE_A,
    email: "directie@bedrijf-a.nl",
    name: "Directie A",
    role: "directie",
  });
  const directieBId = store.insert("users", {
    clerkId: CLERK_DIRECTIE_B,
    email: "directie@bedrijf-b.nl",
    name: "Directie B",
    role: "directie",
  });

  const medewerkerRecordId = store.insert("medewerkers", {
    userId: directieAId,
    naam: "Kees Bakker",
    clerkUserId: CLERK_MEDEWERKER,
    isActief: true,
  });
  const medewerkerUserId = store.insert("users", {
    clerkId: CLERK_MEDEWERKER,
    email: "kees@bedrijf-a.nl",
    name: "Kees Bakker",
    role: "medewerker",
    linkedMedewerkerId: medewerkerRecordId,
  });

  // Bericht binnen het huidige bedrijf — moet zichtbaar zijn.
  store.insert("direct_messages", {
    userId: directieAId,
    fromUserId: directieAId,
    fromClerkId: CLERK_DIRECTIE_A,
    toUserId: medewerkerUserId,
    toClerkId: CLERK_MEDEWERKER,
    companyId: directieAId,
    message: "Morgen om 8u op de Tulpstraat",
    messageType: "text",
    isRead: false,
    createdAt: 3000,
  });

  // Bericht uit het vorige bedrijf — mag NIET meer zichtbaar zijn of meetellen.
  store.insert("direct_messages", {
    userId: directieBId,
    fromUserId: directieBId,
    fromClerkId: CLERK_DIRECTIE_B,
    toUserId: medewerkerUserId,
    toClerkId: CLERK_MEDEWERKER,
    companyId: directieBId,
    message: "Loonstrook vorige werkgever",
    messageType: "text",
    isRead: false,
    createdAt: 2000,
  });

  // Bericht van vóór de backfill: geen userId. Fail-closed → onzichtbaar.
  store.insert("direct_messages", {
    fromUserId: directieAId,
    fromClerkId: CLERK_DIRECTIE_A,
    toUserId: medewerkerUserId,
    toClerkId: CLERK_MEDEWERKER,
    companyId: directieAId,
    message: "Oud bericht zonder tenant-veld",
    messageType: "text",
    isRead: false,
    createdAt: 1000,
  });

  return { store, directieAId, directieBId, medewerkerUserId };
}

function ctxVoorMedewerker(store: TestStore) {
  return maakCtx(store, CLERK_MEDEWERKER) as unknown as MutationCtx;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("chat.getDirectMessages — tenant-scope", () => {
  it("toont alleen berichten van het huidige bedrijf", async () => {
    const { store, directieAId } = maakScenario();

    const berichten = await getDirectMessagesHandler(ctxVoorMedewerker(store), {
      withUserId: directieAId,
    });

    expect(berichten).toHaveLength(1);
    expect(berichten[0].message).toBe("Morgen om 8u op de Tulpstraat");
  });

  it("lekt geen conversatie uit het vorige bedrijf", async () => {
    const { store, directieBId } = maakScenario();

    const berichten = await getDirectMessagesHandler(ctxVoorMedewerker(store), {
      withUserId: directieBId,
    });

    expect(berichten).toEqual([]);
  });

  it("verbergt berichten zonder userId tot de backfill is gedraaid (fail-closed)", async () => {
    const { store, directieAId } = maakScenario();

    const berichten = await getDirectMessagesHandler(ctxVoorMedewerker(store), {
      withUserId: directieAId,
    });

    expect(
      berichten.some((b) => b.message === "Oud bericht zonder tenant-veld")
    ).toBe(false);
  });
});

describe("chat.getDMConversations — tenant-scope", () => {
  it("geeft alleen gesprekspartners binnen het eigen bedrijf", async () => {
    const { store, directieAId } = maakScenario();

    const gesprekken = await getDMConversationsHandler(
      ctxVoorMedewerker(store),
      {} as Record<string, never>
    );

    expect(gesprekken).toHaveLength(1);
    expect(gesprekken[0].partnerId).toBe(directieAId);
    expect(gesprekken[0].partnerName).toBe("Directie A");
    // Het ongelezen bericht uit bedrijf B en het pre-backfill bericht tellen niet mee
    expect(gesprekken[0].unreadCount).toBe(1);
  });
});

describe("chat.getUnreadCounts — tenant-scope", () => {
  it("telt geen ongelezen DM's uit een ander bedrijf", async () => {
    const { store } = maakScenario();

    const tellers = await getUnreadCountsHandler(
      ctxVoorMedewerker(store),
      {} as Record<string, never>
    );

    expect(tellers.dm).toBe(1);
    expect(tellers.total).toBe(1);
  });
});

describe("chat.sendDirectMessage — tenant-veld bij insert", () => {
  it("schrijft userId gelijk aan het bedrijfsaccount, zodat er geen nieuw gat ontstaat", async () => {
    const { store, directieAId } = maakScenario();

    await sendDirectMessageHandler(ctxVoorMedewerker(store), {
      toUserId: directieAId,
      message: "Ik ben onderweg",
    });

    const nieuw = store
      .getAll("direct_messages")
      .find((d) => d.message === "Ik ben onderweg");

    expect(nieuw).toBeDefined();
    expect(nieuw?.userId).toBe(directieAId);
    expect(nieuw?.companyId).toBe(directieAId);
  });

  it("het zojuist verstuurde bericht is meteen zichtbaar in de gescopete query", async () => {
    const { store, directieAId } = maakScenario();

    await sendDirectMessageHandler(ctxVoorMedewerker(store), {
      toUserId: directieAId,
      message: "Ik ben onderweg",
    });

    const berichten = await getDirectMessagesHandler(ctxVoorMedewerker(store), {
      withUserId: directieAId,
    });

    expect(berichten.map((b) => b.message)).toContain("Ik ben onderweg");
  });
});
