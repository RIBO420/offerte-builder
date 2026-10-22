/**
 * Text en TextInput met de huisstijlletter Outfit.
 *
 * In React Native kies je het gewicht van een custom font via de familienaam
 * (`Outfit_400Regular`, `Outfit_600SemiBold`), niet via `fontWeight`: een custom
 * familie mét fontWeight valt op iOS terug op de systeemletter en wordt op Android
 * nep-vet. Deze wrappers vertalen `fontWeight` (ook uit NativeWind-klassen als
 * `font-semibold`) naar de juiste familie en halen het gewicht zelf weg:
 * 600 en zwaarder → halfvet, de rest → regulier. Een expliciete andere familie
 * (mono) blijft ongemoeid.
 *
 * Geneste Text zonder eigen gewicht of familie erft van de ouder, zoals in RN
 * gebruikelijk — anders zou een woord binnen een kop terugvallen op regulier.
 *
 * Gebruik deze in plaats van `Text`/`TextInput` uit 'react-native'.
 */
import React, { createContext, forwardRef, useContext } from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { cssInterop } from 'nativewind';
import { lettertype } from '../../theme/typography';

const OUTFIT = new Set<string>([lettertype.regulier, lettertype.halfvet, 'System']);
const HALFVET = new Set(['semibold', 'bold', 'condensedBold', 'heavy', 'black']);

function isHalfvet(gewicht: NonNullable<TextStyle['fontWeight']>): boolean {
  if (typeof gewicht === 'number') return gewicht >= 600;
  const n = Number.parseInt(gewicht, 10);
  return Number.isNaN(n) ? HALFVET.has(gewicht) : n >= 600;
}

/**
 * Zet fontWeight om naar de Outfit-familie. `erven`: binnen een andere Text —
 * zonder eigen gewicht/familie dan niets zetten, zodat de ouder doorwerkt.
 */
export function metOutfit(style: StyleProp<TextStyle>, erven = false): StyleProp<TextStyle> {
  const plat = StyleSheet.flatten(style) as TextStyle | undefined;
  const familie = plat?.fontFamily;
  const gewicht = plat?.fontWeight;
  if (familie && !OUTFIT.has(familie)) return style;
  if (erven && gewicht == null && !familie) return style;

  const fontFamily =
    gewicht != null
      ? isHalfvet(gewicht) ? lettertype.halfvet : lettertype.regulier
      : familie && familie !== 'System' ? familie : lettertype.regulier;
  const { fontWeight: _weg, ...rest } = plat ?? {};
  return { ...rest, fontFamily };
}

const BinnenTekst = createContext(false);

export const Text = forwardRef<RNText, TextProps>(function Text({ style, ...props }, ref) {
  const genest = useContext(BinnenTekst);
  const tekst = <RNText ref={ref} {...props} style={metOutfit(style, genest)} />;
  return genest ? tekst : <BinnenTekst.Provider value>{tekst}</BinnenTekst.Provider>;
});
// eslint-disable-next-line @typescript-eslint/no-redeclare -- waarde én type, net als in 'react-native'
export type Text = RNText;

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput({ style, ...props }, ref) {
  return <RNTextInput ref={ref} {...props} style={metOutfit(style)} />;
});
// eslint-disable-next-line @typescript-eslint/no-redeclare -- waarde én type, net als in 'react-native'
export type TextInput = RNTextInput;

// className → style vóór de wrapper, zodat `font-semibold` e.d. ook omgezet worden.
cssInterop(Text, { className: 'style' });
cssInterop(TextInput, { className: { target: 'style', nativeStyleToProp: { textAlign: true } } });
