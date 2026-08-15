"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Het raster van de dagstaat.
 *
 * Twaalf kolommen, één keer gedefinieerd, met **container**-queries in plaats
 * van viewport-breakpoints: het dashboard staat in `main` naast een sidebar die
 * in- en uitklapt, dus de schermbreedte zegt niets over de ruimte die de blokken
 * echt hebben. `@container/dagstaat` staat op de paginawrapper; elk blok kiest
 * zijn span op de breedte van díé container.
 *
 * Drie tiers, zo gekozen dat geen enkele tier een gat in het raster laat:
 *
 * | Tier | Container | Indeling |
 * |---|---|---|
 * | S | < 26rem  | één kolom, DOM-volgorde = prioriteitsvolgorde |
 * | M | 26–50rem | werkstrook vol breed, de twee paren naast elkaar (7/5 en 6/6) |
 * | L | ≥ 50rem  | de volle bento uit het masterplan (7/5 · 12 · 8/4 · 6/6 · 12) |
 *
 * Let op bij het bijstellen: een container-query meet de **content-box**, dus de
 * `p-6`/`md:p-8` van de wrapper telt niet mee. Gemeten content-boxen (sidebar
 * uitgeklapt): 1680px viewport → 1288px (L), 1280 → 952 (L), tablet 768 → 440
 * (M), mobiel 375 → 327 (S). Op tablet eet de sidebar 256px, dus daar is een
 * cel écht een halve telefoon breed — de werkstrook blijft er bewust vol breed
 * en alleen de rustiger paren splitsen.
 */
export const DAGSTAAT_SPAN = {
  aandacht: "col-span-12 @[50rem]/dagstaat:col-span-7",
  taken: "col-span-12 @[50rem]/dagstaat:col-span-5",
  cijfers: "col-span-12",
  pipeline: "col-span-12 @[26rem]/dagstaat:col-span-7 @[50rem]/dagstaat:col-span-8",
  conversie: "col-span-12 @[26rem]/dagstaat:col-span-5 @[50rem]/dagstaat:col-span-4",
  lopendWerk: "col-span-12 @[26rem]/dagstaat:col-span-6",
  laatsteOffertes: "col-span-12 @[26rem]/dagstaat:col-span-6",
  vloot: "col-span-12",
} as const;

/**
 * Eén gestaggerde reveal bij binnenkomst, verder rust: 80 ms per blok,
 * ease-out-quint (`cubic-bezier(.23,1,.32,1)`) — echte dingen remmen af, ze
 * stuiteren niet.
 *
 * **Waarom CSS en geen framer-motion.** De vorige versie draaide dit met
 * `m.div` + variants en waarschuwde in een commentaar dat blokken in een
 * verborgen of voor-gerenderde tab op `opacity: 0` bleven hangen (WS3a). Dat is
 * hier opnieuw gemeten: in een achtergrondtab staat `requestAnimationFrame`
 * stil, dus JS-animaties komen nooit bij hun eindwaarde — alle acht de blokken
 * stonden op `opacity: 0` terwijl de pagina volledig geladen was. Een
 * CSS-animatie met `animation-fill-mode: both` loopt op de documenttijdlijn en
 * eindigt hoe dan ook op zijn `to`-staat. Geen JS, geen hangende blokken.
 */
const REVEAL_STIJL = `
@keyframes dagstaat-reveal {
  from { opacity: 0; transform: translate3d(0, 10px, 0); }
  to   { opacity: 1; transform: none; }
}
.dagstaat-reveal {
  animation: dagstaat-reveal 420ms cubic-bezier(0.23, 1, 0.32, 1) both;
  will-change: opacity, transform;
}
@media (prefers-reduced-motion: reduce) {
  .dagstaat-reveal { animation: none; }
}
`;

/** Zet de keyframes klaar. Hoort vóór de eerste `dagstaat-reveal` in de DOM. */
export function DagstaatRevealStijl() {
  return <style>{REVEAL_STIJL}</style>;
}

const STAP_MS = 80;

function revealStijl(stap: number): CSSProperties {
  return { animationDelay: `${stap * STAP_MS}ms` };
}

/** Wrapper voor iets dat meedoet aan de reveal maar niet in het raster staat. */
export function DagstaatReveal({
  stap,
  className,
  children,
}: {
  stap: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("dagstaat-reveal", className)} style={revealStijl(stap)}>
      {children}
    </div>
  );
}

export function BentoBlok({
  span,
  stap,
  className,
  children,
}: {
  /** Een waarde uit {@link DAGSTAAT_SPAN}. */
  span: string;
  /** Positie in de reveal-volgorde (0 = eerst). */
  stap: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={revealStijl(stap)}
      // min-w-0: zonder dit neemt een grid-item de intrinsieke breedte van zijn
      // langste regel aan en duwt het de pagina zijwaarts open. Harde regel 1.
      // [&>*]:h-full trekt het paneel door tot de hoogte van zijn buur, zodat
      // een rij van twee cellen één blok leest en geen trapje.
      className={cn(
        "dagstaat-reveal flex min-w-0 flex-col [&>*]:h-full",
        span,
        className
      )}
    >
      {children}
    </div>
  );
}

export function DagstaatBento({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-12 gap-3">{children}</div>;
}
