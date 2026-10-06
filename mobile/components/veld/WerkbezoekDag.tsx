import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useVeldServerActie } from '../../hooks/use-veld-server-actie';
import type { Id } from '../../convex/_generated/dataModel';
import { useVeldOpdracht } from '../../hooks/use-veld-opdracht';
import { useCurrentUser } from '../../hooks/use-current-user';
import { Button } from '../ui';
import { Kaart, Melding, Scheiding, StatusPil } from '../werk/Bouwstenen';
import { tekst } from '../../theme';
import { BezoekFotoActies } from './BezoekFotoActies';
import { useVeldKleuren } from './BuitenModus';
import { AFVOER, type AfvoerKeuze } from '../../lib/afvoer-keuzes';

export type Onderdeel = 'foto' | 'afronding' | 'aanhanger' | 'afvoer';
export const LABELS: Record<Onderdeel, string> = { foto: 'Foto', afronding: 'Werk terugmelden', aanhanger: 'Aanhanger', afvoer: 'Afval meegenomen' };
export interface Bezoek {
  werkitemId: Id<'projecten'>; bezoekSleutel: string; naam: string; klantNaam: string | null; instructie?: string | null;
  afronding: { afgerond: boolean; reden?: string; resterendMinuten?: number; revision: number; doorNaam: string } | null;
  afvoer?: { keuze: AfvoerKeuze; revision: number; doorNaam: string } | null;
  fotos: { magVerwijderen?: boolean; id: Id<'werkbezoekFotos'>; fase: 'voor' | 'na'; url: string | null; doorNaam: string }[];
  delegaties: { _id: Id<'werkbezoekDelegaties'>; onderdeel: Onderdeel; medewerkerId: string; doorNaam: string }[];
  ontbreekt: Onderdeel[]; verplicht: boolean; gereed: boolean; gedeeldGereed: boolean;
}
export interface WerkbezoekDagData { bezoeken: Bezoek[]; gereed: boolean }

/**
 * Bezoekmelding van één klus: terugmelden, afval, foto's en overdragen.
 * `ingebed` = binnen het klusscherm; dan staan klantnaam en instructie al
 * bovenaan en heet de kaart "Voor je vertrekt".
 */
