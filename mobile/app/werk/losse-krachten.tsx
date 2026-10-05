import React, { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useQuery } from 'convex/react';
import { useVeldServerActie } from '../../hooks/use-veld-server-actie';
import { WerksoortKeuze, type Werksoort } from '../../components/veld/WerksoortKeuze';
import * as Crypto from 'expo-crypto';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { VeldScherm } from '../../components/veld/VeldScherm';
import { useBuitenModus } from '../../components/veld/BuitenModus';
import { useCurrentUser } from '../../hooks/use-current-user';
import { isKantoorRole } from '../../lib/roles';
import { Button } from '../../components/ui';
import { vandaagAmsterdam, schuifDag } from '../../lib/werk-periode';
import { CATEGORIE_LABELS, isGeldigTijdvak, type SegmentCategorie, type VeldSegment } from '../../types/veld';
import type { WerkbezoekDagData } from '../../components/veld/WerkbezoekDag';

interface Persoon { _id: Id<'medewerkers'>; naam: string; herkomstPlatform: string | null }
interface KrachtDag { medewerker: Persoon; segmenten: VeldSegment[]; revisie: number; status: string }
export default function LosseKrachten() { return <VeldScherm titel="Losse krachten"><BevoegdeInhoud /></VeldScherm>; }
function BevoegdeInhoud() {
  const { role } = useCurrentUser(); const { kleuren } = useBuitenModus();
  return role === 'voorman' || isKantoorRole(role) ? <KrachtenInhoud /> : <Text style={{ color: kleuren.foreground }}>Alleen de voorman en kantoor kunnen uren van losse krachten invullen.</Text>;
}
function KrachtenInhoud() {
  const { kleuren } = useBuitenModus(); const { role } = useCurrentUser();
  const [datum, setDatum] = useState(vandaagAmsterdam); const [persoonId, setPersoonId] = useState<Id<'medewerkers'> | null>(null);
  const personen = useQuery(api.losseKrachten.mijnLosseKrachten, {}) as Persoon[] | undefined;
  const dag = useQuery(api.losseKrachten.getLosseKrachtDag, persoonId ? { medewerkerId: persoonId, datum } : 'skip') as KrachtDag | undefined;
  const bezoeken = useQuery(api.werkbezoek.getVoorDag, { datum }) as WerkbezoekDagData | undefined;
  const kantoorItems = useQuery(api.werkitems.listVoorPlanbord, isKantoorRole(role) ? { start: datum, eind: datum } : 'skip') as { _id: Id<'projecten'>; naam: string }[] | undefined;
  const klussen = isKantoorRole(role) ? kantoorItems ?? [] : (bezoeken?.bezoeken ?? []).map(b => ({ _id: b.werkitemId, naam: b.klantNaam ? `${b.klantNaam} · ${b.naam}` : b.naam }));
  const { voerUit, online } = useVeldServerActie();
  const [werksoort, setWerksoort] = useState<Werksoort | undefined>();
  const [nieuw, setNieuw] = useState(false); const [naam, setNaam] = useState(''); const [herkomst, setHerkomst] = useState('');
  const [categorie, setCategorie] = useState<SegmentCategorie>('werken'); const [begin, setBegin] = useState('07:00'); const [eind, setEind] = useState('08:00');
  const [werkitemId, setWerkitemId] = useState<Id<'projecten'> | null>(null); const [notitie, setNotitie] = useState('');
  const [bezig, setBezig] = useState(false); const [fout, setFout] = useState<string | null>(null);
  const poging = useRef<{ payload: string; sleutel: string } | null>(null);
  const sleutelVoor = (payload: object) => { const serialized = JSON.stringify(payload); if (poging.current?.payload !== serialized) poging.current = { payload: serialized, sleutel: Crypto.randomUUID() }; return poging.current.sleutel; };
  const toevoegen = async () => {
    if (!naam.trim() || bezig) return;
    const payload = { naam: naam.trim(), ...(herkomst.trim() ? { herkomstPlatform: herkomst.trim() } : {}) };
    setBezig(true); setFout(null);
    try { const id = await voerUit('losseKrachten:maakLosseKracht', { ...payload, sleutel: sleutelVoor(payload) }) as Id<'medewerkers'>; setPersoonId(id); setNieuw(false); setNaam(''); setHerkomst(''); poging.current = null; }
    catch (error) { setFout(error instanceof Error ? error.message : 'Persoon toevoegen mislukt.'); }
    finally { setBezig(false); }
  };
  const opslaan = async () => {
    if (!persoonId || !dag || bezig) return;
    if (!isGeldigTijdvak(begin, eind)) { setFout('Vul geldige begin- en eindtijden in (HH:MM).'); return; }
    if (categorie === 'werken' && !werkitemId) { setFout('Kies de klus voor deze werkuren.'); return; }
    const payload = { medewerkerId: persoonId, datum, categorie, beginTijd: begin, eindTijd: eind, verwachteRevisie: dag.revisie,
      ...(werkitemId ? { werkitemId } : {}), ...(categorie === 'anders' && werksoort ? { werksoort } : {}), ...(notitie.trim() ? { notitie: notitie.trim() } : {}),
    };
    setBezig(true); setFout(null);
    try { await voerUit('losseKrachten:logUrenVoorLosseKracht', { ...payload, sleutel: sleutelVoor(payload) }); poging.current = null; setNotitie(''); }
    catch (error) { setFout(error instanceof Error ? error.message : 'Uren opslaan mislukt.'); }
    finally { setBezig(false); }
  };
  const veld = { color: kleuren.foreground, borderWidth: 1, borderColor: kleuren.border, borderRadius: 10, minHeight: 48, padding: 12, fontSize: 16 };
  return <>
    {!online && <Text style={{ color: kleuren.mutedForeground }}>Verbind met internet om personen of hun uren op te slaan.</Text>}
    <Text style={{ color: kleuren.mutedForeground }}>Registreer uren voor krachten zonder eigen account. Jij blijft zichtbaar als degene die de uren invult.</Text>
    {!personen ? <Text style={{ color: kleuren.mutedForeground }}>Losse krachten laden…</Text> : personen.map(p => <Pressable key={p._id} accessibilityRole="radio" accessibilityLabel={p.naam} accessibilityState={{ checked: p._id === persoonId }} disabled={bezig} onPress={() => { setPersoonId(p._id); setFout(null); }} style={{ ...veld, borderColor: p._id === persoonId ? kleuren.primary : kleuren.border }}><Text style={{ color: kleuren.foreground }}>{p.naam}{p.herkomstPlatform ? ` · ${p.herkomstPlatform}` : ''}</Text></Pressable>)}
    <Button title="Losse kracht toevoegen" variant="outline" disabled={bezig} onPress={() => setNieuw(!nieuw)} />
    {nieuw && <View style={{ gap: 10 }}><TextInput accessibilityLabel="Naam losse kracht" value={naam} onChangeText={setNaam} maxLength={150} placeholder="Naam" placeholderTextColor={kleuren.mutedForeground} style={veld} /><TextInput accessibilityLabel="Herkomst of bureau" value={herkomst} onChangeText={setHerkomst} maxLength={150} placeholder="Herkomst of bureau (optioneel)" placeholderTextColor={kleuren.mutedForeground} style={veld} /><Button title="Persoon opslaan" variant="outline" onPress={toevoegen} loading={bezig} disabled={!naam.trim()} /></View>}
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Button title="Vorige dag" variant="ghost" disabled={bezig} onPress={() => setDatum(schuifDag(datum, -1))} /><Button title="Volgende dag" variant="ghost" disabled={bezig} onPress={() => setDatum(schuifDag(datum, 1))} /></View>
    <Text style={{ color: kleuren.foreground }}>{datum}</Text>
    {persoonId && (!dag ? <Text style={{ color: kleuren.mutedForeground }}>Dag laden…</Text> : <>
      <Text accessibilityRole="header" style={{ color: kleuren.foreground, fontSize: 17, fontWeight: '600' }}>{dag.medewerker.naam} · {dag.status === 'ingediend' ? 'Ingediend' : 'Open'}</Text>
      {dag.segmenten.map(s => <Text key={s._id} style={{ color: kleuren.foreground }}>{s.beginTijd}–{s.eindTijd} · {CATEGORIE_LABELS[s.categorie]}{s.notitie ? ` · ${s.notitie}` : ''}</Text>)}
      {dag.status !== 'ingediend' && <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{Object.entries(CATEGORIE_LABELS).map(([key, label]) => <Button key={key} title={label} variant={categorie === key ? 'secondary' : 'ghost'} disabled={bezig} onPress={() => { setCategorie(key as SegmentCategorie); setWerksoort(undefined); }} />)}</View>
        {categorie === 'anders' && <WerksoortKeuze waarde={werksoort} wijzigen={setWerksoort} disabled={bezig} />}
        <Text style={{ color: kleuren.mutedForeground }}>Klus {categorie === 'werken' ? '(verplicht)' : '(optioneel)'}</Text>
        {klussen.map(k => <Pressable key={k._id} disabled={bezig} accessibilityRole="radio" accessibilityState={{ checked: werkitemId === k._id }} onPress={() => setWerkitemId(werkitemId === k._id ? null : k._id)} style={{ ...veld, borderColor: werkitemId === k._id ? kleuren.primary : kleuren.border }}><Text style={{ color: kleuren.foreground }}>{k.naam}</Text></Pressable>)}
        {!klussen.length && <Text style={{ color: kleuren.mutedForeground }}>Er zijn geen klussen beschikbaar op deze dag. Laat kantoor de planning controleren.</Text>}
        <View style={{ flexDirection: 'row', gap: 8 }}><TextInput accessibilityLabel="Begin uren losse kracht" value={begin} onChangeText={setBegin} maxLength={5} editable={!bezig} style={{ ...veld, flex: 1 }} keyboardType="numbers-and-punctuation" /><TextInput accessibilityLabel="Einde uren losse kracht" value={eind} onChangeText={setEind} maxLength={5} editable={!bezig} style={{ ...veld, flex: 1 }} keyboardType="numbers-and-punctuation" /></View>
        <TextInput accessibilityLabel="Notitie uren losse kracht" value={notitie} onChangeText={setNotitie} editable={!bezig} placeholder="Notitie (optioneel)" placeholderTextColor={kleuren.mutedForeground} style={veld} />
        <Button title="Uren voor deze persoon opslaan" variant="outline" loading={bezig} disabled={!online} onPress={opslaan} />
      </View>}
    </>)}
    {fout && <Text accessibilityRole="alert" style={{ color: kleuren.foreground }}>{fout}</Text>}
  </>;
}
