/**
 * Regressietests voor audit §2 — cross-tenant lek in convex/chat.ts.
 *
 * De DM-queries scanden `direct_messages` volledig en selecteerden alleen op
 * clerkId. Een medewerker die van werkgever wisselt houdt zijn clerkId, dus
 * berichten uit het vórige bedrijf bleven zichtbaar en meetellen. Sinds fase 3
 * van de org-migratie is de tenant-grens de ORGANISATIE uit het JWT: alle
 * leesqueries lopen via `by_org`, niet meer via het bedrijfsaccount.
 *
 * Let op: de gedeelde `MockConvexStore` in helpers/convex-mock.ts negeert
 * `withIndex` (het geeft de builder ongewijzigd terug). Een test daarop zou
 * ook slagen mét het lek. Daarom staat hier een eigen, index-bewuste mock:
 * `withIndex` past de eq-eisen daadwerkelijk toe, precies zoals Convex doet —
 * inclusief het feit dat een rij zónder `orgId` buiten de range
 * `orgId === <mijn org>` valt (de fail-closed keuze tijdens de backfill).
 *
 * De identity draagt hier een `org_id`-claim, zodat `requireOrg` in
 * convex/auth.ts de organisatie via `by_clerk_org_id` kan opzoeken.
 */

import { describe, it, expect } from "vitest";
import type { MutationCtx } from "../../../../convex/_generated/server";
import {
  getDirectMessages,
  getDMConversations,
  getTeamMessages,
  getUnreadCounts,
  sendDirectMessage,
} from "../../../../convex/chat";
import {
  deleteThread,
  getThread,
  listMessages,
  listThreads,
  markAsRead,
  sendMessage,
} from "../../../../convex/chatThreads";

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

  patch(id: string, updates: Record<string, unknown>): void {
    const doc = this.get(id);
    if (!doc) return;
    for (const [sleutel, waarde] of Object.entries(updates)) {
      if (waarde === undefined) delete doc[sleutel];
      else doc[sleutel] = waarde;
    }
  }

  delete(id: string): void {
    for (const [tabel, rijen] of this.tabellen) {
      const idx = rijen.findIndex((d) => d._id === id);
      if (idx !== -1) {
        rijen.splice(idx, 1);
        this.tabellen.set(tabel, rijen);
        return;
      }
    }
  }
}

