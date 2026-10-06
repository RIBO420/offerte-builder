import React, { useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { AlertTriangle, CalendarX2, ChevronRight, Clock, MapPin, Navigation, UserX } from 'lucide-react-native';
import { useVeldCache } from '../../hooks/use-veld-cache';
import { api } from '../../convex/_generated/api';
import { VeldScherm } from '../../components/veld/VeldScherm';
import { useBuitenModus } from '../../components/veld/BuitenModus';
import { Button } from '../../components/ui';
import { Drukvlak, Kaart, LegeStaat, Melding, PeriodeKiezer, Scheiding, Segment, StatusPil, WeekStrook, type Toon } from '../../components/werk/Bouwstenen';
import { vandaagAmsterdam, schuifDag, urenLabel, werkPeriode } from '../../lib/werk-periode';
import { dagLabel, dagNummer, korteDatum, periodeLabel, weekNummer, weekdagKort, weekdagNaam } from '../../lib/datum-labels';
import { tekst } from '../../theme';
import type { VeldDagData, VeldStop } from '../../types/veld';

export default function Planning() {
  return <VeldScherm titel="Mijn planning"><PlanningInhoud /></VeldScherm>;
}

function PlanningInhoud() {
  const vandaag = vandaagAmsterdam();
  const [datum, setDatum] = useState(vandaag);
  const [modus, setModus] = useState<'week' | 'dag'>('week');
  const week = werkPeriode(datum, 'week');
  const weekDagen = Array.from({ length: 7 }, (_, i) => schuifDag(week.van, i));
  const inHuidigePeriode = modus === 'week' ? vandaag >= week.van && vandaag <= week.tot : datum === vandaag;

  return (
    <>
      <Segment
        label="Weergave"
        opties={[{ waarde: 'week', label: 'Week' }, { waarde: 'dag', label: 'Dag' }]}
        waarde={modus}
        onChange={setModus}
      />
      <PeriodeKiezer
        titel={modus === 'week' ? `Week ${weekNummer(week.van)}` : weekdagNaam(datum)}
        ondertitel={modus === 'week' ? periodeLabel(week.van, week.tot) : korteDatum(datum)}
        vorigeLabel={modus === 'week' ? 'Vorige week' : 'Vorige dag'}
        volgendeLabel={modus === 'week' ? 'Volgende week' : 'Volgende dag'}
        onVorige={() => setDatum(schuifDag(datum, modus === 'week' ? -7 : -1))}
        onVolgende={() => setDatum(schuifDag(datum, modus === 'week' ? 7 : 1))}
        onVandaag={inHuidigePeriode ? undefined : () => setDatum(vandaag)}
      />
      <WeekStrook
        dagen={weekDagen}
        gekozen={modus === 'dag' ? datum : ''}
        vandaag={vandaag}
        onKies={dag => { setDatum(dag); setModus('dag'); }}
        labelVan={dag => ({ kort: weekdagKort(dag), nummer: dagNummer(dag), voluit: dagLabel(dag) })}
      />
      <View style={{ gap: modus === 'week' ? 12 : 12, marginTop: 4 }}>
        {(modus === 'week' ? weekDagen : [datum]).map(dag => (
          <PlanningDag key={dag} datum={dag} vandaag={vandaag} compact={modus === 'week'} />
        ))}
      </View>
    </>
  );
}

function PlanningDag({ datum, vandaag, compact }: { datum: string; vandaag: string; compact: boolean }) {
  const { kleuren } = useBuitenModus();
  const router = useRouter();
  const liveDag = useQuery(api.urenSegmenten.getVeldDag, { datum }) as VeldDagData | null | undefined;
  const { data: dag, uitCache } = useVeldCache(`dag:${datum}`, liveDag);
  const isVandaag = datum === vandaag;

  const kop = (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, paddingHorizontal: 4 }}>
      <Text accessibilityRole="header" style={[tekst.titel3, { color: kleuren.foreground, flexShrink: 1 }]} numberOfLines={1}>
        {weekdagNaam(datum)} <Text style={{ color: kleuren.mutedForeground, fontWeight: '500' }}>{korteDatum(datum)}</Text>
      </Text>
      {isVandaag ? <StatusPil label="Vandaag" toon="primair" /> : !compact && dag?.team ? <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground }]} numberOfLines={1}>{dag.team.naam}</Text> : null}
    </View>
  );

  if (dag === undefined) {
    return <View style={{ gap: 8 }}>{kop}<Kaart variant="stil"><Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Planning laden…</Text></Kaart></View>;
  }
  if (dag === null) {
    return compact && !isVandaag ? null : (
      <LegeStaat icoon={UserX} titel="Account niet gekoppeld" uitleg="Je account is nog niet aan een medewerker gekoppeld. Vraag kantoor om dit in Team te regelen." />
    );
  }
  if (!dag.stops.length) {
    if (compact) {
      // Lege dag in de weekweergave: één rustige regel, geen kop-met-leegte.
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 4, minHeight: 32 }}>
          <Text style={[tekst.kop, { color: isVandaag ? kleuren.foreground : kleuren.mutedForeground }]} numberOfLines={1}>
            {weekdagNaam(datum)} <Text style={{ fontWeight: '400' }}>{korteDatum(datum)}</Text>
          </Text>
          {isVandaag ? <StatusPil label="Vandaag · vrij" toon="primair" /> : <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Geen klussen</Text>}
        </View>
      );
    }
    return <View style={{ gap: 10 }}>{kop}<LegeStaat icoon={CalendarX2} titel="Geen klussen ingepland" uitleg={dag.team ? `Je staat bij ${dag.team.naam}, maar er staan nog geen klussen op deze dag.` : 'Er staat voor deze dag nog niets op de planning.'} /></View>;
  }

  if (compact) {
    // Weekweergave: per klus één regel; tikken opent het klusscherm.
    return (
      <View style={{ gap: 8 }}>
        {kop}
        <Kaart padding={4} style={{ paddingHorizontal: 16, gap: 0 }}>
          {dag.stops.map((stop, i) => {
            const gelogd = dag.segmenten.some(s => s.werkitemId === stop.werkitemId && s.categorie === 'werken' && s.status !== 'concept');
            const gemist = !gelogd && datum < vandaag;
            const naam = stop.klantNaam ?? stop.naam;
            const sub = [urenLabel(stop.geplandeMinuten), stop.adres?.split(',').slice(-1)[0]?.replace(/^\s*\d{4}\s?[A-Z]{2}\s*/, '').trim()].filter(Boolean).join(' · ');
            return (
              <View key={String(stop.werkitemId)}>
                {i > 0 && <Scheiding />}
                <Drukvlak
                  onPress={() => router.push({ pathname: '/werk/klus/[id]', params: { id: String(stop.werkitemId), datum, naam } })}
                  accessibilityLabel={`${naam}, ${sub}${gelogd ? ', gelogd' : gemist ? ', uren ontbreken' : ''}`}
                  accessibilityHint="Opent de klus"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10 }}
                >
                  <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: stop.type === 'onderhoudsbeurt' ? kleuren.werkOnderhoud : kleuren.werkAanleg }} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[tekst.kop, { color: kleuren.foreground }]} numberOfLines={1}>{naam}</Text>
                    <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.mutedForeground, fontSize: 14 }]} numberOfLines={1}>{sub}</Text>
                  </View>
                  {gelogd ? <StatusPil label="Gelogd" toon="succes" /> : gemist ? <StatusPil label="Uren ontbreken" toon="gemist" /> : null}
                  <ChevronRight size={18} color={kleuren.mutedForeground} strokeWidth={2} />
                </Drukvlak>
              </View>
            );
          })}
        </Kaart>
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {kop}
      {uitCache && <Melding tekst="Opgeslagen planning op dit toestel. Wijzigingen volgen zodra je verbinding hebt." />}
      {dag.stops.map(stop => {
        const gelogd = dag.segmenten.some(s => s.werkitemId === stop.werkitemId && s.categorie === 'werken' && s.status !== 'concept');
        const gemist = !gelogd && datum < vandaag;
        return <KlusKaart key={String(stop.werkitemId)} stop={stop} datum={datum} vandaag={isVandaag} gelogd={gelogd} gemist={gemist} />;
      })}
    </View>
  );
}

