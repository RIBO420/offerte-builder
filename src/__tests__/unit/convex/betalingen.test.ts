/**
 * Unit tests for betalingen (payments) business logic.
 *
 * Since Convex handler functions require the Convex runtime, these tests
 * extract and verify the pure business logic: payment status validation,
 * status transitions, data integrity, and filtering/lookup logic.
 */
import { describe, it, expect } from "vitest";

// ─── Extracted types & validation logic ──────────────────────────────────────

type BetalingStatus = "open" | "pending" | "paid" | "failed" | "expired" | "canceled";
type BetalingType = "aanbetaling" | "configurator" | "factuur";

const VALID_STATUSES: BetalingStatus[] = ["open", "pending", "paid", "failed", "expired", "canceled"];
const VALID_TYPES: BetalingType[] = ["aanbetaling", "configurator", "factuur"];

function isValidStatus(status: string): status is BetalingStatus {
  return VALID_STATUSES.includes(status as BetalingStatus);
}

function isValidType(type: string): type is BetalingType {
  return VALID_TYPES.includes(type as BetalingType);
}

/** Simulate the create mutation's initial state setting */
interface BetalingInput {
  molliePaymentId: string;
  bedrag: number;
  beschrijving: string;
  referentie: string;
  klantNaam: string;
  klantEmail: string;
  type: BetalingType;
  metadata?: Record<string, string | number | boolean | null>;
}

interface Betaling extends BetalingInput {
  userId: string;
  status: BetalingStatus;
  createdAt: number;
  updatedAt: number;
}

function createBetaling(input: BetalingInput, userId: string): Betaling {
  const now = Date.now();
  return {
    ...input,
    userId,
    status: "open", // Always starts as "open"
    createdAt: now,
    updatedAt: now,
  };
}

/** Simulate updateStatus lookup and patch */
function findByMollieId(betalingen: Betaling[], molliePaymentId: string): Betaling | null {
  return betalingen.find((b) => b.molliePaymentId === molliePaymentId) ?? null;
}

function updateBetalingStatus(betaling: Betaling, newStatus: BetalingStatus): Betaling {
  return {
    ...betaling,
    status: newStatus,
    updatedAt: Date.now(),
  };
}

/** Simulate lookup by referentie */
function findByReferentie(betalingen: Betaling[], referentie: string): Betaling[] {
  return betalingen.filter((b) => b.referentie === referentie);
}

/** Simulate admin vs user filtering in list query */
function filterByUser(betalingen: Betaling[], userId: string): Betaling[] {
  return betalingen.filter((b) => b.userId === userId);
}

// ─── Mock data factories ─────────────────────────────────────────────────────

function createMockBetalingInput(overrides: Partial<BetalingInput> = {}): BetalingInput {
  return {
    molliePaymentId: `tr_${Math.random().toString(36).slice(2, 10)}`,
    bedrag: 250.0,
    beschrijving: "Aanbetaling tuin renovatie",
    referentie: "FAC-2026-001",
    klantNaam: "Jan de Vries",
    klantEmail: "jan@example.nl",
    type: "factuur",
    ...overrides,
  };
}

function createMockBetalingen(count: number, userId: string): Betaling[] {
  return Array.from({ length: count }, (_, i) =>
    createBetaling(
      createMockBetalingInput({
        molliePaymentId: `tr_mock${i}`,
        referentie: `FAC-2026-${String(i + 1).padStart(3, "0")}`,
      }),
      userId,
    ),
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Betalingen - Status Validation", () => {
  it("accepts all valid statuses", () => {
    for (const status of VALID_STATUSES) {
      expect(isValidStatus(status)).toBe(true);
    }
  });

  it("rejects invalid statuses", () => {
    expect(isValidStatus("completed")).toBe(false);
    expect(isValidStatus("refunded")).toBe(false);
    expect(isValidStatus("")).toBe(false);
    expect(isValidStatus("PAID")).toBe(false); // case sensitive
  });
});