function maakCtx(store: TestStore, clerkId: string, clerkOrgId: string) {
  return {
    db: {
      get: async (id: string) => store.get(id),
      query: (tabel: string) => maakQueryBuilder(store.getAll(tabel)),
      insert: async (tabel: string, data: Record<string, unknown>) =>
        store.insert(tabel, data),
      patch: async (id: string, updates: Record<string, unknown>) =>
        store.patch(id, updates),
      delete: async (id: string) => store.delete(id),
    },
    auth: {
      // `org_id` is het custom claim uit het Clerk-JWT-template "convex";
      // requireOrg leest het letterlijk zo uit de identity.
      getUserIdentity: async () => ({ subject: clerkId, org_id: clerkOrgId }),
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

type Bericht = { message: string; orgId?: string };

const getDirectMessagesHandler = handlerVan<
  { withUserId: string; limit?: number },
  Bericht[]
>(getDirectMessages);

const getDMConversationsHandler = handlerVan<
  Record<string, never>,
  Array<{ partnerId: string; partnerName: string; unreadCount: number }>
>(getDMConversations);

const getTeamMessagesHandler = handlerVan<
  { channelType: "team" | "project" | "broadcast" },
  Bericht[]
>(getTeamMessages);

const getUnreadCountsHandler = handlerVan<
  Record<string, never>,
  { dm: number; team: number; total: number }
>(getUnreadCounts);

const sendDirectMessageHandler = handlerVan<
  { toUserId: string; message: string },
  { messageId: string }
>(sendDirectMessage);

// ─── Scenario ────────────────────────────────────────────────────────────────

const CLERK_MEDEWERKER = "clerk_med";
const CLERK_DIRECTIE_A = "clerk_directie_a";
const CLERK_DIRECTIE_B = "clerk_directie_b";
const CLERK_ORG_A = "org_a";
const CLERK_ORG_B = "org_b";

/**
 * Organisatie A is de huidige werkgever van de medewerker, organisatie B de
 * vorige. De medewerker houdt bij die wissel zijn clerkId — precies het
 * scenario dat de oude clerkId-only queries lieten lekken.
 */
function maakScenario() {
  const store = new TestStore();

  const orgAId = store.insert("organisaties", {
    clerkOrgId: CLERK_ORG_A,
    naam: "Bedrijf A",
    actief: true,
    aangemaaktOp: 1,
  });
  const orgBId = store.insert("organisaties", {
    clerkOrgId: CLERK_ORG_B,
    naam: "Bedrijf B",
    actief: true,
    aangemaaktOp: 1,
  });

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
    orgId: orgAId,
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

  // Bericht binnen de huidige organisatie — moet zichtbaar zijn.
  store.insert("direct_messages", {
    orgId: orgAId,
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

  // Bericht uit de vorige organisatie — mag NIET meer zichtbaar zijn of meetellen.
  store.insert("direct_messages", {
    orgId: orgBId,
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

  // Bericht van vóór de backfill: geen orgId. Fail-closed → onzichtbaar.
  store.insert("direct_messages", {
    userId: directieAId,
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

  // Teamkanaal: één bericht per organisatie, plus één van vóór de backfill.
  store.insert("team_messages", {
    orgId: orgAId,
    companyId: directieAId,
    senderId: directieAId,
    senderName: "Directie A",
    senderClerkId: CLERK_DIRECTIE_A,
    senderRole: "directie",
    channelType: "team",
    channelName: "team",
    message: "Ploegoverleg om 7u",
    messageType: "text",
    isRead: false,
    readBy: [CLERK_DIRECTIE_A],
    createdAt: 3000,
  });
  store.insert("team_messages", {
    orgId: orgBId,
    companyId: directieBId,
    senderId: directieBId,
    senderName: "Directie B",
    senderClerkId: CLERK_DIRECTIE_B,
    senderRole: "directie",
    channelType: "team",
    channelName: "team",
    message: "Intern bedrijf B",
    messageType: "text",
    isRead: false,
    readBy: [CLERK_DIRECTIE_B],
    createdAt: 2000,
  });
  store.insert("team_messages", {
    companyId: directieAId,
    senderId: directieAId,
    senderName: "Directie A",
    senderClerkId: CLERK_DIRECTIE_A,
    senderRole: "directie",
    channelType: "team",
    channelName: "team",
    message: "Teambericht zonder tenant-veld",
    messageType: "text",
    isRead: false,
    readBy: [CLERK_DIRECTIE_A],
    createdAt: 1000,
  });

  return { store, orgAId, orgBId, directieAId, directieBId, medewerkerUserId };
}

function ctxVoorMedewerker(store: TestStore) {
  return maakCtx(store, CLERK_MEDEWERKER, CLERK_ORG_A) as unknown as MutationCtx;
}

/** Zelfde clerkId, maar met het org-claim van de vórige werkgever. */
function ctxVoorMedewerkerBijOrgB(store: TestStore) {
  return maakCtx(store, CLERK_MEDEWERKER, CLERK_ORG_B) as unknown as MutationCtx;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("chat.getDirectMessages — tenant-scope", () => {
  it("toont alleen berichten van de huidige organisatie", async () => {
    const { store, directieAId } = maakScenario();

    const berichten = await getDirectMessagesHandler(ctxVoorMedewerker(store), {
      withUserId: directieAId,
    });

    expect(berichten).toHaveLength(1);
    expect(berichten[0].message).toBe("Morgen om 8u op de Tulpstraat");
  });

  it("lekt geen conversatie uit de vorige organisatie", async () => {
    const { store, directieBId } = maakScenario();

    const berichten = await getDirectMessagesHandler(ctxVoorMedewerker(store), {
      withUserId: directieBId,
    });

    expect(berichten).toEqual([]);
  });

  it("verbergt berichten zonder orgId tot de backfill is gedraaid (fail-closed)", async () => {
    const { store, directieAId } = maakScenario();

    const berichten = await getDirectMessagesHandler(ctxVoorMedewerker(store), {
      withUserId: directieAId,
    });

    expect(
      berichten.some((b) => b.message === "Oud bericht zonder tenant-veld")
    ).toBe(false);
  });
});

describe("chat.getTeamMessages — tenant-scope", () => {
  it("toont alleen het teamkanaal van de eigen organisatie", async () => {
    const { store } = maakScenario();

    const berichten = await getTeamMessagesHandler(ctxVoorMedewerker(store), {
      channelType: "team",
    });

    expect(berichten.map((b) => b.message)).toEqual(["Ploegoverleg om 7u"]);
  });

  it("dezelfde gebruiker met het org-claim van bedrijf B ziet alleen B", async () => {
    const { store } = maakScenario();

    const berichten = await getTeamMessagesHandler(
      ctxVoorMedewerkerBijOrgB(store),
      { channelType: "team" }
    );

    expect(berichten.map((b) => b.message)).toEqual(["Intern bedrijf B"]);
  });
});

describe("chat.getDMConversations — tenant-scope", () => {
  it("geeft alleen gesprekspartners binnen de eigen organisatie", async () => {
    const { store, directieAId } = maakScenario();

    const gesprekken = await getDMConversationsHandler(
      ctxVoorMedewerker(store),
      {} as Record<string, never>
    );

    expect(gesprekken).toHaveLength(1);
    expect(gesprekken[0].partnerId).toBe(directieAId);
    expect(gesprekken[0].partnerName).toBe("Directie A");
    // Het ongelezen bericht uit organisatie B en het pre-backfill bericht tellen niet mee
    expect(gesprekken[0].unreadCount).toBe(1);
  });
});

describe("chat.getUnreadCounts — tenant-scope", () => {
  it("telt geen ongelezen DM's of teamberichten uit een andere organisatie", async () => {
    const { store } = maakScenario();

    const tellers = await getUnreadCountsHandler(
      ctxVoorMedewerker(store),
      {} as Record<string, never>
    );

    expect(tellers.dm).toBe(1);
    expect(tellers.team).toBe(1);
    expect(tellers.total).toBe(2);
  });
});

describe("chat.sendDirectMessage — tenant-veld bij insert", () => {
  it("schrijft orgId van de actieve organisatie, zodat er geen nieuw gat ontstaat", async () => {
    const { store, orgAId, directieAId } = maakScenario();

    await sendDirectMessageHandler(ctxVoorMedewerker(store), {
      toUserId: directieAId,
      message: "Ik ben onderweg",
    });

    const nieuw = store
      .getAll("direct_messages")
      .find((d) => d.message === "Ik ben onderweg");

    expect(nieuw).toBeDefined();
    expect(nieuw?.orgId).toBe(orgAId);
    // Legacy-velden blijven meelopen zolang het schema companyId eist (fase 6)
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

// ─── chatThreads: org-isolatie ───────────────────────────────────────────────

/**
 * `chat_threads` draagt `orgId` sinds fase 3. Elke ingang op een thread — lezen,
 * posten, als gelezen markeren, verwijderen — moet de organisatie van de
 * aanroeper tegen die van de thread houden.
 *
 * `deleteThread` had die check helemaal NIET: de rol-gate ("alleen directie")
 * zegt niets over wélk bedrijf, dus directie van bedrijf A kon met een
 * thread-id een gesprek van bedrijf B wissen — inclusief alle berichten. De
 * test hieronder controleert daarom niet alleen dat de aanroep faalt, maar ook
 * dat de berichten van de andere organisatie er daarna nog staan.
 */

const listThreadsHandler = handlerVan<
  { filter?: string },
  Array<{ _id: string }>
>(listThreads);

const getThreadHandler = handlerVan<{ threadId: string }, TestDoc | null>(
  getThread
);

const listMessagesHandler = handlerVan<
  { threadId: string; limit?: number },
  Bericht[]
>(listMessages);

const sendMessageHandler = handlerVan<
  { threadId: string; message: string },
  string
>(sendMessage);

const markAsReadHandler = handlerVan<{ threadId: string }, void>(markAsRead);

const deleteThreadHandler = handlerVan<
  { threadId: string },
  { success: boolean }
>(deleteThread);

const CLERK_KANTOOR_A = "clerk_kantoor_a";

/**
 * Twee organisaties, elk met één klant-thread en één bericht erin. De
 * acterende gebruiker is directie van organisatie A — de zwaarste rol, zodat
 * een test die faalt niet aan een te krappe rol kan liggen.
 */
function maakThreadScenario() {
  const store = new TestStore();

  const orgAId = store.insert("organisaties", {
    clerkOrgId: CLERK_ORG_A,
    naam: "Bedrijf A",
    actief: true,
    aangemaaktOp: 1,
  });
  const orgBId = store.insert("organisaties", {
    clerkOrgId: CLERK_ORG_B,
    naam: "Bedrijf B",
    actief: true,
    aangemaaktOp: 1,
  });

  const kantoorAId = store.insert("users", {
    clerkId: CLERK_KANTOOR_A,
    email: "kantoor@bedrijf-a.nl",
    name: "Kantoor A",
    role: "directie",
  });

  const klantAId = store.insert("klanten", {
    orgId: orgAId,
    userId: kantoorAId,
    naam: "Klant A",
  });
  const klantBId = store.insert("klanten", {
    orgId: orgBId,
    userId: kantoorAId,
    naam: "Klant B",
  });

  const threadAId = store.insert("chat_threads", {
    type: "klant",
    klantId: klantAId,
    participants: [CLERK_KANTOOR_A],
    orgId: orgAId,
    companyUserId: kantoorAId,
    unreadByBedrijf: 2,
    createdAt: 1000,
  });
  const threadBId = store.insert("chat_threads", {
    type: "klant",
    klantId: klantBId,
    participants: [],
    orgId: orgBId,
    companyUserId: kantoorAId,
    unreadByBedrijf: 3,
    createdAt: 1000,
  });

  store.insert("chat_messages", {
    threadId: threadAId,
    senderType: "klant",
    senderUserId: "clerk_klant_a",
    senderName: "Klant A",
    message: "Vraag van klant A",
    isRead: false,
    createdAt: 1100,
  });
  store.insert("chat_messages", {
    threadId: threadBId,
    senderType: "klant",
    senderUserId: "clerk_klant_b",
    senderName: "Klant B",
    message: "Vraag van klant B",
    isRead: false,
    createdAt: 1100,
  });

  return { store, orgAId, orgBId, threadAId, threadBId, klantAId };
}

function ctxVoorKantoorA(store: TestStore) {
  return maakCtx(store, CLERK_KANTOOR_A, CLERK_ORG_A) as unknown as MutationCtx;
}

function berichtenVan(store: TestStore, threadId: string) {
  return store
    .getAll("chat_messages")
    .filter((m) => m.threadId === threadId)
    .map((m) => m.message as string);
}

describe("chatThreads.listThreads — org-isolatie", () => {
  it("geeft alleen de threads van de eigen organisatie", async () => {
    const { store, threadAId } = maakThreadScenario();

    const threads = await listThreadsHandler(ctxVoorKantoorA(store), {});

    expect(threads.map((t) => t._id)).toEqual([threadAId]);
  });
});

describe("chatThreads.getThread — org-isolatie", () => {
  it("geeft de eigen thread terug (positieve controle)", async () => {
    const { store, threadAId } = maakThreadScenario();

    const thread = await getThreadHandler(ctxVoorKantoorA(store), {
      threadId: threadAId,
    });

    expect(thread?._id).toBe(threadAId);
  });

  it("geeft null voor een thread van een andere organisatie", async () => {
    const { store, threadBId } = maakThreadScenario();

    const thread = await getThreadHandler(ctxVoorKantoorA(store), {
      threadId: threadBId,
    });

    expect(thread).toBeNull();
  });
});

describe("chatThreads.listMessages — org-isolatie", () => {
  it("leest de berichten van de eigen thread (positieve controle)", async () => {
    const { store, threadAId } = maakThreadScenario();

    const berichten = await listMessagesHandler(ctxVoorKantoorA(store), {
      threadId: threadAId,
    });

    expect(berichten.map((b) => b.message)).toEqual(["Vraag van klant A"]);
  });

  it("leest niets uit een thread van een andere organisatie", async () => {
    const { store, threadBId } = maakThreadScenario();

    const berichten = await listMessagesHandler(ctxVoorKantoorA(store), {
      threadId: threadBId,
    });

    expect(berichten).toEqual([]);
  });
});

describe("chatThreads.sendMessage — org-isolatie", () => {
  it("post in de eigen thread (positieve controle)", async () => {
    const { store, threadAId } = maakThreadScenario();

    await sendMessageHandler(ctxVoorKantoorA(store), {
      threadId: threadAId,
      message: "Wij komen dinsdag",
    });

    expect(berichtenVan(store, threadAId)).toContain("Wij komen dinsdag");
    expect(store.get(threadAId)!.unreadByKlant).toBe(1);
  });

  it("weigert posten in een thread van een andere organisatie", async () => {
    const { store, threadBId } = maakThreadScenario();

    await expect(
      sendMessageHandler(ctxVoorKantoorA(store), {
        threadId: threadBId,
        message: "Bericht in andermans gesprek",
      })
    ).rejects.toThrow("Geen toegang tot dit gesprek");

    // En er is niets bijgeschreven
    expect(berichtenVan(store, threadBId)).toEqual(["Vraag van klant B"]);
  });
});

describe("chatThreads.markAsRead — org-isolatie", () => {
  it("reset de eigen teller (positieve controle)", async () => {
    const { store, threadAId } = maakThreadScenario();

    await markAsReadHandler(ctxVoorKantoorA(store), { threadId: threadAId });

    expect(store.get(threadAId)!.unreadByBedrijf).toBe(0);
  });

  it("laat de teller van een andere organisatie ongemoeid", async () => {
    const { store, threadBId } = maakThreadScenario();

    await expect(
      markAsReadHandler(ctxVoorKantoorA(store), { threadId: threadBId })
    ).rejects.toThrow("Geen toegang tot dit gesprek");

    expect(store.get(threadBId)!.unreadByBedrijf).toBe(3);
  });
});

describe("chatThreads.deleteThread — org-isolatie", () => {
  it("verwijdert de eigen thread inclusief berichten (positieve controle)", async () => {
    const { store, threadAId } = maakThreadScenario();

    const resultaat = await deleteThreadHandler(ctxVoorKantoorA(store), {
      threadId: threadAId,
    });

    expect(resultaat).toEqual({ success: true });
    expect(store.get(threadAId)).toBeNull();
    expect(berichtenVan(store, threadAId)).toEqual([]);
  });

  it("weigert een thread van een andere organisatie te wissen", async () => {
    const { store, threadBId } = maakThreadScenario();

    await expect(
      deleteThreadHandler(ctxVoorKantoorA(store), { threadId: threadBId })
    ).rejects.toThrow("Gesprek niet gevonden");
  });

  it("laat bij die weigering de thread én zijn berichten staan", async () => {
    const { store, threadBId } = maakThreadScenario();

    await expect(
      deleteThreadHandler(ctxVoorKantoorA(store), { threadId: threadBId })
    ).rejects.toThrow();

    // De kern van de regressie: de rol-gate liet directie door, waarna zowel de
    // thread als alle chat_messages van de andere tenant werden gewist.
    expect(store.get(threadBId)).not.toBeNull();
    expect(berichtenVan(store, threadBId)).toEqual(["Vraag van klant B"]);
  });
});