function routeUrl(adres: string) {
  const q = encodeURIComponent(adres);
  return Platform.OS === 'ios' ? `http://maps.apple.com/?daddr=${q}` : `geo:0,0?q=${q}`;
}

function KlusKaart({ stop, datum, vandaag, gelogd, gemist }: { stop: VeldStop; datum: string; vandaag: boolean; gelogd: boolean; gemist: boolean }) {
  const { kleuren } = useBuitenModus();
  const router = useRouter();
  const status: { label: string; toon: Toon } = gelogd ? { label: 'Gelogd', toon: 'succes' } : gemist ? { label: 'Uren ontbreken', toon: 'gemist' } : { label: 'Gepland', toon: 'neutraal' };
  const openDag = () => router.push({ pathname: '/(tabs)/uren', params: { datum } });
  return (
    <Kaart variant={vandaag ? 'natuur' : 'standaard'}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[tekst.titel3, { color: kleuren.foreground }]} numberOfLines={2}>{stop.klantNaam ?? stop.naam}</Text>
          {stop.klantNaam && <Text style={[tekst.sub, { color: kleuren.mutedForeground }]} numberOfLines={2}>{stop.naam}</Text>}
        </View>
        <StatusPil {...status} />
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Clock size={16} color={kleuren.mutedForeground} strokeWidth={2} />
          <Text style={[tekst.sub, tekst.cijfers, { color: kleuren.foreground }]}>{urenLabel(stop.geplandeMinuten)} gepland</Text>
        </View>
        {stop.adres && (
          <Drukvlak
            onPress={() => { void Linking.openURL(routeUrl(stop.adres!)).catch(() => undefined); }}
            accessibilityLabel={`Route naar ${stop.adres}`}
            accessibilityHint="Opent kaarten"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}
          >
            <MapPin size={16} color={kleuren.mutedForeground} strokeWidth={2} />
            <Text style={[tekst.sub, { color: kleuren.foreground, flex: 1 }]} numberOfLines={2}>{stop.adres}</Text>
            <Navigation size={16} color={kleuren.primary} strokeWidth={2} />
          </Drukvlak>
        )}
      </View>

      {stop.bijzonderheden && <Melding tekst={stop.bijzonderheden} toon="wachten" icoon={AlertTriangle} />}

      {stop.uitvoeringsInstructie && (
        <View style={{ backgroundColor: kleuren.muted, borderRadius: 14, padding: 12, gap: 4 }}>
          <Text style={[tekst.bijschrift, { color: kleuren.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Instructie</Text>
          <Text style={[tekst.callout, { color: kleuren.foreground }]}>{stop.uitvoeringsInstructie}</Text>
        </View>
      )}

      {stop.taken.length > 0 && (
        <View style={{ gap: 6 }}>
          {stop.taken.map((taak, index) => (
            <View key={index} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: kleuren.primary, marginTop: 8 }} />
              <Text style={[tekst.callout, { color: kleuren.foreground, flex: 1 }]}>{taak.omschrijving}</Text>
            </View>
          ))}
        </View>
      )}

      <Button title={gemist ? 'Ontbrekende uren aanvullen' : 'Werkdag openen'} variant={vandaag || gemist ? 'primary' : 'secondary'} onPress={openDag} fullWidth />
    </Kaart>
  );
}
