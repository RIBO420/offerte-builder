/**
 * Unit tests harde acceptatie-validatie (PRD §2.5 "Overgang naar de keten",
 * §8.11 twee-routes-test).
 *
 * Test de pure beslisregels uit convex/acceptatieRegels.ts die
 * offertes.updateStatus uitvoert bij de overgang naar "geaccepteerd":
 * - geen acceptatie zonder ten minste één werkitem (beide routes, harde fout)
 * - route 1 (bouwsteenRegels) → automatisch concept-contract
 * - route 2 (vrij) → alleen ná koppeling (werkitem of contract aanwezig)
 * - aanleg-wizard → project bij acceptatie (bestaand gedrag blijft werken)
 */

import { describe, it, expect } from "vitest";
import {
  beoordeelAcceptatie,
  ACCEPTATIE_GEWEIGERD_REDEN,
  type AcceptatieContext,
} from "../../../../convex/acceptatieRegels";

const context = (over: Partial<AcceptatieContext> = {}): AcceptatieContext => ({
  type: "onderhoud",
  bron: undefined,
  heeftWerkitem: false,
  heeftContract: false,
  aantalBouwsteenRegels: 0,
  heeftVoorcalculatie: false,
  ...over,
});

describe("harde validatie: geen 'geaccepteerd' zonder werkitem", () => {
  it("weigert een vrije offerte (route 2) zonder koppeling, met duidelijke reden", () => {
    const besluit = beoordeelAcceptatie(
      context({ type: "aanleg", bron: "vrij" })
    );
    expect(besluit.toegestaan).toBe(false);
    if (!besluit.toegestaan) {
      expect(besluit.reden).toBe(ACCEPTATIE_GEWEIGERD_REDEN);
      expect(besluit.reden).toMatch(/koppel/i);
    }
  });

  it("weigert ook een wizard-offerte zonder enige keten-uitgang (route 1 én 2)", () => {
    expect(
      beoordeelAcceptatie(context({ type: "onderhoud" })).toegestaan
    ).toBe(false);
    expect(
      beoordeelAcceptatie(context({ type: "aanleg" })).toegestaan
    ).toBe(false);
  });

  it("een vrije onderhoud-offerte zonder koppeling wordt geweigerd, ook mét voorcalculatie", () => {
    const besluit = beoordeelAcceptatie(
      context({ type: "onderhoud", bron: "vrij", heeftVoorcalculatie: true })
    );
    expect(besluit.toegestaan).toBe(false);
  });

  it("een vrije aanleg-offerte gaat niet via de project-automaat (bron vrij ≠ wizard)", () => {
    const besluit = beoordeelAcceptatie(
      context({ type: "aanleg", bron: "vrij", heeftVoorcalculatie: true })
    );
    expect(besluit.toegestaan).toBe(false);
  });
});

describe("route 2 (vrij): acceptatie ná de koppel-dialoog", () => {
  it("met een gekoppeld werkitem (project of losse beurt) mag acceptatie door", () => {
    const besluit = beoordeelAcceptatie(
      context({ type: "aanleg", bron: "vrij", heeftWerkitem: true })
    );
    expect(besluit).toEqual({ toegestaan: true, actie: "geen" });
  });

  it("met een al aangemaakt contract mag acceptatie door", () => {
    const besluit = beoordeelAcceptatie(
      context({ type: "onderhoud", bron: "vrij", heeftContract: true })
    );
    expect(besluit).toEqual({ toegestaan: true, actie: "geen" });
  });

  it("regels gekoppeld aan bouwstenen mét frequentie → concept-contract als keten", () => {
    // Koppel-dialoog schrijft bouwsteenRegels op de offerte; acceptatie
    // maakt daarna automatisch het concept-contract aan.
    const besluit = beoordeelAcceptatie(
      context({ type: "onderhoud", bron: "vrij", aantalBouwsteenRegels: 2 })
    );
    expect(besluit).toEqual({
      toegestaan: true,
      actie: "contract_aanmaken",
    });
  });
});

describe("route 1 (wizard): automatische keten", () => {
  it("onderhoud met bouwsteenRegels → concept-contract aanmaken bij acceptatie", () => {
    const besluit = beoordeelAcceptatie(
      context({ type: "onderhoud", aantalBouwsteenRegels: 3 })
    );
    expect(besluit).toEqual({
      toegestaan: true,
      actie: "contract_aanmaken",
    });
  });

  it("bestaat het contract al (her-acceptatie), dan geen tweede actie", () => {
    const besluit = beoordeelAcceptatie(
      context({
        type: "onderhoud",
        aantalBouwsteenRegels: 3,
        heeftContract: true,
      })
    );
    expect(besluit).toEqual({ toegestaan: true, actie: "geen" });
  });

  it("aanleg-wizard (voorcalculatie aanwezig) → project aanmaken bij acceptatie", () => {
    const besluit = beoordeelAcceptatie(
      context({ type: "aanleg", heeftVoorcalculatie: true })
    );
    expect(besluit).toEqual({ toegestaan: true, actie: "project_aanmaken" });
  });

  it("aanleg-wizard met al bestaand project (bestaand gedrag) → geen dubbele actie", () => {
    const besluit = beoordeelAcceptatie(
      context({
        type: "aanleg",
        heeftVoorcalculatie: true,
        heeftWerkitem: true,
      })
    );
    expect(besluit).toEqual({ toegestaan: true, actie: "geen" });
  });
});
