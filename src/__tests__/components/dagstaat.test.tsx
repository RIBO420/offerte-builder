/**
 * De dagstaat vervangt het oude dashboard van 2205px hoog. Twee dingen die
 * daarbij makkelijk stilletjes terugvallen, staan hier vast:
 *
 * 1. De kop ís de samenvatting. De tellers ("15 offertes · 11 projecten") die
 *    eerst als losse regel onder de begroeting stonden, zijn erin opgegaan —
 *    inclusief enkelvoud/meervoud, want "1 dingen vragen je aandacht" leest als
 *    een bug.
 * 2. Lijsten cappen, maar amputeren niet. "Aandacht nodig" toont vier regels en
 *    houdt de rest één klik weg; die klik moet er ook echt zijn, anders is het
 *    verstoppen.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  dagstaatClausules,
  dagstaatZin,
  DagstaatKop,
} from "@/components/dashboard/dagstaat-kop";
import { AandachtNodig } from "@/components/dashboard/aandacht-nodig";

const GEEN_CIJFERS = {
  aandacht: 0,
  takenOpen: 0,
  projectenLopend: 0,
  offertesPipeline: 0,
};

describe("dagstaatClausules", () => {
  it("meldt rust als er niets openstaat, en laat lege tellers weg", () => {
    expect(dagstaatClausules(GEEN_CIJFERS)).toEqual([
      { getal: "niets", staart: "vraagt je aandacht" },
    ]);
  });

  it("houdt enkelvoud en meervoud uit elkaar", () => {
    const enkel = dagstaatClausules({
      aandacht: 1,
      takenOpen: 1,
      projectenLopend: 1,
      offertesPipeline: 1,
    }).map((c) => c.staart);

    expect(enkel).toEqual([
      "ding vraagt je aandacht",
      "taak staat open",
      "project loopt",
      "offerte in de pipeline",
    ]);

    const meervoud = dagstaatClausules({
      aandacht: 3,
      takenOpen: 2,
      projectenLopend: 2,
      offertesPipeline: 15,
    }).map((c) => c.staart);

    expect(meervoud).toEqual([
      "dingen vragen je aandacht",
      "taken staan open",
      "projecten lopen",
      "offertes in de pipeline",
    ]);
  });

  it("bouwt één leesbare regel van begroeting plus stand van zaken", () => {
    expect(
      dagstaatZin("Goedemiddag, Ricardo", {
        aandacht: 3,
        takenOpen: 0,
        projectenLopend: 2,
        offertesPipeline: 15,
      })
    ).toBe(
      "Goedemiddag, Ricardo — 3 dingen vragen je aandacht, 2 projecten lopen, 15 offertes in de pipeline."
    );
  });
});

describe("DagstaatKop", () => {
  it("zet de tellers in de kopregel zelf, niet in een tweede regel eronder", () => {
    render(
      <DagstaatKop
        groet="Goedemiddag, Ricardo"
        cijfers={{
          aandacht: 3,
          takenOpen: 4,
          projectenLopend: 2,
          offertesPipeline: 15,
        }}
        actie={<button type="button">Nieuwe offerte</button>}
      />
    );

    const kop = screen.getByRole("heading", { level: 1 });
    expect(kop.textContent?.replace(/\s+/g, " ")).toBe(
      "Goedemiddag, Ricardo — 3 dingen vragen je aandacht, 4 taken staan open, 2 projecten lopen, 15 offertes in de pipeline."
    );
    // De actie hangt ernaast, niet erin: de knop is eigendom van een ander blok.
    expect(kop).not.toContainElement(
      screen.getByRole("button", { name: "Nieuwe offerte" })
    );
  });
});

const waarschuwing = (n: number) => ({
  id: `w${n}`,
  type: "conflict",
  prioriteit: "hoog" as const,
  titel: `Dubbele planning ${n}`,
  beschrijving: `Toelichting ${n}`,
  actie: "Herplan één van de projecten",
});

describe("AandachtNodig", () => {
  it("blijft één regel als er niets openstaat — geen gat in de bento", () => {
    render(<AandachtNodig acceptedWithoutProject={[]} warnings={[]} />);

    expect(screen.getByText("Niets vraagt je aandacht")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("capt op vier regels en houdt de rest één klik weg", async () => {
    const user = userEvent.setup();
    render(
      <AandachtNodig
        acceptedWithoutProject={[]}
        warnings={[1, 2, 3, 4, 5, 6].map(waarschuwing)}
      />
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.queryByText("Dubbele planning 5")).not.toBeInTheDocument();

    const doorklik = screen.getByRole("button", { name: /Alle 6 tonen/ });
    expect(doorklik).toHaveAttribute("aria-expanded", "false");

    await user.click(doorklik);

    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByText("Dubbele planning 5")).toBeInTheDocument();
  });

  it("zet getekende offertes zonder project bovenaan, mét knop", () => {
    render(
      <AandachtNodig
        acceptedWithoutProject={[
          { _id: "o1", offerteNummer: "OFF-2026-001", klantNaam: "Hermans" },
        ]}
        warnings={[waarschuwing(1)]}
      />
    );

    const regels = screen.getAllByRole("listitem");
    expect(regels[0]).toHaveTextContent("Hermans");
    expect(
      screen.getByRole("link", { name: "Start project" })
    ).toHaveAttribute("href", "/projecten/nieuw?offerte=o1");
  });

  it("stuurt elk signaal naar het scherm waar je het oplost", () => {
    render(
      <AandachtNodig
        acceptedWithoutProject={[]}
        warnings={[
          { ...waarschuwing(1), type: "financieel", actie: "Verstuur aanmaningen" },
          { ...waarschuwing(2), type: "keuring", actie: "Plan APK keuring" },
        ]}
      />
    );

    expect(
      screen.getByRole("link", { name: /Verstuur aanmaningen/ })
    ).toHaveAttribute("href", "/facturen");
    expect(screen.getByRole("link", { name: /Plan APK keuring/ })).toHaveAttribute(
      "href",
      "/wagenpark"
    );
  });
});
