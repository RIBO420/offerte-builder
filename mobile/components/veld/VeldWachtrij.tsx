import React from 'react';
import { Alert, Image, View } from 'react-native';
import { Text } from '../ui/Tekst';
import { RefreshCw } from 'lucide-react-native';
import { Button } from '../ui/Button';
import { useVeldOpdracht } from '../../hooks/use-veld-opdracht';
import { useVeldCache } from '../../hooks/use-veld-cache';
import { IcoonTegel, Kaart, Melding, Scheiding, StatusPil } from '../werk/Bouwstenen';
import { tekst } from '../../theme';
import { useVeldKleuren } from './BuitenModus';
import { RETOUR_KEUZES } from './AanhangerRetourKaart';
import { VerwijderKnop } from './VerwijderKnop';
import { korteDatum } from '../../lib/datum-labels';
import { AFVOER } from '../../lib/afvoer-keuzes';
import { CATEGORIE_LABELS, type SegmentCategorie, type VeldDagData } from '../../types/veld';

/** ISO-dag als "5 okt"; iets anders tonen we zoals het is. */
const datumTekst = (datum: unknown) =>
  typeof datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(datum) ? korteDatum(datum) : String(datum);
/** Onbekende sleutel: underscores weg en hoofdletter vooraan, nooit een ruwe code. */
const leesbaar = (waarde: string) => { const t = waarde.replaceAll('_', ' '); return t.charAt(0).toUpperCase() + t.slice(1); };
const keuzeLabel = (type: string, keuze: string) =>
  (type === 'retour' ? RETOUR_KEUZES.find(([k]) => k === keuze)?.[1] : type === 'afvoer' ? AFVOER.find(([k]) => k === keuze)?.[1] : undefined) ?? leesbaar(keuze);
const categorieLabel = (categorie: unknown) => CATEGORIE_LABELS[categorie as SegmentCategorie] ?? leesbaar(String(categorie));

const LABELS = { dagvoorstel: 'Uren', retour: 'Aanhangerretour', afronding: 'Klusafronding', delegatie: 'Overdracht aan collega', foto: 'Foto', intro: 'Introductie', afvoer: 'Afvoer bij klus', segmentToevoegen: 'Uren toevoegen', segmentWijzigen: 'Uren wijzigen' };
export function VeldWachtrij() {
  const { wachtrij, fout, synchroniseer, verwijder, probeerOpnieuw } = useVeldOpdracht();
  const kleuren = useVeldKleuren();
  if (!wachtrij.length && !fout) return null;
  return <Kaart style={{ gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <IcoonTegel icoon={RefreshCw} toon="wachten" grootte={40} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text accessibilityRole="header" style={[tekst.kop, { color: kleuren.foreground }]}>Nog te synchroniseren</Text>
        <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14, lineHeight: 19 }]}>Je invoer blijft op dit toestel bewaard. Dien je dag in nadat de wachtrij leeg is.</Text>
      </View>
    </View>
    {fout && <Melding toon="gemist" tekst={fout} />}
    {wachtrij.length > 0 && <View>
      {wachtrij.map((r, i) => <View key={r.id}>
        {i > 0 && <Scheiding />}
        <View style={{ gap: 6, paddingVertical: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {r.type === 'foto' && typeof r.payload.localUri === 'string' && <Image source={{ uri: r.payload.localUri }} accessibilityIgnoresInvertColors style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: kleuren.vulling }} />}
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <Text style={[tekst.kop, { color: kleuren.foreground, flexShrink: 1 }]}>{r.type === 'foto' ? (r.payload.fase === 'voor' ? 'Voorfoto' : r.payload.fase === 'na' ? 'Nafoto' : 'Foto') : LABELS[r.type]}{r.payload.datum ? <Text style={[tekst.cijfers, { color: kleuren.mutedForeground, fontWeight: '400' }]}> · {datumTekst(r.payload.datum)}</Text> : null}</Text>
              <StatusPil label={r.status === 'conflict' ? 'Controle nodig' : 'Wacht op bevestiging'} toon={r.status === 'conflict' ? 'gemist' : 'wachten'} />
            </View>
          </View>
          {r.type === 'foto' && typeof r.payload.datum === 'string' && typeof r.payload.werkitemId === 'string' && <KlusNaam datum={r.payload.datum} werkitemId={r.payload.werkitemId} />}
          {typeof r.payload.keuze === 'string' && <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>{keuzeLabel(r.type, r.payload.keuze)}</Text>}
          {Array.isArray(r.payload.segmenten) && r.payload.segmenten.map((segment, i) => <Text key={i} style={[tekst.sub, tekst.cijfers, { color: kleuren.mutedForeground }]}>{String(segment.beginTijd)}–{String(segment.eindTijd)} · {categorieLabel(segment.categorie)}</Text>)}
          {r.status === 'wacht' && r.laatsteFout && <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14, lineHeight: 19 }]}>De server was even niet bereikbaar. De app probeert het automatisch opnieuw{r.pogingen ? ` (poging ${r.pogingen})` : ''}.</Text>}
          {r.fout && <>
            <Melding toon="gemist" tekst={r.fout} />
            <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14, lineHeight: 19 }]}>Controleer de melding. Probeer dezelfde bewaarde invoer opnieuw als het probleem is opgelost. Een gewijzigde dag moet je eerst opnieuw bekijken.</Text>
            <Button title="Bewaarde invoer opnieuw proberen" variant="outline" onPress={() => { void probeerOpnieuw(r.id); }} />
            <VerwijderKnop title="Wachtende opdracht verwijderen" onPress={() => Alert.alert('Wachtende invoer verwijderen?', 'Alleen deze lokale opdracht wordt verwijderd. Reeds opgeslagen registraties blijven bestaan.', [
              { text: 'Annuleren', style: 'cancel' }, { text: 'Verwijderen', style: 'destructive', onPress: () => { void verwijder(r.id); } },
            ])} />
          </>}
        </View>
      </View>)}
    </View>}
    <Button title="Opnieuw synchroniseren" variant="secondary" onPress={() => { void synchroniseer(); }} icon={<RefreshCw size={16} color={kleuren.primary} strokeWidth={2} />} fullWidth />
  </Kaart>;
}

/** Klusnaam uit de laatst bewaarde dagkaart; zonder cache tonen we niets. */
function KlusNaam({ datum, werkitemId }: { datum: string; werkitemId: string }) {
  const kleuren = useVeldKleuren();
  const { data: dag } = useVeldCache<VeldDagData>(`dag:${datum}`, undefined);
  const stop = dag?.stops.find(s => String(s.werkitemId) === werkitemId);
  if (!stop) return null;
  return <Text style={[tekst.sub, { color: kleuren.mutedForeground }]} numberOfLines={1}>{stop.klantNaam ? `${stop.klantNaam} · ${stop.naam}` : stop.naam}</Text>;
}
