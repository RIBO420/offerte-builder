/**
 * R1 — eerlijke lege staten.
 *
 * De oude /rapportages vulde lege secties met verzonnen data: fictieve
 * medewerkers, een winstmarge van 25,9% en sparklines die altijd omhoog wezen.
 * Deze tests leggen het tegenovergestelde vast: is er niets, dan zégt de sectie
 * dat, vertelt hij wanneer er wél iets staat, en verzint hij geen percentage.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SectieHoeLoopt } from "@/app/(dashboard)/rapportages/components/sectie-hoe-loopt";
import { SectiePipeline } from "@/app/(dashboard)/rapportages/components/sectie-pipeline";
import { SectieGeldLigt } from "@/app/(dashboard)/rapportages/components/sectie-geld-ligt";
import { SectieBesteWerk } from "@/app/(dashboard)/rapportages/components/sectie-beste-werk";
import type {
  BesteWerk,
  GeldLigt,
  HoeLoopt,
  Periode,
  Pipeline,
} from "@/app/(dashboard)/rapportages/components/types";

const LEGE_CIJFERS = {
  getekendeOmzetExclBtw: 0,
  getekendeOmzetInclBtw: 0,
  getekendeMarge: 0,
  getekendeMargePercentage: 0,
  aantalGetekend: 0,
  gemiddeldeOpdrachtwaarde: 0,
  gefactureerdInclBtw: 0,
  gefactureerdExclBtw: 0,
  aantalFacturen: 0,
  ontvangen: 0,
  openstaand: 0,
  vervallenBedrag: 0,
  aantalVervallen: 0,
};

const PERIODE: Periode = {
  preset: "deze-maand",
  soort: "maand",
  label: "Augustus 2026",
  start: new Date(2026, 7, 1).getTime(),
  eind: new Date(2026, 8, 1).getTime(),
  isLopend: true,
  voortgangFractie: 0.5,
  vorigePeriode: {
    soort: "maand",
    label: "Juli 2026",
    start: new Date(2026, 6, 1).getTime(),
    eind: new Date(2026, 7, 1).getTime(),
    isLopend: false,
    voortgangFractie: 1,
  },
  zelfdePeriodeVorigJaar: {
    soort: "maand",
    label: "Augustus 2025",
    start: new Date(2025, 7, 1).getTime(),
    eind: new Date(2025, 8, 1).getTime(),
    isLopend: false,
    voortgangFractie: 1,
  },
};

const LEGE_HOE_LOOPT: HoeLoopt = {
  huidig: LEGE_CIJFERS,
  vorigePeriode: null,
  zelfdePeriodeVorigJaar: null,
  verschil: {
    getekendeOmzetVsVorigePeriode: null,
    getekendeOmzetVsVorigJaar: null,
    gefactureerdVsVorigePeriode: null,
    gefactureerdVsVorigJaar: null,
  },
  maandReeks: [],
};

const LEGE_PIPELINE: Pipeline = {
  openStatussen: {
    concept: 0,
    voorcalculatie: 0,
    verzonden: 0,
    geaccepteerd: 0,
    afgewezen: 0,
    pipelineTotaal: 0,
  },
  openWaardeInclBtw: 0,
  funnel: {
    voorcalculatie: 0,
    verzonden: 0,
    afgehandeld: 0,
    geaccepteerd: 0,
  },
  conversie: {
    voorcalculatieToVerzonden: 0,
    verzondenToAfgehandeld: 0,
    afgehandeldToWon: 0,
    overallConversion: 0,
  },
  conversieInPeriode: {
    voorcalculatieToVerzonden: 0,
    verzondenToAfgehandeld: 0,
    afgehandeldToWon: 0,
    overallConversion: 0,
  },
  aangemaaktInPeriode: 0,
  blijftLiggen: [],
  aantalBlijftLiggen: 0,
  drempelDagen: 14,
};

const LEGE_GELD_LIGT: GeldLigt = {
  openstaand: {
    regels: [],
    totaalOpenstaand: 0,
    perBucket: {
      nog_niet_vervallen: { bedrag: 0, aantal: 0 },
      "1_30_dagen": { bedrag: 0, aantal: 0 },
      "31_60_dagen": { bedrag: 0, aantal: 0 },
      ouder_dan_60_dagen: { bedrag: 0, aantal: 0 },
    },
    gemiddeldeOuderdomDagen: 0,
  },
  voorNacalculatie: {
    aantalProjecten: 0,
    accurateProjecten: 0,
    accuratessePercentage: 0,
    geplandeUren: 0,
    werkelijkeUren: 0,
    afwijkingUren: 0,
    afwijkingPercentage: 0,
    afwijkingEuro: 0,
    uurtarief: 45,
    projecten: [],
    scopes: [],
    projectenZonderNacalculatie: 0,
  },
};

const LEGE_BESTE_WERK: BesteWerk = {
  scopeMarges: [],
  topKlanten: [],
  aantalKlanten: 0,
  aantalTerugkerend: 0,
  margePercentage: 0,
  marge: 0,
};

/** Geen enkele sectie mag een percentage verzinnen als er niets te delen valt. */
function geenVerzonnenPercentage() {
  expect(document.body.textContent).not.toMatch(/\+?100\s?%/);
  expect(document.body.textContent).not.toContain("NaN");
  expect(document.body.textContent).not.toContain("Infinity");
}

