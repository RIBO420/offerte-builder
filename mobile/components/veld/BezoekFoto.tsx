import React, { useState } from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../ui';
import { useBuitenModus } from './BuitenModus';

export function BezoekFoto({ url, label }: { url: string; label: string }) {
  const [open, setOpen] = useState(false);
  const { kleuren } = useBuitenModus();
  const insets = useSafeAreaInsets();
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${label}`} onPress={() => setOpen(true)}>
      <Image source={{ uri: url }} accessibilityLabel={label} style={{ width: '100%', height: 200, borderRadius: 10 }} resizeMode="cover" />
    </Pressable>
    <Modal visible={open} onRequestClose={() => setOpen(false)} animationType="fade">
      <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: kleuren.background }}>
        <View style={{ padding: 16, gap: 12 }}><Button title="Foto sluiten" variant="outline" onPress={() => setOpen(false)} /><Text style={{ color: kleuren.foreground }}>{label}</Text></View>
        <Image source={{ uri: url }} accessibilityLabel={label} style={{ flex: 1, width: '100%' }} resizeMode="contain" />
      </View>
    </Modal>
  </>;
}
