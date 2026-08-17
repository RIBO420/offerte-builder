/**
 * Het tabmechanisme van /rapportages.
 *
 * Drie dingen moeten waar blijven, en alle drie kunnen ze stil sneuvelen:
 *
 * 1. **Het verhaal is de default.** Een schone `/rapportages` en elke bestaande
 *    bookmark landen in het scrollverhaal, niet op het grafiekenblad.
 * 2. **`?tab=grafieken` opent het grafiekenblad.** Dat is de hele deeplink.
 * 3. **De acht oude tabs blijven werken.** `?tab=marges` was tot het
 *    herontwerp een echte tab; die inhoud zit nu in "Wat is mijn beste werk?".
 *    Sinds `tab` óók de tabkeuze is, is de verleiding groot om alles wat in
 *    `tab` staat als tabnaam te lezen — en dan verdwijnt die omleiding
 *    geruisloos. Vandaar dat de test hier de `router.replace` naar het anker
 *    natrekt en niet alleen "welk blad staat er".
 *
 * En één ding dat de tabs pas nuttig maakt: de gekozen periode moet de wissel
 * overleven. Die staat daarom in de URL en niet in component-state.
 */

import { describe, expect, it, beforeAll, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RapportageInhoud } from "@/app/(dashboard)/rapportages/components/rapportage-inhoud";
import {
  isRapportageTab,
  rapportageTabVan,
} from "@/app/(dashboard)/rapportages/components/rapportage-tabbalk";

const replace = vi.fn();
const push = vi.fn();
let zoek = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push, prefetch: vi.fn() }),
  useSearchParams: () => zoek,
  usePathname: () => "/rapportages",
}));

// Geen backend in een componenttest: `undefined` is de laadstaat, en dan
// rendert elk blad zijn kop plus het skelet. De koppen zijn genoeg om te zien
// wélk blad er staat, en zo hoeft deze test geen volledige payload te verzinnen.
vi.mock("convex/react", () => ({
  useQuery: () => undefined,
}));

const VERHAAL_KOP = /Hoe staat het bedrijf ervoor\?/i;
const GRAFIEKEN_KOP = /Alle cijfers in één blik/i;

beforeAll(() => {
  // jsdom kent `matchMedia` niet; `useReducedMotion` in de ankerbalk wel.
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  zoek = new URLSearchParams();
});

describe("welk blad staat er", () => {
  it("zonder ?tab= staat het verhaal er — dat blijft de default", () => {
    render(<RapportageInhoud />);
    expect(screen.getByRole("heading", { name: VERHAAL_KOP })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: GRAFIEKEN_KOP })
    ).not.toBeInTheDocument();
  });

  it("?tab=grafieken opent het grafiekenblad", () => {
    zoek = new URLSearchParams("tab=grafieken");
    render(<RapportageInhoud />);
    expect(
      screen.getByRole("heading", { name: GRAFIEKEN_KOP })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: VERHAAL_KOP })
    ).not.toBeInTheDocument();
  });

  it("beide bladen dragen dezelfde keuzebalk", () => {
    render(<RapportageInhoud />);
    const balk = screen.getByRole("navigation", {
      name: /weergave van dit rapport/i,
    });
    expect(balk).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Grafieken" })
    ).toBeInTheDocument();
  });
});

describe("oude ?tab=-deeplinks", () => {
  it("?tab=marges landt in het verhaal, bij het anker waar die inhoud heen is", () => {
    zoek = new URLSearchParams("tab=marges");
    render(<RapportageInhoud />);

    expect(screen.getByRole("heading", { name: VERHAAL_KOP })).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/rapportages#beste-werk", {
      scroll: false,
    });
  });

  it("een onbekende tabwaarde landt bovenaan het verhaal", () => {
    zoek = new URLSearchParams("tab=iets-wat-nooit-bestond");
    render(<RapportageInhoud />);

    expect(screen.getByRole("heading", { name: VERHAAL_KOP })).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/rapportages#hoe-loopt", {
      scroll: false,
    });
  });

  it("laat de periode staan terwijl het de oude tabwaarde opruimt", () => {
    zoek = new URLSearchParams("tab=calculatie&periode=zomer");
    render(<RapportageInhoud />);

    expect(replace).toHaveBeenCalledWith("/rapportages?periode=zomer#geld-ligt", {
      scroll: false,
    });
  });

  it("ruimt de nieuwe tabwaardes níét op — dat zijn geen oude deeplinks", () => {
    zoek = new URLSearchParams("tab=grafieken");
    render(<RapportageInhoud />);
    expect(replace).not.toHaveBeenCalled();
  });

  it("kent exact twee tabwaardes; al het andere is een oude deeplink", () => {
    expect(isRapportageTab("verhaal")).toBe(true);
    expect(isRapportageTab("grafieken")).toBe(true);
    for (const oud of [
      "overzicht",
      "omzet",
      "pipeline",
      "klanten",
      "marges",
      "calculatie",
      "medewerkers",
      "projecten",
      null,
    ]) {
      expect(isRapportageTab(oud)).toBe(false);
      expect(rapportageTabVan(oud)).toBe("verhaal");
    }
  });
});

describe("de periodekeuze overleeft een tabwissel", () => {
  it("neemt periode, van en tot mee naar het grafiekenblad", async () => {
    const gebruiker = userEvent.setup();
    zoek = new URLSearchParams("periode=aangepast&van=1000&tot=2000");
    render(<RapportageInhoud />);

    await gebruiker.click(screen.getByRole("button", { name: "Grafieken" }));

    expect(push).toHaveBeenCalledTimes(1);
    const doel = String(push.mock.calls[0][0]);
    expect(doel).toContain("tab=grafieken");
    expect(doel).toContain("periode=aangepast");
    expect(doel).toContain("van=1000");
    expect(doel).toContain("tot=2000");
  });

  it("haalt de tabparameter weer uit de URL bij terug naar het verhaal", async () => {
    const gebruiker = userEvent.setup();
    zoek = new URLSearchParams("tab=grafieken&periode=zomer");
    render(<RapportageInhoud />);

    await gebruiker.click(screen.getByRole("button", { name: "Verhaal" }));

    expect(push).toHaveBeenCalledWith("/rapportages?periode=zomer");
  });
});
