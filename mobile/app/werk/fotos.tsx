import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { CalendarDays, ImageOff, Search } from 'lucide-react-native';
import { api } from '../../convex/_generated/api';
import { VeldScherm } from '../../components/veld/VeldScherm';
import { useBuitenModus } from '../../components/veld/BuitenModus';
import { BezoekFoto } from '../../components/veld/BezoekFoto';
import { Button } from '../../components/ui';
import { Drukvlak, Kaart, LegeStaat, Melding, PeriodeKiezer, SectieKop, StatusPil } from '../../components/werk/Bouwstenen';
import { useVeldCache } from '../../hooks/use-veld-cache';
import { useCurrentUser } from '../../hooks/use-current-user';
import { isKantoorRole } from '../../lib/roles';
import { vandaagAmsterdam, schuifDag, geldigeDag } from '../../lib/werk-periode';
import { korteDatum, weekdagNaam } from '../../lib/datum-labels';
import { tekst } from '../../theme';

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
  const vandaag = vandaagAmsterdam();
  const veld = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, backgroundColor: kleuren.muted, borderRadius: 12, minHeight: 44, paddingHorizontal: 12 };
  const invoer = { flex: 1, color: kleuren.foreground, fontSize: 16, minHeight: 44, paddingVertical: 10 };

  return <>
    <Text style={[tekst.sub, { color: kleuren.mutedForeground, paddingHorizontal: 4 }]}>{kantoor ? 'Foto’s van alle klussen op deze werkdag.' : 'Foto’s van jouw klussen op deze werkdag.'}</Text>
    <PeriodeKiezer
      titel={weekdagNaam(datum)}
      ondertitel={korteDatum(datum)}
      vorigeLabel="Vorige dag"
      volgendeLabel="Volgende dag"
      onVorige={() => selecteer(schuifDag(datum, -1))}
      onVolgende={() => selecteer(schuifDag(datum, 1))}
      onVandaag={datum === vandaag ? undefined : () => selecteer(vandaag)}
    />

    <View style={{ gap: 8 }}>
      <SectieKop
        titel="Zoeken"
        rechts={
          <Drukvlak onPress={() => { setZoek(''); selecteer(vandaagAmsterdam()); }} haptic="selection" accessibilityLabel="Filters herstellen" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
            <Text style={[tekst.sub, { color: kleuren.primary, fontWeight: '600' }]}>Herstellen</Text>
          </Drukvlak>
        }
      />
      <View style={veld}>
        <Search size={18} color={kleuren.mutedForeground} strokeWidth={2} />
        <TextInput accessibilityLabel="Zoek klant of klus" value={zoek} onChangeText={setZoek} placeholder="Zoek klant of klus" placeholderTextColor={kleuren.mutedForeground} clearButtonMode="while-editing" style={invoer} />
      </View>
      <View style={veld}>
        <CalendarDays size={18} color={kleuren.mutedForeground} strokeWidth={2} />
        <TextInput accessibilityLabel="Klusdatum (jaar-maand-dag)" value={datumInvoer} onChangeText={setDatumInvoer} onEndEditing={() => { if (geldigeDag(datumInvoer)) setDatum(datumInvoer); }} placeholder="JJJJ-MM-DD" placeholderTextColor={kleuren.mutedForeground} style={[invoer, tekst.cijfers]} />
      </View>
    </View>

    {uitCache && <Melding tekst="Laatst geladen overzicht. Foto’s openen vraagt mogelijk verbinding." />}
    {!data && <Kaart variant="stil"><Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Foto’s laden…</Text></Kaart>}

    {bezoeken?.filter(b => b.fotos.some(f => f.url)).map((b, i) => (
      <Kaart key={`${b.werkitemId}-${i}`}>
        <View style={{ gap: 2 }}>
          <Text style={[tekst.kop, { color: kleuren.foreground }]} numberOfLines={2}>{b.klantNaam ?? b.naam}</Text>
          {b.klantNaam ? <Text style={[tekst.sub, { color: kleuren.mutedForeground }]} numberOfLines={2}>{b.naam}</Text> : null}
        </View>
        {b.fotos.filter(f => f.url).map(f => (
          <View key={f.id} style={{ gap: 8 }}>
            <BezoekFoto url={f.url!} label={`${f.fase === 'voor' ? 'Voorfoto' : 'Nafoto'} · ${b.naam}`} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <StatusPil label={f.fase === 'voor' ? 'Voor' : 'Na'} toon={f.fase === 'na' ? 'succes' : 'neutraal'} />
              <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.mutedForeground, fontSize: 14, flex: 1 }]} numberOfLines={2}>
                {f.doorNaam}{f.createdAt ? ` · ${new Date(f.createdAt).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}` : ''}
              </Text>
            </View>
          </View>
        ))}
      </Kaart>
    ))}
    {data && !bezoeken?.some(b => b.fotos.length) && <LegeStaat icoon={ImageOff} titel="Geen foto’s gevonden" uitleg="Er zijn geen foto’s voor deze dag of zoekterm." />}

    <Button title="Naar mijn werkdag" variant="outline" fullWidth onPress={() => router.push({ pathname: '/(tabs)/uren', params: { datum } })} />
  </>;
}
