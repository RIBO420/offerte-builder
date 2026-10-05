import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { CheckCircle2, KeyRound } from 'lucide-react-native';
import { VeldScherm } from '../../components/veld/VeldScherm';
import { useBuitenModus } from '../../components/veld/BuitenModus';
import { Button } from '../../components/ui';
import { IcoonTegel, Kaart, Melding } from '../../components/werk/Bouwstenen';
import { tekst } from '../../theme';

const OPGESLAGEN = 'Je wachtwoord is opgeslagen.';

export default function AccountScherm() {
  return <VeldScherm titel="Wachtwoord"><WachtwoordFormulier /></VeldScherm>;
}
function WachtwoordFormulier() {
  const { user } = useUser();
  const { kleuren } = useBuitenModus();
  const [huidig, setHuidig] = useState('');
  const [nieuw, setNieuw] = useState('');
  const [herhaal, setHerhaal] = useState('');
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);
  const opslaan = async () => {
    if (!user || bezig) return;
    if (nieuw !== herhaal) { setMelding('De nieuwe wachtwoorden zijn niet gelijk.'); return; }
    setBezig(true); setMelding(null);
    try {
      await user.updatePassword({ newPassword: nieuw, ...(user.passwordEnabled ? { currentPassword: huidig } : {}) });
      setHuidig(''); setNieuw(''); setHerhaal(''); setMelding(OPGESLAGEN);
    } catch (error) { setMelding(error instanceof Error ? error.message : 'Opslaan mislukt. Probeer het opnieuw.'); }
    finally { setBezig(false); }
  };
  return <>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 }}>
      <IcoonTegel icoon={KeyRound} toon="neutraal" grootte={40} />
      <Text style={[tekst.sub, { color: kleuren.mutedForeground, flex: 1 }]}>Je kunt ook blijven inloggen met een inlogcode of Google. Een wachtwoord is optioneel.</Text>
    </View>
    <Kaart style={{ gap: 16 }}>
      {([
        ...(user?.passwordEnabled ? [{ label: 'Huidig wachtwoord', waarde: huidig, wijzigen: setHuidig }] : []),
        { label: 'Nieuw wachtwoord', waarde: nieuw, wijzigen: setNieuw },
        { label: 'Herhaal nieuw wachtwoord', waarde: herhaal, wijzigen: setHerhaal },
      ]).map(veld => <View key={veld.label} style={{ gap: 6 }}>
        <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontWeight: '600', fontSize: 14, paddingHorizontal: 2 }]}>{veld.label}</Text>
        <TextInput accessibilityLabel={veld.label} secureTextEntry autoCapitalize="none" autoCorrect={false}
          value={veld.waarde} onChangeText={veld.wijzigen} editable={!bezig}
          style={{ color: kleuren.foreground, backgroundColor: kleuren.muted, borderRadius: 12, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 }} />
      </View>)}
    </Kaart>
    {melding && (melding === OPGESLAGEN
      ? <View accessibilityRole="alert"><Melding tekst={melding} toon="succes" icoon={CheckCircle2} /></View>
      : <Melding tekst={melding} toon="gemist" />)}
    <Button title={bezig ? 'Opslaan…' : 'Wachtwoord opslaan'} size="lg" fullWidth onPress={opslaan} disabled={bezig || !nieuw || !herhaal || (!!user?.passwordEnabled && !huidig)} />
  </>;
}
