import React from 'react';
import { Alert, Text, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { Button } from '../ui/Button';
import { useVeldOpdracht } from '../../hooks/use-veld-opdracht';
import { IcoonTegel, Kaart, Melding, Scheiding, StatusPil } from '../werk/Bouwstenen';
import { tekst } from '../../theme';
import { useVeldKleuren } from './BuitenModus';

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
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <Text style={[tekst.kop, { color: kleuren.foreground, flexShrink: 1 }]}>{LABELS[r.type]}{r.payload.datum ? <Text style={[tekst.cijfers, { color: kleuren.mutedForeground, fontWeight: '400' }]}> · {String(r.payload.datum)}</Text> : null}</Text>
            <StatusPil label={r.status === 'conflict' ? 'Controle nodig' : 'Wacht op bevestiging'} toon={r.status === 'conflict' ? 'gemist' : 'wachten'} />
          </View>
          {typeof r.payload.keuze === 'string' && <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>{r.payload.keuze.replaceAll('_', ' ')}</Text>}
          {Array.isArray(r.payload.segmenten) && r.payload.segmenten.map((segment, i) => <Text key={i} style={[tekst.sub, tekst.cijfers, { color: kleuren.mutedForeground }]}>{String(segment.beginTijd)}–{String(segment.eindTijd)} · {String(segment.categorie).replaceAll('_', ' ')}</Text>)}
          {r.fout && <>
            <Melding toon="gemist" tekst={r.fout} />
            <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14, lineHeight: 19 }]}>Controleer de melding. Probeer dezelfde bewaarde invoer opnieuw als het probleem is opgelost. Een gewijzigde dag moet je eerst opnieuw bekijken.</Text>
            <Button title="Bewaarde invoer opnieuw proberen" variant="outline" onPress={() => { void probeerOpnieuw(r.id); }} />
            <Button title="Wachtende opdracht verwijderen" variant="ghost" onPress={() => Alert.alert('Wachtende invoer verwijderen?', 'Alleen deze lokale opdracht wordt verwijderd. Reeds opgeslagen registraties blijven bestaan.', [
              { text: 'Annuleren', style: 'cancel' }, { text: 'Verwijderen', style: 'destructive', onPress: () => { void verwijder(r.id); } },
            ])} />
          </>}
        </View>
      </View>)}
    </View>}
    <Button title="Opnieuw synchroniseren" variant="secondary" onPress={() => { void synchroniseer(); }} icon={<RefreshCw size={16} color={kleuren.primary} strokeWidth={2} />} fullWidth />
  </Kaart>;
}
