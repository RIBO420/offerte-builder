import React, { Fragment, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Check, UserPlus, UserX, WifiOff } from 'lucide-react-native';
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
import { Drukvlak, Kaart, LegeStaat, Melding, PeriodeKiezer, SectieKop, StatusPil } from '../../components/werk/Bouwstenen';
import { vandaagAmsterdam, schuifDag } from '../../lib/werk-periode';
import { korteDatum, weekdagNaam } from '../../lib/datum-labels';
import { tekst } from '../../theme';
import { CATEGORIE_LABELS, isGeldigTijdvak, type SegmentCategorie, type VeldSegment } from '../../types/veld';
import type { WerkbezoekDagData } from '../../components/veld/WerkbezoekDag';

interface Persoon { _id: Id<'medewerkers'>; naam: string; herkomstPlatform: string | null }
interface KrachtDag { medewerker: Persoon; segmenten: VeldSegment[]; revisie: number; status: string }
export default function LosseKrachten() { return <VeldScherm titel="Losse krachten"><BevoegdeInhoud /></VeldScherm>; }
function BevoegdeInhoud() {
  const { role } = useCurrentUser();
  return role === 'voorman' || isKantoorRole(role) ? <KrachtenInhoud /> : <LegeStaat icoon={UserX} titel="Geen toegang" uitleg="Alleen de voorman en kantoor kunnen uren van losse krachten invullen." />;
}

/** Keuzeregel in een groepslijst: iOS-vinkje rechts, rij licht op bij indrukken. */
function KeuzeRegel({ gekozen, onPress, disabled, label, titel, sub }: { gekozen: boolean; onPress: () => void; disabled?: boolean; label?: string; titel: string; sub?: string | null }) {
  const { kleuren } = useBuitenModus();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: gekozen, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: pressed ? kleuren.muted : 'transparent', opacity: disabled ? 0.45 : 1 })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[tekst.body, { color: kleuren.foreground, fontWeight: gekozen ? '600' : '400' }]} numberOfLines={2}>{titel}</Text>
        {!!sub && <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14 }]} numberOfLines={1}>{sub}</Text>}
      </View>
      {gekozen && <Check size={20} color={kleuren.primary} strokeWidth={2.5} />}
    </Pressable>
  );
}

