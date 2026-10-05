import React, { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useQuery } from 'convex/react';
import * as Crypto from 'expo-crypto';
import { useVeldOpdracht } from '../../hooks/use-veld-opdracht';
import { useVeldCache } from '../../hooks/use-veld-cache';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { Button } from '../ui';
import { amsterdamTijd, retourTijdstip } from '../../lib/retour-tijd';
import { useBuitenModus } from './BuitenModus';

export const RETOUR_KEUZES = [
  ['geen_aanhanger', 'Geen aanhanger mee'], ['leeg', 'Leeg'], ['kwart', '¼ vol'],
  ['half', '½ vol'], ['driekwart', '¾ vol'], ['vol', 'Vol'],
] as const;
type Keuze = typeof RETOUR_KEUZES[number][0];
interface Retour {
  _id: string; retourId: string; keuze: Keuze; voertuigId?: Id<'voertuigen'>;
  revision: number; gemeldDoorNaam: string; waargenomenOp: number;
  notitie?: string;
}
interface RetourDag {
  teamId: Id<'teams'> | null; medewerkerId: Id<'medewerkers'> | null;
  aanhangers: { _id: Id<'voertuigen'>; naam: string; kenteken: string }[];
  retouren: Retour[]; magMelden: boolean;
  preselectedVoertuigId?: Id<'voertuigen'> | null;
}
interface Concept {
  retourId: string; keuze: Keuze | null; voertuigId: string;
  expectedRevision?: number; tijd: string; notitie: string; correctieReden: string;
}

function foutTekst(error: unknown): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = error.data;
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') return data.message;
  }
  return error instanceof Error ? error.message : 'Opslaan is niet gelukt. Probeer opnieuw.';
}