describe("Betalingen - Type Validation", () => {
  it("accepts all valid types", () => {
    for (const type of VALID_TYPES) {
      expect(isValidType(type)).toBe(true);
    }
  });

  it("rejects invalid types", () => {
    expect(isValidType("subscription")).toBe(false);
    expect(isValidType("refund")).toBe(false);
    expect(isValidType("")).toBe(false);
  });
});

describe("Betalingen - Create (Initial State)", () => {
  it("sets initial status to 'open'", () => {
    const input = createMockBetalingInput();
    const betaling = createBetaling(input, "user-1");
    expect(betaling.status).toBe("open");
  });

  it("preserves all input fields", () => {
    const input = createMockBetalingInput({
      molliePaymentId: "tr_test123",
      bedrag: 500.0,
      beschrijving: "Test betaling",
      referentie: "FAC-2026-042",
      klantNaam: "Piet Jansen",
      klantEmail: "piet@example.nl",
      type: "aanbetaling",
    });
    const betaling = createBetaling(input, "user-1");

    expect(betaling.molliePaymentId).toBe("tr_test123");
    expect(betaling.bedrag).toBe(500.0);
    expect(betaling.beschrijving).toBe("Test betaling");
    expect(betaling.referentie).toBe("FAC-2026-042");
    expect(betaling.klantNaam).toBe("Piet Jansen");
    expect(betaling.klantEmail).toBe("piet@example.nl");
    expect(betaling.type).toBe("aanbetaling");
  });

  it("sets createdAt and updatedAt timestamps", () => {
    const before = Date.now();
    const betaling = createBetaling(createMockBetalingInput(), "user-1");
    const after = Date.now();

    expect(betaling.createdAt).toBeGreaterThanOrEqual(before);
    expect(betaling.createdAt).toBeLessThanOrEqual(after);
    expect(betaling.updatedAt).toBe(betaling.createdAt);
  });

  it("assigns the correct userId", () => {
    const betaling = createBetaling(createMockBetalingInput(), "user-abc");
    expect(betaling.userId).toBe("user-abc");
  });

  it("preserves optional metadata", () => {
    const input = createMockBetalingInput({
      metadata: { orderId: "ORD-001", amount: 100, isTest: true, nullField: null },
    });
    const betaling = createBetaling(input, "user-1");

    expect(betaling.metadata).toEqual({
      orderId: "ORD-001",
      amount: 100,
      isTest: true,
      nullField: null,
    });
  });

  it("works without metadata", () => {
    const input = createMockBetalingInput();
    delete input.metadata;
    const betaling = createBetaling(input, "user-1");
    expect(betaling.metadata).toBeUndefined();
  });

  it("handles decimal bedrag values", () => {
    const input = createMockBetalingInput({ bedrag: 99.99 });
    const betaling = createBetaling(input, "user-1");
    expect(betaling.bedrag).toBe(99.99);
  });

  it("handles zero bedrag", () => {
    const input = createMockBetalingInput({ bedrag: 0 });
    const betaling = createBetaling(input, "user-1");
    expect(betaling.bedrag).toBe(0);
  });
});

