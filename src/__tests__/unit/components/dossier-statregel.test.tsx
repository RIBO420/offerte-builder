/**
 * Het klantdossier v13: statregel, submenu-tellers en de Bestanden-tab.
 *
 * Wat hier vastligt is precies wat de klant in prototype v13 vroeg
 * (functionele-inventaris §A1, §A2 en §A7) en wat zonder test stilletjes
 * terugvalt naar "een rij grijze cijfers":
 *
 * 1. **Scannen op kleur.** Elke tegel heeft een 4px linkerbalk met betekenis:
 *    geld amber, werk groen, offertes kleibruin, relatie donkergroen. Krijgen
 *    twee tegels dezelfde balk, dan is de kleur decoratie geworden.
 * 2. **Elke tegel bedient het dossier.** Klik = het tabblad dat het cijfer
 *    bewijst; anders is de strook een plaatje.
 * 3. **Rood betekent één ding**: er staat een factuur langer dan 30 dagen
 *    open. Een net verstreken vervaldatum is amber — anders is rood op de dag
 *    dat het écht misgaat niets bijzonders meer.
 * 4. **Verzonden offertes en facturen staan vanzelf in Bestanden**, met het
 *    merkje "automatisch toegevoegd" en een doorverwijzing naar het document.
 * 5. **Verwijderen vraagt eerst.** Een foto van "voor" maak je niet opnieuw.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { KlantCijferstrip } from "@/components/klanten/dossier/klant-cijferstrip";
import {
  DossierNav,
  type DossierTellingen,
} from "@/components/klanten/dossier/dossier-nav";

// ─── Harnas ──────────────────────────────────────────────────────────────────

/** Wat `klantBestanden.list` in deze test teruggeeft. */
let bestandenData: unknown = { fotos: [], documenten: [] };
const mutatie = vi.fn(async (_naam: string, _args: unknown) => ({
  success: true,
}));

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (fn: unknown) =>
      getFunctionName(fn as never) === "klantBestanden:list"
        ? bestandenData
        : undefined,
    useMutation: (fn: unknown) => {
      const naam = getFunctionName(fn as never);
      return (args: unknown) => mutatie(naam, args);
    },
  };
});

vi.mock("@/lib/toast-utils", () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
  showWarningToast: vi.fn(),
}));

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
  // AnimatedNumber vraagt de motion-voorkeur op; met "reduce" staat het cijfer
  // er meteen in plaats van na een animatieframe.
  window.matchMedia ??= vi.fn().mockReturnValue({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as never;
});

beforeEach(() => {
  mutatie.mockClear();
  bestandenData = { fotos: [], documenten: [] };
});

const DAG = 24 * 60 * 60 * 1000;

/** Volle tellingen; per test overschrijf je alleen wat het verhaal draagt. */
function bouwTellingen(
  overschrijf: Partial<DossierTellingen> = {}
): DossierTellingen {
  return {
    openTaken: 0,
    eerstvolgendeDeadline: null,
    contactmomenten: 0,
    tijdlijn: 0,
    laatsteContactOp: null,
    laatsteContactTimestamp: null,
    klantSinds: Date.parse("2024-03-04T10:00:00Z"),
    projecten: 0,
    onderhoud: 0,
    offertes: 0,
    offertesTotaal: 0,
    offertesConcept: 0,
    facturen: 0,
    bestanden: 0,
    openFacturen: 0,
    openstaandBedrag: 0,
    factuurTeLaat: false,
    factuurOuderDan30: false,
    ...overschrijf,
  };
}

function toonStatregel(tellingen: DossierTellingen, onKies = vi.fn()) {
  render(
    <KlantCijferstrip
      tellingen={tellingen}
      klantSinds={tellingen.klantSinds}
      actief="actueel"
      onKies={onKies}
    />
  );
  return onKies;
}

/** De 4px kleurbalk van een tegel. */
function balkVan(tegel: HTMLElement): HTMLElement {
  const balk = tegel.querySelector("[data-balk]");
  if (!balk) throw new Error("tegel heeft geen kleurbalk");
  return balk as HTMLElement;
}

/** De statuspil van een navigatie-item (het icoon is óók aria-hidden). */
function pilVan(item: HTMLElement): HTMLElement {
  const pil = item.querySelector("span.rounded-full");
  if (!pil) throw new Error("nav-item heeft geen pil");
  return pil as HTMLElement;
}

// ─── §A1 Statregel ───────────────────────────────────────────────────────────

