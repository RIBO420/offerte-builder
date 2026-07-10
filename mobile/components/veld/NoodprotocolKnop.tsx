/**
 * Noodprotocol — vaste, altijd bereikbare snelkoppeling in de veld-app
 * (PRD §2.6 / bijlage C). De inhoud is een beheerd tekstblok
 * (instellingen.veldInstellingen); de app is alleen een weergave.
 */

import React, { useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { AlertTriangle, Phone } from 'lucide-react-native';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui';
import { useBuitenModus } from './BuitenModus';

export function NoodprotocolKnop({ tekst }: { tekst: string | null }) {
  const [open, setOpen] = useState(false);
  const { kleuren } = useBuitenModus();

  const belAlarmnummer = () => {
    Linking.openURL('tel:112').catch(() => {
      // Kan niet bellen vanaf dit toestel — de tekst blijft zichtbaar
    });
  };

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        title="Nood"
        icon={<AlertTriangle size={16} color="#FAFAFA" />}
        onPress={() => setOpen(true)}
      />
      <Dialog visible={open} onClose={() => setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Noodprotocol</DialogTitle>
          </DialogHeader>
          <Text
            style={{
              color: kleuren.mutedForeground,
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            Bij een ongeval of gevaarlijke situatie: bel bij levensgevaar
            altijd eerst 112.
          </Text>
          <ScrollView style={{ maxHeight: 320 }}>
            <Text style={{ color: kleuren.foreground, fontSize: 14, lineHeight: 21 }}>
              {tekst?.trim() ||
                'Er is nog geen noodprotocol ingesteld. Kantoor beheert de inhoud via de veld-instellingen.'}
            </Text>
          </ScrollView>
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
                  icon={<Phone size={16} color="#FAFAFA" />}
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
