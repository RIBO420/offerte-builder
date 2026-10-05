import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { api } from '../../convex/_generated/api';
import { VeldScherm } from '../../components/veld/VeldScherm';
import { useBuitenModus } from '../../components/veld/BuitenModus';
import { BezoekFoto } from '../../components/veld/BezoekFoto';
import { Button } from '../../components/ui';
import { useVeldCache } from '../../hooks/use-veld-cache';
import { useCurrentUser } from '../../hooks/use-current-user';
import { isKantoorRole } from '../../lib/roles';
import { vandaagAmsterdam, schuifDag, geldigeDag } from '../../lib/werk-periode';

type FotoDag = { bezoeken: { werkitemId: string; naam: string; klantNaam: string | null; fotos: { id: string; fase: 'voor' | 'na'; url: string | null; doorNaam: string; createdAt?: number }[] }[] };
export default function FotoScherm() { return <VeldScherm titel="Foto’s van klussen"><Fotos /></VeldScherm>; }
function Fotos() {
  const { kleuren } = useBuitenModus(); const router = useRouter(); const { role } = useCurrentUser();
  const [datum, setDatum] = useState(vandaagAmsterdam); const [datumInvoer, setDatumInvoer] = useState(datum); const [zoek, setZoek] = useState('');
  const kantoor = isKantoorRole(role);
  const eigen = useQuery(api.werkbezoek.getVoorDag, kantoor ? 'skip' : { datum }) as FotoDag | undefined;
  const alle = useQuery(api.werkbezoek.getKantoorDag, kantoor ? { datum } : 'skip') as FotoDag | undefined;
  const { data, uitCache } = useVeldCache(`fotos:${kantoor ? 'kantoor' : 'eigen'}:${datum}`, kantoor ? alle : eigen);
  const selecteer = (dag: string) => { setDatum(dag); setDatumInvoer(dag); };
  const bezoeken = data?.bezoeken.filter(b => `${b.klantNaam ?? ''} ${b.naam}`.toLowerCase().includes(zoek.toLowerCase()));
  return <View style={{ gap: 14 }}>
    <Text style={{ color: kleuren.mutedForeground }}>{kantoor ? 'Foto’s van alle klussen op deze werkdag.' : 'Foto’s van jouw klussen op deze werkdag.'}</Text>
    <View style={{ flexDirection: 'row', gap: 8 }}><Button title="Vorige" variant="outline" onPress={() => selecteer(schuifDag(datum, -1))} /><Button title="Volgende" variant="outline" onPress={() => selecteer(schuifDag(datum, 1))} /></View>
    <TextInput accessibilityLabel="Klusdatum (jaar-maand-dag)" value={datumInvoer} onChangeText={setDatumInvoer} onEndEditing={() => { if (geldigeDag(datumInvoer)) setDatum(datumInvoer); }} style={{ color: kleuren.foreground, borderWidth: 1, borderColor: kleuren.border, borderRadius: 10, padding: 12 }} />
    <TextInput accessibilityLabel="Zoek klant of klus" value={zoek} onChangeText={setZoek} placeholder="Zoek klant of klus" placeholderTextColor={kleuren.mutedForeground} style={{ color: kleuren.foreground, borderWidth: 1, borderColor: kleuren.border, borderRadius: 10, padding: 12 }} />
    <Button title="Filters herstellen" variant="ghost" onPress={() => { setZoek(''); selecteer(vandaagAmsterdam()); }} />
    {uitCache && <Text style={{ color: kleuren.mutedForeground }}>Laatst geladen overzicht. Foto’s openen vraagt mogelijk verbinding.</Text>}
    {!data && <Text style={{ color: kleuren.mutedForeground }}>Foto’s laden…</Text>}
    {bezoeken?.flatMap(b => b.fotos.filter(f => f.url).map(f => <View key={f.id} style={{ gap: 8 }}>
      <Text style={{ color: kleuren.foreground, fontWeight: '600' }}>{b.klantNaam ?? b.naam} · {b.naam}</Text>
      <BezoekFoto url={f.url!} label={`${f.fase === 'voor' ? 'Voorfoto' : 'Nafoto'} · ${b.naam}`} />
      <Text style={{ color: kleuren.mutedForeground }}>{f.doorNaam}{f.createdAt ? ` · ${new Date(f.createdAt).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}` : ''}</Text>
    </View>))}
    {data && !bezoeken?.some(b => b.fotos.length) && <Text style={{ color: kleuren.mutedForeground }}>Geen foto’s gevonden voor deze selectie.</Text>}
    <Button title="Naar mijn werkdag" variant="outline" onPress={() => router.push({ pathname: '/(tabs)/uren', params: { datum } })} />
  </View>;
}
