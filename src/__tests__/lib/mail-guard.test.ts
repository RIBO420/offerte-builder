/**
 * Unit-tests voor de centrale mail-/push-sandbox-guard (fase 0).
 *
 * De guard is fail-closed: alléén de exacte string "true" activeert
 * echt verzenden. Elke andere waarde (afwezig, leeg, "TRUE", "1",
 * "yes", "false") betekent: niet versturen.
 */
import { describe, expect, it } from "vitest";
import {
  isEmailVerzendenActief,
  SANDBOX_EMAIL_REDEN,
  SANDBOX_EMAIL_STATUS,
} from "../../../convex/lib/mailGuard";

describe("mailGuard.isEmailVerzendenActief", () => {
  it("is actief bij exact 'true'", () => {
    expect(isEmailVerzendenActief({ EMAIL_VERZENDEN_ACTIEF: "true" })).toBe(
      true
    );
  });

  it("is fail-closed als de variabele ontbreekt", () => {
    expect(isEmailVerzendenActief({})).toBe(false);
  });

  it("is fail-closed als de variabele undefined is", () => {
    expect(
      isEmailVerzendenActief({ EMAIL_VERZENDEN_ACTIEF: undefined })
    ).toBe(false);
  });

  it("is fail-closed bij lege string", () => {
    expect(isEmailVerzendenActief({ EMAIL_VERZENDEN_ACTIEF: "" })).toBe(false);
  });

  it("is fail-closed bij expliciet 'false'", () => {
    expect(isEmailVerzendenActief({ EMAIL_VERZENDEN_ACTIEF: "false" })).toBe(
      false
    );
  });

  it.each(["TRUE", "True", "1", "yes", "on", " true", "true "])(
    "accepteert variant %j NIET (alleen exact 'true')",
    (waarde) => {
      expect(isEmailVerzendenActief({ EMAIL_VERZENDEN_ACTIEF: waarde })).toBe(
        false
      );
    }
  );

  it("leest standaard uit process.env en is daar fail-closed zonder variabele", () => {
    const origineel = process.env.EMAIL_VERZENDEN_ACTIEF;
    try {
      delete process.env.EMAIL_VERZENDEN_ACTIEF;
      expect(isEmailVerzendenActief()).toBe(false);

      process.env.EMAIL_VERZENDEN_ACTIEF = "true";
      expect(isEmailVerzendenActief()).toBe(true);
    } finally {
      if (origineel === undefined) {
        delete process.env.EMAIL_VERZENDEN_ACTIEF;
      } else {
        process.env.EMAIL_VERZENDEN_ACTIEF = origineel;
      }
    }
  });
});

describe("mailGuard sandbox-constanten", () => {
  it("gebruikt de afgesproken sandbox-status voor emailLogs", () => {
    expect(SANDBOX_EMAIL_STATUS).toBe("onderdrukt (sandbox)");
  });

  it("heeft een uitlegtekst voor het error-veld", () => {
    expect(SANDBOX_EMAIL_REDEN).toContain("EMAIL_VERZENDEN_ACTIEF");
    expect(SANDBOX_EMAIL_REDEN).toContain("onderdrukt");
  });
});
