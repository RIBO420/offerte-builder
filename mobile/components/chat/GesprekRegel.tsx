import React, { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Drukvlak } from '../werk/Bouwstenen';
import { useVeldKleuren } from '../veld/BuitenModus';
import { tekst } from '../../theme';
import { inboxTijd } from './chat-tijd';

const AVATAR = 44;
const TUSSENRUIMTE = 12;

/** Ongelezen-telling als gevulde pil in de primaire kleur. */
export function OngelezenTeller({ aantal }: { aantal: number }) {
  const kleuren = useVeldKleuren();
  return (
    <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 7, backgroundColor: kleuren.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text maxFontSizeMultiplier={1.2} style={[tekst.bijschrift, tekst.cijfers, { color: kleuren.primaryForeground, fontWeight: '700' }]}>
        {aantal > 99 ? '99+' : aantal}
      </Text>
    </View>
  );
}

/**
 * Eén gesprek in de inbox: avatar, naam met tijd rechts, laatste bericht op één
 * regel en de ongelezen-telling. Hoogte ≥ 72, dus ruim boven het 44pt-raakvlak.
 */
export function GesprekRegel({
  avatar,
  naam,
  voorbeeld,
  tijd,
  ongelezen = 0,
  onPress,
}: {
  avatar: ReactNode;
  naam: string;
  voorbeeld: string;
  tijd?: number;
  ongelezen?: number;
  onPress: () => void;
}) {
  const kleuren = useVeldKleuren();
  const tijdLabel = tijd ? inboxTijd(tijd) : '';
  const heeftOngelezen = ongelezen > 0;
  return (
    <Drukvlak
      onPress={onPress}
      accessibilityLabel={[naam, heeftOngelezen ? `${ongelezen} ongelezen` : null, voorbeeld, tijdLabel || null].filter(Boolean).join(', ')}
      accessibilityHint="Opent het gesprek"
      style={{ flexDirection: 'row', alignItems: 'center', gap: TUSSENRUIMTE, minHeight: 72, paddingVertical: 12 }}
    >
      {avatar}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={[tekst.kop, { color: kleuren.foreground, flex: 1 }]} numberOfLines={1}>
            {naam}
          </Text>
          {tijdLabel !== '' && (
            <Text style={[tekst.voetnoot, tekst.cijfers, { color: heeftOngelezen ? kleuren.primary : kleuren.mutedForeground, fontWeight: heeftOngelezen ? '600' : '400' }]}>
              {tijdLabel}
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 22 }}>
          <Text style={[tekst.sub, { color: heeftOngelezen ? kleuren.foreground : kleuren.mutedForeground, flex: 1 }]} numberOfLines={1}>
            {voorbeeld}
          </Text>
          {heeftOngelezen && <OngelezenTeller aantal={ongelezen} />}
        </View>
      </View>
    </Drukvlak>
  );
}

/** Haarlijn tussen gesprekken, ingesprongen tot de tekst (zoals iOS-lijsten). */
export function RegelLijn() {
  const kleuren = useVeldKleuren();
  return <View style={{ height: 1, backgroundColor: kleuren.border, marginLeft: AVATAR + TUSSENRUIMTE }} />;
}
