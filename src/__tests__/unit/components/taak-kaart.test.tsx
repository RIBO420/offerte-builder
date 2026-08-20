/**
 * De gedeelde taakkaart (klantdossier v13 + werkbord "Mijn dag").
 *
 * Wat hier vastligt, is precies wat de klant in prototype v13 heeft gevraagd
 * (functionele-inventaris §A6) en wat zonder test stilletjes terugvalt naar
 * "een lijstje met een vinkje":
 *
 * 1. **"Wacht op check" is een echte status** (harde eis 7). De derde
 *    statusknop zegt bij wie het komt te liggen — "Klaar, moet gecheckt door
 *    Bart" — en zonder checker is dat "Klaar, moet gecheckt" plús een melding
 *    dat er nog iemand bij hoort.
 * 2. **Maker groen, checker amber.** De twee rollen moeten in één blik te
 *    onderscheiden zijn; als beide avatars dezelfde rol krijgen is de kaart
 *    kleur zonder betekenis.
 * 3. **Subtaken tonen voortgang**, niet alleen een lijstje: x/y én een balk.
 * 4. **Klaar is doorgestreept**, en het vinkje staat aan.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// jsdom kent de Pointer Capture-API niet; Radix (checkbox, select) wél.
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

/** Elke mutatie loopt hierlangs: (functienaam, argumenten). */
const mutatie = vi.fn(async (_naam: string, _args: unknown) => ({
  success: true,
}));
const toastGoed = vi.fn();
const toastWaarschuwing = vi.fn();
const toastFout = vi.fn();

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useMutation: (fn: unknown) => {
      const naam = getFunctionName(fn as never);
      return (args: unknown) => mutatie(naam, args);
    },
    useQuery: () => undefined,
  };
});

vi.mock("@/lib/toast-utils", () => ({
  showSuccessToast: (bericht: string) => toastGoed(bericht),
  showWarningToast: (bericht: string) => toastWaarschuwing(bericht),
  showErrorToast: (bericht: string) => toastFout(bericht),
}));

const BART = { _id: "u-bart", naam: "Bart van der Heijden", initialen: "BH", isAdmin: false };
const RICARDO = { _id: "u-ric", naam: "Ricardo Bos", initialen: "RB", isAdmin: true };
const PERSONEN = [BART, RICARDO];

type Taak = Record<string, unknown>;

function bouwTaak(overschrijf: Taak = {}): Taak {
  return {
    _id: "t1",
    _creationTime: Date.now(),
    orgId: "org1",
    klantId: "k1",
    klantNaam: "Ger Hermans",
    titel: "Offerte narekenen",
    omschrijving: undefined,
    status: "todo",
    prioriteit: "normaal",
    deadline: undefined,
    subtaken: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    laatsteBewegingOp: Date.now(),
    stilDagen: 0,
    over: false,
    ai: false,
    maker: null,
    checker: null,
    uitzetter: null,
    subtakenKlaar: 0,
    subtakenTotaal: 0,
    reactieCount: 0,
    ...overschrijf,
  };
}

async function toonKaart(taak: Taak, variant: "dossier" | "drawer" = "drawer") {
  const { TaakKaart } = await import("@/components/taken/taak-kaart");
  render(
    <TaakKaart
      taak={taak as never}
      personen={PERSONEN as never}
      variant={variant}
    />
  );
}

beforeEach(() => {
  mutatie.mockClear();
  toastGoed.mockClear();
  toastWaarschuwing.mockClear();
  toastFout.mockClear();
});

