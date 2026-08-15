"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * De entree van élke dashboardpagina.
 *
 * **Waarom dit geen framer-motion meer is.** `(dashboard)/layout.tsx` hangt
 * deze wrapper om alles wat `main` rendert. Zolang hij een `m.div` met
 * `initial="hidden"` (`opacity: 0`) was, hing de hele app aan één rAF-lus: valt
 * `requestAnimationFrame` stil — achtergrondtab, zware tab, trage machine — dan
 * komt de animatie nooit bij zijn eindwaarde en blijft het scherm blanco,
 * ongeacht hoe braaf de pagina eronder zich gedraagt. Gemeten op `/projecten`
 * (15 aug 2026, `visibilityState === "hidden"`): wrapper op `opacity 0.12`,
 * inhoud volledig geladen.
 *
 * Nu is de eindstaat de basisstijl en is de animatie versiering: CSS-klassen
 * uit tw-animate-css, die met `animation-fill-mode: none` draaien. Buiten de
 * looptijd geldt dus altijd gewoon "zichtbaar". De `key` op de wrapper laat de
 * animatie opnieuw starten bij elke routewissel — dat is precies wat
 * `AnimatePresence` hier deed, alleen zonder JS.
 *
 * `flex flex-1 flex-col` is geen opmaak maar een doorgeefluik: de `<main>` in
 * `(dashboard)/layout.tsx` is een flexkolom, en zonder deze klassen breekt deze
 * tussenlaag de keten. Pagina's die `flex flex-1 items-center justify-center`
 * schrijven voor een laadstaat krijgen dan geen hoogte om in te centreren en
 * plakken tegen de bovenrand. De wrapper staat er nu altijd, ook bij
 * `prefers-reduced-motion` — vroeger viel hij daar weg, en dus ook de keten.
 */

type TransitionVariant = "fade" | "slide-up" | "slide-right" | "scale";
type TransitionSpeed = "fast" | "normal" | "slow" | "spring";

/** Waar de beweging vandaan komt. Alles onder `motion-safe:`. */
const VARIANT_KLASSE: Record<TransitionVariant, string> = {
  fade: "motion-safe:animate-in motion-safe:fade-in",
  "slide-up":
    "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4",
  "slide-right":
    "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-4",
  scale: "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95",
};

/** `spring` bestaat niet in CSS; het is hier de rustigste van de drie. */
const SNELHEID_KLASSE: Record<TransitionSpeed, string> = {
  fast: "motion-safe:duration-150",
  normal: "motion-safe:duration-200",
  slow: "motion-safe:duration-300",
  spring: "motion-safe:duration-300",
};

interface PageTransitionProps {
  children: ReactNode;
  /** Animation variant */
  variant?: TransitionVariant;
  /** Transition speed */
  speed?: TransitionSpeed;
  /** Custom key for transition (defaults to pathname) */
  transitionKey?: string;
}

/**
 * PageTransition — wrapper voor de pagina-entree in `(dashboard)/layout.tsx`.
 */
export function PageTransition({
  children,
  variant = "fade",
  speed = "normal",
  transitionKey,
}: PageTransitionProps) {
  const pathname = usePathname();
  const key = transitionKey ?? pathname;

  return (
    <div
      key={key}
      className={cn(
        "flex flex-1 flex-col",
        VARIANT_KLASSE[variant],
        SNELHEID_KLASSE[speed],
        "motion-safe:ease-out"
      )}
    >
      {children}
    </div>
  );
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
        "motion-safe:duration-150 motion-safe:ease-out"
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
      className={cn(
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:ease-out",
        className
      )}
    >
      {children}
    </div>
  );
}
