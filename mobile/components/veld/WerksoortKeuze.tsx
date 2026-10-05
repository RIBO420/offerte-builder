import React from 'react';
import { Text, View } from 'react-native';
import { Button } from '../ui';
import { tekst } from '../../theme';
import { useVeldKleuren } from './BuitenModus';
import { ANDERS_WERKSOORTEN, type Werksoort } from '../../lib/werksoorten';
export { ANDERS_WERKSOORTEN, type Werksoort } from '../../lib/werksoorten';
export function WerksoortKeuze({ waarde, wijzigen, disabled }: { waarde?: Werksoort; wijzigen: (waarde: Werksoort) => void; disabled?: boolean }) {
  const kleuren = useVeldKleuren();
  return <View style={{ gap: 8 }}><Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontWeight: '600' }]}>Welke werkzaamheden?</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{ANDERS_WERKSOORTEN.map(soort => <Button key={soort} title={soort} size="sm" variant={waarde === soort ? 'secondary' : 'outline'} geselecteerd={waarde === soort} disabled={disabled} onPress={() => wijzigen(soort)} />)}</View>
  </View>;
}
