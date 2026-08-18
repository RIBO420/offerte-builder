// @vitest-environment node
/**
 * Het cron-pad van de offerte-opvolging, ZONDER ingelogde gebruiker.
 *
 * `processDueReminders` draait als cron: `ctx.auth.getUserIdentity()` geeft
 * `null`. Sinds de org-migratie is de organisatie de tenant-grens, en
 * `zetTriggerMailKlaar` haalt die uit het JWT tenzij de aanroeper hem
 * meegeeft. Doet de cron dat niet, dan geeft de trigger-motor netjes
 * `geen_org` terug en gebeurt er niets — geen foutmelding, geen mail, geen
 * spoor. Precies het soort gat dat geen enkele gate ziet.
 *
 * De bestaande tests hiervoor (mail-triggers.test.ts) draaien op een ctx mét
 * identity en dekken dat scenario dus niet. Deze tests leggen vast dat:
 *   1. de cron zonder sessie de organisatie van de OFFERTE gebruikt;
 *   2. de trigger-lookup op by_org loopt (een trigger van een andere
 *      organisatie mag nooit vuren);
 *   3. het bestaande herinnerings-pad de orgId meekrijgt, zodat
 *      emailTemplates niet op de userId-fallback hoeft terug te vallen;
 *   4. `scheduleReminders` de tenant op de reminder-rij zet.
 *
 * `convex-test` is in dit project niet geïnstalleerd; net als de andere
 * convex-tests draaien we de handlers direct tegen een in-memory nep-ctx. De
 * mock-ctx hieronder past index-constraints ÉCHT toe — de gedeelde helper
 * negeert `withIndex`, en juist de scoping ván die index is wat hier getest
 * wordt.
 */

import { describe, it, expect, vi } from "vitest";
import {
  MockConvexStore,
  createMockCtx,
  createMockUser,
  createMockKlant,
  createMockOfferte,
  seedMockOrganisatie,
  type MockCtx,
} from "../../helpers/convex-mock";
import {
  processDueReminders,
  scheduleReminders,
} from "../../../../convex/offerteReminders";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AnyHandler = (ctx: unknown, args: unknown) => Promise<unknown>;

/** Convex registreert de handler op de functie zelf (func._handler). */
function handler(fn: unknown): AnyHandler {
  return (fn as { _handler: AnyHandler })._handler;
}

interface IndexConstraint {
  op: "eq" | "lte" | "gte";
  field: string;
  value: unknown;
}

/**
 * Index-bewuste query-builder: `withIndex(q => q.eq(...).lte(...))` filtert
 * echt op de opgegeven velden. Zonder dit zou een by_org-lookup elke rij
 * teruggeven en zou test 2 hieronder niets bewijzen.
 */
function maakIndexBewusteCtx(store: MockConvexStore): MockCtx {
  const ctx = createMockCtx(store);
  ctx.db.query = vi.fn((tableName: string) => {
    let docs = store.getAll(tableName);
    const builder = {
      withIndex: (_naam: string, fn?: (q: unknown) => unknown) => {
        const constraints: IndexConstraint[] = [];
        const q = {
          eq: (field: string, value: unknown) => {
            constraints.push({ op: "eq", field, value });
            return q;
          },
          lte: (field: string, value: unknown) => {
            constraints.push({ op: "lte", field, value });
            return q;
          },
          gte: (field: string, value: unknown) => {
            constraints.push({ op: "gte", field, value });
            return q;
          },
        };
        if (fn) fn(q);
        docs = docs.filter((doc) =>
          constraints.every((c) => {
            const waarde = doc[c.field] as never;
            if (c.op === "eq") return waarde === c.value;
            if (c.op === "lte") return waarde <= (c.value as never);
            return waarde >= (c.value as never);
          })
        );
        return builder;
      },
      filter: () => builder,
      order: () => builder,
      collect: async () => [...docs],
      first: async () => docs[0] ?? null,
      unique: async () => docs[0] ?? null,
      take: async (n: number) => docs.slice(0, n),
    };
    return builder;
  });
  return ctx;
}

/** Minimaal trigger-record voor het event offerte_opvolging. */
function seedOpvolgingsTrigger(
  store: MockConvexStore,
  orgId: string,
  overrides: Record<string, unknown> = {}
): string {
  const nu = Date.now();
  return store.insert("mailTriggers", {
    orgId,
    event: "offerte_opvolging",
    naam: "Offerte-opvolging",
    onderwerp: "Herinnering offerte {{offerteNummer}}",
    inhoud: "Beste {{klantnaam}}, uw offerte {{offerteNummer}} staat nog open.",
    variabelen: ["klantnaam", "offerteNummer"],
    vertragingDagen: 0,
    ontvanger: "klant",
    modus: "concept",
    actief: true,
    createdAt: nu,
    updatedAt: nu,
    ...overrides,
  });
}

