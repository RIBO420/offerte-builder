import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { useVeldCache } from '../../hooks/use-veld-cache';
import { api } from '../../convex/_generated/api';
import { VeldScherm } from '../../components/veld/VeldScherm';
import { useBuitenModus } from '../../components/veld/BuitenModus';
import { Button } from '../../components/ui';
import { vandaagAmsterdam, schuifDag, geldigeDag, urenLabel, werkPeriode } from '../../lib/werk-periode';
import type { VeldDagData } from '../../types/veld';

export default function Planning() { return <VeldScherm titel="Mijn planning"><PlanningInhoud /></VeldScherm>; }
function PlanningInhoud() {
  const { kleuren } = useBuitenModus();
  const [datum, setDatum] = useState(vandaagAmsterdam); const [datumInvoer, setDatumInvoer] = useState(datum);
  const [modus, setModus] = useState<'dag' | 'week'>('week');
  const kiesDatum = (waarde: string) => { setDatum(waarde); setDatumInvoer(waarde); };
  const week = werkPeriode(datum, 'week');
  const dagen = modus === 'week' ? Array.from({ length: 7 }, (_, i) => schuifDag(week.van, i)) : [datum];
  return <>
    <View style={{ flexDirection: 'row', gap: 8 }}><Button title="Week" variant={modus === 'week' ? 'secondary' : 'ghost'} onPress={() => setModus('week')} /><Button title="Dag" variant={modus === 'dag' ? 'secondary' : 'ghost'} onPress={() => setModus('dag')} /></View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Button title={`Vorige ${modus}`} variant="outline" onPress={() => kiesDatum(schuifDag(datum, modus === 'week' ? -7 : -1))} /><Button title={`Volgende ${modus}`} variant="outline" onPress={() => kiesDatum(schuifDag(datum, modus === 'week' ? 7 : 1))} /></View>
    <TextInput accessibilityLabel="Planningsdatum (jaar-maand-dag)" value={datumInvoer} onChangeText={waarde => { setDatumInvoer(waarde); if (geldigeDag(waarde)) setDatum(waarde); }} placeholder="jaar-maand-dag" placeholderTextColor={kleuren.mutedForeground} maxLength={10} style={{ color: kleuren.foreground, borderWidth: 1, borderColor: kleuren.border, borderRadius: 10, padding: 12, minHeight: 48, fontSize: 16 }} />
    {!geldigeDag(datumInvoer) && <Text style={{ color: kleuren.mutedForeground }}>Vul de datum in als jaar-maand-dag.</Text>}
    <Button title="Vandaag" variant="ghost" onPress={() => kiesDatum(vandaagAmsterdam())} />
    {modus === 'week' && <Text style={{ color: kleuren.foreground }}>{week.van} — {week.tot}</Text>}
    {dagen.map(dag => <PlanningDag key={dag} datum={dag} />)}
  </>;
}
function PlanningDag({ datum }: { datum: string }) {
  const { kleuren } = useBuitenModus(); const router = useRouter();
  const liveDag = useQuery(api.urenSegmenten.getVeldDag, { datum }) as VeldDagData | null | undefined;
  const { data: dag, uitCache } = useVeldCache(`dag:${datum}`, liveDag);
  const openDag = () => router.push({ pathname: '/(tabs)/uren', params: { datum } });
  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={{ color: kleuren.foreground, fontSize: 18, fontWeight: '600' }}>{new Date(`${datum}T12:00:00Z`).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' })}</Text>
    {uitCache && <Text style={{ color: kleuren.mutedForeground }}>Opgeslagen planning; wijzigingen volgen bij verbinding.</Text>}
    {dag === undefined ? <Text style={{ color: kleuren.mutedForeground }}>Planning laden…</Text> : dag === null ? <Text style={{ color: kleuren.mutedForeground }}>Je account is nog niet aan een medewerker gekoppeld.</Text> : <>
      {dag.team && <Text style={{ color: kleuren.mutedForeground }}>{dag.team.naam}</Text>}
      {!dag.stops.length && <Text style={{ color: kleuren.mutedForeground }}>Geen klussen ingepland.</Text>}
      {dag.stops.map(stop => {
        const gelogd = dag.segmenten.some(s => s.werkitemId === stop.werkitemId && s.categorie === 'werken' && s.status !== 'concept');
        const gemist = !gelogd && datum < vandaagAmsterdam();
        return <View key={stop.werkitemId} style={{ backgroundColor: kleuren.card, borderWidth: 1, borderColor: kleuren.border, borderRadius: 14, padding: 16, gap: 8 }}>
          <Text style={{ color: kleuren.foreground, fontWeight: '600', fontSize: 17 }}>{stop.klantNaam ?? stop.naam}</Text>
          {stop.klantNaam && <Text style={{ color: kleuren.foreground }}>{stop.naam}</Text>}
          <Text style={{ color: kleuren.mutedForeground }}>{gelogd ? 'Gelogd' : gemist ? 'Gemist — nog geen uren' : 'Wachtend'} · Gepland: {urenLabel(stop.geplandeMinuten)}</Text>
          {stop.adres && <Text style={{ color: kleuren.mutedForeground }}>{stop.adres}</Text>}
          {stop.uitvoeringsInstructie && <Text style={{ color: kleuren.foreground }}>{stop.uitvoeringsInstructie}</Text>}
          {stop.bijzonderheden && <Text style={{ color: kleuren.foreground }}>Let op: {stop.bijzonderheden}</Text>}
          {stop.taken.map((taak, index) => <Text key={index} style={{ color: kleuren.foreground }}>• {taak.omschrijving}</Text>)}
          <Button title={gemist ? 'Gemiste klus aanvullen' : 'Werkdag en route openen'} variant="outline" onPress={openDag} />
        </View>;
      })}
    </>}
  </View>;
}