describe("TaakKaart: de vier statussen zijn zichtbaar verschillend", () => {
  it.each([
    ["todo", "Te doen"],
    ["bezig", "Bezig"],
    ["check", "Wacht op check"],
    ["klaar", "Klaar"],
  ])("toont bij status %s de pil %s", async (status, label) => {
    await toonKaart(bouwTaak({ status }));
    const kaart = document.querySelector("article") as HTMLElement;
    expect(kaart.dataset.status).toBe(status);
    expect(within(kaart).getAllByText(label).length).toBeGreaterThan(0);
  });

  it("streept een afgeronde taak door en zet het vinkje aan", async () => {
    await toonKaart(bouwTaak({ status: "klaar" }));

    const titel = screen.getByText("Offerte narekenen");
    expect(titel.className).toContain("line-through");
    expect(
      screen.getByRole("checkbox", { name: "Taak Offerte narekenen heropenen" })
    ).toBeChecked();
  });

  it("vinkt een open taak af naar klaar in één klik", async () => {
    const gebruiker = userEvent.setup();
    await toonKaart(bouwTaak());

    await gebruiker.click(
      screen.getByRole("checkbox", { name: "Taak Offerte narekenen afronden" })
    );

    await waitFor(() => expect(mutatie).toHaveBeenCalled());
    expect(mutatie).toHaveBeenCalledWith("klantTaken:setStatus", {
      taakId: "t1",
      status: "klaar",
    });
  });
});

describe("TaakKaart: de checkknop zegt bij wie het komt te liggen", () => {
  it("noemt de voornaam van de checker", async () => {
    await toonKaart(bouwTaak({ checker: BART }));

    expect(
      screen.getByRole("button", { name: "Klaar, moet gecheckt door Bart" })
    ).toBeInTheDocument();
  });

  it("valt zonder checker terug op de kale zin", async () => {
    await toonKaart(bouwTaak());

    expect(
      screen.getByRole("button", { name: "Klaar, moet gecheckt" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /moet gecheckt door/ })
    ).not.toBeInTheDocument();
  });

  it("meldt 'Klaargezet voor [voornaam]' bij het doorzetten", async () => {
    const gebruiker = userEvent.setup();
    await toonKaart(bouwTaak({ checker: BART }));

    await gebruiker.click(
      screen.getByRole("button", { name: "Klaar, moet gecheckt door Bart" })
    );

    await waitFor(() =>
      expect(mutatie).toHaveBeenCalledWith("klantTaken:setStatus", {
        taakId: "t1",
        status: "check",
      })
    );
    expect(toastGoed).toHaveBeenCalledWith("Klaargezet voor Bart");
  });

  it("herinnert je eraan een checker te kiezen als er geen is", async () => {
    const gebruiker = userEvent.setup();
    await toonKaart(bouwTaak());

    await gebruiker.click(
      screen.getByRole("button", { name: "Klaar, moet gecheckt" })
    );

    await waitFor(() => expect(toastWaarschuwing).toHaveBeenCalled());
    expect(toastWaarschuwing.mock.calls[0][0]).toMatch(/wie het checkt/i);
    expect(toastGoed).not.toHaveBeenCalled();
  });
});

