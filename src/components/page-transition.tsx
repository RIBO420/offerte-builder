"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { REVEAL_KLASSE } from "@/components/pagina-reveal";

/**
 * De tussenlaag om élke dashboardpagina.
 *
 * **Waarom hier geen animatie meer in zit (okt 2026).** Deze wrapper fadede
 * bij elke routewissel (via een `key` op de pathname), en de herontworpen
 * pagina's doen dat zelf ook met `PaginaReveal`/`REVEAL_KLASSE`. Dat gaf een
 * dubbele fade op elke navigatie. De pagina-entree heeft nu één bron:
 * `REVEAL_KLASSE` in `pagina-reveal.tsx`, om de geladen inhoud.
 *
 * Daarvóór (aug 2026) was dit een framer-motion `m.div` met
 * `initial="hidden"`; valt `requestAnimationFrame` stil, dan bleef de hele app
 * blanco. Zie `pagina-reveal.tsx` voor die les.
 *
 * `flex flex-1 flex-col` is geen opmaak maar een doorgeefluik: de `<main>` in
 * `(dashboard)/layout.tsx` is een flexkolom, en zonder deze klassen breekt deze
 * tussenlaag de keten. Pagina's die `flex flex-1 items-center justify-center`
 * schrijven voor een laadstaat krijgen dan geen hoogte om in te centreren en
 * plakken tegen de bovenrand.
 */

type TransitionVariant = "fade" | "slide-up" | "slide-right" | "scale";

/** Waar de beweging vandaan komt. Alles onder `motion-safe:`. */
const VARIANT_KLASSE: Record<TransitionVariant, string> = {
  fade: "motion-safe:animate-in motion-safe:fade-in",
  "slide-up":
    "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4",
  "slide-right":
    "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-4",
  scale: "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95",
};

/**
 * PageTransition — layout-tussenlaag in `(dashboard)/layout.tsx`. Geen
 * animatie: de entree zit in de pagina zelf.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col">{children}</div>;
}

/**
 * ContentTransition — voor het wisselen van inhoud bínnen een pagina
 * (tabbladen, panelen). Zelfde regel: de nieuwe inhoud staat er meteen, de
 * fade is versiering.
 */
export function ContentTransition({
  children,
  transitionKey,
  variant = "fade",
}: {
  children: ReactNode;
  transitionKey: string;
  variant?: TransitionVariant;
}) {
  return (
    <div
      key={transitionKey}
      className={cn(
        VARIANT_KLASSE[variant],
        "motion-safe:duration-150 motion-safe:ease-standaard"
      )}
    >
      {children}
    </div>
  );
}

/**
 * FadeIn — losse fade voor één blok.
 *
 * `delay` blijft in de signatuur staan zodat aanroepplekken niet hoeven te
 * wijzigen, maar wordt bewust genegeerd: een delay heeft
 * `animation-fill-mode: both` nodig om vóór de start niets te tonen, en dát is
 * precies de lege tussenstaat die we hier weghalen.
 */
export function FadeIn({
  children,
  delay: _delay = 0,
  duration: _duration = 0.3,
  className,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(REVEAL_KLASSE, className)}
    >
      {children}
    </div>
  );
}