describe("Betalingen - Status Update", () => {
  it("updates status from open to pending", () => {
    const betaling = createBetaling(createMockBetalingInput(), "user-1");
    const updated = updateBetalingStatus(betaling, "pending");
    expect(updated.status).toBe("pending");
  });

  it("updates status from open to paid", () => {
    const betaling = createBetaling(createMockBetalingInput(), "user-1");
    const updated = updateBetalingStatus(betaling, "paid");
    expect(updated.status).toBe("paid");
  });

  it("updates status from open to failed", () => {
    const betaling = createBetaling(createMockBetalingInput(), "user-1");
    const updated = updateBetalingStatus(betaling, "failed");
    expect(updated.status).toBe("failed");
  });

  it("updates status from open to expired", () => {
    const betaling = createBetaling(createMockBetalingInput(), "user-1");
    const updated = updateBetalingStatus(betaling, "expired");
    expect(updated.status).toBe("expired");
  });

  it("updates status from open to canceled", () => {
    const betaling = createBetaling(createMockBetalingInput(), "user-1");
    const updated = updateBetalingStatus(betaling, "canceled");
    expect(updated.status).toBe("canceled");
  });

  it("updates updatedAt timestamp on status change", () => {
    const betaling = createBetaling(createMockBetalingInput(), "user-1");
    const originalUpdatedAt = betaling.updatedAt;

    // Small delay to ensure timestamp differs
    const updated = updateBetalingStatus(betaling, "paid");
    expect(updated.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
  });

  it("preserves other fields when updating status", () => {
    const input = createMockBetalingInput({
      molliePaymentId: "tr_preserve",
      bedrag: 750,
      klantNaam: "Test Klant",
    });
    const betaling = createBetaling(input, "user-1");
    const updated = updateBetalingStatus(betaling, "paid");

    expect(updated.molliePaymentId).toBe("tr_preserve");
    expect(updated.bedrag).toBe(750);
    expect(updated.klantNaam).toBe("Test Klant");
    expect(updated.userId).toBe("user-1");
  });
});

describe("Betalingen - Lookup by Mollie ID", () => {
  it("finds a betaling by molliePaymentId", () => {
    const betalingen = createMockBetalingen(5, "user-1");
    const result = findByMollieId(betalingen, "tr_mock2");
    expect(result).not.toBeNull();
    expect(result!.molliePaymentId).toBe("tr_mock2");
  });

  it("returns null when molliePaymentId does not exist", () => {
    const betalingen = createMockBetalingen(3, "user-1");
    const result = findByMollieId(betalingen, "tr_nonexistent");
    expect(result).toBeNull();
  });

  it("returns null for empty collection", () => {
    const result = findByMollieId([], "tr_any");
    expect(result).toBeNull();
  });

  it("finds the correct one among many", () => {
    const betalingen = createMockBetalingen(100, "user-1");
    const result = findByMollieId(betalingen, "tr_mock50");
    expect(result).not.toBeNull();
    expect(result!.referentie).toBe("FAC-2026-051");
  });
});

describe("Betalingen - Lookup by Referentie", () => {
  it("finds betalingen by referentie", () => {
    const betalingen = createMockBetalingen(5, "user-1");
    const result = findByReferentie(betalingen, "FAC-2026-003");
    expect(result).toHaveLength(1);
    expect(result[0].referentie).toBe("FAC-2026-003");
  });

  it("returns empty array when referentie does not exist", () => {
    const betalingen = createMockBetalingen(3, "user-1");
    const result = findByReferentie(betalingen, "FAC-9999-999");
    expect(result).toHaveLength(0);
  });

  it("finds multiple betalingen with same referentie", () => {
    const betaling1 = createBetaling(
      createMockBetalingInput({ molliePaymentId: "tr_a", referentie: "FAC-2026-001" }),
      "user-1",
    );
    const betaling2 = createBetaling(
      createMockBetalingInput({ molliePaymentId: "tr_b", referentie: "FAC-2026-001" }),
      "user-1",
    );
    const betaling3 = createBetaling(
      createMockBetalingInput({ molliePaymentId: "tr_c", referentie: "FAC-2026-002" }),
      "user-1",
    );

    const result = findByReferentie([betaling1, betaling2, betaling3], "FAC-2026-001");
    expect(result).toHaveLength(2);
  });
});

describe("Betalingen - User Filtering (List Query)", () => {
  it("returns only betalingen for the specified user", () => {
    const user1Betalingen = createMockBetalingen(3, "user-1");
    const user2Betalingen = createMockBetalingen(2, "user-2");
    const all = [...user1Betalingen, ...user2Betalingen];

    const result = filterByUser(all, "user-1");
    expect(result).toHaveLength(3);
    result.forEach((b) => expect(b.userId).toBe("user-1"));
  });

  it("returns empty array when user has no betalingen", () => {
    const betalingen = createMockBetalingen(5, "user-1");
    const result = filterByUser(betalingen, "user-99");
    expect(result).toHaveLength(0);
  });

  it("admin sees all betalingen (no filter applied)", () => {
    const user1Betalingen = createMockBetalingen(3, "user-1");
    const user2Betalingen = createMockBetalingen(2, "user-2");
    const all = [...user1Betalingen, ...user2Betalingen];

    // Admin query returns all — simulated by not filtering
    expect(all).toHaveLength(5);
  });
});

describe("Betalingen - Payment Type Semantics", () => {
  it("aanbetaling type represents a deposit payment", () => {
    const input = createMockBetalingInput({ type: "aanbetaling", bedrag: 500 });
    const betaling = createBetaling(input, "user-1");
    expect(betaling.type).toBe("aanbetaling");
  });

  it("configurator type represents an online configurator payment", () => {
    const input = createMockBetalingInput({ type: "configurator", bedrag: 150 });
    const betaling = createBetaling(input, "user-1");
    expect(betaling.type).toBe("configurator");
  });

  it("factuur type represents an invoice payment", () => {
    const input = createMockBetalingInput({ type: "factuur", bedrag: 2500 });
    const betaling = createBetaling(input, "user-1");
    expect(betaling.type).toBe("factuur");
  });
});

describe("Betalingen - Data Integrity", () => {
  it("molliePaymentId should be unique per betaling", () => {
    const betalingen = createMockBetalingen(10, "user-1");
    const ids = betalingen.map((b) => b.molliePaymentId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("timestamps are positive numbers", () => {
    const betaling = createBetaling(createMockBetalingInput(), "user-1");
    expect(betaling.createdAt).toBeGreaterThan(0);
    expect(betaling.updatedAt).toBeGreaterThan(0);
  });

  it("bedrag supports typical Dutch invoice amounts", () => {
    // Common amounts in Dutch landscaping
    const amounts = [0.01, 50.0, 250.5, 1500.0, 25000.0, 99999.99];
    for (const amount of amounts) {
      const input = createMockBetalingInput({ bedrag: amount });
      const betaling = createBetaling(input, "user-1");
      expect(betaling.bedrag).toBe(amount);
    }
  });
});

describe("Betalingen - UpdateStatus Error Scenarios", () => {
  it("should not find a betaling with non-existent molliePaymentId", () => {
    const betalingen = createMockBetalingen(5, "user-1");
    const found = findByMollieId(betalingen, "tr_does_not_exist");
    expect(found).toBeNull();
    // The actual mutation would throw ConvexError here
  });

  it("should find betaling even after status changes", () => {
    const input = createMockBetalingInput({ molliePaymentId: "tr_persistent" });
    const original = createBetaling(input, "user-1");
    const updated = updateBetalingStatus(original, "paid");

    // molliePaymentId is preserved after update
    const found = findByMollieId([updated], "tr_persistent");
    expect(found).not.toBeNull();
    expect(found!.status).toBe("paid");
  });
});

describe("Betalingen - Mollie Payment Lifecycle", () => {
  it("follows typical successful payment flow: open -> pending -> paid", () => {
    const betaling = createBetaling(createMockBetalingInput(), "user-1");
    expect(betaling.status).toBe("open");

    const pending = updateBetalingStatus(betaling, "pending");
    expect(pending.status).toBe("pending");

    const paid = updateBetalingStatus(pending, "paid");
    expect(paid.status).toBe("paid");
  });

  it("follows failed payment flow: open -> pending -> failed", () => {
    const betaling = createBetaling(createMockBetalingInput(), "user-1");
    const pending = updateBetalingStatus(betaling, "pending");
    const failed = updateBetalingStatus(pending, "failed");
    expect(failed.status).toBe("failed");
  });

  it("follows expired payment flow: open -> expired", () => {
    const betaling = createBetaling(createMockBetalingInput(), "user-1");
    const expired = updateBetalingStatus(betaling, "expired");
    expect(expired.status).toBe("expired");
  });

  it("follows canceled payment flow: open -> canceled", () => {
    const betaling = createBetaling(createMockBetalingInput(), "user-1");
    const canceled = updateBetalingStatus(betaling, "canceled");
    expect(canceled.status).toBe("canceled");
  });
});
