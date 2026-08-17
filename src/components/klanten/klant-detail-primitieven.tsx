"use client";

import type { ReactNode } from "react";
import { CopyButton } from "@/components/ui/copy-button";

/**
 * De twee bouwsteentjes van het klantdossier die op meer dan één plek staan:
 * de contactchip in de identiteitskop en de feitenregel in de gegevenslijst.
 * Stonden als lokale helpers in `klanten/[id]/page.tsx`; nu die pagina in kop +
 * tabs is opgesplitst, hebben kop en Instellingen-tab ze allebei nodig.
 */

/**
 * Stille contactchip: het hele gegeven is klikbaar (bellen, mailen, route),
 * de kopieerknop verschijnt pas bij aanwijzen of toetsenbordfocus. Zo blijft
 * de regel rustig zonder dat er functionaliteit verdwijnt.
 */
export function ContactChip({
  icoon,
  href,
  extern = false,
  kopieer,
  kopieerLabel,
  titel,
  className,
  children,
}: {
  icoon: ReactNode;
  href?: string;
  /** Externe links (Maps) openen in een nieuw tabblad. */
  extern?: boolean;
  kopieer?: string;
  kopieerLabel?: string;
  titel?: string;
  className?: string;
  children: ReactNode;
}) {
  const inhoud = (
    <>
      <span
        aria-hidden
        className="shrink-0 text-muted-foreground [&>svg]:size-4"
      >
        {icoon}
      </span>
      {children}
    </>
  );
  return (
    <span className="group/chip inline-flex min-w-0 items-center gap-0.5">
      {href ? (
        <a
          href={href}
          {...(extern
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
          title={titel}
          className={`inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className ?? ""}`}
        >
          {inhoud}
        </a>
      ) : (
        <span
          title={titel}
          className={`inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 ${className ?? ""}`}
        >
          {inhoud}
        </span>
      )}
      {kopieer && (
        <span className="shrink-0 opacity-0 transition-opacity duration-100 focus-within:opacity-100 group-hover/chip:opacity-100 max-sm:opacity-100">
          <CopyButton value={kopieer} label={kopieerLabel} />
        </span>
      )}
    </span>
  );
}

/** Label links, waarde rechts — leest als een dossierregel, niet als een kaart. */
export function Feit({
  label,
  children,
  uitlijnen = "rechts",
}: {
  label: string;
  children: ReactNode;
  /** Adressen lopen over meerdere regels en staan beter onder het label. */
  uitlijnen?: "rechts" | "onder";
}) {
  if (uitlijnen === "onder") {
    return (
      <div className="px-3 py-2.5">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-sm">{children}</dd>
      </div>
    );
  }
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2.5">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm">{children}</dd>
    </div>
  );
}
