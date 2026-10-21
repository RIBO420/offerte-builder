/**
 * Nummerreeksen (HERO-nabouw): het jaarformaat blijft zoals het was, het
 * doorlopende formaat gaat verder waar HERO stopt (01399, FACT01129).
 */

import { describe, it, expect } from "vitest";
import { ConvexError } from "convex/values";
import {
  formatteerDocumentNummer,
  formatteerFactuurNummer,
  offerteReeks,
  factuurReeks,
  valideerNummerreeks,
} from "../../../../convex/lib/documentNummer";
import { formatteerOfferteNummer } from "../../../../convex/lib/offerteNummer";

describe("formatteerDocumentNummer", () => {
  it("jaarformaat is gelijk aan het bestaande offerteformaat", () => {
    const reeks = { prefix: "OFF-", formaat: "jaar" as const, cijfers: 5 };
    expect(formatteerDocumentNummer(reeks, 7, 2026)).toBe("OFF-2026-007");
    expect(formatteerDocumentNummer(reeks, 7, 2026)).toBe(
      formatteerOfferteNummer("OFF-", 2026, 7)
    );
  });

  it("doorlopend volgt HERO: offerte 01400 na 01399", () => {
    const reeks = { prefix: "", formaat: "doorlopend" as const, cijfers: 5 };
    expect(formatteerDocumentNummer(reeks, 1400, 2026)).toBe("01400");
  });

  it("doorlopend met voorvoegsel: FACT01130", () => {
    const reeks = { prefix: "FACT", formaat: "doorlopend" as const, cijfers: 5 };
    expect(formatteerDocumentNummer(reeks, 1130, 2027)).toBe("FACT01130");
  });
});

describe("reeksen uit instellingen", () => {
  it("zonder nieuwe velden blijft alles bij het oude", () => {
    const inst = { offerteNummerPrefix: "OFF-" };
    expect(offerteReeks(inst).formaat).toBe("jaar");
    expect(factuurReeks(inst)).toMatchObject({ prefix: "FAC-", formaat: "jaar" });
    expect(formatteerFactuurNummer(inst, 12, 2026)).toBe("FAC-2026-012");
    expect(formatteerFactuurNummer(inst, 12, 2026, "creditnota")).toBe(
      "CN-2026-012"
    );
  });

  it("doorlopend: creditnota deelt voorvoegsel en teller met de factuur", () => {
    const inst = {
      offerteNummerPrefix: "",
      factuurNummerPrefix: "FACT",
      factuurNummerFormaat: "doorlopend" as const,
      factuurNummerCijfers: 5,
    };
    expect(formatteerFactuurNummer(inst, 1130, 2026)).toBe("FACT01130");
    expect(formatteerFactuurNummer(inst, 1131, 2026, "creditnota")).toBe(
      "FACT01131"
    );
  });
});

describe("valideerNummerreeks", () => {
  const doorlopend = { prefix: "", formaat: "doorlopend" as const, cijfers: 5 };

  it("accepteert het HERO-startnummer", () => {
    expect(() => valideerNummerreeks(doorlopend, 1400, 12)).not.toThrow();
  });

  it("weigert een nummer dat al uitgegeven is", () => {
    expect(() => valideerNummerreeks(doorlopend, 12, 12)).toThrow(ConvexError);
  });

  it("weigert een nummer dat niet in het aantal cijfers past", () => {
    expect(() => valideerNummerreeks(doorlopend, 100000, 0)).toThrow(
      /past niet/
    );
  });

  it("weigert een voorvoegsel met spaties", () => {
    expect(() =>
      valideerNummerreeks({ ...doorlopend, prefix: "FA CT" }, 1, 0)
    ).toThrow(ConvexError);
  });
});
