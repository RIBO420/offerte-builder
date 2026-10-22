import React, { type ComponentType } from 'react';
import { View } from 'react-native';
import { Text } from '../ui/Tekst';
import { toonKleuren, type Toon } from '../werk/Bouwstenen';
import { useVeldKleuren } from '../veld/BuitenModus';
import { initialen } from './chat-tijd';

type Icoon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

// Vaste toon per naam, zodat iemand overal dezelfde avatarkleur houdt.
const AVATAR_TONEN: Toon[] = ['primair', 'info', 'wachten', 'neutraal'];
function avatarToon(naam: string): Toon {
  let hash = 0;
  for (let i = 0; i < naam.length; i++) {
    hash = naam.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_TONEN[Math.abs(hash) % AVATAR_TONEN.length];
}

/** Initialen in een ronde, getinte tegel. Decoratief: de naam staat er altijd naast. */
export function PersoonAvatar({ naam, grootte = 44 }: { naam: string; grootte?: number }) {
  const kleuren = useVeldKleuren();
  const { voor, achter } = toonKleuren(kleuren, avatarToon(naam));
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: grootte, height: grootte, borderRadius: grootte / 2, backgroundColor: achter, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text maxFontSizeMultiplier={1.2} style={{ color: voor, fontSize: Math.max(12, Math.round(grootte * 0.36)), fontWeight: '600' }}>
        {initialen(naam)}
      </Text>
    </View>
  );
}

/** Rond icoon voor een kanaal (team, mededelingen, project): zelfde vorm als een persoon. */
export function KanaalAvatar({ icoon: I, toon, grootte = 44 }: { icoon: Icoon; toon: Toon; grootte?: number }) {
  const kleuren = useVeldKleuren();
  const { voor, achter } = toonKleuren(kleuren, toon);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: grootte, height: grootte, borderRadius: grootte / 2, backgroundColor: achter, alignItems: 'center', justifyContent: 'center' }}
    >
      <I size={Math.round(grootte * 0.46)} color={voor} strokeWidth={2} />
    </View>
  );
}
