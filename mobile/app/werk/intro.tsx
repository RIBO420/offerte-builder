import React, { Fragment, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../../components/ui/Tekst';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Check, Clock, Compass, Truck, Users, WifiOff } from 'lucide-react-native';
import { bevestigIntroLokaal, introScope } from '../../lib/intro-status';
import { VeldScherm } from '../../components/veld/VeldScherm';
import { useBuitenModus } from '../../components/veld/BuitenModus';
import { Button } from '../../components/ui';
import { Drukvlak, IcoonTegel, Kaart, Melding } from '../../components/werk/Bouwstenen';
import { useVeldOpdracht } from '../../hooks/use-veld-opdracht';
import { tekst } from '../../theme';

const stappen = [
  ['Jouw werkdag', 'Bij Mijn dag zie je je klussen en je dagvoorstel. Controleer de tijden en pauzes voordat je ze bevestigt. Je kunt zelf een extra blok toevoegen.'],
  ['Werk samen aan de klus', 'Voeg een foto toe en meld of de klus klaar is. Geef bij een onvoltooide klus de reden en resterende tijd aan. Een collega kan de gedeelde vragen beantwoorden; geef dat dan expliciet aan.'],
  ['Afval en terug naar de loods', 'Geef per klus aan hoeveel afval meegaat. Meld apart hoe vol de fysieke aanhanger terugkomt naar de loods, met de juiste aanhanger en tijd.'],
  ['Ook zonder verbinding', 'Opgeslagen opdrachten staan in de wachtrij totdat ze bevestigd zijn. Controleer meldingen en los conflicten op. Je kunt de dag indienen als alles is gesynchroniseerd en de klusvragen beantwoord zijn.'],
  ['Alles terugvinden', 'Via Home en Uren open je Planning, Mijn uren en Protocollen. Bij Profiel kun je deze uitleg opnieuw bekijken en optioneel een wachtwoord instellen.'],
] as const;
const iconen = [Clock, Users, Truck, WifiOff, Compass] as const;

export default function IntroScherm() { return <VeldScherm titel="Welkom bij je werkapp"><Intro /></VeldScherm>; }
function Intro() {
  const { orgId, userId } = useAuth();
  const { kleuren } = useBuitenModus();
  const router = useRouter();
  const { verstuur } = useVeldOpdracht();
  const [stap, setStap] = useState(0);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  // Eenmaal getoond = gezien op dit toestel, ook als de app halverwege sluit.
  useEffect(() => { void bevestigIntroLokaal(introScope(orgId, userId)); }, [orgId, userId]);
  const klaar = async (overgeslagen: boolean) => {
    setBezig(true); setFout(null);
    try {
      await bevestigIntroLokaal(introScope(orgId, userId));
      // De servermarkering loopt via de wachtrij; ook als die nog wacht of faalt
      // komt de intro niet terug (lokaal blijvend bevestigd).
      await verstuur('intro', { overgeslagen }).catch(() => undefined);
      // Vanuit Profiel ligt de tabs-stack er al onder: terug, geen tweede instantie.
      if (router.canGoBack()) router.back(); else router.replace('/(tabs)');
    } catch (error) { setFout(error instanceof Error ? error.message : 'Opslaan mislukt.'); }
    finally { setBezig(false); }
  };
  const laatste = stap === stappen.length - 1;

  return <>
    <Kaart variant="natuur" padding={20}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IcoonTegel icoon={iconen[stap]} toon="primair" grootte={52} />
        {/* Voortgang als stippen in plaats van een bovenkopje boven de titel. */}
        <View accessible accessibilityLabel={`Stap ${stap + 1} van ${stappen.length}`} style={{ flexDirection: 'row', gap: 6 }}>
          {stappen.map((_, i) => (
            <View key={i} style={{ width: i === stap ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: i <= stap ? kleuren.primary : kleuren.primarySoft }} />
          ))}
        </View>
      </View>
      <Text accessibilityRole="header" style={[tekst.titel2, { color: kleuren.foreground }]}>{stappen[stap][0]}</Text>
      <Text style={[tekst.body, { color: kleuren.foreground, lineHeight: 25 }]}>{stappen[stap][1]}</Text>
    </Kaart>

    <Kaart padding={0} style={{ gap: 0, overflow: 'hidden' }}>
      {stappen.map(([titel], index) => {
        const actief = index === stap;
        return <Fragment key={titel}>
          {index > 0 && <View style={{ height: 1, backgroundColor: kleuren.border, marginLeft: 64 }} />}
          <Drukvlak
            onPress={() => setStap(index)}
            disabled={bezig}
            haptic="selection"
            accessibilityLabel={`Stap ${index + 1}: ${titel}${index < stap ? ', gelezen' : ''}`}
            accessibilityState={{ selected: actief }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 8 }}
          >
            <IcoonTegel icoon={iconen[index]} toon={actief ? 'primair' : 'neutraal'} grootte={36} />
            <Text style={[tekst.body, { color: actief ? kleuren.foreground : kleuren.mutedForeground, fontWeight: actief ? '600' : '400', flex: 1 }]} numberOfLines={1}>{titel}</Text>
            {index < stap && <Check size={18} color={kleuren.primary} strokeWidth={2.5} />}
          </Drukvlak>
        </Fragment>;
      })}
    </Kaart>

    {fout && <Melding tekst={fout} toon="gemist" />}
    <View style={{ gap: 10 }}>
      <Button title={bezig ? 'Opslaan…' : laatste ? 'Aan de slag' : 'Volgende'} size="lg" fullWidth disabled={bezig}
        onPress={() => laatste ? klaar(false) : setStap(stap + 1)} />
      {laatste && <Button title="Wachtwoord instellen (optioneel)" variant="outline" fullWidth onPress={() => router.push('/werk/account')} />}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {stap > 0 && <View style={{ flex: 1 }}><Button title="Vorige" variant="outline" fullWidth onPress={() => setStap(stap - 1)} disabled={bezig} /></View>}
        <View style={{ flex: 1 }}><Button title="Uitleg overslaan" variant="ghost" fullWidth onPress={() => klaar(true)} disabled={bezig} /></View>
      </View>
    </View>
  </>;
}
