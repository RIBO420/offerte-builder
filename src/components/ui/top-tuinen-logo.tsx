import Image from "next/image";

import { cn } from "@/lib/utils";

/** Bestandspaden in `public/`, gegenereerd uit het bronlogo van de hoofdsite. */
const BRON = {
  kleur: "/logo-top-tuinen.png",
  wit: "/logo-top-tuinen-wit.png",
} as const;

export type TopTuinenLogoVariant = keyof typeof BRON;

interface TopTuinenLogoProps {
  /**
   * `wit` op een donkere of groene ondergrond, `kleur` (het groene verloop) op
   * een lichte. De app gebruikt overal `wit`; lichte vlakken krijgen daarom een
   * groene drager onder het merkteken.
   */
  variant?: TopTuinenLogoVariant;
  /** Zijde in px; het merkteken is vierkant. */
  size?: number;
  className?: string;
  /**
   * Alleen invullen als het logo alléén staat. Staat "Top Tuinen" er als tekst
   * naast, laat dit dan weg — anders leest een schermlezer de naam dubbel.
   */
  alt?: string;
  /** Aanzetten waar het logo boven de vouw staat (login, portaal-header). */
  priority?: boolean;
}

/**
 * Het merkteken van Top Tuinen: de boom in de ring.
 *
 * Twee bestanden en geen CSS-filter, want dezelfde assets worden ook buiten de
 * browser gebruikt: `logo-top-tuinen.png` houdt het groene kleurverloop,
 * `logo-top-tuinen-wit.png` is dezelfde vorm volledig wit met behoud van alpha.
 *
 * Let op bij het plaatsen: een wit merkteken op een licht vlak is onzichtbaar.
 * Op `bg-card`, `bg-sidebar` en andere vlakken die met het thema meebewegen
 * hoort dus een vaste groene drager eronder — géén `bg-primary`, want die is in
 * dark mode juist bijna wit.
 */
export function TopTuinenLogo({
  variant = "wit",
  size = 32,
  className,
  alt,
  priority = false,
}: TopTuinenLogoProps) {
  return (
    <Image
      src={BRON[variant]}
      // Zonder alt is het logo decoratie: de naam staat er als tekst naast.
      alt={alt ?? ""}
      aria-hidden={alt ? undefined : true}
      width={size}
      height={size}
      priority={priority}
      className={cn("object-contain", className)}
    />
  );
}
