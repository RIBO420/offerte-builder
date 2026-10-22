/**
 * Noodprotocol — vaste, altijd bereikbare snelkoppeling in de veld-app
 * (PRD §2.6 / bijlage C). De inhoud is een beheerd tekstblok
 * (instellingen.veldInstellingen); de app is alleen een weergave.
 */

import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Linking, ScrollView, View } from 'react-native';
import { Text } from '../ui/Tekst';
import { Phone, Siren } from 'lucide-react-native';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui';
import { Drukvlak, Melding } from '../werk/Bouwstenen';
import { tekst as tekstStijl } from '../../theme';
import { useVeldKleuren } from './BuitenModus';

export function NoodprotocolKnop({ tekst }: { tekst: string | null }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const kleuren = useVeldKleuren();

  const belAlarmnummer = () => {
    Linking.openURL('tel:112').catch(() => {
      // Kan niet bellen vanaf dit toestel — de tekst blijft zichtbaar
    });
  };

  return (
    <>
      <Drukvlak
        onPress={() => setOpen(true)}
        haptic="press"
        accessibilityLabel="Nood"
        accessibilityHint="Opent het noodprotocol"
        style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: kleuren.dangerSoft }}
      >
        <Siren size={21} color={kleuren.danger} strokeWidth={2} />
      </Drukvlak>
      <Dialog visible={open} onClose={() => setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Noodprotocol</DialogTitle>
          </DialogHeader>
          <View style={{ marginBottom: 12 }}>
            <Melding
              toon="gemist"
              icoon={Phone}
              tekst="Bij een ongeval of gevaarlijke situatie: bel bij levensgevaar altijd eerst 112."
            />
          </View>
          <ScrollView style={{ maxHeight: 320 }}>
            <Text style={[tekstStijl.callout, { color: kleuren.foreground, lineHeight: 23 }]}>
              {tekst?.trim() ||
                'Er is nog geen noodprotocol ingesteld. Kantoor beheert de inhoud via de veld-instellingen.'}
            </Text>
          </ScrollView>
          <View style={{ marginTop: 12 }}>
            <Button title="Protocollen en contacten" variant="secondary" onPress={() => { setOpen(false); router.push('/werk/protocollen'); }} fullWidth />
          </View>
          <DialogFooter>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button
                  variant="outline"
                  title="Sluiten"
                  onPress={() => setOpen(false)}
                  fullWidth
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  variant="destructive"
                  title="Bel 112"
                  icon={<Phone size={16} color={kleuren.destructiveForeground} strokeWidth={2} />}
                  onPress={belAlarmnummer}
                  fullWidth
                />
              </View>
            </View>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
