import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { eigenUrenCsv } from '../../lib/eigen-uren-csv';
import { useQuery } from 'convex/react';
import { useVeldCache } from '../../hooks/use-veld-cache';
import { useRouter } from 'expo-router';
import { api } from '../../convex/_generated/api';
import { VeldScherm } from '../../components/veld/VeldScherm';
import { useBuitenModus } from '../../components/veld/BuitenModus';
import { Button } from '../../components/ui';
import { vandaagAmsterdam, werkPeriode, schuifPeriode, urenLabel } from '../../lib/werk-periode';
import { CATEGORIE_LABELS, type SegmentCategorie } from '../../types/veld';

interface Totalen { span: number; geregistreerd: number; klantwerk: number; pauze: number; indirect: number; bronBetaald: number; perCategorie: Record<string, number> }
interface Registratie { medewerkerNaam?: string; status?: string; werksoort?: string | null; minuten: number; klantId: string | null; id: string; beginTijd: string; eindTijd: string; categorie: SegmentCategorie; klantNaam: string | null; notitie: string | null }
interface Overzicht { totalen: Totalen; dagen: { datum: string; status: string; totalen: Totalen; registraties: Registratie[] }[] }
export default function UrenOverzicht() { return <VeldScherm titel="Mijn uren"><OverzichtInhoud /></VeldScherm>; }

