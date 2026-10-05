import React from 'react';
import { Text, View } from 'react-native';
import { Button } from '../ui';
import { useBuitenModus } from './BuitenModus';
import { ANDERS_WERKSOORTEN, type Werksoort } from '../../lib/werksoorten';
export { ANDERS_WERKSOORTEN, type Werksoort } from '../../lib/werksoorten';
export function WerksoortKeuze({ waarde, wijzigen, disabled }: { waarde?: Werksoort; wijzigen: (waarde: Werksoort) => void; disabled?: boolean }) {
  const { kleuren } = useBuitenModus();
  return <View style={{ gap: 8 }}><Text style={{ color: kleuren.mutedForeground }}>Welke werkzaamheden?</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{ANDERS_WERKSOORTEN.map(soort => <Button key={soort} title={soort} variant={waarde === soort ? 'secondary' : 'outline'} disabled={disabled} onPress={() => wijzigen(soort)} />)}</View>
  </View>;
}
