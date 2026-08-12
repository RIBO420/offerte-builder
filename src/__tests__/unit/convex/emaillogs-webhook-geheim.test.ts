/**
 * Regressietest bij audit §3 — `emailLogs.updateFromWebhook`.
 *
 * De mutation documenteerde zichzelf als "webhook-only, security via Svix",
 * maar was een gewone publieke Convex-mutation. Iedereen die de deployment-URL
 * kende kon daarmee delivery-, open-, bounce- en complaint-events vervalsen
 * voor willekeurige resendId's.
 *
 * Een internalMutation is geen optie: die is niet aanroepbaar via
 * ConvexHttpClient vanuit de Next.js-routehandler. De mutation eist daarom nu
 * een gedeeld geheim (CONVEX_WEBHOOK_SECRET) dat de route meestuurt.
 *
 * Kern van deze test: zonder of met een verkeerd geheim moet de mutation
 * GOOIEN — niet stilzwijgend slagen en niet stilzwijgend niets doen.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConvexError } from "convex/values";
import { MockConvexStore, createMockCtx } from "../../helpers/convex-mock";
import { updateFromWebhook } from "../../../../convex/emailLogs";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AnyHandler = (ctx: unknown, args: unknown) => Promise<unknown>;

/** Convex registreert de handler op de functie zelf (func._handler). */
function handler(fn: unknown): AnyHandler {
  return (fn as { _handler: AnyHandler })._handler;
}

const GEHEIM = "test-geheim-abcdefghijklmnop";

function maakContext() {
  const store = new MockConvexStore();
  const logId = store.insert("email_logs", {
    offerteId: "offertes:1",
    userId: "users:1",
    type: "offerte_verzonden",
    to: "klant@example.com",
    subject: "Uw offerte",
    status: "verzonden",
    resendId: "resend_abc123",
  });
  return { store, ctx: createMockCtx(store), logId };
}

const basisArgs = {
  resendId: "resend_abc123",
  eventType: "email.delivered" as const,
  timestamp: 1_700_000_000_000,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("emailLogs.updateFromWebhook — gedeeld webhook-geheim", () => {
  beforeEach(() => {
    process.env.CONVEX_WEBHOOK_SECRET = GEHEIM;
  });

  afterEach(() => {
    delete process.env.CONVEX_WEBHOOK_SECRET;
  });

  it("werkt de status bij met het juiste geheim", async () => {
    const { store, ctx, logId } = maakContext();

    await handler(updateFromWebhook)(ctx, { secret: GEHEIM, ...basisArgs });

    const log = store.get(logId);
    expect(log?.status).toBe("delivered");
    expect(log?.deliveredAt).toBe(basisArgs.timestamp);
  });

  it("weigert een aanroep zonder geheim en schrijft niets", async () => {
    const { store, ctx, logId } = maakContext();

    await expect(
      handler(updateFromWebhook)(ctx, { secret: "", ...basisArgs })
    ).rejects.toThrow(ConvexError);

    expect(ctx.db.patch).not.toHaveBeenCalled();
    expect(store.get(logId)?.status).toBe("verzonden");
  });

  it("weigert een verkeerd geheim en schrijft niets", async () => {
    const { store, ctx, logId } = maakContext();

    await expect(
      handler(updateFromWebhook)(ctx, {
        secret: "iets-heel-anders",
        ...basisArgs,
      })
    ).rejects.toThrow(ConvexError);

    expect(ctx.db.patch).not.toHaveBeenCalled();
    expect(store.get(logId)?.status).toBe("verzonden");
  });

  it("accepteert geen geheim dat alleen begint als het echte", async () => {
    // Bewaakt de constante-tijd-vergelijking: een prefix van de juiste lengte
    // mag nooit doorgelaten worden.
    const { ctx } = maakContext();
    const bijnaGoed = GEHEIM.slice(0, -1) + "X";

    await expect(
      handler(updateFromWebhook)(ctx, { secret: bijnaGoed, ...basisArgs })
    ).rejects.toThrow(ConvexError);

    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it("faalt gesloten als CONVEX_WEBHOOK_SECRET niet geconfigureerd is", async () => {
    // Een ontbrekend geheim in de Convex-omgeving is een configuratiefout.
    // Doorlaten zou het oorspronkelijke gat weer openzetten.
    delete process.env.CONVEX_WEBHOOK_SECRET;
    const { store, ctx, logId } = maakContext();

    await expect(
      handler(updateFromWebhook)(ctx, { secret: GEHEIM, ...basisArgs })
    ).rejects.toThrow(ConvexError);

    expect(ctx.db.patch).not.toHaveBeenCalled();
    expect(store.get(logId)?.status).toBe("verzonden");
  });
});
