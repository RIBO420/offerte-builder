import React from 'react';
import { View } from 'react-native';
import { Text } from '../../components/ui/Tekst';
import Constants from 'expo-constants';
import { CheckCircle2, Clock, Download, RefreshCw, Smartphone, WifiOff } from 'lucide-react-native';
import { VeldScherm } from '../../components/veld/VeldScherm';
import { useBuitenModus } from '../../components/veld/BuitenModus';
import { useVeldOpdracht } from '../../hooks/use-veld-opdracht';
import { Button } from '../../components/ui';
import { VeldWachtrij } from '../../components/veld/VeldWachtrij';
import { IcoonTegel, Kaart, Melding, SectieKop } from '../../components/werk/Bouwstenen';
import { tekst } from '../../theme';

export default function AppHulp() { return <VeldScherm titel="Installeren en bijwerken"><Hulp /></VeldScherm>; }
function Hulp() {
  const { kleuren } = useBuitenModus(); const { wachtrij, synchroniseer } = useVeldOpdracht();
  const alinea = [tekst.callout, { color: kleuren.foreground, lineHeight: 23 }];
  return <>
    <Kaart style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <IcoonTegel icoon={Smartphone} toon="primair" grootte={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[tekst.kop, { color: kleuren.foreground }]}>Top Tuinen</Text>
        <Text style={[tekst.sub, tekst.cijfers, { color: kleuren.mutedForeground }]}>{Constants.expoConfig?.version ? `Versie ${Constants.expoConfig.version}` : 'Onbekende versie'}</Text>
      </View>
    </Kaart>

    <View style={{ gap: 8 }}>
      <SectieKop titel="App installeren" />
      <Kaart style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <IcoonTegel icoon={Download} toon="neutraal" grootte={36} />
        <Text style={[alinea, { flex: 1 }]}>Gebruik de installatielink die kantoor voor jouw iPhone of Android-toestel verstrekt. Log daarna in met je werkaccount. Vraag kantoor om de juiste link als je de app op een nieuw toestel installeert.</Text>
      </Kaart>
    </View>

    <View style={{ gap: 8 }}>
      <SectieKop titel="Een update uitvoeren" />
      <Kaart>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <IcoonTegel icoon={RefreshCw} toon="neutraal" grootte={36} />
          <Text style={[alinea, { flex: 1 }]}>Bewaar je invoer en sluit open formulieren. Verbind met internet en synchroniseer de wachtrij. Installeer daarna de update via hetzelfde kanaal waarmee je de app hebt geïnstalleerd. Verwijder de app niet om een update af te dwingen: invoer die alleen op dit toestel staat kan dan verloren gaan.</Text>
        </View>
        {wachtrij.length
          ? <Melding tekst={`Nog ${wachtrij.length} opdrachten niet bevestigd. Werk deze eerst af.`} toon="wachten" icoon={Clock} />
          : <Melding tekst="Geen wachtende opdrachten. Controleer ook of je open formulieren hebt bewaard." toon="succes" icoon={CheckCircle2} />}
        <Button title="Wachtrij synchroniseren" variant="secondary" fullWidth onPress={() => { void synchroniseer(); }} />
      </Kaart>
    </View>
    <VeldWachtrij />

    <View style={{ gap: 8 }}>
      <SectieKop titel="Geen verbinding" />
      <Kaart style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <IcoonTegel icoon={WifiOff} toon="neutraal" grootte={36} />
        <Text style={[alinea, { flex: 1 }]}>Eerder geladen dagen, protocollen en overzichten blijven beschikbaar. Opdrachten die als bewaard op dit toestel worden gemeld blijven in de wachtrij. Een dag indienen vraagt verbinding en serverbevestiging.</Text>
      </Kaart>
    </View>
  </>;
}
