"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";

/**
 * De cijferstrip: een rij kerncijfers als één instrument.
 *
 * Ontstaan als de dashboard-`Cijferbalk` en hier losgetrokken zodat het
 * klantdossier dezelfde strook kan gebruiken zonder hem na te bouwen. Wat
 * generiek is, staat hier; wat een pagina eigen is (welke cijfers, welke
 * kolomverdeling) blijft bij de aanroeper.
 *
 * De hairlines komen uit `gap-px` op een `bg-border`-vlak: dat tekent in élke
 * rasterstand een sluitende scheiding, ook als de strip van 4 naar 2 naar 1
 * kolom vouwt. Met `divide-x` zou de streep bij het vouwen op de verkeerde
 * cellen belanden.
 */

// ── Cel ─────────────────────────────────────────────────────────────────────

export function Cel({
  label,
  href,
  onClick,
  actief = false,
  span,
  balk,
  waarde,
  waardeTekst,
  waardeClassName,
  format = "currency",
  groot = false,
  voet,
  chip,
}: {
  label: string;
  /**
   * De lijst die dit cijfer bewijst. Elk blok klikt door. Cellen die binnen de
   * pagina schakelen (tabs) geven `onClick` in plaats van `href`: een link die
   * niet navigeert hoort geen link te zijn.
   */
  href?: string;
  onClick?: () => void;
  /** Alleen bij `onClick`: markeert de cel die nu open staat. */
  actief?: boolean;
  span?: string;
  /**
   * Achtergrondklasse van een 4px linkerbalk (`bg-…`). Bedoeld om een strook
   * op kleur te kunnen scannen in plaats van op tekst: geld amber, werk groen,
   * offertes kleibruin, relatie donkergroen. Zonder deze prop verandert er
   * niets aan de cel.
   */
  balk?: string;
  /** Getal — telt op met `AnimatedNumber`. Laat weg bij `waardeTekst`. */
  waarde?: number;
  /** Niet-numerieke waarde ("3 dagen geleden", "—"). Wint van `waarde`. */
  waardeTekst?: ReactNode;
  /** Voor een cel die kleur mag geven aan het cijfer zelf (openstaand bedrag). */
  waardeClassName?: string;
  format?: "currency" | "number";
  groot?: boolean;
  voet: ReactNode;
  chip?: ReactNode;
}) {
  const basis = cn(
    "group relative flex flex-col gap-1 bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
    actief && "bg-accent/50",
    balk && "pl-4",
    span
  );

  const waardeKlasse = cn(
    groot
      ? // Het enige heldcijfer van de pagina.
        "font-display text-[34px] leading-none font-semibold tracking-tight tabular-nums @[52rem]/cijfers:text-[40px]"
      : "text-[22px] leading-none font-bold tracking-tight tabular-nums",
    waardeClassName
  );

  const inhoud = (
    <>
      {balk && (
        <span
          aria-hidden
          data-balk
          className={cn("absolute inset-y-0 left-0 w-1", balk)}
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        {groot && chip}
      </div>

      {waardeTekst !== undefined ? (
        <span className={waardeKlasse}>{waardeTekst}</span>
      ) : (
        <AnimatedNumber
          value={waarde ?? 0}
          prefix={format === "currency" ? "€ " : ""}
          formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 0 }}
          locale="nl-NL"
          className={waardeKlasse}
        />
      )}

      {/* mt-auto: de voetregels van alle cellen liggen op één lijn, ongeacht
          hoe hoog het cijfer erboven is. */}
      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-[11px] leading-4">
        {voet}
        {!groot && chip}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={basis}>
        {inhoud}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={actief ? "true" : undefined}
      className={basis}
    >
      {inhoud}
    </button>
  );
}

// ── Cijferstrip ─────────────────────────────────────────────────────────────

export function Cijferstrip({
  label,
  kolommen,
  className,
  children,
}: {
  /** Toegankelijke naam van de strook ("Kerncijfers"). */
  label: string;
  /** Kolomverdeling van het raster; container-queries horen bij de aanroeper. */
  kolommen: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className={cn("overflow-hidden rounded-lg border bg-card", className)}
    >
      <div className={cn("grid gap-px bg-border", kolommen)}>{children}</div>
    </section>
  );
}
