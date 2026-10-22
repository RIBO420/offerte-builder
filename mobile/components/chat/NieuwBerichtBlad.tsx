import React from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, View } from 'react-native';
import { Text } from '../ui/Tekst';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { Users, X } from 'lucide-react-native';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { Drukvlak, Kaart, LegeStaat } from '../werk/Bouwstenen';
import { useVeldKleuren } from '../veld/BuitenModus';
import { tekst } from '../../theme';
import { PersoonAvatar } from './ChatAvatar';
import { RegelLijn } from './GesprekRegel';

export interface DMKandidaat {
  userId: Id<'users'>;
  naam: string;
  functie?: string;
}

/**
 * "Nieuw bericht": kies een collega om een privégesprek mee te beginnen. Op iOS
 * een pagesheet (veegt weg zoals in Berichten), op Android een volledig scherm.
 * Wie je mag kiezen bepaalt de server (medewerkers zien alleen de directie).
 */
export function NieuwBerichtBlad({
  zichtbaar,
  onSluit,
  onKies,
  onNaSluiten,
}: {
  zichtbaar: boolean;
  onSluit: () => void;
  onKies: (kandidaat: DMKandidaat) => void;
  /** iOS: vuurt pas als het blad helemaal weg is — veilig moment om te navigeren. */
  onNaSluiten?: () => void;
}) {
  const kleuren = useVeldKleuren();
  const insets = useSafeAreaInsets();
  const collegas = useQuery(api.chat.getUsersForDM, zichtbaar ? {} : 'skip');
  const ios = Platform.OS === 'ios';

  return (
    <Modal
      visible={zichtbaar}
      animationType="slide"
      presentationStyle={ios ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onSluit}
      onDismiss={onNaSluiten}
    >
      <View style={{ flex: 1, backgroundColor: kleuren.background, paddingTop: ios ? 8 : insets.top + 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 12, paddingVertical: 6, gap: 12 }}>
          <Text accessibilityRole="header" style={[tekst.titel3, { color: kleuren.foreground, flex: 1 }]}>
            Nieuw bericht
          </Text>
          <Drukvlak
            onPress={onSluit}
            accessibilityLabel="Sluiten"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: kleuren.vulling, alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={20} color={kleuren.foreground} strokeWidth={2.25} />
          </Drukvlak>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 24, gap: 8 }}>
          <Text style={[tekst.sub, { color: kleuren.mutedForeground, paddingHorizontal: 4 }]}>Kies met wie je een gesprek begint.</Text>
          {collegas === undefined ? (
            <View style={{ paddingVertical: 40, alignItems: 'center', gap: 12 }}>
              <ActivityIndicator color={kleuren.primary} />
              <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Collega&apos;s laden…</Text>
            </View>
          ) : collegas.length === 0 ? (
            <LegeStaat icoon={Users} titel="Geen collega's beschikbaar" uitleg="Er is niemand met een account om een gesprek mee te beginnen." />
          ) : (
            <Kaart padding={0} style={{ paddingHorizontal: 16, gap: 0 }}>
              {collegas.map((c, i) => (
                <View key={c.userId}>
                  {i > 0 && <RegelLijn />}
                  <Drukvlak
                    onPress={() => onKies({ userId: c.userId, naam: c.naam, functie: c.functie })}
                    accessibilityLabel={c.functie ? `${c.naam}, ${c.functie}` : c.naam}
                    accessibilityHint="Opent een gesprek"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 }}
                  >
                    <PersoonAvatar naam={c.naam} grootte={44} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[tekst.kop, { color: kleuren.foreground }]} numberOfLines={1}>{c.naam}</Text>
                      {c.functie ? (
                        <Text style={[tekst.sub, { color: kleuren.mutedForeground }]} numberOfLines={1}>{c.functie}</Text>
                      ) : null}
                    </View>
                  </Drukvlak>
                </View>
              ))}
            </Kaart>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
