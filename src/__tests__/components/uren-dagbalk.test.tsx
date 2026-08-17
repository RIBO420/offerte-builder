/**
 * De dagbalk is de nieuwe kernvisual van de urenketen: één werkdag als blokken
 * op een tijd-as, in de wachtrij, in lijsten en later in de ploegenfilm. Drie
 * dingen mogen daar nooit meer wegzakken:
 *
 * 1. **Hij schaalt, hij scrollt niet.** Alle blokken staan op percentages van de
 *    as en blijven binnen 0–100%. Een segment buiten 06:00–18:00 rekt de as op
 *    in plaats van afgeknipt te worden (CLAUDE.md regel 1).
 * 2. **Zeven categorieën, vijf kleurfamilies** — en het gat tussen twee
 *    segmenten is een eigen, gearceerd blok.
 * 3. **Kleur is nooit de enige drager**: elk blok heeft een naam ("werken
 *    07:15–12:00, Dohmen"), de balk als geheel vertelt de dag in één zin.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Dagbalk,
  dagbalkBeschrijving,
  dagbalkBlokken,
} from "@/components/uren/dagbalk";
import type { DagSegment } from "@/components/uren/controle-types";

const DAG: DagSegment[] = [
  { beginTijd: "06:30", eindTijd: "07:00", categorie: "reistijd" },
  { beginTijd: "07:00", eindTijd: "12:00", categorie: "werken", label: "Dohmen" },
  { beginTijd: "12:00", eindTijd: "12:30", categorie: "pauze" },
  // Gat van 12:30 tot 13:30 — geen registratie.
  { beginTijd: "13:30", eindTijd: "16:00", categorie: "werken", label: "Hermans" },
  { beginTijd: "16:00", eindTijd: "16:45", categorie: "onderhoud_materiaal" },
];

describe("Dagbalk: de schaal", () => {
  it("zet segmenten op percentages van de as en blijft binnen de balk", () => {
    const { blokken, asVan, asTot } = dagbalkBlokken(DAG);

    expect(asVan).toBe(6 * 60);
    expect(asTot).toBe(18 * 60);

    // 07:00–12:00 op een as van twaalf uur: begint op 1/12, duurt 5/12.
    const werken = blokken.find((b) => b.beginTijd === "07:00");
    expect(werken?.links).toBeCloseTo(100 / 12, 5);
    expect(werken?.breedte).toBeCloseTo((5 / 12) * 100, 5);

    for (const blok of blokken) {
      expect(blok.links).toBeGreaterThanOrEqual(0);
      // Geen enkel blok mag over de rechterrand heen: dát is het verschil
      // tussen schalen en zijwaarts scrollen.
      expect(blok.links + blok.breedte).toBeLessThanOrEqual(100.0001);
    }
  });

  it("rekt de as op voor een segment buiten 06:00–18:00 in plaats van het af te knippen", () => {
    const { blokken, asVan, asTot } = dagbalkBlokken([
      { beginTijd: "04:40", eindTijd: "06:00", categorie: "reistijd" },
      { beginTijd: "06:00", eindTijd: "19:20", categorie: "werken", label: "Storm" },
    ]);

    // Naar het hele uur eronder/erboven: 04:00–20:00.
    expect(asVan).toBe(4 * 60);
    expect(asTot).toBe(20 * 60);
    expect(blokken[0].links).toBeCloseTo((40 / 960) * 100, 5);
    expect(blokken.at(-1)!.links + blokken.at(-1)!.breedte).toBeLessThanOrEqual(
      100.0001
    );
  });

  it("geeft een heel kort segment een zichtbare ondergrens", () => {
    const { blokken } = dagbalkBlokken([
      { beginTijd: "08:00", eindTijd: "08:03", categorie: "werken", label: "Bel" },
    ]);
    // 3 minuten op 12 uur is 0,4% — te dun om te zien, dus opgetrokken.
    expect(blokken[0].breedte).toBeGreaterThanOrEqual(0.8);
  });

  it("laat een omgekeerd of ongeldig tijdvak weg in plaats van te liegen", () => {
    const { blokken } = dagbalkBlokken([
      { beginTijd: "12:00", eindTijd: "11:00", categorie: "werken" },
      { beginTijd: "onzin", eindTijd: "09:00", categorie: "pauze" },
      { beginTijd: "09:00", eindTijd: "10:00", categorie: "werken", label: "Ok" },
    ]);
    expect(blokken).toHaveLength(1);
    expect(blokken[0].naam).toContain("09:00–10:00");
  });
});

describe("Dagbalk: categorieën en gaten", () => {
  it("brengt zeven categorieën terug tot vijf kleurfamilies", () => {
    const { blokken } = dagbalkBlokken([
      { beginTijd: "07:00", eindTijd: "08:00", categorie: "werken", label: "A" },
      { beginTijd: "08:00", eindTijd: "08:30", categorie: "reistijd" },
      { beginTijd: "08:30", eindTijd: "09:00", categorie: "pauze" },
      { beginTijd: "09:00", eindTijd: "09:30", categorie: "teammeeting" },
      { beginTijd: "09:30", eindTijd: "10:00", categorie: "onderhoud_materiaal" },
      { beginTijd: "10:00", eindTijd: "10:30", categorie: "afvalverwerker_bes" },
      { beginTijd: "10:30", eindTijd: "11:00", categorie: "anders" },
    ]);

    expect(blokken.map((b) => b.familie)).toEqual([
      "werken",
      "reistijd",
      "pauze",
      "indirect",
      "indirect",
      "indirect",
      "indirect",
    ]);
  });

  it("zet een gat tussen twee segmenten als eigen blok in de balk", () => {
    const { blokken } = dagbalkBlokken(DAG);
    const gat = blokken.filter((b) => b.familie === "gat");

    expect(gat).toHaveLength(1);
    expect(gat[0].beginTijd).toBe("12:30");
    expect(gat[0].eindTijd).toBe("13:30");
    expect(gat[0].naam).toBe("gat in de dag 12:30–13:30");
  });

  it("maakt van afronding tussen twee segmenten geen gat", () => {
    const { blokken } = dagbalkBlokken([
      { beginTijd: "07:00", eindTijd: "08:00", categorie: "werken", label: "A" },
      { beginTijd: "08:05", eindTijd: "09:00", categorie: "werken", label: "B" },
    ]);
    expect(blokken.some((b) => b.familie === "gat")).toBe(false);
  });
});

describe("Dagbalk: toegankelijkheid", () => {
  it("geeft elk segment een eigen naam met categorie, tijd en klus", () => {
    render(<Dagbalk segmenten={DAG} label="Lars Hendriks, woensdag 12 augustus" />);

    expect(
      screen.getByRole("img", { name: "werken 07:00–12:00, Dohmen" })
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "pauze 12:00–12:30" })).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "onderhoud materiaal 16:00–16:45" })
    ).toBeInTheDocument();
    // Dezelfde tekst hangt als tooltip aan het blok.
    expect(screen.getByTitle("gat in de dag 12:30–13:30")).toBeInTheDocument();
  });

  it("vertelt de hele dag in de naam van de balk", () => {
    const { blokken } = dagbalkBlokken(DAG);
    const beschrijving = dagbalkBeschrijving(blokken, "Lars Hendriks");

    expect(beschrijving.startsWith("Lars Hendriks: ")).toBe(true);
    expect(beschrijving).toContain("werken 07:00–12:00, Dohmen");
    expect(beschrijving).toContain("gat in de dag 12:30–13:30");

    render(<Dagbalk segmenten={DAG} label="Lars Hendriks" />);
    expect(screen.getByRole("group", { name: beschrijving })).toBeInTheDocument();
  });

  it("zegt het ook als er niets geregistreerd is", () => {
    render(<Dagbalk segmenten={[]} label="Kevin Bruls" />);
    expect(
      screen.getByRole("group", { name: "Kevin Bruls: geen segmenten" })
    ).toBeInTheDocument();
  });
});

describe("Dagbalk: de twee maten", () => {
  it("geeft hero de tijd-as en een legenda in woorden", () => {
    render(<Dagbalk segmenten={DAG} formaat="hero" legenda />);

    expect(screen.getByText("06:00")).toBeInTheDocument();
    expect(screen.getByText("12:00")).toBeInTheDocument();
    expect(screen.getByText("18:00")).toBeInTheDocument();
    // Legenda: alleen de families die in deze dag voorkomen.
    expect(screen.getByText("werken")).toBeInTheDocument();
    expect(screen.getByText("loods / indirect")).toBeInTheDocument();
    expect(screen.getByText("gat in de dag")).toBeInTheDocument();
  });

  it("houdt mini kaal: geen as-labels, wel dezelfde blokken", () => {
    const { container } = render(<Dagbalk segmenten={DAG} formaat="mini" />);

    expect(screen.queryByText("06:00")).not.toBeInTheDocument();
    expect(container.querySelector('[data-formaat="mini"]')).toBeInTheDocument();
    expect(screen.getAllByRole("img").length).toBe(dagbalkBlokken(DAG).blokken.length);
  });
});