describe("Statregel: vier tegels die je op kleur kunt scannen (§A1)", () => {
  it("geeft elke tegel zijn eigen betekeniskleur", () => {
    toonStatregel(bouwTellingen());

    const kleuren = [
      ["Openstaand", "bg-status-herinnering-dot"], // geld = amber
      ["Open taken", "bg-chart-1"], // werk = groen
      ["Offertes", "bg-accent-warm"], // kansen = kleibruin
      ["Laatste contact", "bg-primary"], // relatie = donkergroen
    ] as const;

    const gebruikt = new Set<string>();
    for (const [label, klasse] of kleuren) {
      const tegel = screen.getByRole("button", { name: new RegExp(label) });
      expect(balkVan(tegel)).toHaveClass(klasse);
      gebruikt.add(klasse);
    }
    // Vier tegels, vier verschillende kleuren — anders zegt de kleur niets.
    expect(gebruikt.size).toBe(4);
  });

  it("opent per tegel het tabblad dat het cijfer bewijst", async () => {
    const user = userEvent.setup();
    const onKies = toonStatregel(bouwTellingen());

    for (const [label, tab] of [
      ["Openstaand", "facturen"],
      ["Open taken", "taken"],
      ["Offertes", "offertes"],
      ["Laatste contact", "tijdlijn"],
    ] as const) {
      await user.click(screen.getByRole("button", { name: new RegExp(label) }));
      expect(onKies).toHaveBeenLastCalledWith(tab);
    }
    expect(onKies).toHaveBeenCalledTimes(4);
  });

  it("zegt in de subteksten wat er aan de hand is", () => {
    toonStatregel(
      bouwTellingen({
        openstaandBedrag: 2420,
        openFacturen: 2,
        openTaken: 3,
        eerstvolgendeDeadline: "2026-09-01",
        offertesTotaal: 4,
        offertesConcept: 1,
        laatsteContactOp: Date.parse("2026-06-11T09:00:00Z"),
      })
    );

    expect(screen.getByText("2 open facturen")).toBeInTheDocument();
    expect(screen.getByText(/eerstvolgende: di 1 sep/)).toBeInTheDocument();
    expect(screen.getByText("1 in concept")).toBeInTheDocument();
    expect(screen.getByText(/Klant sinds 4 mrt 2024/)).toBeInTheDocument();
  });

  it("houdt de lege staat stil in plaats van alarmerend", () => {
    toonStatregel(bouwTellingen());

    expect(screen.getByText("geen open facturen")).toBeInTheDocument();
    expect(screen.getByText("alles afgerond")).toBeInTheDocument();
    expect(screen.getByText("nog geen offertes")).toBeInTheDocument();
    // Nooit gesproken = een streepje, geen verzonnen datum.
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("kleurt het openstaande bedrag pas rood na 30 dagen", () => {
    const { unmount } = render(
      <KlantCijferstrip
        tellingen={bouwTellingen({
          openstaandBedrag: 1210,
          openFacturen: 1,
          factuurTeLaat: true,
        })}
        klantSinds={Date.now()}
        actief="actueel"
        onKies={vi.fn()}
      />
    );
    expect(screen.getByText("1 open factuur")).not.toHaveClass(
      "text-status-vervallen-text"
    );
    unmount();

    render(
      <KlantCijferstrip
        tellingen={bouwTellingen({
          openstaandBedrag: 1210,
          openFacturen: 1,
          factuurTeLaat: true,
          factuurOuderDan30: true,
        })}
        klantSinds={Date.now()}
        actief="actueel"
        onKies={vi.fn()}
      />
    );
    expect(screen.getByText("1 open factuur")).toHaveClass(
      "text-status-vervallen-text"
    );
  });
});

// ─── §A2 Submenu-tellers ─────────────────────────────────────────────────────

describe("Submenu-tellers: grijs, amber of rood (§A2)", () => {
  function toonNav(tellingen: DossierTellingen, onKies = vi.fn()) {
    render(
      <DossierNav actief="actueel" onKies={onKies} tellingen={tellingen} />
    );
    return onKies;
  }

  it("toont een grijs streepje zolang er niets openstaat", () => {
    toonNav(bouwTellingen());

    const actueel = screen.getByRole("button", { name: /Actueel/ });
    expect(pilVan(actueel)).toHaveTextContent("—");
    expect(pilVan(actueel)).toHaveClass("text-muted-foreground/70");
  });

  it("telt Actueel als open taken plus open facturen, in amber", () => {
    toonNav(bouwTellingen({ openTaken: 3, openFacturen: 2 }));

    const pil = pilVan(screen.getByRole("button", { name: /Actueel/ }));
    expect(pil).toHaveTextContent("5");
    expect(pil).toHaveClass("bg-status-herinnering");
  });

  it("kleurt de factuurteller rood bij een factuur ouder dan 30 dagen", () => {
    const { unmount } = render(
      <DossierNav
        actief="actueel"
        onKies={vi.fn()}
        tellingen={bouwTellingen({
          openFacturen: 1,
          facturen: 4,
          factuurTeLaat: true,
        })}
      />
    );
    // Over de vervaldatum, maar nog geen maand open: amber.
    expect(pilVan(screen.getByRole("button", { name: /Facturen/ }))).toHaveClass(
      "bg-status-herinnering"
    );
    unmount();

    render(
      <DossierNav
        actief="actueel"
        onKies={vi.fn()}
        tellingen={bouwTellingen({
          openFacturen: 1,
          facturen: 4,
          factuurTeLaat: true,
          factuurOuderDan30: true,
        })}
      />
    );
    expect(pilVan(screen.getByRole("button", { name: /Facturen/ }))).toHaveClass(
      "bg-status-vervallen"
    );
  });

  it("zet Bestanden in de groep Klant met een neutrale telling", async () => {
    const user = userEvent.setup();
    const onKies = toonNav(bouwTellingen({ bestanden: 7 }));

    const bestanden = screen.getByRole("button", { name: /Bestanden/ });
    const pil = pilVan(bestanden);
    expect(pil).toHaveTextContent("7");
    // Neutraal: een foto vraagt niets van je, hij staat er gewoon.
    expect(pil).toHaveClass("bg-muted");
    expect(pil).not.toHaveClass("bg-status-herinnering");

    await user.click(bestanden);
    expect(onKies).toHaveBeenCalledWith("bestanden");
  });
});

// ─── §A7 Bestanden-tab ───────────────────────────────────────────────────────

describe("Bestanden-tab: foto's met label, documenten met herkomst (§A7)", () => {
  const FOTO = {
    _id: "kb1",
    soort: "foto",
    label: "voor",
    titel: "Achtertuin vanaf terras",
    bron: "upload",
    nummer: undefined,
    timestamp: Date.now() - DAG,
    url: "https://storage.test/foto.jpg",
    geuploadDoorNaam: "Bart van der Heijden",
  };
  const OFFERTE_DOC = {
    _id: "kb2",
    soort: "document",
    label: undefined,
    titel: "Offerte OF-2026-014",
    bron: "offerte",
    nummer: "OF-2026-014",
    timestamp: Date.now() - 2 * DAG,
    url: null,
    geuploadDoorNaam: null,
    offerteId: "of1",
  };

  async function toonTab() {
    const { BestandenTab } = await import(
      "@/components/klanten/dossier/bestanden-tab"
    );
    render(<BestandenTab klantId={"k1" as never} />);
  }

  it("toont foto's met hun labelbadge en de camera-affordance", async () => {
    bestandenData = { fotos: [FOTO], documenten: [] };
    await toonTab();

    const kaartje = screen
      .getByText("Achtertuin vanaf terras")
      .closest("li") as HTMLElement;
    // De badge zit op de foto zelf, niet alleen in de labelkiezer erboven.
    expect(within(kaartje).getByText("Voor")).toBeInTheDocument();
    expect(within(kaartje).getByText(/Bart van der Heijden/)).toBeInTheDocument();

    // Op mobiel moet de knop de camera openen, niet de bestandskiezer.
    const invoer = screen.getByLabelText("Foto kiezen");
    expect(invoer).toHaveAttribute("accept", "image/*");
    expect(invoer).toHaveAttribute("capture", "environment");
  });

  it("merkt een automatisch gearchiveerde offerte en linkt naar het document", async () => {
    bestandenData = { fotos: [], documenten: [OFFERTE_DOC] };
    await toonTab();

    expect(screen.getByText("Offerte OF-2026-014")).toBeInTheDocument();
    expect(screen.getByText(/automatisch toegevoegd/)).toBeInTheDocument();
    // Geen eigen bestand: de rij wijst naar de offerte zelf.
    expect(screen.getByRole("link", { name: /Offerte OF-2026-014/ })).toHaveAttribute(
      "href",
      "/offertes/of1"
    );
  });

  it("verwijdert pas na bevestiging", async () => {
    bestandenData = { fotos: [FOTO], documenten: [] };
    const user = userEvent.setup();
    await toonTab();

    await user.click(
      screen.getByRole("button", { name: "Achtertuin vanaf terras verwijderen" })
    );
    // De vraag staat er; er is nog niets weg.
    const dialoog = await screen.findByRole("alertdialog");
    expect(
      within(dialoog).getByText("Bestand verwijderen?")
    ).toBeInTheDocument();
    expect(mutatie).not.toHaveBeenCalled();

    await user.click(within(dialoog).getByRole("button", { name: "Verwijderen" }));
    await waitFor(() =>
      expect(mutatie).toHaveBeenCalledWith("klantBestanden:verwijder", {
        bestandId: "kb1",
      })
    );
  });

  it("zegt bij een leeg dossier wat er hoort te komen", async () => {
    await toonTab();

    expect(screen.getByText("Nog geen foto's.")).toBeInTheDocument();
    expect(screen.getByText("Nog geen documenten.")).toBeInTheDocument();
    expect(
      screen.getByText(/Verzonden offertes en facturen verschijnen hier vanzelf/)
    ).toBeInTheDocument();
  });
});