/**
 * Eén organisatie met een verzonden offerte en een opeisbare reminder.
 * De ctx heeft BEWUST geen identity: dit is het cron-pad.
 */
function storeMetOpeisbareReminder() {
  const store = new MockConvexStore();
  const orgId = seedMockOrganisatie(store);
  const userId = store.insert("users", createMockUser());
  const klantId = store.insert("klanten", createMockKlant(userId, { orgId }));
  const offerteId = store.insert(
    "offertes",
    createMockOfferte(userId, klantId, {
      orgId,
      status: "verzonden",
      klant: {
        naam: "Jan de Vries",
        adres: "Tulpstraat 12",
        postcode: "1234 AB",
        plaats: "Amsterdam",
        email: "jan@devries.nl",
      },
      shareToken: "tok123",
    })
  );
  store.insert("offerte_reminders", {
    offerteId,
    orgId,
    userId,
    type: "niet_bekeken",
    scheduledAt: Date.now() - 1000,
    status: "pending",
  });

  const ctx = maakIndexBewusteCtx(store);
  // DE kern van deze suite: een cron heeft geen sessie.
  ctx.auth.getUserIdentity.mockResolvedValue(null);
  // processDueReminders schrijft de interne notificatie via runMutation
  (ctx as unknown as { runMutation: unknown }).runMutation = vi.fn(
    async () => undefined
  );

  return { ctx, store, orgId, userId, offerteId, klantId };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("processDueReminders — cron zonder identity (org uit de offerte)", () => {
  it("zet de opvolgmail klaar op de organisatie van de offerte", async () => {
    const { ctx, store, orgId, offerteId } = storeMetOpeisbareReminder();
    seedOpvolgingsTrigger(store, orgId);

    // Voor de zekerheid: er is echt geen sessie om een org uit te halen.
    expect(await ctx.auth.getUserIdentity()).toBeNull();

    const resultaat = (await handler(processDueReminders)(ctx, {})) as {
      processedCount: number;
    };
    expect(resultaat.processedCount).toBe(1);

    const mails = store.getAll("conceptMails");
    expect(mails).toHaveLength(1);
    expect(mails[0].orgId).toBe(orgId);
    expect(mails[0].event).toBe("offerte_opvolging");
    expect(mails[0].offerteId).toBe(offerteId);
    expect(mails[0].onderwerp).toContain("OFF-2026-001");
    // Eén pad: het directe herinnerings-mailpad wordt niet óók ingepland
    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("gebruikt nooit de trigger van een andere organisatie", async () => {
    const { ctx, store } = storeMetOpeisbareReminder();
    // Trigger bestaat wél, maar bij een ander bedrijf
    seedOpvolgingsTrigger(store, "organisaties:999");

    await handler(processDueReminders)(ctx, {});

    // Geen concept-mail op andermans sjabloon; wel het bestaande
    // herinnerings-pad (gedrag van "geen trigger-record")
    expect(store.getAll("conceptMails")).toHaveLength(0);
    expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
  });

  it("geeft de orgId mee aan het herinnerings-mailpad (emailTemplates hoeft niet op userId terug te vallen)", async () => {
    const { ctx, orgId } = storeMetOpeisbareReminder();
    // Geen trigger-record → bestaand pad (sendReminderEmail)
    await handler(processDueReminders)(ctx, {});

    expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
    const [, , mailArgs] = (
      ctx.scheduler.runAfter as unknown as {
        mock: { calls: unknown[][] };
      }
    ).mock.calls[0];
    expect((mailArgs as Record<string, unknown>).orgId).toBe(orgId);
  });
});

describe("scheduleReminders — tenant op de reminder-rij", () => {
  it("zet orgId op elke ingeplande reminder", async () => {
    const store = new MockConvexStore();
    const orgId = seedMockOrganisatie(store);
    const userId = store.insert("users", createMockUser());
    const klantId = store.insert("klanten", createMockKlant(userId, { orgId }));
    const offerteId = store.insert(
      "offertes",
      createMockOfferte(userId, klantId, { orgId, status: "verzonden" })
    );
    // Deze mutation wordt wél door een ingelogde gebruiker aangeroepen
    const ctx = maakIndexBewusteCtx(store);

    await handler(scheduleReminders)(ctx, { offerteId });

    const reminders = store.getAll("offerte_reminders");
    expect(reminders).toHaveLength(3); // dag 3/7/14
    // Zonder orgId zou geen enkele by_org-query deze rijen nog zien
    expect(reminders.every((r) => r.orgId === orgId)).toBe(true);
  });
});
