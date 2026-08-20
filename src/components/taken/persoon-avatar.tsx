"use client";

import { cn } from "@/lib/utils";
import type { ToewijsbaarPersoon } from "./types";

/**
 * Het schijfje met initialen op een taakkaart.
 *
 * De rol zit in de kleur, niet in een extra labeltje: **maker groen, checker
 * amber** (inventaris §A6/§C). Groen is "werk dat gedaan wordt", amber is
 * "aandacht/wachten" — precies wat een checker doet. Zo zie je op een bord van
 * dertig kaartjes in één blik van wie het werk is en wie er nog overheen moet.
 *
 * Zonder persoon staat er een gestippelde ring met een streepje: leeg is een
 * zichtbare toestand ("niemand maakt dit"), geen weggelaten element.
 */
export type AvatarRol = "maker" | "checker" | "neutraal";

const ROL_TOON: Record<AvatarRol, string> = {
  maker: "border-primary/40 bg-primary/12 text-primary",
  checker:
    "border-status-verzonden-border bg-status-verzonden text-status-verzonden-text",
  neutraal: "border-border bg-muted text-muted-foreground",
};

const ROL_OMSCHRIJVING: Record<AvatarRol, string> = {
  maker: "Maakt het",
  checker: "Checkt het voor verzending",
  neutraal: "Betrokken",
};

export function PersoonAvatar({
  persoon,
  rol = "neutraal",
  toonLeeg = false,
  className,
}: {
  persoon: ToewijsbaarPersoon | null | undefined;
  rol?: AvatarRol;
  /** Ook een schijfje tonen als er niemand staat (open kaart, bord-kaartje). */
  toonLeeg?: boolean;
  className?: string;
}) {
  if (!persoon && !toonLeeg) return null;

  const omschrijving = ROL_OMSCHRIJVING[rol];
  const titel = persoon
    ? `${omschrijving}: ${persoon.naam}`
    : `${omschrijving}: niemand`;

  return (
    <span
      data-rol={rol}
      data-leeg={persoon ? undefined : "true"}
      title={titel}
      aria-label={titel}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold leading-none",
        persoon ? ROL_TOON[rol] : "border-dashed border-border text-muted-foreground/70",
        className
      )}
    >
      {persoon ? persoon.initialen : "–"}
    </span>
  );
}
