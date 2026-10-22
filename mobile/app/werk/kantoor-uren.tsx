import React, { Fragment, useState } from 'react';
import { View } from 'react-native';
import { Text, TextInput } from '../../components/ui/Tekst';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from 'convex/react';
import { CalendarX2, Lock, Search } from 'lucide-react-native';
import { api } from '../../convex/_generated/api';
import { VeldScherm } from '../../components/veld/VeldScherm';
import { useBuitenModus } from '../../components/veld/BuitenModus';
import { useCurrentUser } from '../../hooks/use-current-user';
import { isKantoorRole } from '../../lib/roles';
import { Kaart, LegeStaat, PeriodeKiezer, SectieKop, StatusPil, type Toon } from '../../components/werk/Bouwstenen';
import { vandaagAmsterdam, geldigeDag, schuifDag } from '../../lib/werk-periode';
import { korteDatum, weekdagNaam } from '../../lib/datum-labels';
import { tekst } from '../../theme';

const INDIEN: Record<string, { label: string; toon: Toon }> = {
  ingediend: { label: 'Ingediend', toon: 'succes' },
  deels: { label: 'Deels ingediend', toon: 'wachten' },
  open: { label: 'Open', toon: 'neutraal' },
  niets: { label: 'Geen uren', toon: 'gemist' },
};

export default function KantoorUren() { return <VeldScherm titel="Urencontrole"><Inhoud /></VeldScherm>; }
function Inhoud() {
  const { role } = useCurrentUser();
  const { kleuren } = useBuitenModus();
  const params = useLocalSearchParams<{ datum?: string }>();
  const [datum, setDatum] = useState(geldigeDag(params.datum) ? params.datum : vandaagAmsterdam());
  const [zoek, setZoek] = useState('');
  const kantoor = isKantoorRole(role);
  const data = useQuery(api.veldDekking.getPeriode, kantoor ? { van: datum, tot: datum } : 'skip');
  if (!kantoor) return <LegeStaat icoon={Lock} titel="Alleen voor kantoor" uitleg="Urencontrole is alleen beschikbaar voor kantoor." />;
  const vandaag = vandaagAmsterdam();
  const veld = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, backgroundColor: kleuren.muted, borderRadius: 12, minHeight: 44, paddingHorizontal: 12 };
  const invoer = { flex: 1, color: kleuren.foreground, fontSize: 16, minHeight: 44, paddingVertical: 10 };
  const gefilterd = data?.filter(r => r.medewerkerNaam.toLowerCase().includes(zoek.toLowerCase())) ?? [];

  return <>
    <Text style={[tekst.sub, { color: kleuren.mutedForeground, paddingHorizontal: 4 }]}>Bekijk indienstatus en ontbrekende klusregistraties. Correcties en exports staan in de kantooromgeving.</Text>
    <PeriodeKiezer
      titel={weekdagNaam(datum)}
      ondertitel={korteDatum(datum)}
      vorigeLabel="Vorige dag"
      volgendeLabel="Volgende dag"
      onVorige={() => setDatum(schuifDag(datum, -1))}
      onVolgende={() => setDatum(schuifDag(datum, 1))}
      onVandaag={datum === vandaag ? undefined : () => setDatum(vandaag)}
    />
    <View style={veld}>
      <Search size={18} color={kleuren.mutedForeground} strokeWidth={2} />
      <TextInput accessibilityLabel="Zoek medewerker" value={zoek} onChangeText={setZoek} placeholder="Zoek medewerker" placeholderTextColor={kleuren.mutedForeground} clearButtonMode="while-editing" style={invoer} />
    </View>

    {data === undefined ? <Kaart variant="stil"><Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Urencontrole laden…</Text></Kaart>
      : !data.length ? <LegeStaat icoon={CalendarX2} titel="Geen planning of uren" uitleg="Op deze dag is niets gepland of geregistreerd." />
      : !gefilterd.length ? <Text style={[tekst.sub, { color: kleuren.mutedForeground, textAlign: 'center', paddingVertical: 12 }]}>Geen medewerker gevonden voor “{zoek}”.</Text>
      : <View style={{ gap: 8 }}>
        <SectieKop titel="Medewerkers" telling={gefilterd.length} />
        <Kaart padding={0} style={{ gap: 0, overflow: 'hidden' }}>
          {gefilterd.map((r, i) => {
            const status = INDIEN[r.status] ?? { label: r.status, toon: 'neutraal' as const };
            return <Fragment key={r.medewerkerId}>
              {i > 0 && <View style={{ height: 1, backgroundColor: kleuren.border, marginLeft: 16 }} />}
              <View style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <Text style={[tekst.kop, { color: kleuren.foreground, flexShrink: 1 }]} numberOfLines={2}>{r.medewerkerNaam}</Text>
                  <StatusPil {...status} />
                </View>
                <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.mutedForeground, fontSize: 14 }]}>
                  {r.geregistreerdeBlokken} tijdblokken · {r.ontbrekendeBezoeken} ontbrekende klussen
                </Text>
                {r.bezoeken.length > 0 && <View style={{ backgroundColor: kleuren.muted, borderRadius: 14, paddingHorizontal: 12 }}>
                  {r.bezoeken.map((b, j) => {
                    const bezoek: { label: string; toon: Toon } = b.gelogd ? { label: 'Uren aanwezig', toon: 'succes' } : b.afwezig ? { label: 'Afwezig', toon: 'neutraal' } : { label: 'Uren ontbreken', toon: 'gemist' };
                    return <View key={b.werkitemId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: j ? 1 : 0, borderTopColor: kleuren.border }}>
                      <Text style={[tekst.sub, { color: kleuren.foreground, flex: 1 }]} numberOfLines={2}>{b.naam}</Text>
                      <StatusPil {...bezoek} />
                    </View>;
                  })}
                </View>}
              </View>
            </Fragment>;
          })}
        </Kaart>
      </View>}
  </>;
}
