"use client";

/**
 * De bouwstenen van één antwoordblok (masterplan §"Het ontwerp").
 *
 * Stripe's drieluik, in het Nederlands: **vraag → antwoordzin met heldcijfer →
 * hooguit één bewijsstuk → doorklik naar de brondata**. De grafiek is nooit het
 * antwoord; hij staaft het antwoord dat er in taal boven staat.
 *
 * Bewust géén `<Card>` en geen `SectiePaneel`: dit is een leespagina, geen
 * werkscherm. Hiërarchie komt uit typografie, witruimte en één haarlijn per
 * sectie — kaarten om alles heen leest als een grafiekenmuseum met lijstjes.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { m } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { cn } from "@/lib/utils";

/** Anker-ids; ook de sleutels van de scroll-spy en de oude `?tab=`-omleiding. */
export const SECTIES = [
  { id: "hoe-loopt", vraag: "Hoe loopt deze periode?", kort: "Deze periode" },
  { id: "pipeline", vraag: "Wat zit er in de pipeline?", kort: "Pipeline" },
  { id: "geld-ligt", vraag: "Waar blijft geld liggen?", kort: "Openstaand" },
  { id: "beste-werk", vraag: "Wat is mijn beste werk?", kort: "Beste werk" },
] as const;

export type SectieId = (typeof SECTIES)[number]["id"];

/** ease-out-quint — echte objecten remmen af, ze stuiteren niet. */
const REM = [0.23, 1, 0.32, 1] as const;

export function AntwoordBlok({
  id,
  vraag,
  /** Waar dit blok over gaat qua tijd: "Augustus 2026" of "Los van de periode". */
  reikwijdte,
  /** Volgnummer voor de gestaggerde intro (~80 ms per sectie). */
  index = 0,
  children,
}: {
  id: SectieId;
  vraag: string;
  reikwijdte: ReactNode;
  index?: number;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <m.section
      id={id}
      data-sectie={id}
      // scroll-mt houdt de kop vrij van de sticky ankerbalk (~44 px) plus lucht.
      className="scroll-mt-20 border-t border-border/70 py-12 first:border-t-0 first:pt-2 md:py-16 @container/blok"
      aria-labelledby={`${id}-kop`}
      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reducedMotion ? 0 : 0.5,
        delay: reducedMotion ? 0 : index * 0.08,
        ease: REM,
      }}
    >
      <header className="mb-7">
        <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {reikwijdte}
        </p>
        <h2
          id={`${id}-kop`}
          className="mt-1.5 font-display text-[26px] leading-tight font-semibold tracking-tight text-balance md:text-[32px]"
        >
          {vraag}
        </h2>
      </header>
      {children}
    </m.section>
  );
}

/**
 * De antwoordzin. Eén geschreven zin die het cijfer duidt — Runway's les: een
 * verschil dat je in taal benoemt landt, een verschil dat je alleen tekent niet.
 */
export function Antwoordzin({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "max-w-[58ch] text-[15px] leading-relaxed text-pretty text-muted-foreground md:text-base",
        className
      )}
    >
      {children}
    </p>
  );
}

/** Het cijfer waar het in de zin over gaat, benadrukt binnen de lopende tekst. */
export function Nadruk({ children }: { children: ReactNode }) {
  return (
    <strong className="font-medium text-foreground tabular-nums">
      {children}
    </strong>
  );
}

export type CijferToon = "neutraal" | "aandacht";

/**
 * Het heldcijfer: Fraunces, groot, links uitgelijnd, `tabular-nums`.
 *
 * Geen sparkline eronder — een trendlijntje van 60 px zegt niets en was op de
 * oude pagina zelfs verzonnen (`generateTrendData` wees altijd omhoog).
 */
export function Heldcijfer({
  label,
  waarde,
  eenheid,
  onder,
  toon = "neutraal",
  formaat = "groot",
}: {
  label: string;
  waarde: string;
  /** Klein achtervoegsel op de basislijn van het cijfer ("%", "uur"). */
  eenheid?: string;
  onder?: ReactNode;
  toon?: CijferToon;
  formaat?: "groot" | "middel";
}) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 font-display font-semibold tracking-tight tabular-nums",
          formaat === "groot"
            ? "text-[clamp(2.4rem,6cqi+1rem,3.75rem)] leading-[0.95]"
            : "text-[clamp(1.6rem,3cqi+1rem,2.1rem)] leading-tight",
          toon === "aandacht" && "text-[var(--chart-2)]"
        )}
      >
        {waarde}
        {eenheid && (
          <span className="ml-1 align-baseline text-[0.42em] font-medium tracking-normal text-muted-foreground">
            {eenheid}
          </span>
        )}
      </p>
      {onder && (
        <p className="mt-2 max-w-[34ch] text-sm text-pretty text-muted-foreground">
          {onder}
        </p>
      )}
    </div>
  );
}

/**
 * Doorklik naar de lijstpagina die het cijfer maakt. Verifieerbaarheid is het
 * hele punt: een cijfer dat je kunt natellen is een cijfer dat je gelooft.
 */
export function Doorklik({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className
      )}
    >
      {children}
      <ArrowRight className="size-3.5 transition-transform duration-300 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none" />
    </Link>
  );
}

/**
 * Het bewijsstuk: één grafiek of lijst met een klein onderschrift. Een
 * haarlijn erboven in plaats van een kaartrand — de sectie is al het frame.
 */
export function Bewijs({
  titel,
  toelichting,
  acties,
  children,
  className,
}: {
  titel: string;
  toelichting?: ReactNode;
  acties?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("min-w-0", className)}>
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border/70 pb-2">
        <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {titel}
        </span>
        {acties}
        {toelichting && (
          <span className="text-xs text-muted-foreground">{toelichting}</span>
        )}
      </figcaption>
      {children}
    </figure>
  );
}

/**
 * Sectie zonder data. Legt uit wanneer er wél iets staat — een lege sectie die
 * alleen "geen data" zegt leert de gebruiker niets (R1).
 */
export function LegeSectie({
  tekst,
  hint,
  actie,
}: {
  tekst: string;
  hint?: string;
  actie?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/25 px-4 py-5">
      <p className="text-sm font-medium">{tekst}</p>
      {hint && (
        <p className="mt-1 max-w-[52ch] text-sm text-pretty text-muted-foreground">
          {hint}
        </p>
      )}
      {actie && <div className="mt-3">{actie}</div>}
    </div>
  );
}
