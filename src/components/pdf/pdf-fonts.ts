import { Font } from "@react-pdf/renderer";

/**
 * Letter van de huisstijlgids (okt 2026): Outfit — Regular 400 voor tekst,
 * SemiBold 600 voor koppen, namen en contactgegevens.
 *
 * De TTF's staan in `public/fonts/outfit/` (SIL OFL 1.1, zie OFL.txt daar;
 * afkomstig uit @expo-google-fonts/outfit 0.4.3, volledige glyph-set).
 * react-pdf leest geen woff2, vandaar TTF.
 *
 * - Browser (alle PDF's worden client-side gerenderd): relatieve URL, react-pdf
 *   haalt hem met fetch op van de eigen origin.
 * - Node (scripts/tests): bestandspad vanaf de projectroot.
 */
export const PDF_FONT = "Outfit";

/** Spread in een style voor koppen, namen, bedragen en contactgegevens. */
export const PDF_KOP = { fontFamily: PDF_FONT, fontWeight: 600 } as const;

let geregistreerd = false;

function fontBasis(): string {
  if (typeof window !== "undefined") return "/fonts/outfit";
  return `${process.cwd()}/public/fonts/outfit`;
}

export function registreerPdfFonts(): void {
  if (geregistreerd) return;
  geregistreerd = true;
  const basis = fontBasis();
  Font.register({
    family: PDF_FONT,
    fonts: [
      { src: `${basis}/Outfit-Regular.ttf`, fontWeight: 400 },
      { src: `${basis}/Outfit-SemiBold.ttf`, fontWeight: 600 },
    ],
  });
}

registreerPdfFonts();
