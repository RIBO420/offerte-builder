/**
 * De entree van een pagina mag nooit de reden zijn dat je niets ziet.
 *
 * Gemeten aanleiding (15 aug 2026): `/projecten` stond in een achtergrondtab op
 * `opacity: 0.12164` (buitenste wrapper) en `opacity: 0` (headerrij) terwijl de
 * tabel er met drie rijen gewoon stond. Oorzaak: framer-motion rekent op
 * `requestAnimationFrame`, en die staat in een afgeknepen tab stil — de
 * eindstaat werd nooit bereikt.
 *
 * Wat hier vastligt is de omkering: de eindstaat is de basisstijl, de animatie
 * is versiering. Twee dingen die dat waarmaken en die stilletjes kunnen
 * terugvallen:
 *
 * 1. Geen beginstaat buiten de animatie om — geen inline `opacity`, geen
 *    `opacity-0`-klasse, en geen `fill-mode-*`. Zonder fill-mode geldt buiten
 *    de looptijd van de animatie altijd de basisstijl, en die is zichtbaar.
 *    Rendert de browser nul animatieframes, dan staat de inhoud er gewoon.
 * 2. Alle animatieklassen staan achter `motion-safe:`, zodat respect voor
 *    `prefers-reduced-motion` in CSS zit en niet in een hook die pas ná de
 *    eerste render het goede antwoord geeft.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { PaginaReveal, REVEAL_KLASSE } from "@/components/pagina-reveal";
import {
  PageTransition,
  ContentTransition,
  FadeIn,
} from "@/components/page-transition";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projecten",
}));

/** Klassen die beweging aanzetten. Elk daarvan hoort motion-safe te zijn. */
const BEWEGING = [
  "animate-in",
  "fade-in",
  "slide-in",
  "zoom-in",
  "duration-",
  "ease-",
];

function klassen(element: HTMLElement): string[] {
  return Array.from(element.classList);
}

function bewegingsklassen(element: HTMLElement): string[] {
  return klassen(element).filter((klasse) =>
    BEWEGING.some((deel) => klasse.replace("motion-safe:", "").startsWith(deel))
  );
}

const gevallen: Array<[string, () => HTMLElement]> = [
  [
    "PaginaReveal",
    () => {
      render(
        <PaginaReveal>
          <p>Inhoud</p>
        </PaginaReveal>
      );
      return screen.getByText("Inhoud").parentElement as HTMLElement;
    },
  ],
  [
    "PageTransition",
    () => {
      render(
        <PageTransition>
          <p>Inhoud</p>
        </PageTransition>
      );
      return screen.getByText("Inhoud").parentElement as HTMLElement;
    },
  ],
  [
    "ContentTransition",
    () => {
      render(
        <ContentTransition transitionKey="tab">
          <p>Inhoud</p>
        </ContentTransition>
      );
      return screen.getByText("Inhoud").parentElement as HTMLElement;
    },
  ],
  [
    "FadeIn",
    () => {
      render(
        <FadeIn>
          <p>Inhoud</p>
        </FadeIn>
      );
      return screen.getByText("Inhoud").parentElement as HTMLElement;
    },
  ],
];

describe.each(gevallen)("%s", (_naam, maak) => {
  it("zet zijn inhoud neer zonder ook maar één animatieframe", () => {
    const wrapper = maak();

    // Geen inline beginstaat: framer zette hier `opacity: 0` neer en liet dat
    // staan zodra rAF stilviel. `toBeVisible` valt over precies dat.
    expect(wrapper.style.opacity).toBe("");
    expect(wrapper.style.transform).toBe("");
    expect(screen.getByText("Inhoud")).toBeVisible();
  });

  it("houdt geen beginstaat vast met een klasse", () => {
    const wrapper = maak();

    expect(klassen(wrapper)).not.toContain("opacity-0");
    // `fill-mode-both` zou de `from`-staat óók vóór en na de animatie laten
    // gelden — dan is de lege tussenstaat terug.
    expect(
      klassen(wrapper).filter((k) => k.includes("fill-mode"))
    ).toHaveLength(0);
  });

  it("laat prefers-reduced-motion door CSS afhandelen", () => {
    const wrapper = maak();
    const beweging = bewegingsklassen(wrapper);

    expect(beweging.length).toBeGreaterThan(0);
    expect(beweging.every((k) => k.startsWith("motion-safe:"))).toBe(true);
  });
});

describe("PageTransition", () => {
  it("houdt de flexketen heel, ook zonder animatie", () => {
    render(
      <PageTransition>
        <p>Inhoud</p>
      </PageTransition>
    );
    const wrapper = screen.getByText("Inhoud").parentElement as HTMLElement;

    // De `<main>` in (dashboard)/layout.tsx is een flexkolom; breekt deze
    // tussenlaag de keten, dan hebben laadstaten geen hoogte om in te
    // centreren en plakken ze tegen de bovenrand.
    expect(klassen(wrapper)).toEqual(
      expect.arrayContaining(["flex", "flex-1", "flex-col"])
    );
  });
});

describe("REVEAL_KLASSE", () => {
  it("is de gedeelde bron voor pagina-entrees", () => {
    expect(REVEAL_KLASSE).toContain("motion-safe:animate-in");
    expect(REVEAL_KLASSE).not.toContain("fill-mode");
    expect(REVEAL_KLASSE).not.toContain("delay-");
  });
});
