import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { bevestigIntroLokaal, introScope } from '../../lib/intro-status';
import { VeldScherm } from '../../components/veld/VeldScherm';
import { useBuitenModus } from '../../components/veld/BuitenModus';
import { Button } from '../../components/ui';
import { useVeldOpdracht } from '../../hooks/use-veld-opdracht';

const stappen = [
  ['Jouw werkdag', 'Bij Uren zie je de planning en je dagvoorstel. Controleer de tijden en pauzes voordat je ze bevestigt. Je kunt zelf een extra blok toevoegen.'],
  ['Werk samen aan de klus', 'Voeg een foto toe en meld of de klus klaar is. Geef bij een onvoltooide klus de reden en resterende tijd aan. Een collega kan de gedeelde vragen beantwoorden; geef dat dan expliciet aan.'],
  ['Afval en terug naar de loods', 'Geef per klus aan hoeveel afval meegaat. Meld apart hoe vol de fysieke aanhanger terugkomt naar de loods, met de juiste aanhanger en tijd.'],
  ['Ook zonder verbinding', 'Opgeslagen opdrachten staan in de wachtrij totdat ze bevestigd zijn. Controleer meldingen en los conflicten op. Je kunt de dag indienen als alles is gesynchroniseerd en de klusvragen beantwoord zijn.'],
  ['Alles terugvinden', 'Via Home en Uren open je Planning, Mijn uren en Protocollen. Bij Profiel kun je deze uitleg opnieuw bekijken en optioneel een wachtwoord instellen.'],
] as const;
export default function IntroScherm() { return <VeldScherm titel="Welkom bij je werkapp"><Intro /></VeldScherm>; }
function Intro() {
  const { orgId, userId } = useAuth();
  const { kleuren } = useBuitenModus();
  const router = useRouter();
  const { verstuur } = useVeldOpdracht();
  const [stap, setStap] = useState(0);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const klaar = async (overgeslagen: boolean) => {
    setBezig(true); setFout(null);
    try {
      const resultaat = await verstuur('intro', { overgeslagen });
      if (resultaat.status === 'conflict') { setFout(resultaat.fout ?? 'Voorkeur opslaan mislukt.'); return; }
      if (resultaat.status === 'verzonden') bevestigIntroLokaal(introScope(orgId, userId));
      router.replace('/(tabs)');
    } catch (error) { setFout(error instanceof Error ? error.message : 'Opslaan mislukt.'); }
    finally { setBezig(false); }
  };
  return <View style={{ gap: 20 }}>
    <Text style={{ color: kleuren.mutedForeground }}>Stap {stap + 1} van {stappen.length}</Text>
    <Text accessibilityRole="header" style={{ color: kleuren.foreground, fontSize: 20, fontWeight: '600' }}>{stappen[stap][0]}</Text>
    <Text style={{ color: kleuren.foreground, fontSize: 16, lineHeight: 25 }}>{stappen[stap][1]}</Text>
    {fout && <Text accessibilityRole="alert" style={{ color: kleuren.foreground }}>{fout}</Text>}
    {stap > 0 && <Button title="Vorige" variant="outline" onPress={() => setStap(stap - 1)} disabled={bezig} />}
    <Button title={bezig ? 'Opslaan…' : stap === stappen.length - 1 ? 'Aan de slag' : 'Volgende'} disabled={bezig}
      onPress={() => stap === stappen.length - 1 ? klaar(false) : setStap(stap + 1)} />
    <Button title="Uitleg overslaan" variant="ghost" onPress={() => klaar(true)} disabled={bezig} />
    {stap === stappen.length - 1 && <Button title="Wachtwoord instellen (optioneel)" variant="outline" onPress={() => router.push('/werk/account')} />}
  </View>;
}
