import React, { Fragment, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { CalendarX2, ChevronDown, ChevronRight, Share } from 'lucide-react-native';
import { eigenUrenCsv } from '../../lib/eigen-uren-csv';
import { useQuery } from 'convex/react';
import { useVeldCache } from '../../hooks/use-veld-cache';
import { useRouter } from 'expo-router';
import { api } from '../../convex/_generated/api';
import { VeldScherm } from '../../components/veld/VeldScherm';
import { useBuitenModus } from '../../components/veld/BuitenModus';
import { Button } from '../../components/ui';
import { Drukvlak, Kaart, LegeStaat, Melding, PeriodeKiezer, Rij, Scheiding, SectieKop, Segment, StatusPil } from '../../components/werk/Bouwstenen';
import { vandaagAmsterdam, werkPeriode, schuifPeriode, urenLabel } from '../../lib/werk-periode';
import { dagLabel, korteDatum, maandLabel, periodeLabel, weekNummer, weekdagNaam } from '../../lib/datum-labels';
import { tekst } from '../../theme';
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
  const vandaag = vandaagAmsterdam();
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
  const maand = maandLabel(periode.van);
  const lijn = (inspring = 16) => <View style={{ height: 1, backgroundColor: kleuren.border, marginLeft: inspring }} />;

  return <>
    <Segment label="Periode" opties={[{ waarde: 'week', label: 'Week' }, { waarde: 'maand', label: 'Maand' }]} waarde={modus} onChange={setModus} />
    <PeriodeKiezer
      titel={modus === 'week' ? `Week ${weekNummer(periode.van)}` : maand.charAt(0).toUpperCase() + maand.slice(1)}
      ondertitel={modus === 'week' ? periodeLabel(periode.van, periode.tot) : undefined}
      vorigeLabel={modus === 'week' ? 'Vorige week' : 'Vorige maand'}
      volgendeLabel={modus === 'week' ? 'Volgende week' : 'Volgende maand'}
      onVorige={() => setDatum(schuifPeriode(datum, modus, -1))}
      onVolgende={() => setDatum(schuifPeriode(datum, modus, 1))}
      onVandaag={vandaag >= periode.van && vandaag <= periode.tot ? undefined : () => setDatum(vandaag)}
    />
    {uitCache && <Melding tekst="Laatst geladen urenoverzicht op dit toestel." />}

    {!data ? <Kaart variant="stil"><Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Uren laden…</Text></Kaart> : (
      <Kaart variant="natuur" padding={18}>
        <View style={{ gap: 2 }}>
          <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Geregistreerd in deze {modus}</Text>
          <Text accessibilityLabel={urenLabel(data.totalen.geregistreerd)} style={[tekst.grootTitel, tekst.cijfers, { color: kleuren.foreground, fontSize: 48, lineHeight: 56 }]}>
            {Math.floor(data.totalen.geregistreerd / 60)}<Text style={[tekst.titel3, { color: kleuren.mutedForeground }]}>u </Text>
            {Math.round(data.totalen.geregistreerd % 60).toString().padStart(2, '0')}<Text style={[tekst.titel3, { color: kleuren.mutedForeground }]}>m</Text>
          </Text>
        </View>
        <View style={{ gap: 2 }}>
          <Rij label="Werk bij klanten" waarde={urenLabel(data.totalen.klantwerk)} />
          <Rij label="Pauze" waarde={urenLabel(data.totalen.pauze)} />
          <Rij label="Indirecte tijd" waarde={urenLabel(data.totalen.indirect)} />
          <Scheiding />
          <Rij label="Van eerste begin tot laatste einde" waarde={urenLabel(data.totalen.span)} />
          <Rij label="Dagspan min pauze" waarde={urenLabel(data.totalen.bronBetaald)} />
        </View>
        <Text style={[tekst.bijschrift, { color: kleuren.mutedForeground, fontWeight: '400' }]}>Dagspan min pauze telt eventuele gaten tussen registraties mee. Dit is een apart overzichtscijfer.</Text>
      </Kaart>
    )}

    <View style={{ gap: 8 }}>
      <Button
        title={exportBezig ? 'Export voorbereiden…' : 'Mijn uren delen als CSV'}
        variant="outline"
        icon={exportBezig ? undefined : <Share size={18} color={kleuren.foreground} strokeWidth={2} />}
        disabled={!data || exportBezig}
        onPress={exporteer}
        fullWidth
      />
      {uitCache && <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, textAlign: 'center', paddingHorizontal: 8 }]}>De export bevat de laatst geladen gegevens, geen nog wachtende opdrachten.</Text>}
      {exportFout && <Melding tekst={exportFout} toon="gemist" />}
    </View>

    {data && <>
      {klanten.size > 0 && <View style={{ gap: 8 }}>
        <SectieKop titel="Werk per klant" telling={klanten.size} />
        <Kaart padding={0} style={{ gap: 0, overflow: 'hidden' }}>
          {[...klanten.entries()].sort((a, b) => b[1].minuten - a[1].minuten).map(([id, klant], i) => <Fragment key={id}>
            {i > 0 && lijn()}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 50, paddingHorizontal: 16, paddingVertical: 12 }}>
              <Text style={[tekst.body, { color: kleuren.foreground, flexShrink: 1 }]} numberOfLines={2}>{klant.naam}</Text>
              <Text style={[tekst.body, tekst.cijfers, { color: kleuren.foreground, fontWeight: '600' }]}>{urenLabel(klant.minuten)}</Text>
            </View>
          </Fragment>)}
        </Kaart>
      </View>}

      {!data.dagen.length ? (
        <LegeStaat icoon={CalendarX2} titel="Geen geregistreerde uren" uitleg="In deze periode staan nog geen uren op je naam." />
      ) : <View style={{ gap: 8 }}>
        <SectieKop titel="Per dag" telling={data.dagen.length} />
        <Kaart padding={0} style={{ gap: 0, overflow: 'hidden' }}>
          {data.dagen.map((dag, i) => {
            const open = openDag === dag.datum;
            const status = dag.status === 'ingediend' ? 'Ingediend' : 'Open';
            const Pijl = open ? ChevronDown : ChevronRight;
            return <Fragment key={dag.datum}>
              {i > 0 && lijn()}
              <Drukvlak
                onPress={() => setOpenDag(open ? null : dag.datum)}
                haptic="selection"
                accessibilityLabel={`${dagLabel(dag.datum)}, ${urenLabel(dag.totalen.geregistreerd)}, ${status}, details`}
                accessibilityState={{ expanded: open }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 16, paddingVertical: 12 }}
              >
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[tekst.kop, { color: kleuren.foreground }]} numberOfLines={1}>
                    {weekdagNaam(dag.datum)} <Text style={{ color: kleuren.mutedForeground, fontWeight: '400' }}>{korteDatum(dag.datum)}</Text>
                  </Text>
                  <StatusPil label={status} toon={dag.status === 'ingediend' ? 'succes' : 'neutraal'} />
                </View>
                <Text style={[tekst.kop, tekst.cijfers, { color: kleuren.foreground }]}>{urenLabel(dag.totalen.geregistreerd)}</Text>
                <Pijl size={18} color={kleuren.mutedForeground} strokeWidth={2} />
              </Drukvlak>
              {open && <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}>
                {dag.registraties.length > 0 && <View style={{ backgroundColor: kleuren.muted, borderRadius: 14, paddingHorizontal: 14 }}>
                  {dag.registraties.map((r, j) => <View key={r.id} style={{ paddingVertical: 10, gap: 2, borderTopWidth: j ? 1 : 0, borderTopColor: kleuren.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                      <Text style={[tekst.sub, tekst.cijfers, { color: kleuren.foreground, fontWeight: '600' }]}>{r.beginTijd}–{r.eindTijd}</Text>
                      <Text style={[tekst.sub, { color: kleuren.foreground, flex: 1 }]} numberOfLines={1}>{CATEGORIE_LABELS[r.categorie] ?? r.categorie}</Text>
                      <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.mutedForeground, fontSize: 14 }]}>{urenLabel(r.minuten)}</Text>
                    </View>
                    {!!r.klantNaam && <Text style={[tekst.sub, { color: kleuren.mutedForeground }]} numberOfLines={1}>{r.klantNaam}</Text>}
                    {!!r.notitie && <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14 }]}>{r.notitie}</Text>}
                  </View>)}
                </View>}
                <Button title="Dag openen" variant="secondary" fullWidth onPress={() => router.push({ pathname: '/(tabs)/uren', params: { datum: dag.datum } })} />
              </View>}
            </Fragment>;
          })}
        </Kaart>
      </View>}
    </>}
  </>;
}
