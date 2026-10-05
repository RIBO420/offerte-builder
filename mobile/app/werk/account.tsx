import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { VeldScherm } from '../../components/veld/VeldScherm';
import { useBuitenModus } from '../../components/veld/BuitenModus';
import { Button } from '../../components/ui';

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
      setHuidig(''); setNieuw(''); setHerhaal(''); setMelding('Je wachtwoord is opgeslagen.');
    } catch (error) { setMelding(error instanceof Error ? error.message : 'Opslaan mislukt. Probeer het opnieuw.'); }
    finally { setBezig(false); }
  };
  return <View style={{ gap: 16 }}>
    <Text style={{ color: kleuren.mutedForeground }}>Je kunt ook blijven inloggen met een inlogcode of Google. Een wachtwoord is optioneel.</Text>
    {([
      ...(user?.passwordEnabled ? [{ label: 'Huidig wachtwoord', waarde: huidig, wijzigen: setHuidig }] : []),
      { label: 'Nieuw wachtwoord', waarde: nieuw, wijzigen: setNieuw },
      { label: 'Herhaal nieuw wachtwoord', waarde: herhaal, wijzigen: setHerhaal },
    ]).map(veld => <View key={veld.label} style={{ gap: 6 }}>
      <Text style={{ color: kleuren.foreground }}>{veld.label}</Text>
      <TextInput accessibilityLabel={veld.label} secureTextEntry autoCapitalize="none" autoCorrect={false}
        value={veld.waarde} onChangeText={veld.wijzigen} editable={!bezig}
        style={{ color: kleuren.foreground, borderColor: kleuren.border, borderWidth: 1, borderRadius: 10, padding: 14 }} />
    </View>)}
    {melding && <Text accessibilityRole="alert" style={{ color: kleuren.foreground }}>{melding}</Text>}
    <Button title={bezig ? 'Opslaan…' : 'Wachtwoord opslaan'} onPress={opslaan} disabled={bezig || !nieuw || !herhaal || (!!user?.passwordEnabled && !huidig)} />
  </View>;
}
