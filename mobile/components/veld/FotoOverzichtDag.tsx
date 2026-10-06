import React from 'react';
import { Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Drukvlak } from '../werk/Bouwstenen';
import { tekst } from '../../theme';
import { korteDatum, weekdagNaam } from '../../lib/datum-labels';
import { useVeldKleuren } from './BuitenModus';

/**
 * Eén regel dagnavigatie voor het fotooverzicht: de dag links als kop, daaronder
 * een kleine ondertitel; rechts "Vandaag" (alleen als je niet op vandaag staat)
 * en twee kale pijlen. Na vandaag zijn er geen foto's, dus "volgende" stopt daar.
 */
export function FotoOverzichtDag({ datum, vandaag, ondertitel, onKies }: {
  datum: string; vandaag: string; ondertitel?: string; onKies: (richting: -1 | 1 | 0) => void;
}) {
  const kleuren = useVeldKleuren();
  const opVandaag = datum === vandaag;
  const pijl = (richting: -1 | 1) => {
    const I = richting < 0 ? ChevronLeft : ChevronRight;
    const uit = richting > 0 && datum >= vandaag;
    return (
      <Drukvlak
        onPress={() => onKies(richting)}
        disabled={uit}
        haptic="selection"
        hitSlop={2}
        accessibilityLabel={richting < 0 ? 'Vorige dag' : 'Volgende dag'}
        style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
      >
        <I size={24} color={kleuren.primary} strokeWidth={2.25} />
      </Drukvlak>
    );
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 2 }}>
      <View style={{ flex: 1, gap: 1 }} accessibilityRole="header">
        <Text style={[tekst.titel3, { color: kleuren.foreground }]} numberOfLines={1}>
          {`${weekdagNaam(datum)} ${korteDatum(datum)}`}
        </Text>
        {ondertitel ? <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.mutedForeground }]} numberOfLines={1}>{ondertitel}</Text> : null}
      </View>
      {!opVandaag && (
        <Drukvlak
          onPress={() => onKies(0)}
          haptic="selection"
          hitSlop={{ top: 6, bottom: 6 }}
          accessibilityLabel="Naar vandaag"
          style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: kleuren.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 2 }}
        >
          <Text style={[tekst.voetnoot, { color: kleuren.primary, fontWeight: '600' }]}>Vandaag</Text>
        </Drukvlak>
      )}
      {pijl(-1)}
      {pijl(1)}
    </View>
  );
}
