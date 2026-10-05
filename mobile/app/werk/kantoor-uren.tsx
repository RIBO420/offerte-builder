import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { VeldScherm } from '../../components/veld/VeldScherm';
import { useBuitenModus } from '../../components/veld/BuitenModus';
import { useCurrentUser } from '../../hooks/use-current-user';
import { isKantoorRole } from '../../lib/roles';
import { Button } from '../../components/ui';
import { vandaagAmsterdam, geldigeDag } from '../../lib/werk-periode';

export default function KantoorUren() { return <VeldScherm titel="Urencontrole"><Inhoud /></VeldScherm>; }
function Inhoud() {
  const { role } = useCurrentUser();
  const { kleuren } = useBuitenModus();
  const params = useLocalSearchParams<{ datum?: string }>();
  const [datum, setDatum] = useState(geldigeDag(params.datum) ? params.datum : vandaagAmsterdam());
  const [zoek, setZoek] = useState('');
  const kantoor = isKantoorRole(role);
  const geldig = /^\d{4}-\d{2}-\d{2}$/.test(datum) && Number.isFinite(Date.parse(datum)) && new Date(datum).toISOString().slice(0, 10) === datum;
  const data = useQuery(api.veldDekking.getPeriode, kantoor && geldig ? { van: datum, tot: datum } : 'skip');
  if (!kantoor) return <Text style={{ color: kleuren.foreground }}>Urencontrole is alleen beschikbaar voor kantoor.</Text>;
  const verschuif = (n: number) => { if (geldig) setDatum(new Date(Date.parse(datum) + n * 86400000).toISOString().slice(0, 10)); };
  return <View style={{ gap: 14 }}>
    <Text style={{ color: kleuren.mutedForeground }}>Bekijk indienstatus en ontbrekende klusregistraties. Correcties en exports staan in de kantooromgeving.</Text>
    <TextInput accessibilityLabel="Controledatum" value={datum} onChangeText={setDatum} placeholder="JJJJ-MM-DD" placeholderTextColor={kleuren.mutedForeground} style={{ color: kleuren.foreground, borderWidth: 1, borderColor: kleuren.border, borderRadius: 10, padding: 12 }} />
    <View style={{ flexDirection: 'row', gap: 12 }}><Button title="Vorige dag" variant="outline" onPress={() => verschuif(-1)} /><Button title="Volgende dag" variant="outline" onPress={() => verschuif(1)} /></View>
    <TextInput accessibilityLabel="Zoek medewerker" value={zoek} onChangeText={setZoek} placeholder="Zoek medewerker" placeholderTextColor={kleuren.mutedForeground} style={{ color: kleuren.foreground, borderWidth: 1, borderColor: kleuren.border, borderRadius: 10, padding: 12 }} />
    {!geldig ? <Text style={{ color: kleuren.destructive }}>Vul een geldige datum in.</Text> : data === undefined ? <Text style={{ color: kleuren.mutedForeground }}>Urencontrole laden…</Text> : !data.length ? <Text style={{ color: kleuren.mutedForeground }}>Geen planning of uren op deze dag.</Text> : data.filter(r => r.medewerkerNaam.toLowerCase().includes(zoek.toLowerCase())).map(r => <View key={r.medewerkerId} style={{ borderWidth: 1, borderColor: kleuren.border, borderRadius: 14, padding: 14, gap: 8 }}>
      <Text style={{ color: kleuren.foreground, fontWeight: '600' }}>{r.medewerkerNaam}</Text>
      <Text style={{ color: kleuren.mutedForeground }}>{r.status} · {r.geregistreerdeBlokken} tijdblokken · {r.ontbrekendeBezoeken} ontbrekende klussen</Text>
      {r.bezoeken.map(b => <Text key={b.werkitemId} style={{ color: kleuren.foreground }}>{b.naam} — {b.gelogd ? 'Uren aanwezig' : b.afwezig ? 'Afwezig' : 'Uren ontbreken'}</Text>)}
    </View>)}
  </View>;
}