/** De retourmelding is een ploegantwoord; uren indienen staat hier los van. */
export function AanhangerRetourKaart({ datum, teamId }: { datum: string; teamId?: string }) {
  const { kleuren } = useBuitenModus();
  const liveDag = useQuery(api.aanhangerRetouren.getDag, {
    datum, ...(teamId ? { teamId: teamId as Id<'teams'> } : {}),
  }) as RetourDag | undefined;
  const { data: dag } = useVeldCache(`retour:${datum}:${teamId ?? 'eigen'}`, liveDag);
  const { verstuur, wachtrij } = useVeldOpdracht();
  const [concept, setConcept] = useState<Concept | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [gelukt, setGelukt] = useState(false);
  const [wacht, setWacht] = useState(false);
  // Bij een onzekere netwerkrespons gebruikt een ongewijzigde retry dezelfde sleutel.
  const poging = useRef<{ inhoud: string; idempotencyKey: string; waargenomenOp: number } | null>(null);
  const actief = useRef(false);

  const open = (retour?: Retour) => {
    if (!dag) return;
    const basis = dag.teamId ? `team:${dag.teamId}` : `medewerker:${dag.medewerkerId}`;
    const prefix = `${basis}:${datum}:retour:`;
    const nummers = dag.retouren.map(r => r.retourId.startsWith(prefix) ? Number(r.retourId.slice(prefix.length)) : 0).filter(Number.isFinite);
    setConcept({
      retourId: retour?.retourId ?? `${prefix}${Math.max(0, ...nummers) + 1}`,
      keuze: retour?.keuze ?? null,
      voertuigId: retour?.voertuigId ?? dag.preselectedVoertuigId ?? (dag.aanhangers.length === 1 ? dag.aanhangers[0]._id : ''),
      expectedRevision: retour?.revision,
      // eslint-disable-next-line react-hooks/purity -- open() is only called from a press event; this is the observation form default.
      tijd: amsterdamTijd(retour?.waargenomenOp ?? Date.now()),
      notitie: retour?.notitie ?? '', correctieReden: '',
    });
    poging.current = null;
    setFout(null);
    setGelukt(false); setWacht(false);
  };

  const opslaan = async () => {
    if (!dag || !concept || !concept.keuze || actief.current) return;
    if (concept.keuze !== 'geen_aanhanger' && !concept.voertuigId) {
      setFout('Kies de aanhanger waarmee je terugkomt.'); return;
    }
    if (concept.expectedRevision !== undefined && !concept.correctieReden.trim()) {
      setFout('Geef een reden voor deze correctie.'); return;
    }
    const waargenomenOp = retourTijdstip(datum, concept.tijd);
    if (waargenomenOp === null || waargenomenOp > Date.now() + 300000) {
      setFout('Vul een geldige tijd van terugkomst in (HH:MM), niet in de toekomst.'); return;
    }
    const payload = {
      waargenomenOp,
      retourId: concept.retourId, datum,
      ...(dag.teamId ? { teamId: dag.teamId } : {}),
      keuze: concept.keuze,
      ...(concept.keuze !== 'geen_aanhanger' ? { voertuigId: concept.voertuigId as Id<'voertuigen'> } : {}),
      ...(concept.expectedRevision !== undefined ? { expectedRevision: concept.expectedRevision } : {}),
      ...(concept.notitie.trim() ? { notitie: concept.notitie.trim() } : {}),
      ...(concept.correctieReden.trim() ? { correctieReden: concept.correctieReden.trim() } : {}),
    };
    const inhoud = JSON.stringify(payload);
    if (poging.current?.inhoud !== inhoud) {
      poging.current = { inhoud, idempotencyKey: Crypto.randomUUID(), waargenomenOp };
    }
    actief.current = true; setBezig(true); setFout(null);
    try {
      const result = await verstuur('retour', { ...payload, waargenomenOp: poging.current.waargenomenOp }, poging.current.idempotencyKey);
      if (result.status === 'conflict') setFout(result.fout ?? 'Controleer de wachtende melding bovenaan je dag.');
      else { setConcept(null); setGelukt(result.status === 'verzonden'); setWacht(result.status === 'wacht'); poging.current = null; }
    } catch (error) {
      setFout(foutTekst(error));
    } finally {
      actief.current = false; setBezig(false);
    }
  };

  const tekstveld = { color: kleuren.foreground, backgroundColor: kleuren.background, borderColor: kleuren.border, borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 48, fontSize: 16 };
  return (
    <View style={{ backgroundColor: kleuren.card, borderColor: kleuren.border, borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 }}>
      <Text accessibilityRole="header" style={{ color: kleuren.foreground, fontSize: 17, fontWeight: '600' }}>Terug naar de loods</Text>
      <Text style={{ color: kleuren.mutedForeground, fontSize: 14 }}>Hoe vol gaat de aanhanger mee terug?</Text>
      {!dag ? <Text style={{ color: kleuren.mutedForeground }}>Retourmeldingen laden…</Text> : <>
        {dag.retouren.length === 0 && <Text style={{ color: kleuren.mutedForeground }}>Nog niet gemeld{dag.teamId ? ' door je ploeg' : ''}.</Text>}
        {dag.retouren.map((retour, index) => {
          const voertuig = dag.aanhangers.find(a => a._id === retour.voertuigId);
          return <View key={retour._id} style={{ gap: 6, borderTopWidth: index > 0 ? 1 : 0, borderColor: kleuren.border, paddingTop: index > 0 ? 12 : 0 }}>
            <Text style={{ color: kleuren.foreground, fontWeight: '600' }}>Retour {index + 1} · {RETOUR_KEUZES.find(([key]) => key === retour.keuze)?.[1]}</Text>
            {retour.voertuigId && <Text style={{ color: kleuren.foreground }}>{voertuig ? `${voertuig.naam} · ${voertuig.kenteken}` : 'Aanhanger geregistreerd'}</Text>}
            <Text style={{ color: kleuren.mutedForeground }}>{retour.gemeldDoorNaam} · {amsterdamTijd(retour.waargenomenOp)}</Text>
            {retour.notitie && <Text style={{ color: kleuren.foreground }}>{retour.notitie}</Text>}
            {dag.magMelden && !concept && <Button title="Melding corrigeren" variant="ghost" size="sm" onPress={() => open(retour)} />}
          </View>;
        })}
        {wacht && <Text accessibilityLiveRegion="polite" style={{ color: kleuren.foreground }}>Op dit toestel bewaard. Wacht op bevestiging; je ploeg ziet de melding na synchronisatie.</Text>}
        {gelukt && <Text accessibilityLiveRegion="polite" style={{ color: kleuren.foreground }}>Opgeslagen. Je ploeg ziet dezelfde melding.</Text>}
        {!dag.magMelden && <Text style={{ color: kleuren.mutedForeground }}>Je kunt deze retourmeldingen bekijken. Melden kan voor je eigen ploegdag.</Text>}
        {dag.magMelden && !concept && <Button title={dag.retouren.length ? 'Nog een retour melden' : 'Retour melden'} variant="outline" disabled={wachtrij.some(r => r.type === 'retour' && r.payload.datum === datum)} onPress={() => open()} />}
        {concept && <View style={{ gap: 12 }}>
          <Text style={{ color: kleuren.foreground, fontWeight: '600' }}>{concept.expectedRevision === undefined ? 'Nieuwe retourmelding' : 'Melding corrigeren'}</Text>
          {concept.expectedRevision !== undefined && dag.retouren.some(r => r.retourId === concept.retourId && r.revision !== concept.expectedRevision) &&
            <Text accessibilityRole="alert" style={{ color: kleuren.foreground }}>Een collega heeft deze melding gewijzigd. Sluit je correctie en open de nieuwste melding.</Text>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {RETOUR_KEUZES.map(([keuze, label]) => <Pressable
              key={keuze} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: concept.keuze === keuze, disabled: bezig }} disabled={bezig}
              onPress={() => setConcept({ ...concept, keuze })}
              style={{ minHeight: 48, minWidth: 64, justifyContent: 'center', padding: 12, borderWidth: 1, borderRadius: 10, borderColor: concept.keuze === keuze ? kleuren.primary : kleuren.border, backgroundColor: concept.keuze === keuze ? kleuren.primary : kleuren.background }}>
              <Text style={{ color: concept.keuze === keuze ? kleuren.primaryForeground : kleuren.foreground }}>{label}</Text>
            </Pressable>)}
          </View>
          {concept.keuze && concept.keuze !== 'geen_aanhanger' && <View style={{ gap: 8 }}>
            <Text style={{ color: kleuren.foreground }}>Welke aanhanger?</Text>
            {dag.aanhangers.length === 0 && <Text style={{ color: kleuren.mutedForeground }}>Er is geen aanhanger beschikbaar. Laat kantoor de aanhanger toevoegen aan het wagenpark.</Text>}
            {dag.aanhangers.map(a => <Pressable key={a._id} disabled={bezig} accessibilityRole="radio" accessibilityState={{ checked: concept.voertuigId === a._id, disabled: bezig }} onPress={() => setConcept({ ...concept, voertuigId: a._id })} style={{ ...tekstveld, borderColor: concept.voertuigId === a._id ? kleuren.primary : kleuren.border }}>
              <Text style={{ color: kleuren.foreground }}>{concept.voertuigId === a._id ? '✓ ' : ''}{a.naam} · {a.kenteken}</Text>
            </Pressable>)}
          </View>}
          <Text style={{ color: kleuren.foreground }}>Tijd van terugkomst</Text>
          <TextInput accessibilityLabel="Tijd van terugkomst (Nederlandse tijd)" placeholder="16:30" placeholderTextColor={kleuren.mutedForeground} value={concept.tijd} maxLength={5} editable={!bezig} onChangeText={tijd => setConcept({ ...concept, tijd })} style={tekstveld} keyboardType="numbers-and-punctuation" />
          <TextInput maxLength={1000} accessibilityLabel="Toelichting retourmelding" placeholder="Toelichting (optioneel)" placeholderTextColor={kleuren.mutedForeground} value={concept.notitie} editable={!bezig} onChangeText={notitie => setConcept({ ...concept, notitie })} style={tekstveld} multiline />
          {concept.expectedRevision !== undefined && <TextInput maxLength={1000} accessibilityLabel="Reden voor correctie" placeholder="Reden voor correctie" placeholderTextColor={kleuren.mutedForeground} value={concept.correctieReden} editable={!bezig} onChangeText={correctieReden => setConcept({ ...concept, correctieReden })} style={tekstveld} multiline />}
          {fout && <Text accessibilityRole="alert" style={{ color: kleuren.foreground }}>{fout}</Text>}
          <Button title="Retour opslaan" variant="outline" onPress={opslaan} loading={bezig} disabled={!concept.keuze} />
          <Button title="Annuleren" variant="ghost" disabled={bezig} onPress={() => { setConcept(null); setFout(null); }} />
        </View>}
      </>}
    </View>
  );
}
