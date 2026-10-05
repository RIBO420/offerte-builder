import React from 'react';
import { Text, View } from 'react-native';
import Constants from 'expo-constants';
import { VeldScherm } from '../../components/veld/VeldScherm';
import { useBuitenModus } from '../../components/veld/BuitenModus';
import { useVeldOpdracht } from '../../hooks/use-veld-opdracht';
import { Button } from '../../components/ui';
import { VeldWachtrij } from '../../components/veld/VeldWachtrij';

export default function AppHulp() { return <VeldScherm titel="Installeren en bijwerken"><Hulp /></VeldScherm>; }
function Hulp() {
  const { kleuren } = useBuitenModus(); const { wachtrij, synchroniseer } = useVeldOpdracht();
  return <View style={{ gap: 16 }}>
    <Text style={{ color: kleuren.foreground }}>Top Tuinen {Constants.expoConfig?.version ?? 'onbekende versie'}</Text>
    <Text accessibilityRole="header" style={{ color: kleuren.foreground, fontWeight: '600' }}>App installeren</Text>
    <Text style={{ color: kleuren.mutedForeground }}>Gebruik de installatielink die kantoor voor jouw iPhone of Android-toestel verstrekt. Log daarna in met je werkaccount. Vraag kantoor om de juiste link als je de app op een nieuw toestel installeert.</Text>
    <Text accessibilityRole="header" style={{ color: kleuren.foreground, fontWeight: '600' }}>Een update uitvoeren</Text>
    <Text style={{ color: kleuren.mutedForeground }}>Bewaar je invoer en sluit open formulieren. Verbind met internet en synchroniseer de wachtrij. Installeer daarna de update via hetzelfde kanaal waarmee je de app hebt geïnstalleerd. Verwijder de app niet om een update af te dwingen: invoer die alleen op dit toestel staat kan dan verloren gaan.</Text>
    <Text style={{ color: kleuren.foreground }}>{wachtrij.length ? `Nog ${wachtrij.length} opdrachten niet bevestigd. Werk deze eerst af.` : 'Geen wachtende opdrachten. Controleer ook of je open formulieren hebt bewaard.'}</Text>
    <Button title="Wachtrij synchroniseren" variant="outline" onPress={() => { void synchroniseer(); }} />
    <VeldWachtrij />
    <Text accessibilityRole="header" style={{ color: kleuren.foreground, fontWeight: '600' }}>Geen verbinding</Text>
    <Text style={{ color: kleuren.mutedForeground }}>Eerder geladen dagen, protocollen en overzichten blijven beschikbaar. Opdrachten die als bewaard op dit toestel worden gemeld blijven in de wachtrij. Een dag indienen vraagt verbinding en serverbevestiging.</Text>
  </View>;
}