export function BezoekKaart({ bezoek, datum, ingebed = false }: { bezoek: Bezoek; datum: string; ingebed?: boolean }) {
  const kleuren = useVeldKleuren(); const { linkedMedewerkerId } = useCurrentUser();
  const { verstuur, wachtrij } = useVeldOpdracht();
  const { voerUit } = useVeldServerActie();
  const [form, setForm] = useState<{ afgerond: boolean; reden: string; minuten: string; revision?: number } | null>(null);
  const [bezig, setBezig] = useState(false); const [melding, setMelding] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const pending = wachtrij.some(r => r.payload.werkitemId === bezoek.werkitemId && r.payload.datum === datum);
  const opslaan = async () => {
    if (!form || bezig) return;
    if (!form.afgerond && !form.reden.trim()) { setFout('Vertel waarom het werk nog niet af is.'); return; }
    const aantal = form.minuten.trim() ? Number(form.minuten) : undefined;
    if (aantal !== undefined && (!Number.isInteger(aantal) || aantal < 0)) { setFout('Vul resterende tijd in als een heel aantal minuten.'); return; }
    setBezig(true); setFout(null);
    try {
      const resultaat = await verstuur('afronding', { werkitemId: bezoek.werkitemId, datum, afgerond: form.afgerond,
        ...(form.revision !== undefined ? { expectedRevision: form.revision } : {}),
        ...(!form.afgerond ? { reden: form.reden.trim(), ...(aantal !== undefined ? { resterendMinuten: aantal } : {}) } : {}),
      });
      if (resultaat.status === 'conflict') setFout(resultaat.fout ?? 'Controleer de wachtende invoer.');
      else { setForm(null); setMelding(resultaat.status === 'wacht' ? 'Op dit toestel bewaard; wacht op bevestiging.' : 'Je bezoekmelding is opgeslagen.'); }
    } catch (error) { setFout(error instanceof Error ? error.message : 'Opslaan mislukt.'); }
    finally { setBezig(false); }
  };
  const delegeer = async (onderdeel: Onderdeel) => {
    setBezig(true); setFout(null);
    try {
      const result = await verstuur('delegatie', { werkitemId: bezoek.werkitemId, datum, onderdeel });
      if (result.status === 'conflict') setFout(result.fout ?? 'Overdragen is niet gelukt.');
      else setMelding(result.status === 'wacht' ? 'Overdracht bewaard op dit toestel; wacht op bevestiging.' : 'Overgelaten aan een collega. Het ontbrekende antwoord blijft zichtbaar voor je ploeg.');
    } catch (error) { setFout(error instanceof Error ? error.message : 'Overdragen mislukt.'); }
    finally { setBezig(false); }
  };
  const intrekkenDelegatie = async (id: Id<'werkbezoekDelegaties'>) => {
    try { await voerUit('werkbezoek:trekDelegatieIn', { id }); } catch (error) { setFout(error instanceof Error ? error.message : 'Intrekken mislukt.'); }
  };
  const veld = { color: kleuren.foreground, backgroundColor: kleuren.input, borderWidth: 1, borderColor: kleuren.border, borderRadius: 12, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17 };
  return <Kaart style={{ gap: 14 }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
      <Text accessibilityRole="header" style={[tekst.titel3, { color: kleuren.foreground, flex: 1 }]} numberOfLines={2}>{ingebed ? 'Voor je vertrekt' : bezoek.klantNaam ?? bezoek.naam}</Text>
      <StatusPil label={bezoek.gedeeldGereed ? 'Compleet' : 'Open'} toon={bezoek.gedeeldGereed ? 'succes' : 'wachten'} />
    </View>
    {!ingebed && bezoek.instructie && (
      <View style={{ backgroundColor: kleuren.muted, borderRadius: 14, padding: 12, gap: 4 }}>
        <Text style={[tekst.bijschrift, { color: kleuren.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Instructie</Text>
        <Text style={[tekst.callout, { color: kleuren.foreground }]}>{bezoek.instructie}</Text>
      </View>
    )}
    <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>{bezoek.gedeeldGereed ? 'Bezoekmelding compleet' : `Nog nodig: ${bezoek.ontbreekt.map(o => LABELS[o]).join(', ')}`}</Text>
    {bezoek.afronding && <View style={{ gap: 4 }}>
      <Text style={[tekst.callout, { color: kleuren.foreground, fontWeight: '600' }]}>{bezoek.afronding.afgerond ? 'Werk van dit bezoek is af' : 'Werk is nog niet af'} <Text style={{ color: kleuren.mutedForeground, fontWeight: '400' }}>· {bezoek.afronding.doorNaam}</Text></Text>
      {bezoek.afronding.reden && <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>{bezoek.afronding.reden}</Text>}
      {bezoek.afronding.resterendMinuten !== undefined && <Text style={[tekst.sub, tekst.cijfers, { color: kleuren.mutedForeground }]}>Nog ongeveer {bezoek.afronding.resterendMinuten} minuten werk</Text>}
    </View>}
    {!form && <Button title={bezoek.afronding ? 'Bezoekmelding aanpassen' : 'Werk terugmelden'} variant={bezoek.afronding ? 'outline' : 'primary'} disabled={pending} onPress={() => { setForm({ afgerond: bezoek.afronding?.afgerond ?? true, reden: bezoek.afronding?.reden ?? '', minuten: bezoek.afronding?.resterendMinuten?.toString() ?? '', revision: bezoek.afronding?.revision }); setFout(null); }} fullWidth />}
    {form && <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><Button title="Werk is af" variant={form.afgerond ? 'secondary' : 'outline'} geselecteerd={form.afgerond} disabled={bezig} onPress={() => setForm({ ...form, afgerond: true })} fullWidth /></View><View style={{ flex: 1 }}><Button title="Nog niet af" variant={!form.afgerond ? 'secondary' : 'outline'} geselecteerd={!form.afgerond} disabled={bezig} onPress={() => setForm({ ...form, afgerond: false })} fullWidth /></View></View>
      {!form.afgerond && <><TextInput accessibilityLabel="Waarom is het werk nog niet af?" value={form.reden} editable={!bezig} maxLength={2000} onChangeText={reden => setForm({ ...form, reden })} placeholder="Waarom is het werk nog niet af?" placeholderTextColor={kleuren.mutedForeground} style={veld} multiline /><TextInput accessibilityLabel="Resterende minuten (optioneel)" value={form.minuten} editable={!bezig} onChangeText={minuten => setForm({ ...form, minuten })} placeholder="Resterende minuten (optioneel)" placeholderTextColor={kleuren.mutedForeground} keyboardType="number-pad" style={veld} /></>}
      <Button title="Bezoekmelding opslaan" onPress={opslaan} loading={bezig} fullWidth />
      <Button title="Annuleren" variant="ghost" disabled={bezig} onPress={() => setForm(null)} />
    </View>}
    <Scheiding />
    <AfvoerMelding bezoek={bezoek} datum={datum} />
    <Scheiding />
    <BezoekFotoActies werkitemId={bezoek.werkitemId} datum={datum} fotos={bezoek.fotos} naam={bezoek.klantNaam ?? bezoek.naam} />
    {bezoek.ontbreekt.length > 0 && <Scheiding />}
    {bezoek.ontbreekt.map(onderdeel => {
      const eigenDelegatie = bezoek.delegaties.find(d => d.onderdeel === onderdeel && d.medewerkerId === linkedMedewerkerId);
      return <View key={onderdeel} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><Text style={[tekst.sub, { color: kleuren.mutedForeground, flexShrink: 1 }]}><Text style={{ color: kleuren.foreground, fontWeight: '600' }}>{LABELS[onderdeel]}</Text>: {eigenDelegatie ? 'aan collega overgelaten; antwoord ontbreekt nog' : 'nog niet ingevuld'}</Text>{eigenDelegatie ? <Button title="Zelf weer oppakken" variant="ghost" size="sm" disabled={bezig} onPress={() => intrekkenDelegatie(eigenDelegatie._id)} /> : <Button title={`${LABELS[onderdeel]} door collega`} variant="ghost" size="sm" disabled={bezig || pending} onPress={() => delegeer(onderdeel)} />}</View>;
    })}
    {melding && <View accessibilityLiveRegion="polite"><Melding toon="succes" tekst={melding} /></View>}{fout && <Melding toon="gemist" tekst={fout} />}
  </Kaart>;
}

function AfvoerMelding({ bezoek, datum }: { bezoek: Bezoek; datum: string }) {
  const kleuren = useVeldKleuren(); const { verstuur, wachtrij } = useVeldOpdracht();
  const pending = wachtrij.find(r => r.type === 'afvoer' && r.payload.werkitemId === bezoek.werkitemId && r.payload.datum === datum);
  const [bezig, setBezig] = useState(false); const [melding, setMelding] = useState<string | null>(null);
  const opslaan = async (keuze: AfvoerKeuze) => {
    if (bezig || pending) return;
    setBezig(true);
    try {
      const result = await verstuur('afvoer', { werkitemId: bezoek.werkitemId, datum, keuze, ...(bezoek.afvoer ? { expectedRevision: bezoek.afvoer.revision } : {}) });
      setMelding(result.status === 'conflict' ? result.fout ?? 'Controleer de wachtende invoer.' : result.status === 'wacht' ? 'Bewaard op dit toestel; wacht op bevestiging.' : 'Afvalmelding opgeslagen.');
    } catch (error) { setMelding(error instanceof Error ? error.message : 'Opslaan mislukt.'); }
    finally { setBezig(false); }
  };
  return <View style={{ gap: 10 }}>
    <View style={{ gap: 2 }}>
      <Text style={[tekst.kop, { color: kleuren.foreground }]}>Afval meegenomen bij deze klus</Text>
      {bezoek.afvoer && <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14 }]}>{AFVOER.find(([key]) => key === bezoek.afvoer?.keuze)?.[1]} · {bezoek.afvoer.doorNaam}</Text>}
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{AFVOER.map(([keuze, label]) => <Button key={keuze} title={label} size="sm" variant={bezoek.afvoer?.keuze === keuze ? 'secondary' : 'outline'} geselecteerd={bezoek.afvoer?.keuze === keuze} disabled={bezig || !!pending} onPress={() => opslaan(keuze)} />)}</View>
    {pending && <Melding toon="wachten" tekst={`Wachtende afvalmelding: ${AFVOER.find(([key]) => key === pending.payload.keuze)?.[1] ?? 'controleer wachtrij'}. Nog niet bevestigd; eerst synchroniseren.`} />}
    {melding && <Text accessibilityLiveRegion="polite" style={[tekst.sub, { color: kleuren.foreground }]}>{melding}</Text>}
  </View>;
}
