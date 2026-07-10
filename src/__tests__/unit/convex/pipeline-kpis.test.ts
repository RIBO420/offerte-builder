/**
 * §5.3b (PRD §2.5e): concept-offertes (wizard auto-save) tellen niet mee
 * in pipeline-KPI's. Tests voor de pure helpers in convex/lib/pipelineKpis.ts.
 */
import { describe, it, expect } from "vitest";
import {
  filterConceptenUit,
  berekenPipelineFunnel,
  berekenConversionRates,
} from "../../../../convex/lib/pipelineKpis";

describe("filterConceptenUit", () => {
  it("filtert concept-offertes uit de lijst", () => {
    const offertes = [
      { status: "concept", totalen: { totaalInclBtw: 100 } },
      { status: "voorcalculatie", totalen: { totaalInclBtw: 200 } },
      { status: "verzonden", totalen: { totaalInclBtw: 300 } },
      { status: "concept", totalen: { totaalInclBtw: 400 } },
      { status: "geaccepteerd", totalen: { totaalInclBtw: 500 } },
      { status: "afgewezen", totalen: { totaalInclBtw: 600 } },
    ];

    const pipeline = filterConceptenUit(offertes);

    expect(pipeline).toHaveLength(4);
    expect(pipeline.every((o) => o.status !== "concept")).toBe(true);
  });

  it("laat een lijst zonder concepten ongemoeid", () => {
    const offertes = [
      { status: "verzonden" },
      { status: "geaccepteerd" },
    ];
    expect(filterConceptenUit(offertes)).toEqual(offertes);
  });

  it("geeft een lege lijst terug bij alleen concepten", () => {
    const offertes = [{ status: "concept" }, { status: "concept" }];
    expect(filterConceptenUit(offertes)).toEqual([]);
  });

  it("werkt met een lege lijst", () => {
    expect(filterConceptenUit([])).toEqual([]);
  });

  it("pipeline-totaalwaarde telt concepten niet mee", () => {
    const offertes = [
      { status: "concept", totalen: { totaalInclBtw: 1000 } },
      { status: "verzonden", totalen: { totaalInclBtw: 250 } },
      { status: "geaccepteerd", totalen: { totaalInclBtw: 750 } },
    ];

    const totaalWaarde = filterConceptenUit(offertes).reduce(
      (sum, o) => sum + (o.totalen?.totaalInclBtw ?? 0),
      0
    );

    expect(totaalWaarde).toBe(1000); // 250 + 750, zonder het concept van 1000
  });
});

describe("berekenPipelineFunnel", () => {
  it("bouwt een cumulatieve funnel vanaf voorcalculatie (zonder concept-stage)", () => {
    const funnel = berekenPipelineFunnel({
      voorcalculatie: 2,
      verzonden: 3,
      geaccepteerd: 4,
      afgewezen: 1,
    });

    expect(funnel).toEqual({
      voorcalculatie: 10, // 2 + 3 + 4 + 1
      verzonden: 8, // 3 + 4 + 1
      afgehandeld: 5, // 4 + 1
      geaccepteerd: 4,
    });
    expect(funnel).not.toHaveProperty("concept");
  });

  it("geeft nullen terug bij een lege pipeline", () => {
    const funnel = berekenPipelineFunnel({
      voorcalculatie: 0,
      verzonden: 0,
      geaccepteerd: 0,
      afgewezen: 0,
    });

    expect(funnel).toEqual({
      voorcalculatie: 0,
      verzonden: 0,
      afgehandeld: 0,
      geaccepteerd: 0,
    });
  });
});

describe("berekenConversionRates", () => {
  it("berekent conversieratio's tussen de stages", () => {
    const rates = berekenConversionRates({
      voorcalculatie: 10,
      verzonden: 8,
      afgehandeld: 5,
      geaccepteerd: 4,
    });

    expect(rates).toEqual({
      voorcalculatieToVerzonden: 80, // 8/10
      verzondenToAfgehandeld: 63, // 5/8 afgerond
      afgehandeldToWon: 80, // 4/5
      overallConversion: 40, // 4/10
    });
  });

  it("geeft 0% terug bij lege noemers (geen deling door nul)", () => {
    const rates = berekenConversionRates({
      voorcalculatie: 0,
      verzonden: 0,
      afgehandeld: 0,
      geaccepteerd: 0,
    });

    expect(rates).toEqual({
      voorcalculatieToVerzonden: 0,
      verzondenToAfgehandeld: 0,
      afgehandeldToWon: 0,
      overallConversion: 0,
    });
  });

  it("overallConversion is gewonnen t.o.v. de volledige pipeline-instroom", () => {
    const rates = berekenConversionRates({
      voorcalculatie: 4,
      verzonden: 4,
      afgehandeld: 4,
      geaccepteerd: 2,
    });
    expect(rates.overallConversion).toBe(50);
  });
});
