import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { PDF_FONT } from "./pdf-fonts";
import type { PdfTheme } from "./pdf-theme";
import { beschrijvingNaarBlokken } from "./beschrijving-blokken";

/**
 * Artikelbeschrijving onder een regel, gedeeld door offerte- en factuur-PDF.
 *
 * Bewust een trede rustiger dan de regelnaam: een halve punt kleiner dan de
 * tabelcel, warme grijs uit de huisstijl (6,6:1 op wit), ruime regelafstand.
 * Alinea's houden hun regeleinden; opsommingen krijgen een bolletje met
 * hangende inspringing (goud is geen tekstkleur op licht, dus ook grijs).
 * Geen `wrap={false}`: een lange tekst breekt gewoon over de pagina heen.
 */
function maakStijlen(t: PdfTheme) {
  const grootte = t.typography.smallSize - 0.5;
  return StyleSheet.create({
    wikkel: {
      marginTop: 3,
    },
    alinea: {
      fontFamily: PDF_FONT,
      fontWeight: 400,
      fontSize: grootte,
      lineHeight: 1.45,
      color: t.colors.muted,
    },
    blokTussenruimte: {
      marginTop: 4,
    },
    punt: {
      flexDirection: "row",
      marginTop: 1.5,
      paddingLeft: 2,
    },
    bolletje: {
      width: 9,
      fontFamily: PDF_FONT,
      fontSize: grootte,
      lineHeight: 1.45,
      color: t.colors.muted,
    },
    puntTekst: {
      flex: 1,
      fontFamily: PDF_FONT,
      fontWeight: 400,
      fontSize: grootte,
      lineHeight: 1.45,
      color: t.colors.muted,
    },
  });
}

/**
 * Geen afbreekstreepjes: react-pdf breekt woorden op Engelse patronen
 * ("offer-tekst"), dat leest slecht in Nederlandse offertetekst.
 */
export const geenAfbreking = (woord: string): string[] => [woord];

export function ArtikelBeschrijvingPdf({
  tekst,
  theme,
}: {
  tekst: string | undefined;
  theme: PdfTheme;
}) {
  const blokken = beschrijvingNaarBlokken(tekst);
  if (blokken.length === 0) return null;
  const s = maakStijlen(theme);

  return (
    <View style={s.wikkel}>
      {blokken.map((blok, i) =>
        blok.soort === "alinea" ? (
          <Text
            key={i}
            style={i > 0 ? [s.alinea, s.blokTussenruimte] : s.alinea}
            hyphenationCallback={geenAfbreking}
          >
            {blok.regels.join("\n")}
          </Text>
        ) : (
          <View key={i} style={i > 0 ? s.blokTussenruimte : undefined}>
            {blok.punten.map((punt, j) => (
              <View key={j} style={s.punt}>
                <Text style={s.bolletje}>•</Text>
                <Text style={s.puntTekst} hyphenationCallback={geenAfbreking}>
                  {punt}
                </Text>
              </View>
            ))}
          </View>
        )
      )}
    </View>
  );
}
