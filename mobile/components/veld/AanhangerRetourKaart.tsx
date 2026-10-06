import React, { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useQuery } from 'convex/react';
import * as Crypto from 'expo-crypto';
import { useVeldOpdracht } from '../../hooks/use-veld-opdracht';
import { useVeldCache } from '../../hooks/use-veld-cache';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { Check, Pencil, Truck } from 'lucide-react-native';
import { Button } from '../ui';
import { IcoonTegel, Kaart, Melding, Scheiding, SectieKop, StatusPil } from '../werk/Bouwstenen';
import { tekst } from '../../theme';
import { amsterdamTijd, retourTijdstip } from '../../lib/retour-tijd';
import { useVeldKleuren } from './BuitenModus';

export const RETOUR_KEUZES = [
  ['geen_aanhanger', 'Geen aanhanger mee'], ['leeg', 'Leeg'], ['kwart', '¼ vol'],
  ['half', '½ vol'], ['driekwart', '¾ vol'], ['vol', 'Vol'],
] as const;
type Keuze = typeof RETOUR_KEUZES[number][0];
const keuzeLabel = (keuze: unknown) => RETOUR_KEUZES.find(([key]) => key === keuze)?.[1] ?? 'Onbekend';
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
export function AanhangerRetourKaart({ datum, teamId, ingebed = false }: { datum: string; teamId?: string; ingebed?: boolean }) {
  const kleuren = useVeldKleuren();
  const liveDag = useQuery(api.aanhangerRetouren.getDag, {
    datum, ...(teamId ? { teamId: teamId as Id<'teams'> } : {}),
  }) as RetourDag | undefined;
  const { data: dag } = useVeldCache(`retour:${datum}:${teamId ?? 'eigen'}`, liveDag);
  const { verstuur, wachtrij } = useVeldOpdracht();
  const wachtend = wachtrij.filter(r => r.type === 'retour' && r.payload.datum === datum);
  const [concept, setConcept] = useState<Concept | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [gelukt, setGelukt] = useState(false);
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
    setGelukt(false);
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
      else { setConcept(null); setGelukt(result.status === 'verzonden'); poging.current = null; }
    } catch (error) {
      setFout(foutTekst(error));
    } finally {
      actief.current = false; setBezig(false);
    }
  };

  const tekstveld = { color: kleuren.foreground, backgroundColor: kleuren.input, borderColor: kleuren.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48, fontSize: 17 };
  const veldLabel = [tekst.voetnoot, { color: kleuren.mutedForeground, fontWeight: '600' as const }];
  return (
    <View style={{ gap: 10 }}>
      {!ingebed && <SectieKop titel="Terug naar de loods" />}
      <Kaart style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IcoonTegel icoon={Truck} toon="neutraal" grootte={40} />
          <Text accessibilityRole="header" style={[tekst.kop, { color: kleuren.foreground, flex: 1 }]}>Hoe vol gaat de aanhanger mee terug?</Text>
        </View>
        {!dag ? <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Retourmeldingen laden…</Text> : <>
          {dag.retouren.length === 0 && <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Nog niet gemeld{dag.teamId ? ' door je ploeg' : ''}.</Text>}
          {dag.retouren.length > 0 && <View>
            {dag.retouren.map((retour, index) => {
              const voertuig = dag.aanhangers.find(a => a._id === retour.voertuigId);
              return <View key={retour._id}>
                {index > 0 && <Scheiding />}
                <View style={{ gap: 4, paddingVertical: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={[tekst.kop, { color: kleuren.foreground, flexShrink: 1 }]}>Retour {index + 1}</Text>
                    <StatusPil label={keuzeLabel(retour.keuze)} toon={retour.keuze === 'geen_aanhanger' ? 'neutraal' : 'primair'} />
                  </View>
                  {retour.voertuigId && <Text style={[tekst.sub, { color: kleuren.foreground }]}>{voertuig ? `${voertuig.naam} · ${voertuig.kenteken}` : 'Aanhanger geregistreerd'}</Text>}
                  <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.mutedForeground, fontSize: 14 }]}>{retour.gemeldDoorNaam} · {amsterdamTijd(retour.waargenomenOp)}</Text>
                  {retour.notitie && <Text style={[tekst.sub, { color: kleuren.foreground }]}>{retour.notitie}</Text>}
                  {dag.magMelden && !concept && <View style={{ alignSelf: 'flex-start' }}><Button title="Melding corrigeren" variant="outline" size="sm" icon={<Pencil size={15} color={kleuren.foreground} strokeWidth={2} />} disabled={wachtend.some(r => r.payload.retourId === retour.retourId)} onPress={() => open(retour)} /></View>}
                </View>
              </View>;
            })}
          </View>}
          {wachtend.length > 0 && <View accessibilityLiveRegion="polite" style={{ gap: 8 }}>
            {dag.retouren.length > 0 && <Scheiding />}
            {wachtend.map(r => {
              const voertuig = dag.aanhangers.find(a => a._id === r.payload.voertuigId);
              const correctie = dag.retouren.some(x => x.retourId === r.payload.retourId);
              return <View key={r.id} style={{ gap: 4, paddingVertical: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={[tekst.kop, { color: kleuren.foreground, flexShrink: 1 }]}>{correctie ? 'Correctie' : 'Nieuwe retour'} · {keuzeLabel(r.payload.keuze)}</Text>
                  <StatusPil label={r.status === 'conflict' ? 'Niet opgeslagen' : 'Wacht op verbinding'} toon={r.status === 'conflict' ? 'gemist' : 'wachten'} />
                </View>
                {voertuig && <Text style={[tekst.sub, { color: kleuren.foreground }]}>{voertuig.naam} · {voertuig.kenteken}</Text>}
                <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14 }]}>{r.status === 'conflict' ? (r.fout ?? 'Controleer deze melding bovenaan je dag.') : 'Staat op dit toestel. Je ploeg ziet hem zodra je verbinding hebt.'}</Text>
              </View>;
            })}
          </View>}
          {gelukt && <View accessibilityLiveRegion="polite"><Melding toon="succes" tekst="Opgeslagen. Je ploeg ziet dezelfde melding." /></View>}
          {!dag.magMelden && <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Je kunt deze retourmeldingen bekijken. Melden kan voor je eigen ploegdag.</Text>}
          {dag.magMelden && !concept && <Button title={dag.retouren.length ? 'Nog een retour melden' : 'Retour melden'} variant="outline" disabled={wachtend.length > 0} onPress={() => open()} fullWidth />}
          {dag.magMelden && !concept && wachtend.length > 0 && <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14, textAlign: 'center' }]}>Een nieuwe melding kan zodra de wachtende melding is opgeslagen.</Text>}
          {concept && <View style={{ gap: 12 }}>
            <Scheiding />
            <Text style={[tekst.titel3, { color: kleuren.foreground }]}>{concept.expectedRevision === undefined ? 'Nieuwe retourmelding' : 'Melding corrigeren'}</Text>
            {concept.expectedRevision !== undefined && dag.retouren.some(r => r.retourId === concept.retourId && r.revision !== concept.expectedRevision) &&
              <Text accessibilityRole="alert" style={[tekst.sub, { color: kleuren.warning }]}>Een collega heeft deze melding gewijzigd. Sluit je correctie en open de nieuwste melding.</Text>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {RETOUR_KEUZES.map(([keuze, label]) => <Button key={keuze} title={label} size="sm" variant={concept.keuze === keuze ? 'secondary' : 'outline'} geselecteerd={concept.keuze === keuze} disabled={bezig} onPress={() => setConcept({ ...concept, keuze })} />)}
            </View>
            {concept.keuze && concept.keuze !== 'geen_aanhanger' && <View style={{ gap: 8 }}>
              <Text style={veldLabel}>Welke aanhanger?</Text>
              {dag.aanhangers.length === 0 && <Melding toon="wachten" tekst="Er is geen aanhanger beschikbaar. Laat kantoor de aanhanger toevoegen aan het wagenpark." />}
              {dag.aanhangers.map(a => {
                const gekozen = concept.voertuigId === a._id;
                return <Pressable key={a._id} disabled={bezig} accessibilityRole="radio" accessibilityState={{ checked: gekozen, disabled: bezig }} onPress={() => setConcept({ ...concept, voertuigId: a._id })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: gekozen ? kleuren.primary : kleuren.randSterk, backgroundColor: gekozen ? kleuren.primarySoft : kleuren.card, opacity: pressed ? 0.7 : 1 })}>
                  <Text style={[tekst.callout, { color: kleuren.foreground, flex: 1 }]}>{a.naam} · {a.kenteken}</Text>
                  {gekozen && <Check size={18} color={kleuren.primary} strokeWidth={2.25} />}
                </Pressable>;
              })}
            </View>}
            <View style={{ gap: 6 }}>
              <Text style={veldLabel}>Tijd van terugkomst</Text>
              <TextInput accessibilityLabel="Tijd van terugkomst (Nederlandse tijd)" placeholder="16:30" placeholderTextColor={kleuren.mutedForeground} value={concept.tijd} maxLength={5} editable={!bezig} onChangeText={tijd => setConcept({ ...concept, tijd })} style={[tekstveld, { fontVariant: ['tabular-nums'] }]} keyboardType="numbers-and-punctuation" />
            </View>
            <TextInput maxLength={1000} accessibilityLabel="Toelichting retourmelding" placeholder="Toelichting (optioneel)" placeholderTextColor={kleuren.mutedForeground} value={concept.notitie} editable={!bezig} onChangeText={notitie => setConcept({ ...concept, notitie })} style={tekstveld} multiline />
            {concept.expectedRevision !== undefined && <TextInput maxLength={1000} accessibilityLabel="Reden voor correctie" placeholder="Reden voor correctie" placeholderTextColor={kleuren.mutedForeground} value={concept.correctieReden} editable={!bezig} onChangeText={correctieReden => setConcept({ ...concept, correctieReden })} style={tekstveld} multiline />}
            {fout && <Text accessibilityRole="alert" style={[tekst.sub, { color: kleuren.danger }]}>{fout}</Text>}
            <Button title="Retour opslaan" onPress={opslaan} loading={bezig} disabled={!concept.keuze} fullWidth />
            <Button title="Annuleren" variant="ghost" disabled={bezig} onPress={() => { setConcept(null); setFout(null); }} fullWidth />
          </View>}
        </>}
      </Kaart>
    </View>
  );
}