function Groep({ children }: { children: ReactNode[] }) {
  const { kleuren } = useBuitenModus();
  return (
    <Kaart padding={0} style={{ gap: 0, overflow: 'hidden' }}>
      {children.map((kind, i) => <Fragment key={i}>{i > 0 && <View style={{ height: 1, backgroundColor: kleuren.border, marginLeft: 16 }} />}{kind}</Fragment>)}
    </Kaart>
  );
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
  const veld = { color: kleuren.foreground, backgroundColor: kleuren.muted, borderRadius: 12, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 };
  const label = (t: string) => <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontWeight: '600', fontSize: 14 }]}>{t}</Text>;
  const vandaag = vandaagAmsterdam();

  return <>
    {!online && <Melding tekst="Verbind met internet om personen of hun uren op te slaan." toon="wachten" icoon={WifiOff} />}
    <Text style={[tekst.sub, { color: kleuren.mutedForeground, paddingHorizontal: 4 }]}>Registreer uren voor krachten zonder eigen account. Jij blijft zichtbaar als degene die de uren invult.</Text>

    <View style={{ gap: 8 }}>
      <SectieKop titel="Wie" telling={personen?.length} />
      {!personen ? <Kaart variant="stil"><Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Losse krachten laden…</Text></Kaart> : (
        <Groep>
          {[
            ...personen.map(p => <KeuzeRegel key={p._id} gekozen={p._id === persoonId} disabled={bezig} label={p.naam} titel={p.naam} sub={p.herkomstPlatform} onPress={() => { setPersoonId(p._id); setFout(null); }} />),
            <Drukvlak key="nieuw" onPress={() => setNieuw(!nieuw)} disabled={bezig} haptic="selection" accessibilityLabel="Losse kracht toevoegen" accessibilityState={{ expanded: nieuw }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 16 }}>
              <UserPlus size={20} color={kleuren.primary} strokeWidth={2} />
              <Text style={[tekst.body, { color: kleuren.primary, fontWeight: '600' }]}>Losse kracht toevoegen</Text>
            </Drukvlak>,
          ]}
        </Groep>
      )}
      {nieuw && <Kaart>
        <TextInput accessibilityLabel="Naam losse kracht" value={naam} onChangeText={setNaam} maxLength={150} placeholder="Naam" placeholderTextColor={kleuren.mutedForeground} style={veld} />
        <TextInput accessibilityLabel="Herkomst of bureau" value={herkomst} onChangeText={setHerkomst} maxLength={150} placeholder="Herkomst of bureau (optioneel)" placeholderTextColor={kleuren.mutedForeground} style={veld} />
        <Button title="Persoon opslaan" variant="secondary" fullWidth onPress={toevoegen} loading={bezig} disabled={!naam.trim()} />
      </Kaart>}
    </View>

    <PeriodeKiezer
      titel={weekdagNaam(datum)}
      ondertitel={korteDatum(datum)}
      vorigeLabel="Vorige dag"
      volgendeLabel="Volgende dag"
      onVorige={() => { if (!bezig) setDatum(schuifDag(datum, -1)); }}
      onVolgende={() => { if (!bezig) setDatum(schuifDag(datum, 1)); }}
      onVandaag={datum === vandaag || bezig ? undefined : () => setDatum(vandaag)}
    />

    {persoonId && (!dag ? <Kaart variant="stil"><Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Dag laden…</Text></Kaart> : <>
      <Kaart>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Text accessibilityRole="header" style={[tekst.titel3, { color: kleuren.foreground, flexShrink: 1 }]} numberOfLines={2}>{dag.medewerker.naam}</Text>
          <StatusPil label={dag.status === 'ingediend' ? 'Ingediend' : 'Open'} toon={dag.status === 'ingediend' ? 'succes' : 'neutraal'} />
        </View>
        {dag.segmenten.length > 0 ? <View>
          {dag.segmenten.map((s, i) => <View key={s._id} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: kleuren.border }}>
            <Text style={[tekst.sub, tekst.cijfers, { color: kleuren.foreground, fontWeight: '600' }]}>{s.beginTijd}–{s.eindTijd}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[tekst.sub, { color: kleuren.foreground }]}>{CATEGORIE_LABELS[s.categorie]}</Text>
              {!!s.notitie && <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14 }]}>{s.notitie}</Text>}
            </View>
          </View>)}
        </View> : <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Nog geen uren op deze dag.</Text>}
      </Kaart>

      {dag.status !== 'ingediend' && <View style={{ gap: 8 }}>
        <SectieKop titel="Uren toevoegen" />
        <Kaart style={{ gap: 14 }}>
          <View style={{ gap: 8 }}>
            {label('Soort')}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(CATEGORIE_LABELS).map(([key, l]) => {
                const actief = categorie === key;
                return (
                  <Drukvlak key={key} onPress={() => { setCategorie(key as SegmentCategorie); setWerksoort(undefined); }} disabled={bezig} haptic="selection" accessibilityLabel={l} accessibilityState={{ selected: actief }}
                    style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 22, justifyContent: 'center', backgroundColor: actief ? kleuren.primarySoft : kleuren.muted }}>
                    <Text style={[tekst.sub, { color: actief ? kleuren.primary : kleuren.foreground, fontWeight: actief ? '700' : '500' }]}>{l}</Text>
                  </Drukvlak>
                );
              })}
            </View>
          </View>
          {categorie === 'anders' && <WerksoortKeuze waarde={werksoort} wijzigen={setWerksoort} disabled={bezig} />}

          <View style={{ gap: 8 }}>
            {label(`Klus ${categorie === 'werken' ? '(verplicht)' : '(optioneel)'}`)}
            {klussen.length ? (
              <View style={{ borderRadius: 14, borderWidth: 1, borderColor: kleuren.border, overflow: 'hidden' }}>
                {klussen.map((k, i) => <Fragment key={k._id}>
                  {i > 0 && <View style={{ height: 1, backgroundColor: kleuren.border, marginLeft: 16 }} />}
                  <KeuzeRegel gekozen={werkitemId === k._id} disabled={bezig} titel={k.naam} onPress={() => setWerkitemId(werkitemId === k._id ? null : k._id)} />
                </Fragment>)}
              </View>
            ) : <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Er zijn geen klussen beschikbaar op deze dag. Laat kantoor de planning controleren.</Text>}
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, gap: 6 }}>
              {label('Begin')}
              <TextInput accessibilityLabel="Begin uren losse kracht" value={begin} onChangeText={setBegin} maxLength={5} editable={!bezig} style={[veld, tekst.cijfers]} keyboardType="numbers-and-punctuation" />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              {label('Einde')}
              <TextInput accessibilityLabel="Einde uren losse kracht" value={eind} onChangeText={setEind} maxLength={5} editable={!bezig} style={[veld, tekst.cijfers]} keyboardType="numbers-and-punctuation" />
            </View>
          </View>
          <TextInput accessibilityLabel="Notitie uren losse kracht" value={notitie} onChangeText={setNotitie} editable={!bezig} placeholder="Notitie (optioneel)" placeholderTextColor={kleuren.mutedForeground} style={veld} />
          <Button title="Uren voor deze persoon opslaan" size="lg" fullWidth loading={bezig} disabled={!online} onPress={opslaan} />
        </Kaart>
      </View>}
    </>)}
    {fout && <Melding tekst={fout} toon="gemist" />}
  </>;
}
