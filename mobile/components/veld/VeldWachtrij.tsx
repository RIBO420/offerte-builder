import React from 'react';
import { Alert, Text, View } from 'react-native';
import { Button } from '../ui/Button';
import { useVeldOpdracht } from '../../hooks/use-veld-opdracht';
import { useBuitenModus } from './BuitenModus';

const LABELS = { dagvoorstel: 'Uren', retour: 'Aanhangerretour', afronding: 'Klusafronding', delegatie: 'Overdracht aan collega', foto: 'Foto', intro: 'Introductie', afvoer: 'Afvoer bij klus', segmentToevoegen: 'Uren toevoegen', segmentWijzigen: 'Uren wijzigen' };
export function VeldWachtrij() {
  const { wachtrij, fout, synchroniseer, verwijder, probeerOpnieuw } = useVeldOpdracht();
  const { kleuren } = useBuitenModus();
  if (!wachtrij.length && !fout) return null;
  return <View style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: kleuren.border, gap: 10 }}>
    <Text accessibilityRole="header" style={{ color: kleuren.foreground, fontWeight: '700', fontSize: 16 }}>Nog te synchroniseren</Text>
    <Text style={{ color: kleuren.mutedForeground }}>Je invoer blijft op dit toestel bewaard. Dien je dag in nadat de wachtrij leeg is.</Text>
    {fout && <Text accessibilityRole="alert" style={{ color: kleuren.destructive }}>{fout}</Text>}
    {wachtrij.map(r => <View key={r.id} style={{ gap: 6 }}>
      <Text style={{ color: kleuren.foreground }}>{LABELS[r.type]} · {String(r.payload.datum ?? '')} · {r.status === 'conflict' ? 'Controle nodig' : 'Wacht op bevestiging'}</Text>
      {typeof r.payload.keuze === 'string' && <Text style={{ color: kleuren.mutedForeground }}>{r.payload.keuze.replaceAll('_', ' ')}</Text>}
      {Array.isArray(r.payload.segmenten) && r.payload.segmenten.map((segment, i) => <Text key={i} style={{ color: kleuren.mutedForeground }}>{String(segment.beginTijd)}–{String(segment.eindTijd)} · {String(segment.categorie).replaceAll('_', ' ')}</Text>)}
      {r.fout && <>
        <Text accessibilityRole="alert" style={{ color: kleuren.destructive }}>{r.fout}</Text>
        <Text style={{ color: kleuren.mutedForeground }}>Controleer de melding. Probeer dezelfde bewaarde invoer opnieuw als het probleem is opgelost. Een gewijzigde dag moet je eerst opnieuw bekijken.</Text>
        <Button title="Bewaarde invoer opnieuw proberen" variant="outline" onPress={() => { void probeerOpnieuw(r.id); }} />
        <Button title="Wachtende opdracht verwijderen" variant="outline" onPress={() => Alert.alert('Wachtende invoer verwijderen?', 'Alleen deze lokale opdracht wordt verwijderd. Reeds opgeslagen registraties blijven bestaan.', [
          { text: 'Annuleren', style: 'cancel' }, { text: 'Verwijderen', style: 'destructive', onPress: () => { void verwijder(r.id); } },
        ])} />
      </>}
    </View>)}
    <Button title="Opnieuw synchroniseren" variant="outline" onPress={() => { void synchroniseer(); }} />
  </View>;
}