describe("lege staten per vraagsectie", () => {
  it("sectie 1 zegt dat er niets getekend is en wanneer er wél iets staat", () => {
    render(<SectieHoeLoopt hoeLoopt={LEGE_HOE_LOOPT} periode={PERIODE} />);
    expect(
      screen.getByText(/nog niets getekend of gefactureerd/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/verschijnt hier de omzet/i)).toBeInTheDocument();
    geenVerzonnenPercentage();
  });

  it("sectie 2 zegt dat er geen offerte open staat", () => {
    render(<SectiePipeline pipeline={LEGE_PIPELINE} periode={PERIODE} />);
    expect(screen.getByText(/geen offerte open/i)).toBeInTheDocument();
    geenVerzonnenPercentage();
  });

  it("sectie 3 zegt dat er geen geld stilstaat", () => {
    render(
      <SectieGeldLigt
        geldLigt={LEGE_GELD_LIGT}
        periode={PERIODE}
        preset="deze-maand"
      />
    );
    expect(screen.getByText(/geen geld stil/i)).toBeInTheDocument();
    geenVerzonnenPercentage();
  });

  it("sectie 3 meldt eerlijk dat het beeld onvolledig is", () => {
    render(
      <SectieGeldLigt
        geldLigt={{
          ...LEGE_GELD_LIGT,
          voorNacalculatie: {
            ...LEGE_GELD_LIGT.voorNacalculatie,
            projectenZonderNacalculatie: 3,
          },
        }}
        periode={PERIODE}
        preset="deze-maand"
      />
    );
    expect(
      screen.getByText(/3 afgeronde projecten nog op een nacalculatie/i)
    ).toBeInTheDocument();
  });

  it("sectie 4 zegt dat er nog geen werk getekend is", () => {
    render(<SectieBesteWerk besteWerk={LEGE_BESTE_WERK} periode={PERIODE} />);
    expect(
      screen.getByText(/nog geen werk getekend/i)
    ).toBeInTheDocument();
    geenVerzonnenPercentage();
  });
});

describe("ontbrekende vergelijking", () => {
  it("toont 'geen gegevens over die periode' in plaats van een verzonnen groei", () => {
    render(
      <SectieHoeLoopt
        hoeLoopt={{
          ...LEGE_HOE_LOOPT,
          huidig: {
            ...LEGE_CIJFERS,
            getekendeOmzetExclBtw: 12500,
            getekendeOmzetInclBtw: 15125,
            aantalGetekend: 2,
            gemiddeldeOpdrachtwaarde: 6250,
          },
        }}
        periode={PERIODE}
      />
    );
    // Beide vergelijkingen missen een basis: vorige maand was leeg, en de
    // demodata heeft geen jaarhistorie. Dat is geen +100%, dat is geen basis.
    expect(
      screen.getAllByText("geen gegevens over die periode")
    ).toHaveLength(2);
    expect(screen.getByText("Juli 2026")).toBeInTheDocument();
    expect(screen.getByText("Augustus 2025")).toBeInTheDocument();
    geenVerzonnenPercentage();
  });

  it("vertaalt de scopes in de ranglijst naar mensentaal", () => {
    render(
      <SectieBesteWerk
        besteWerk={{
          ...LEGE_BESTE_WERK,
          aantalKlanten: 1,
          scopeMarges: [
            {
              scope: "water_elektra",
              omzetExclBtw: 8000,
              marge: 2400,
              margePercentage: 30,
              aantalOffertes: 2,
              aandeelPercentage: 100,
            },
          ],
        }}
        periode={PERIODE}
      />
    );
    expect(screen.getAllByText(/Water & elektra/).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain("water_elektra");
  });
});
