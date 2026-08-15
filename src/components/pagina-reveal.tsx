"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * De entree van een pagina: eerst er zíjn, dan pas mooi binnenkomen.
 *
 * **Waarom dit bestaat.** De dashboardpagina's openden met geneste
 * framer-motion-wrappers (`initial={{ opacity: 0, y: 20 }}` op de buitenste,
 * `y: 10` met delays tot 0,3s op elk blok). Bij die opzet is de eindstaat
 * alleen bereikbaar als de animatie ook echt lóópt: framer rekent elke frame
 * op `requestAnimationFrame`. Staat rAF stil — achtergrondtab, zware tab,
 * trage machine — dan blijft de pagina hangen op wat er toevallig al gerekend
 * was. Gemeten op `/projecten` (15 aug 2026) met
 * `document.visibilityState === "hidden"`: buitenste wrapper `opacity 0.12164`,
 * headerrij `opacity 0`, terwijl de tabel er met drie rijen van 49px gewoon
 * stond. Dat is de "lange lege tussenstaat" uit de eindschouw.
 *
 * **De omkering.** De eindstaat is de default; de animatie is versiering.
 * Dat is dezelfde les als WS3a op het dashboard (`dagstaat-bento.tsx`), daar
 * opgelost met een CSS-animatie op de documenttijdlijn. Hier gaan we één stap
 * verder dan `fill-mode: both`:
 *
 * - `animate-in` uit tw-animate-css draait met `animation-fill-mode: none`.
 *   Buiten de looptijd van de animatie geldt dus altijd de basisstijl, en die
 *   is gewoon zichtbaar. Geen `opacity-0`-klasse, geen inline `opacity`, geen
 *   staat die van JS afhangt: rendert de browser nul animatieframes, dan staat
 *   de inhoud er in de eindstaat. Dat is de garantie, per constructie.
 * - Geen delays. Een stagger heeft `fill-mode: both` nodig om vóór de start
 *   niets te tonen, en dat is precies de lege tussenstaat terug. Alles komt
 *   in één beweging binnen.
 * - `motion-safe:` doet het respect voor `prefers-reduced-motion` in CSS. Er
 *   is geen `useReducedMotion()`-hook meer nodig, en dus ook geen render die
 *   pas na de eerste client-effect klopt.
 */
export const REVEAL_KLASSE =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:ease-out";

export function PaginaReveal({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className={cn(REVEAL_KLASSE, className)} style={style}>
      {children}
    </div>
  );
}
