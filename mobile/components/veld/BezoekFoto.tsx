import React, { useState } from 'react';
import { Image, Modal, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { Drukvlak } from '../werk/Bouwstenen';
import { tekst } from '../../theme';
import { useVeldKleuren } from './BuitenModus';

export function BezoekFoto({ url, label }: { url: string; label: string }) {
  const [open, setOpen] = useState(false);
  const kleuren = useVeldKleuren();
  const insets = useSafeAreaInsets();
  return <>
    <Drukvlak accessibilityLabel={`Open ${label}`} onPress={() => setOpen(true)}>
      <Image source={{ uri: url }} accessibilityLabel={label} style={{ width: '100%', height: 200, borderRadius: 14, backgroundColor: kleuren.muted }} resizeMode="cover" />
    </Drukvlak>
    <Modal visible={open} onRequestClose={() => setOpen(false)} animationType="fade">
      <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: kleuren.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
          <Text style={[tekst.kop, { color: kleuren.foreground, flex: 1 }]} numberOfLines={2}>{label}</Text>
          <Drukvlak
            accessibilityLabel="Foto sluiten"
            onPress={() => setOpen(false)}
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: kleuren.muted }}
          >
            <X size={22} color={kleuren.foreground} strokeWidth={2} />
          </Drukvlak>
        </View>
        <Image source={{ uri: url }} accessibilityLabel={label} style={{ flex: 1, width: '100%' }} resizeMode="contain" />
      </View>
    </Modal>
  </>;
}
