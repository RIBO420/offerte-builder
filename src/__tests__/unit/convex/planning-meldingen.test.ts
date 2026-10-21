import { describe, it, expect } from "vitest";
import { geraakteDagen } from "../../../../convex/planningMeldingen";

describe("planningmeldingen (fase 4)", () => {
  const vandaag = "2026-10-21";
  it("alleen vandaag en morgen tellen, oud of nieuw", () => {
    expect(geraakteDagen([{ start: "2026-10-22", eind: "2026-10-24" }], vandaag)).toEqual(["2026-10-22"]);
    expect(geraakteDagen([{ start: "2026-10-19", eind: "2026-10-23" }], vandaag)).toEqual([
      "2026-10-21",
      "2026-10-22",
    ]);
    expect(geraakteDagen([{ start: "2026-10-28" }, {}], vandaag)).toEqual([]);
    // verschoven van morgen naar volgende week: de oude dag telt
    expect(geraakteDagen([{ start: "2026-10-22" }, { start: "2026-10-29" }], vandaag)).toEqual([
      "2026-10-22",
    ]);
  });
});
