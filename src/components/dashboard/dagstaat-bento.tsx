"use client";

import type { ReactNode } from "react";

/**
 * De entree van de dagstaat is sinds okt 2026 de gedeelde pagina-entree
 * (`REVEAL_KLASSE` uit `pagina-reveal.tsx`) om de hele geladen inhoud, in
 * `dashboard/page.tsx`. De eigen `dagstaat-reveal`-keyframes met een stagger
 * van 80ms per blok zijn eruit: één entree voor de hele app.
 */

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
