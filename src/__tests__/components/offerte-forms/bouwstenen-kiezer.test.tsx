/**
 * UI-tests catalogus-stap onderhoud-wizard (PRD §2.5a + bijlage A)
 *
 * - Pakket-tegels preselecteren bouwstenen (daarna vrij aanpasbaar)
 * - Aan/uit-regels met frequentie en prijs per beurt
 * - Live doorrekening: jaarprijs, maandbedrag (÷12), eenmalig apart
 * - Reinigingsreceptuur toont de vaste stapvolgorde
 * - Zand-keuzeregel: beide prijzen zichtbaar, keuze bepaalt de prijs
 */

import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeAll } from "vitest";
import { BouwstenenKiezer } from "@/components/offerte/bouwstenen-kiezer";
import {
  LEGE_CATALOGUS_SELECTIE,
  type BouwsteenDefault,
  type CatalogusSelectie,
} from "@/lib/bouwsteen-offerte";
import { formatSeizoensvenster } from "@/lib/catalogus";
import type { Id } from "../../../../convex/_generated/dataModel";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const id = (s: string) => s as unknown as Id<"bouwstenen">;

const bouwstenen: BouwsteenDefault[] = [
  {
    _id: id("b-maaien"),
    naam: "Gazon maaien",
    code: "GM",
    categorie: "gras_gazon",
    soort: "terugkerend",
    defaultFrequentiePerJaar: 26,
    vensterVanMaand: 3,
    vensterTotMaand: 11,
    urenPerBeurt: 1.5,
    prijsmodel: "uren",
    btwCode: 21,
    defaultPrijsPerBeurt: 97.5,
    uurtarief: 65,
  },
  {
    _id: id("b-analyse"),
    naam: "Gazonanalyse",
    code: "GA",
    categorie: "gras_gazon",
    soort: "eenmalig",
    urenPerBeurt: 2,
    prijsmodel: "uren",
    btwCode: 21,
    defaultPrijsPerBeurt: 130,
    uurtarief: 65,
  },
  {
    _id: id("b-reiniging"),
    naam: "Reinigingsbeurt",
    code: "RB",
    categorie: "reiniging",
    soort: "terugkerend",
    defaultFrequentiePerJaar: 2,
    prijsmodel: "uren",
    urenPerBeurt: 3,
    btwCode: 21,
    defaultPrijsPerBeurt: 195,
    uurtarief: 65,
    receptuurstappen: [
      { volgorde: 1, omschrijving: "Onkruid machinaal borstelen" },
      { volgorde: 2, omschrijving: "Reinigen (Biomix of hogedruk)" },
      { volgorde: 3, omschrijving: "Invegen" },
    ],
  },
  {
    _id: id("b-zand"),
    naam: "Invegen — zand-keuzeregel",
    code: "IZ",
    categorie: "reiniging",
    soort: "keuzeregel",
    defaultFrequentiePerJaar: 2,
    prijsmodel: "vast",
    btwCode: 21,
    defaultPrijsPerBeurt: 45,
    uurtarief: 65,
  },
];

function Harness({
  start = LEGE_CATALOGUS_SELECTIE,
}: {
  start?: CatalogusSelectie;
}) {
  const [catalogus, setCatalogus] = useState<CatalogusSelectie>(start);
  return (
    <BouwstenenKiezer
      bouwstenen={bouwstenen}
      catalogus={catalogus}
      setCatalogus={(updater) =>
        setCatalogus((prev) =>
          typeof updater === "function" ? updater(prev) : updater
        )
      }
    />
  );
}

describe("BouwstenenKiezer", () => {
  it("toont de drie pakket-tegels uit bijlage A en de bouwstenen per categorie", () => {
    render(<Harness />);
    expect(
      screen.getByRole("button", { name: /Onderhoud Tuin/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /De reinigingsreceptuur/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Compleet/ })
    ).toBeInTheDocument();
    expect(screen.getByText("Gras & Gazon")).toBeInTheDocument();
    expect(screen.getByText("Gazon maaien")).toBeInTheDocument();
    // Seizoensvenster als hint (structuurregel 1)
    const venster = formatSeizoensvenster(3, 11)!;
    expect(
      screen.getByText((_, el) => el?.textContent === `Seizoen: ${venster}`)
    ).toBeInTheDocument();
  });

  it("pakket-tegel preselecteert bouwstenen en rekent live door", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByTestId("catalogus-jaarprijs")).toHaveTextContent(
      "0,00"
    );

    await user.click(screen.getByRole("button", { name: /Onderhoud Tuin/ }));

    // Gazon maaien aan: 26 × €97,50 = €2.535 per jaar, €211,25 per maand
    expect(screen.getByTestId("catalogus-jaarprijs")).toHaveTextContent(
      "2.535,00"
    );
    expect(screen.getByTestId("catalogus-maandbedrag")).toHaveTextContent(
      "211,25"
    );
    // Eenmalige bouwsteen (Gazonanalyse) niet automatisch aan
    expect(screen.getByTestId("catalogus-eenmalig")).toHaveTextContent("0,00");
  });

  it("aan/uit-regel: eenmalige bouwsteen telt apart, niet in het maandbedrag", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(
      screen.getByRole("switch", { name: "Gazonanalyse aan/uit" })
    );

    expect(screen.getByTestId("catalogus-eenmalig")).toHaveTextContent(
      "130,00"
    );
    expect(screen.getByTestId("catalogus-maandbedrag")).toHaveTextContent(
      "0,00"
    );
  });

  it("toont de vaste stapvolgorde van de reinigingsreceptuur", () => {
    render(<Harness />);
    expect(screen.getByText("Onkruid machinaal borstelen")).toBeInTheDocument();
    expect(
      screen.getByText("Reinigen (Biomix of hogedruk)")
    ).toBeInTheDocument();
    expect(screen.getByText("Invegen")).toBeInTheDocument();
  });

  it("zand-keuzeregel: beide prijzen zichtbaar en de keuze bepaalt de prijs", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        start={{
          ...LEGE_CATALOGUS_SELECTIE,
          zandPrijzen: { voegzand: 60, straatzand: 35 },
          regels: {
            [String(id("b-zand"))]: {
              aan: true,
              frequentiePerJaar: 2,
              prijsPerBeurt: null,
            },
          },
        }}
      />
    );

    // Beide opties met eigen prijsveld zichtbaar
    expect(screen.getByLabelText("Onkruidvrij voegzand")).toBeInTheDocument();
    expect(screen.getByLabelText("Straatzand")).toBeInTheDocument();

    // Default keuze voegzand: 2 × €60 = €120/jaar
    expect(screen.getByTestId("catalogus-jaarprijs")).toHaveTextContent(
      "120,00"
    );

    await user.click(screen.getByLabelText("Straatzand"));

    // Keuze straatzand: 2 × €35 = €70/jaar
    expect(screen.getByTestId("catalogus-jaarprijs")).toHaveTextContent(
      "70,00"
    );
  });

  it("toont de (i)-toelichting hoe de default-prijs tot stand komt (principe 6)", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(
      screen.getByRole("switch", { name: "Gazon maaien aan/uit" })
    );
    await user.hover(
      screen.getByRole("button", {
        name: "Toelichting default-prijs Gazon maaien",
      })
    );

    const tooltips = await screen.findAllByText(
      /1\.5 uur × € 65\.00 uurtarief/
    );
    expect(tooltips.length).toBeGreaterThan(0);
  });
});