function OverzichtInhoud() {
  const { kleuren } = useBuitenModus(); const router = useRouter();
  const { userId, orgId } = useAuth();
  const exportScope = `${orgId ?? ''}:${userId ?? ''}`;
  const huidigeScope = useRef<string | null>(exportScope);
  useEffect(() => { huidigeScope.current = exportScope; return () => { huidigeScope.current = null; }; }, [exportScope]);
  const [exportBezig, setExportBezig] = useState(false); const [exportFout, setExportFout] = useState<string | null>(null);
  const [modus, setModus] = useState<'week' | 'maand'>('week');
  const [datum, setDatum] = useState(vandaagAmsterdam);
  const [openDag, setOpenDag] = useState<string | null>(null);
  const periode = werkPeriode(datum, modus);
  const live = useQuery(api.urenRapportage.getPeriode, { ...periode, bereik: 'eigen' }) as Overzicht | undefined;
  const { data, uitCache } = useVeldCache(`urenperiode:${periode.van}:${periode.tot}`, live);
  const klanten = new Map<string, { naam: string; minuten: number }>();
  for (const dag of data?.dagen ?? []) for (const r of dag.registraties) {
    if (r.categorie !== 'werken' || !r.klantId) continue;
    const huidig = klanten.get(r.klantId) ?? { naam: r.klantNaam ?? 'Onbekende klant', minuten: 0 };
    huidig.minuten += r.minuten; klanten.set(r.klantId, huidig);
  }
  const exporteer = async () => {
    if (!data || !userId || !orgId || exportBezig) return;
    setExportBezig(true); setExportFout(null);
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Bestanden delen is op dit toestel niet beschikbaar.');
      if (huidigeScope.current !== exportScope) return;
      const csv = eigenUrenCsv(data.dagen.flatMap(dag => dag.registraties.map(r => ({ ...r, datum: dag.datum, status: r.status ?? dag.status }))));
      const map = new Directory(Paths.cache, 'uren-exports', encodeURIComponent(`${orgId}:${userId}`));
      map.create({ intermediates: true, idempotent: true });
      const bestand = new File(map, `mijn-uren-${periode.van}-${periode.tot}.csv`);
      bestand.create({ overwrite: true }); bestand.write(csv);
      await Sharing.shareAsync(bestand.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: `Mijn uren ${periode.van} tot ${periode.tot}` });
    } catch (error) { setExportFout(error instanceof Error ? error.message : 'Exporteren is mislukt.'); }
    finally { setExportBezig(false); }
  };
  const regel = (label: string, minuten: number) => <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Text style={{ color: kleuren.mutedForeground, flexShrink: 1 }}>{label}</Text><Text style={{ color: kleuren.foreground }}>{urenLabel(minuten)}</Text></View>;
  return <>
    <View style={{ flexDirection: 'row', gap: 8 }}><Button title="Week" variant={modus === 'week' ? 'secondary' : 'ghost'} onPress={() => setModus('week')} /><Button title="Maand" variant={modus === 'maand' ? 'secondary' : 'ghost'} onPress={() => setModus('maand')} /></View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Button title="Vorige" variant="outline" onPress={() => setDatum(schuifPeriode(datum, modus, -1))} /><Button title="Volgende" variant="outline" onPress={() => setDatum(schuifPeriode(datum, modus, 1))} /></View>
    <Text style={{ color: kleuren.foreground }}>{periode.van} — {periode.tot}</Text>
    {uitCache && <Text style={{ color: kleuren.mutedForeground }}>Laatst geladen urenoverzicht op dit toestel.</Text>}
    <Button title={exportBezig ? 'Export voorbereiden…' : 'Mijn uren delen als CSV'} variant="outline" disabled={!data || exportBezig} onPress={exporteer} />
    {uitCache && <Text style={{ color: kleuren.mutedForeground }}>De export bevat de laatst geladen gegevens, geen nog wachtende opdrachten.</Text>}
    {exportFout && <Text accessibilityRole="alert" style={{ color: kleuren.foreground }}>{exportFout}</Text>}
    {!data ? <Text style={{ color: kleuren.mutedForeground }}>Uren laden…</Text> : <>
      <View style={{ borderWidth: 1, borderColor: kleuren.border, backgroundColor: kleuren.card, borderRadius: 14, padding: 16, gap: 12 }}>
        <Text style={{ color: kleuren.foreground, fontSize: 28, fontWeight: '600' }}>{urenLabel(data.totalen.geregistreerd)}</Text>
        <Text style={{ color: kleuren.mutedForeground }}>Geregistreerd in deze {modus}</Text>
        {regel('Werk bij klanten', data.totalen.klantwerk)}{regel('Pauze', data.totalen.pauze)}{regel('Indirecte tijd', data.totalen.indirect)}
        {regel('Van eerste begin tot laatste einde', data.totalen.span)}{regel('Dagspan min pauze', data.totalen.bronBetaald)}
        <Text style={{ color: kleuren.mutedForeground, fontSize: 12 }}>Dagspan min pauze telt eventuele gaten tussen registraties mee. Dit is een apart overzichtscijfer.</Text>
      </View>
      {klanten.size > 0 && <View style={{ gap: 8 }}><Text accessibilityRole="header" style={{ color: kleuren.foreground, fontWeight: '600' }}>Werk per klant</Text>{[...klanten.entries()].map(([id, klant]) => <View key={id}>{regel(klant.naam, klant.minuten)}</View>)}</View>}
      {!data.dagen.length && <Text style={{ color: kleuren.mutedForeground }}>Geen geregistreerde uren in deze periode.</Text>}
      {data.dagen.map(dag => <View key={dag.datum} style={{ borderWidth: 1, borderColor: kleuren.border, borderRadius: 12, padding: 12, gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${dag.datum}, ${urenLabel(dag.totalen.geregistreerd)}, details`} accessibilityState={{ expanded: openDag === dag.datum }} onPress={() => setOpenDag(openDag === dag.datum ? null : dag.datum)} style={{ minHeight: 48, justifyContent: 'center', gap: 4 }}>
          <Text style={{ color: kleuren.foreground, fontWeight: '600' }}>{dag.datum} · {urenLabel(dag.totalen.geregistreerd)}</Text><Text style={{ color: kleuren.mutedForeground }}>{dag.status === 'ingediend' ? 'Ingediend' : 'Open'}</Text>
        </Pressable>
        {openDag === dag.datum && <>
          {dag.registraties.map(r => <View key={r.id} style={{ gap: 4 }}><Text style={{ color: kleuren.foreground }}>{r.beginTijd}–{r.eindTijd} · {CATEGORIE_LABELS[r.categorie] ?? r.categorie}</Text>{r.klantNaam && <Text style={{ color: kleuren.mutedForeground }}>{r.klantNaam}</Text>}{r.notitie && <Text style={{ color: kleuren.mutedForeground }}>{r.notitie}</Text>}</View>)}
          <Button title="Dag openen" variant="outline" onPress={() => router.push({ pathname: '/(tabs)/uren', params: { datum: dag.datum } })} />
        </>}
      </View>)}
    </>}
  </>;
}