describe("TaakKaart: maker groen, checker amber", () => {
  it("geeft elke avatar zijn eigen rol en tooltip", async () => {
    await toonKaart(bouwTaak({ maker: RICARDO, checker: BART }));

    const maker = screen.getByLabelText("Maakt het: Ricardo Bos");
    const checker = screen.getByLabelText(
      "Checkt het voor verzending: Bart van der Heijden"
    );

    expect(maker.dataset.rol).toBe("maker");
    expect(checker.dataset.rol).toBe("checker");
    expect(maker.textContent).toBe("RB");
    expect(checker.textContent).toBe("BH");
    // Maker leunt op de merkkleur (groen), checker op de wacht-/aandachttint.
    expect(maker.className).toContain("primary");
    expect(checker.className).toContain("status-verzonden");
  });

  it("toont admins met '(admin)' in de toewijs-selects", async () => {
    await toonKaart(bouwTaak());

    expect(
      screen.getByRole("combobox", { name: "Maakt het" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Checkt het voor verzending" })
    ).toBeInTheDocument();

    const gebruiker = userEvent.setup();
    await gebruiker.click(screen.getByRole("combobox", { name: "Maakt het" }));

    expect(
      await screen.findByRole("option", { name: "Niemand" })
    ).toBeInTheDocument();
    expect(screen.getByText("Ricardo Bos (admin)")).toBeInTheDocument();
    expect(screen.getByText("Bart van der Heijden")).toBeInTheDocument();
  });
});

describe("TaakKaart: subtaken tonen hoe ver het is", () => {
  it("zet x/y in de tags én een balk boven de lijst", async () => {
    await toonKaart(
      bouwTaak({
        subtaken: [
          { titel: "Maten opmeten", klaar: true },
          { titel: "Leverancier bellen", klaar: true },
          { titel: "Prijs invullen", klaar: false },
        ],
        subtakenKlaar: 2,
        subtakenTotaal: 3,
      })
    );

    const balk = screen.getByRole("progressbar", {
      name: "2 van 3 subtaken klaar",
    });
    expect(balk).toHaveAttribute("aria-valuenow", "2");
    expect(balk).toHaveAttribute("aria-valuemax", "3");
    expect(screen.getAllByText("2/3").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("checkbox", { name: "Subtaak Prijs invullen afvinken" })
    ).not.toBeChecked();
  });

  it("schrijft de hele lijst terug bij het afvinken van één subtaak", async () => {
    const gebruiker = userEvent.setup();
    await toonKaart(
      bouwTaak({
        subtaken: [
          { titel: "Maten opmeten", klaar: true },
          { titel: "Prijs invullen", klaar: false },
        ],
        subtakenKlaar: 1,
        subtakenTotaal: 2,
      })
    );

    await gebruiker.click(
      screen.getByRole("checkbox", { name: "Subtaak Prijs invullen afvinken" })
    );

    await waitFor(() =>
      expect(mutatie).toHaveBeenCalledWith("klantTaken:update", {
        taakId: "t1",
        subtaken: [
          { titel: "Maten opmeten", klaar: true },
          { titel: "Prijs invullen", klaar: true },
        ],
      })
    );
  });
});

describe("TaakKaart: ingeklapt versus open", () => {
  it("houdt de dossierkaart dicht tot je hem opent", async () => {
    const gebruiker = userEvent.setup();
    await toonKaart(bouwTaak({ omschrijving: "Bel eerst de leverancier" }), "dossier");

    expect(screen.queryByText("Bel eerst de leverancier")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /moet gecheckt/ })
    ).not.toBeInTheDocument();

    await gebruiker.click(screen.getByRole("button", { name: /Offerte narekenen/ }));

    expect(screen.getByText("Bel eerst de leverancier")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Klaar, moet gecheckt" })
    ).toBeInTheDocument();
  });

  it("staat in de drawer altijd open en heeft geen open/dicht-knop", async () => {
    await toonKaart(bouwTaak({ omschrijving: "Bel eerst de leverancier" }));

    expect(screen.getByText("Bel eerst de leverancier")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { expanded: false })
    ).not.toBeInTheDocument();
  });
});

describe("TaakKaart: tags vertellen de rest", () => {
  it("markeert een verstreken deadline als te laat en toont de herkomst", async () => {
    await toonKaart(
      bouwTaak({ deadline: "2020-01-02", over: true, ai: true, reactieCount: 3 })
    );

    const teLaat = screen.getByText(/dagen te laat/);
    expect(teLaat.className).toContain("status-vervallen");
    expect(screen.getByText("Uit gesprek")).toBeInTheDocument();
    expect(screen.getByTitle("3 reacties")).toBeInTheDocument();
  });

  it("laat een normale prioriteit weg en toont alleen 'Hoog'", async () => {
    await toonKaart(bouwTaak({ prioriteit: "hoog" }));
    // "Hoog" staat als pil én als prioriteitsknop; zonder pil zou het er één zijn.
    expect(screen.getAllByText("Hoog").length).toBe(2);
  });
});
