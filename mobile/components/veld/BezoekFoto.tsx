import React, { useState, type ReactNode } from 'react';
import { Alert, Image, Modal, View } from 'react-native';
import { Text } from '../ui/Tekst';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash2, X } from 'lucide-react-native';
import { Drukvlak } from '../werk/Bouwstenen';
import { tekst } from '../../theme';
import { useIsDonker, useVeldKleuren } from './BuitenModus';

/**
 * Foto die op tik schermvullend opent. Met `grootte` een vierkante tegel (voor
 * een fotoraster), zonder een brede foto van 200pt. `children` ligt over de
 * tegel heen (label of status); `onVerwijder` zet een verwijderknop in de
 * schermvullende weergave, met bevestiging.
 */
export function BezoekFoto({ url, label, grootte, onVerwijder, children }: {
  url: string; label: string; grootte?: number; onVerwijder?: () => Promise<void> | void; children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const kleuren = useVeldKleuren();
  const donker = useIsDonker();
  const insets = useSafeAreaInsets();
  const rand = { borderWidth: 1, borderColor: kleuren.border };
  const verwijder = () => Alert.alert('Foto verwijderen?', 'De foto verdwijnt uit dit bezoek en het klantdossier.', [
    { text: 'Annuleren', style: 'cancel' },
    { text: 'Verwijderen', style: 'destructive', onPress: async () => { setOpen(false); await onVerwijder?.(); } },
  ]);
  return <>
    <Drukvlak accessibilityLabel={`Open ${label}`} onPress={() => setOpen(true)}>
      <View style={grootte ? { width: grootte, height: grootte } : undefined}>
        <Image source={{ uri: url }} accessibilityLabel={label} resizeMode="cover" style={[
          grootte ? { width: grootte, height: grootte, borderRadius: 12 } : { width: '100%', height: 200, borderRadius: 14 },
          { backgroundColor: kleuren.muted }, rand,
        ]} />
        {children}
      </View>
    </Drukvlak>
    <Modal visible={open} onRequestClose={() => setOpen(false)} animationType="fade">
      <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom + 8, backgroundColor: kleuren.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
          <Text style={[tekst.kop, { color: kleuren.foreground, flex: 1 }]} numberOfLines={2}>{label}</Text>
          <Drukvlak
            accessibilityLabel="Foto sluiten"
            onPress={() => setOpen(false)}
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: kleuren.vulling }}
          >
            <X size={22} color={kleuren.foreground} strokeWidth={2} />
          </Drukvlak>
        </View>
        <Image source={{ uri: url }} accessibilityLabel={label} style={{ flex: 1, width: '100%' }} resizeMode="contain" />
        {onVerwijder && (
          <Drukvlak
            accessibilityLabel="Foto verwijderen"
            onPress={verwijder}
            style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 20, marginTop: 12, borderRadius: 22, backgroundColor: kleuren.dangerSoft }}
          >
            <Trash2 size={18} color={kleuren.danger} strokeWidth={2} />
            <Text style={[tekst.kop, { color: kleuren.danger }]}>Foto verwijderen</Text>
          </Drukvlak>
        )}
      </View>
    </Modal>
  </>;
}
