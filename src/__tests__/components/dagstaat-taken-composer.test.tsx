/**
 * "Mijn taken" op de dagstaat toonde openstaande taken, maar je kon er geen
 * toevoegen — en zonder taken was het blok helemaal dood: één regel "Geen open
 * taken" en verder niets te doen. Sinds de composer erin zit staan hier de
 * dingen vast die anders stilletjes terugvallen:
 *
 * 1. De lege staat is één regel plus de composer, niet een leeg blok.
 * 2. De composer klapt open bij aanraking van de hele regel (niet alleen het
 *    veld van 19px) en blijft open terwijl je in de klantkiezer staat — die
 *    rendert in een portal, dus focus verlaat de composer.
 * 3. Een taak hoort bij een klant: zonder gekozen klant slaat hij niet op, mét
 *    klant gaat hij naar `klantTaken.create` op jouw naam.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// jsdom kent de Pointer Capture-API niet; Radix roept hem wél aan.
beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
});

const createTaak = vi.fn(async () => "t-nieuw");
const toastFout = vi.fn();
const toastGoed = vi.fn();

/** Wat `klantTaken.mijnTaken` teruggeeft; per test in te stellen. */
let takenVanDeQuery: unknown = [];

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useMutation: (fn: unknown) =>
      getFunctionName(fn as never) === "klantTaken:create"
        ? createTaak
        : vi.fn(),
    useQuery: (fn: unknown) => {
      const naam = fn === "skip" ? "skip" : getFunctionName(fn as never);
      if (naam === "klantTaken:mijnTaken") return takenVanDeQuery;
      return null;
    },
  };
});

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => ({
    user: { _id: "u1", naam: "Ricardo Bos", linkedMedewerkerId: "m1" },
  }),
}));

vi.mock("@/hooks/use-klanten", () => ({
  useKlanten: () => ({
    klanten: [
      { _id: "k1", naam: "Ger Hermans", plaats: "Weert" },
      { _id: "k2", naam: "Anouk Willems", plaats: "Roermond" },
    ],
    recentKlanten: [],
  }),
  // Gedraagt zich als de echte zoekindex: pas resultaten bij een term, en
  // die resultaten hoeven NIET in de gewone lijst te staan (het gemelde
  // geval: een gezochte klant buiten de eerste acht).
  useKlantenSearch: (term: string) => ({
    results: term.trim().toLowerCase().includes("weller")
      ? [{ _id: "k9", naam: "Stichting Weller Wonen", plaats: "Heerlen" }]
      : [],
    isLoading: false,
  }),
}));

vi.mock("@/lib/toast-utils", () => ({
  showErrorToast: (bericht: string) => toastFout(bericht),
  showSuccessToast: (bericht: string) => toastGoed(bericht),
}));

const TAAK = {
  _id: "t1",
  titel: "Terugbellen over de oprit",
  klantId: "k1",
  klantNaam: "Ger Hermans",
  prioriteit: "normaal",
  status: "open",
  deadline: undefined,
};

async function toonBlok(taken: unknown) {
  takenVanDeQuery = taken;
  const { MijnTaken } = await import("@/components/dashboard/mijn-taken");
  render(<MijnTaken verbergAlsLeeg={false} />);
}

const composerRegel = () =>
  screen.getByLabelText("Nieuwe taak").closest("[data-open]") as HTMLElement;

beforeEach(() => {
  createTaak.mockClear();
  toastFout.mockClear();
  toastGoed.mockClear();
});

