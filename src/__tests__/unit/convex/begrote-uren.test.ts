import { describe, it, expect } from "vitest";
import { begroteUrenVanOfferte, begroteUrenVoorRegels } from "../../../../convex/lib/begroteUren";

const offerte = {
  totalen: { totaalUren: 12 },
  regels: [
    { id: "a", totaal: 3000 },
    { id: "b", totaal: 1000 },
  ],
};

describe("begrote manuren (fase 1b)", () => {
  it("met de hand ingevulde uren winnen van de calculatie", () => {
    expect(begroteUrenVanOfferte({ ...offerte, begroteUren: 48 })).toBe(48);
    expect(begroteUrenVanOfferte(offerte)).toBe(12);
    expect(begroteUrenVanOfferte({ totalen: { totaalUren: 0 } })).toBeUndefined();
  });

  it("een werkitem met een deel van de regels krijgt het deel van de uren", () => {
    const o = { ...offerte, begroteUren: 48 };
    expect(begroteUrenVoorRegels(o, ["a"])).toBe(36);
    expect(begroteUrenVoorRegels(o, ["b"])).toBe(12);
    expect(begroteUrenVoorRegels(o, undefined)).toBe(48);
  });
});
