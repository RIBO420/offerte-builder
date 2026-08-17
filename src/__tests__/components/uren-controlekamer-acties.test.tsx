/**
 * De acties van de Controlekamer — de plekken waar een klik een besluit is.
 *
 * 1. **"In orde" is kwijting, geen status.** De knop op de afwijkingskaart gaat
 *    naar `urenControle:keurDagGoed` (logboek-kwijting, besluit Ricardo) en
 *    nergens anders heen.
 * 2. **"Corrigeren" opent de inspector** — de kaart geeft de medewerker-dag
 *    door aan de pagina; de segmentmutations leven dáár, niet op de kaart.
 * 3. **De export kleurt pas primair als de lijsten leeg zijn.** Zolang iemand
 *    achter is of een dag afwijkt, is de export een gedempte knop — de pagina
 *    zelf is de checklist van de loonronde.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AfwijkingenBlok } from "@/components/uren/afwijkingen-blok";
import { KanDoorBlok, exportIsPrimair } from "@/components/uren/kan-door-blok";
import type { DagKaart, DagSamenvatting } from "@/components/uren/controle-types";

const keurDagGoed = vi.fn(async () => null);
const keurWeekGoed = vi.fn(async () => ({ gekweten: 3 }));
const heropenDag = vi.fn(async () => null);
const toastGoed = vi.fn();
const toastFout = vi.fn();

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useMutation: (fn: unknown) => {
      switch (getFunctionName(fn as never)) {
        case "urenControle:keurDagGoed":
          return keurDagGoed;
        case "urenControle:keurWeekGoed":
          return keurWeekGoed;
        case "urenSegmenten:heropenDag":
          return heropenDag;
        default:
          return vi.fn();
      }
    },
    useQuery: () => null,
  };
});

vi.mock("@/lib/toast-utils", () => ({
  showSuccessToast: (bericht: string) => toastGoed(bericht),
  showErrorToast: (bericht: string) => toastFout(bericht),
}));

const KAART: DagKaart = {
  medewerkerId: "m1",
  naam: "Lars Hendriks",
  datum: "2026-08-12",
  totaalUren: 10.8,
  status: "ingediend",
  segmenten: [
    { beginTijd: "07:00", eindTijd: "12:30", categorie: "werken", label: "Dohmen" },
    { beginTijd: "12:30", eindTijd: "17:48", categorie: "werken", label: "Hermans" },
  ],
  redenen: [
    { type: "lange_dag", uren: 10.8 },
    { type: "geen_pauze", uren: 10.8 },
  ],
};

const STILLE_DAG: DagSamenvatting = {
  medewerkerId: "m2",
  naam: "Kevin Bruls",
  datum: "2026-08-11",
  totaalUren: 8,
  status: "ingediend",
  segmenten: [
    { beginTijd: "07:00", eindTijd: "15:30", categorie: "werken", label: "Storm" },
  ],
};

beforeEach(() => {
  keurDagGoed.mockClear();
  keurWeekGoed.mockClear();
  heropenDag.mockClear();
  toastGoed.mockClear();
  toastFout.mockClear();
});

describe("Afwijkingskaart: de drie uitkomsten van een blik", () => {
  it("kwit de dag met 'In orde' via urenControle:keurDagGoed", async () => {
    render(<AfwijkingenBlok afwijkend={[KAART]} onCorrigeren={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "In orde" }));

    await waitFor(() =>
      expect(keurDagGoed).toHaveBeenCalledWith({
        medewerkerId: "m1",
        datum: "2026-08-12",
      })
    );
    expect(toastGoed).toHaveBeenCalledWith("Dag van Lars Hendriks is akkoord");
    // Kwijting is een logboek-handeling; heropenen hoort hier níet af te gaan.
    expect(heropenDag).not.toHaveBeenCalled();
  });

  it("geeft 'Corrigeren' de medewerker-dag door zodat de inspector kan openen", async () => {
    const onCorrigeren = vi.fn();
    render(<AfwijkingenBlok afwijkend={[KAART]} onCorrigeren={onCorrigeren} />);

    await userEvent.click(screen.getByRole("button", { name: "Corrigeren" }));

    expect(onCorrigeren).toHaveBeenCalledWith({
      medewerkerId: "m1",
      datum: "2026-08-12",
      naam: "Lars Hendriks",
    });
    // Corrigeren zelf muteert niets: de segmentmutations leven in de inspector.
    expect(keurDagGoed).not.toHaveBeenCalled();
  });

  it("toont de film-doorklik alleen als WS-C hem heeft aangesloten", () => {
    const { rerender } = render(
      <AfwijkingenBlok afwijkend={[KAART]} onCorrigeren={vi.fn()} />
    );
    expect(
      screen.queryByRole("button", { name: /film/i })
    ).not.toBeInTheDocument();

    const onDagFilm = vi.fn();
    rerender(
      <AfwijkingenBlok
        afwijkend={[KAART]}
        onCorrigeren={vi.fn()}
        onDagFilm={onDagFilm}
      />
    );
    screen.getByRole("button", { name: "Bekijk deze dag als film" }).click();
    expect(onDagFilm).toHaveBeenCalledWith({
      medewerkerId: "m1",
      datum: "2026-08-12",
    });
  });

  it("brengt de lege staat als goed nieuws", () => {
    render(<AfwijkingenBlok afwijkend={[]} onCorrigeren={vi.fn()} />);
    expect(screen.getByText("Geen dag wijkt af.")).toBeInTheDocument();
  });
});

describe("Wat kan door: alles akkoord en de export", () => {
  it("kwit alle stille dagen in één keer met urenControle:keurWeekGoed", async () => {
    render(
      <KanDoorBlok
        stil={[STILLE_DAG]}
        weekStart="2026-08-10"
        achterAantal={0}
        afwijkendAantal={0}
        gekweten={0}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Alles akkoord" }));

    await waitFor(() =>
      expect(keurWeekGoed).toHaveBeenCalledWith({ weekStart: "2026-08-10" })
    );
    expect(toastGoed).toHaveBeenCalledWith("3 dagen akkoord bevonden");
  });

  it("kleurt de export pas primair als beide lijsten leeg zijn", () => {
    expect(exportIsPrimair({ achter: 0, afwijkend: 0 })).toBe(true);
    expect(exportIsPrimair({ achter: 1, afwijkend: 0 })).toBe(false);
    expect(exportIsPrimair({ achter: 0, afwijkend: 2 })).toBe(false);
    expect(exportIsPrimair({ achter: 3, afwijkend: 1 })).toBe(false);
  });

  it("vraagt de exportknop als outline zolang er werk ligt", () => {
    const exportKnop = vi.fn((variant: "default" | "outline") => (
      <span data-testid="export" data-variant={variant} />
    ));
    render(
      <KanDoorBlok
        stil={[STILLE_DAG]}
        weekStart="2026-08-10"
        achterAantal={2}
        afwijkendAantal={1}
        gekweten={0}
        exportKnop={exportKnop}
      />
    );
    expect(exportKnop).toHaveBeenCalledWith("outline");
    expect(screen.getByTestId("export").dataset.variant).toBe("outline");
  });

  it("vraagt de exportknop als primair zodra de week schoon is — ook in de lege staat", () => {
    const exportKnop = vi.fn((variant: "default" | "outline") => (
      <span data-testid="export" data-variant={variant} />
    ));
    render(
      <KanDoorBlok
        stil={[]}
        weekStart="2026-08-10"
        achterAantal={0}
        afwijkendAantal={0}
        gekweten={4}
        exportKnop={exportKnop}
      />
    );
    expect(exportKnop).toHaveBeenCalledWith("default");
    expect(screen.getByTestId("export").dataset.variant).toBe("default");
    // Leeg is goed nieuws: de kwijting van deze week staat erbij.
    expect(screen.getByText("Niets staat te wachten.")).toBeInTheDocument();
    expect(
      screen.getByText("4 dagen zijn deze week al akkoord bevonden.")
    ).toBeInTheDocument();
  });
});
