/**
 * Het planningsoverzicht groepeerde projecten eerst op hun aanmaakweek en las
 * daardoor als een planning die er niet was. De banen volgen nu de werkelijke
 * stand; dat staat hier vast.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  PlanningBanen,
  verdeelOverBanen,
  type PlanningProject,
} from "@/components/planning/planning-banen";

function project(over: Partial<PlanningProject>): PlanningProject {
  return {
    projectId: over.projectNaam ?? "p",
    projectNaam: "Project",
    klantNaam: "Klant",
    status: "gepland",
    geplandeUren: 10,
    gewerktUren: 0,
    totaalTaken: 0,
    afgerondeTaken: 0,
    geschatteDagen: 0,
    teamleden: [],
    geplandeStart: null,
    geplandeEind: null,
    teamNaam: null,
    ...over,
  };
}

describe("verdeelOverBanen", () => {
  it("zet in uitvoering, ingepland en zonder datum in hun eigen baan", () => {
    const indeling = verdeelOverBanen(
      [
        project({ projectNaam: "Loopt", status: "in_uitvoering", geplandeStart: "2026-10-01" }),
        project({ projectNaam: "Datum", geplandeStart: "2026-10-20", geplandeEind: "2026-10-22" }),
        project({ projectNaam: "Geen datum" }),
      ],
      "2026-10-18"
    );

    expect(indeling.inUitvoering.map((p) => p.projectNaam)).toEqual(["Loopt"]);
    expect(indeling.ingepland.map((p) => p.projectNaam)).toEqual(["Datum"]);
    expect(indeling.zonderDatum.map((p) => p.projectNaam)).toEqual(["Geen datum"]);
    expect(indeling.verlopen).toEqual([]);
  });

  it("markeert ingepland werk als verlopen zodra de einddatum voorbij is", () => {
    const indeling = verdeelOverBanen(
      [
        project({ projectNaam: "Voorbij", geplandeStart: "2026-10-13", geplandeEind: "2026-10-15" }),
        project({ projectNaam: "Vandaag klaar", geplandeStart: "2026-10-17", geplandeEind: "2026-10-18" }),
      ],
      "2026-10-18"
    );

    expect(indeling.verlopen.map((p) => p.projectNaam)).toEqual(["Voorbij"]);
    // Verlopen blijft óók in de baan staan: het is nog steeds ingepland werk.
    expect(indeling.ingepland).toHaveLength(2);
  });

  it("sorteert ingepland werk op startdatum", () => {
    const indeling = verdeelOverBanen(
      [
        project({ projectNaam: "Later", geplandeStart: "2026-11-02" }),
        project({ projectNaam: "Eerder", geplandeStart: "2026-10-20" }),
      ],
      "2026-10-18"
    );

    expect(indeling.ingepland.map((p) => p.projectNaam)).toEqual(["Eerder", "Later"]);
  });
});

describe("PlanningBanen", () => {
  it("toont uren over de begroting in tekst, niet alleen in kleur", () => {
    render(
      <PlanningBanen
        indeling={verdeelOverBanen(
          [
            project({
              projectNaam: "Gazon Hermans",
              status: "in_uitvoering",
              geplandeUren: 42,
              gewerktUren: 43.5,
            }),
          ],
          "2026-10-18"
        )}
      />
    );

    expect(screen.getByText("104%")).toBeInTheDocument();
    expect(screen.getByText(/43,5 van 42 u · 1,5 u over/)).toBeInTheDocument();
  });
});
