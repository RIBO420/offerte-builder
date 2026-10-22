import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { PDF_FONT } from "./pdf-fonts";
import type { PdfTheme } from "./pdf-theme";
import { beschrijvingNaarBlokken } from "./beschrijving-blokken";

/**
 * Artikelbeschrijving onder een regel, gedeeld door offerte- en factuur-PDF.
 *
 * Een eigen, rustig blok onder de regelnaam: een dunne gouden lijn links
 * (goud mag als lijn, niet als tekst) houdt het bij zijn regel. Tekst een
 * trede kleiner dan de tabelcel in warme grijs, ruime regelafstand en lucht
 * tussen alinea's. Een kopje ("De prijs is inclusief:") staat in warm zwart,
 * halfvet; opsommingen krijgen een mosgroen bolletje met hangende
 * inspringing. Geen `wrap={false}`: lange tekst breekt over de pagina heen.
 */
function maakStijlen(t: PdfTheme) {
  const grootte = t.typography.smallSize - 0.5;
  const tekst = {
    fontFamily: PDF_FONT,
    fontWeight: 400 as const,
    fontSize: grootte,
    lineHeight: 1.5,
    color: t.colors.muted,
  };
  return StyleSheet.create({
    wikkel: {
      marginTop: 5,
      marginBottom: 2,
      paddingLeft: 8,
      borderLeftWidth: 1.25,
      borderLeftColor: t.colors.secondary,
    },
    alinea: tekst,
    kop: {
      ...tekst,
      fontWeight: 600,
      color: t.colors.text,
    },
    ruimte: {
      marginTop: 5,
    },
    ruimteKlein: {
      marginTop: 2,
    },
    punt: {
      flexDirection: "row",
      marginTop: 1.5,
    },
    bolletje: {
      ...tekst,
      width: 9,
      color: t.colors.primary,
    },
    puntTekst: {
      ...tekst,
      flex: 1,
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
      {blokken.map((blok, i) => {
        // Een lijst direct onder zijn kopje: weinig ruimte; verder ruim
        const vorige = blokken[i - 1];
        const ruimte =
          i === 0 ? undefined : vorige?.soort === "kop" ? s.ruimteKlein : s.ruimte;
        if (blok.soort === "kop") {
          return (
            <Text
              key={i}
              style={ruimte ? [s.kop, ruimte] : s.kop}
              hyphenationCallback={geenAfbreking}
              minPresenceAhead={20}
            >
              {blok.tekst}
            </Text>
          );
        }
        if (blok.soort === "alinea") {
          return (
            <Text
              key={i}
              style={ruimte ? [s.alinea, ruimte] : s.alinea}
              hyphenationCallback={geenAfbreking}
            >
              {blok.regels.join("\n")}
            </Text>
          );
        }
        return (
          <View key={i} style={ruimte}>
            {blok.punten.map((punt, j) => (
              <View key={j} style={s.punt}>
                <Text style={s.bolletje}>•</Text>
                <Text style={s.puntTekst} hyphenationCallback={geenAfbreking}>
                  {punt}
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
