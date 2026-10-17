"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

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

// ── Dashboard A: twee kolommen ──────────────────────────────────────────────
//
// Werk links (wat je moet dóén), geld en offertes rechts (wat je moet wéten).
// Eén splitsing op inhoud in plaats van een bento van acht even zware cellen:
// je weet per kolom welk soort vraag hij beantwoordt. Onder 60rem containerbreedte
// stapelen de kolommen, werk eerst — de DOM-volgorde is de prioriteitsvolgorde.
// De geldkolom is begrensd (max 26rem): cijfers worden niet beter leesbaar
// door ze breder te maken, de werkkolom wel.

export function DagstaatKolommen({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-start gap-6 @[60rem]/dagstaat:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] @[60rem]/dagstaat:gap-8">
      {children}
    </div>
  );
}

export function DagstaatKolom({
  label,
  icoon,
  children,
}: {
  /** Kolomkop in labelstijl ("Werk", "Geld en offertes"). */
  label: string;
  icoon?: ReactNode;
  children: ReactNode;
}) {
  return (
    // min-w-0: zonder dit neemt een grid-item de breedte van zijn langste
    // regel aan en duwt het de pagina zijwaarts open. Harde regel 1.
    <section aria-label={label} className="flex min-w-0 flex-col gap-3">
      <p
        aria-hidden="true"
        className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase [&>svg]:size-4"
      >
        {icoon}
        {label}
      </p>
      {children}
    </section>
  );
}