describe("Mijn taken: lege staat nodigt uit", () => {
  it("toont één regel plus de composer in plaats van een dood blok", async () => {
    await toonBlok([]);

    expect(screen.getByText("Nog geen taken")).toBeInTheDocument();
    expect(screen.getByText("— voeg de eerste toe.")).toBeInTheDocument();
    // De composer staat er ook zónder taken: dát is de reden dat je hier bent.
    expect(screen.getByLabelText("Nieuwe taak")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("houdt de composer boven een gevulde lijst", async () => {
    await toonBlok([TAAK]);

    expect(screen.getByLabelText("Nieuwe taak")).toBeInTheDocument();
    expect(screen.getByText("Terugbellen over de oprit")).toBeInTheDocument();
    expect(screen.queryByText("Nog geen taken")).not.toBeInTheDocument();
  });
});

describe("Mijn taken: de composer klapt open", () => {
  it("opent op een klik náást het invoerveld en zet de cursor in het veld", async () => {
    const gebruiker = userEvent.setup();
    await toonBlok([]);

    const regel = composerRegel();
    expect(regel.getAttribute("data-open")).toBe("false");

    await gebruiker.click(regel);

    await waitFor(() => expect(regel.getAttribute("data-open")).toBe("true"));
    expect(document.activeElement).toBe(screen.getByLabelText("Nieuwe taak"));
    expect(
      screen.getByRole("combobox", { name: "Klant kiezen" })
    ).toBeInTheDocument();
  });

  it("blijft open terwijl de klantkiezer (portal) openstaat", async () => {
    const gebruiker = userEvent.setup();
    await toonBlok([]);

    const regel = composerRegel();
    await gebruiker.click(regel);
    await waitFor(() => expect(regel.getAttribute("data-open")).toBe("true"));

    await gebruiker.click(screen.getByRole("combobox", { name: "Klant kiezen" }));

    await waitFor(() =>
      expect(screen.getByPlaceholderText("Zoek klant…")).toBeInTheDocument()
    );
    expect(regel.getAttribute("data-open")).toBe("true");
  });
});

describe("Mijn taken: de klantkiezer", () => {
  it("kiest ook een klant die via zoeken gevonden is (melding 16 aug)", async () => {
    const gebruiker = userEvent.setup();
    await toonBlok([]);

    const regel = composerRegel();
    await gebruiker.click(regel);
    await waitFor(() => expect(regel.getAttribute("data-open")).toBe("true"));

    await gebruiker.click(screen.getByRole("combobox", { name: "Klant kiezen" }));
    const zoekveld = await screen.findByPlaceholderText("Zoek klant…");
    await gebruiker.type(zoekveld, "Weller");

    // Bewust userEvent (volledige pointer-reeks): precies die reeks liet de
    // keuze verloren gaan doordat het regel-klikvlak de focus stal.
    const resultaat = await screen.findByText("Stichting Weller Wonen");
    await gebruiker.click(resultaat);

    // De keuze moet landen op de kiezer-knop; blijft hij op "Klant kiezen"
    // staan, dan is de klik op een zoekresultaat verloren gegaan.
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Klant kiezen" })
      ).toHaveTextContent("Stichting Weller Wonen")
    );
  });
});

describe("Mijn taken: een taak toevoegen", () => {
  it("slaat op bij de gekozen klant, op naam van de ingelogde medewerker", async () => {
    const gebruiker = userEvent.setup();
    await toonBlok([]);

    await gebruiker.click(composerRegel());
    await gebruiker.click(screen.getByRole("combobox", { name: "Klant kiezen" }));

    // `fireEvent`, niet `userEvent`: cmdk hangt zijn keuze aan `onClick`, en de
    // pointer-reeks die userEvent ervóór afvuurt laat de keuze in jsdom
    // wegvallen (gemeten: item blijft data-selected, maar onSelect vuurt niet).
    // De echte browser doet dit wél; hier gaat het om de bedrading erachter.
    const optie = (await screen.findByText("Ger Hermans")).closest(
      "[data-slot='command-item']"
    ) as HTMLElement;
    fireEvent.click(optie);
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Klant kiezen" }).textContent
      ).toContain("Ger Hermans")
    );

    await gebruiker.type(
      screen.getByLabelText("Nieuwe taak"),
      "Offerte narekenen{Enter}"
    );

    await waitFor(() => expect(createTaak).toHaveBeenCalledTimes(1));
    expect(createTaak).toHaveBeenCalledWith({
      klantId: "k1",
      titel: "Offerte narekenen",
      prioriteit: "normaal",
      deadline: undefined,
      toegewezenAanId: "m1",
    });
    expect(toastGoed).toHaveBeenCalledWith("Taak toegevoegd");
  });

  it("weigert een taak zonder klant en zegt waaróm", async () => {
    const gebruiker = userEvent.setup();
    await toonBlok([]);

    await gebruiker.click(composerRegel());
    await gebruiker.type(
      screen.getByLabelText("Nieuwe taak"),
      "Losse gedachte{Enter}"
    );

    expect(createTaak).not.toHaveBeenCalled();
    expect(toastFout).toHaveBeenCalledWith(
      "Kies eerst de klant waar deze taak bij hoort"
    );
    // De knop laat het ook zien in plaats van alleen bij het indrukken.
    expect(screen.getByRole("button", { name: "Toevoegen" })).toBeDisabled();
  });
});
