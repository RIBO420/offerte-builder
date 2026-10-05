import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/clerk-expo';
import { wijzigVoorstelTijd, splitsVoorPauze, tijdMinuten, minutenTijd } from '../../lib/dagvoorstel-tijden';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useVeldOpdracht } from '../../hooks/use-veld-opdracht';
import * as Crypto from 'expo-crypto';
import { SlidersHorizontal } from 'lucide-react-native';
import { Button, Checkbox } from '../ui';
import { Kaart, Scheiding } from '../werk/Bouwstenen';
import { tekst } from '../../theme';
import { WerksoortKeuze, type Werksoort } from './WerksoortKeuze';
import { KlusKiezer } from './KlusKiezer';
import { useVeldKleuren } from './BuitenModus';
import { CATEGORIE_LABELS, isGeldigTijdvak, type SegmentCategorie, type VeldDagData } from '../../types/veld';

interface Regel {
  werksoort?: Werksoort; categorie: SegmentCategorie; beginTijd: string; eindTijd: string; werkitemId?: string;
  geplandeBeginTijd?: string; geplandeEindTijd?: string; notitie: string;
  afwijkingReden: string; afwijkingOvergeslagen: boolean;
}
const minuten = (tijd: string) => Number(tijd.slice(0, 2)) * 60 + Number(tijd.slice(3));
const tijd = (waarde: number) => `${Math.floor(waarde / 60).toString().padStart(2, '0')}:${(waarde % 60).toString().padStart(2, '0')}`;

/** Bewerk uitsluitend nog niet bevestigde voorstellen; één atomaire opslag. */
export function DagvoorstelEditor({ dag, datum }: { dag: VeldDagData; datum: string }) {
  const kleuren = useVeldKleuren(); const { verstuur } = useVeldOpdracht();
  const { userId, orgId } = useAuth();
  const conceptSleutel = userId && orgId ? `toptuinen:dagconcept:v1:${orgId}:${userId}:${datum}` : null;
  const schrijfKeten = useRef(Promise.resolve());
  const [conceptEigenaar, setConceptEigenaar] = useState(conceptSleutel);
  const [pauzeForm, setPauzeForm] = useState<{ index: number; begin: string; duur: string } | null>(null);
  const [regels, setRegels] = useState<Regel[] | null>(null);
  const [revisie, setRevisie] = useState(0); const [schuifMee, setSchuifMee] = useState(true);
  const [bezig, setBezig] = useState(false); const [fout, setFout] = useState<string | null>(null);
  const poging = useRef<{ payload: string; sleutel: string } | null>(null);
  const actief = useRef(false);
  if (conceptEigenaar !== conceptSleutel) { setConceptEigenaar(conceptSleutel); setRegels(null); setPauzeForm(null); setFout(null); }
  const schrijfConcept = useCallback((inhoud: string | null) => {
    if (!conceptSleutel) return Promise.resolve();
    schrijfKeten.current = schrijfKeten.current.catch(() => undefined).then(() => inhoud === null ? AsyncStorage.removeItem(conceptSleutel) : AsyncStorage.setItem(conceptSleutel, inhoud));
    return schrijfKeten.current;
  }, [conceptSleutel]);
  useEffect(() => {
    if (!regels || conceptEigenaar !== conceptSleutel) return;
    void schrijfConcept(JSON.stringify({ revisie, regels })).catch(() => setFout('Je concept kon niet op dit toestel worden bewaard. Houd het scherm open en probeer opnieuw.'));
  }, [regels, revisie, schrijfConcept, conceptEigenaar, conceptSleutel]);
  const openen = async () => {
    if (bezig) return;
    setBezig(true); setFout(null); poging.current = null;
    try {
      const tekst = conceptSleutel ? await AsyncStorage.getItem(conceptSleutel) : null;
      if (tekst) {
        const concept = JSON.parse(tekst);
        if (!Array.isArray(concept.regels) || !Number.isInteger(concept.revisie) || concept.regels.some((r: Regel) => !r || typeof r.beginTijd !== 'string' || typeof r.eindTijd !== 'string' || !(r.categorie in CATEGORIE_LABELS))) throw new Error('Het opgeslagen concept kan niet worden gelezen. Wis geen appgegevens; vraag kantoor om hulp.');
        setRegels(concept.regels); setRevisie(concept.revisie);
      } else {
        setRegels(dag.voorstellen.map(v => ({ categorie: v.categorie, werkitemId: v.werkitemId ?? undefined, beginTijd: v.beginTijd, eindTijd: v.eindTijd, geplandeBeginTijd: v.beginTijd, geplandeEindTijd: v.eindTijd, notitie: '', afwijkingReden: '', afwijkingOvergeslagen: false })));
        setRevisie(dag.revisie ?? 0);
      }
    } catch (error) { setFout(error instanceof Error ? error.message : 'Concept openen mislukt.'); }
    finally { setBezig(false); }
  };
  const aanpassen = (index: number, patch: Partial<Regel>) => setRegels(huidig => huidig?.map((r, i) => i === index ? { ...r, ...patch } : r) ?? null);
  const tijdWijzigen = (index: number, veld: 'beginTijd' | 'eindTijd', waarde: string) => {
    if (!regels) return;
    try { setRegels(wijzigVoorstelTijd(regels, index, veld, waarde, schuifMee)); setFout(null); }
    catch (error) { setFout(error instanceof Error ? error.message : 'Controleer de tijden.'); }
  };
  const pauze = () => {
    if (!regels || !pauzeForm) return;
    try {
      const volgende = splitsVoorPauze<Regel>(regels, pauzeForm.index, pauzeForm.begin, Number(pauzeForm.duur), (r, beginTijd, eindTijd) => ({ ...r, categorie: 'pauze', beginTijd, eindTijd, geplandeBeginTijd: undefined, geplandeEindTijd: undefined, notitie: '', afwijkingReden: '', afwijkingOvergeslagen: false }));
      // De bewuste pauze wordt van het geplande werk afgesplitst. Elke werkhelft
      // houdt daarna een eigen geplande tijd zodat vervolgbewerking vergelijkbaar is.
      setRegels(volgende.map((r, i) => i >= pauzeForm.index && i < pauzeForm.index + (volgende.length - regels.length + 1) && r.categorie === 'werken' ? { ...r, geplandeBeginTijd: r.beginTijd, geplandeEindTijd: r.eindTijd } : r));
      setPauzeForm(null); setFout(null);
    } catch (error) { setFout(error instanceof Error ? error.message : 'Pauze toevoegen mislukt.'); }
  };
  const extraBlok = (index: number) => {
    if (!regels) return;
    const start = minuten(regels[index].eindTijd);
    const volgende = regels.map((r, i) => i > index ? { ...r, beginTijd: tijd(minuten(r.beginTijd) + 15), eindTijd: tijd(minuten(r.eindTijd) + 15) } : r);
    volgende.splice(index + 1, 0, { categorie: 'laden', beginTijd: tijd(start), eindTijd: tijd(start + 15), notitie: '', afwijkingReden: '', afwijkingOvergeslagen: false });
    if (volgende.every(r => isGeldigTijdvak(r.beginTijd, r.eindTijd))) setRegels(volgende);
    else setFout('Het extra blok past niet binnen deze dag.');
  };
  const opslaan = async () => {
    if (!regels?.length || actief.current) return;
    if (regels.some(r => !isGeldigTijdvak(r.beginTijd, r.eindTijd))) { setFout('Controleer de begin- en eindtijden (HH:MM).'); return; }
    const payload = { datum, verwachteRevisie: revisie, segmenten: regels.map(r => ({ ...r, werkitemId: r.werkitemId || undefined, werksoort: r.categorie === 'anders' ? r.werksoort : undefined, notitie: r.notitie.trim() || undefined, afwijkingReden: r.afwijkingReden.trim() || undefined })) };
    const serialized = JSON.stringify(payload);
    if (poging.current?.payload !== serialized) poging.current = { payload: serialized, sleutel: Crypto.randomUUID() };
    actief.current = true; setBezig(true); setFout(null);
    try { const result = await verstuur('dagvoorstel', payload, poging.current.sleutel);
      if (result.status === 'conflict') setFout(result.fout ?? 'Controleer de wachtende invoer bovenaan de dag.');
      else { await schrijfConcept(null); setRegels(null); poging.current = null; }
    }
    catch (error) { setFout(error instanceof Error ? error.message : 'Opslaan is mislukt. Probeer opnieuw.'); }
    finally { actief.current = false; setBezig(false); }
  };
  const veld = { color: kleuren.foreground, backgroundColor: kleuren.input, borderWidth: 1, borderColor: kleuren.border, borderRadius: 12, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17 };
  const foutRegel = fout && <Text accessibilityRole="alert" style={[tekst.sub, { color: kleuren.danger }]}>{fout}</Text>;
  if (!regels) return <View style={{ gap: 8 }}><Button title="Dagvoorstel aanpassen" variant="outline" disabled={bezig} onPress={openen} icon={<SlidersHorizontal size={16} color={kleuren.foreground} strokeWidth={2} />} />{foutRegel}</View>;
  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={[tekst.titel3, { color: kleuren.foreground }]}>Controleer je dagvoorstel</Text>
    <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Je concept wordt op dit toestel bewaard. Begin verschuiven behoudt de duur; eind wijzigen past de duur aan.</Text>
    <Checkbox label="Latere voorstellen meeschuiven" checked={schuifMee} onCheckedChange={setSchuifMee} disabled={bezig} />
    {(dag.revisie ?? 0) !== revisie && <Text accessibilityRole="alert" style={[tekst.sub, { color: kleuren.warning }]}>De dag is intussen gewijzigd. Sluit dit voorstel en open het opnieuw voordat je opslaat.</Text>}
    {regels.map((r, index) => {
      const afwijkend = r.geplandeBeginTijd && r.geplandeEindTijd && Math.abs((minuten(r.eindTijd) - minuten(r.beginTijd)) - (minuten(r.geplandeEindTijd) - minuten(r.geplandeBeginTijd))) > 15;
      return <Kaart key={index} padding={14} style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <Text style={[tekst.kop, { color: kleuren.foreground }]}>Segment {index + 1}</Text>
          <Text style={[tekst.sub, tekst.cijfers, { color: kleuren.mutedForeground }]}>{r.beginTijd}–{r.eindTijd}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{Object.entries(CATEGORIE_LABELS).map(([categorie, label]) => {
          const actief = r.categorie === categorie;
          return <Pressable key={categorie} disabled={bezig} accessibilityRole="radio" accessibilityState={{ checked: actief }} onPress={() => aanpassen(index, { categorie: categorie as SegmentCategorie, werksoort: undefined })} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 999, backgroundColor: actief ? kleuren.primary : kleuren.muted, opacity: bezig ? 0.45 : pressed ? 0.7 : 1 })}><Text style={[tekst.sub, { color: actief ? kleuren.primaryForeground : kleuren.foreground, fontWeight: actief ? '600' : '500' }]}>{label}</Text></Pressable>;
        })}</View>
        {r.categorie === 'anders' && <WerksoortKeuze waarde={r.werksoort} wijzigen={werksoort => aanpassen(index, { werksoort })} disabled={bezig} />}
        <View style={{ flexDirection: 'row', gap: 10 }}>{(['beginTijd', 'eindTijd'] as const).map(veld => <View key={veld} style={{ flex: 1, gap: 6 }}>
          <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontWeight: '600' }]}>{veld === 'beginTijd' ? 'Begin' : 'Eind'}</Text>
          <EindTijdVeld label={`${veld === 'beginTijd' ? 'Begintijd' : 'Eindtijd'} segment ${index + 1}`} waarde={r[veld]} disabled={bezig} commit={waarde => tijdWijzigen(index, veld, waarde)} />
          <View style={{ flexDirection: 'row', gap: 6 }}>{[-5, 5].map(delta => <View key={delta} style={{ flex: 1 }}><Button title={delta > 0 ? '+5' : '−5'} accessibilityLabel={`${veld === 'beginTijd' ? 'Begintijd' : 'Eindtijd'} segment ${index + 1} 5 minuten ${delta > 0 ? 'later' : 'eerder'}`} variant="secondary" size="sm" disabled={bezig} onPress={() => tijdWijzigen(index, veld, minutenTijd(tijdMinuten(r[veld]) + delta))} fullWidth /></View>)}</View>
        </View>)}</View>
        <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontWeight: '600' }]}>Klus {r.categorie === 'werken' ? '(verplicht)' : '(optioneel)'}</Text>
        <KlusKiezer datum={datum} stops={dag.stops} waarde={r.werkitemId} wijzigen={werkitemId => aanpassen(index, { werkitemId: werkitemId ?? undefined })} disabled={bezig} />
        <TextInput accessibilityLabel={`Notitie segment ${index + 1}`} value={r.notitie} editable={!bezig} placeholder="Notitie (optioneel)" placeholderTextColor={kleuren.mutedForeground} onChangeText={notitie => aanpassen(index, { notitie })} style={veld} />
        {afwijkend && <><TextInput accessibilityLabel={`Reden afwijking segment ${index + 1}`} value={r.afwijkingReden} editable={!bezig} placeholder="Waarom wijkt de duur af?" placeholderTextColor={kleuren.mutedForeground} onChangeText={afwijkingReden => aanpassen(index, { afwijkingReden })} style={veld} /><Checkbox label="Reden nu overslaan" checked={r.afwijkingOvergeslagen} onCheckedChange={afwijkingOvergeslagen => aanpassen(index, { afwijkingOvergeslagen })} disabled={bezig} /></>}
        {pauzeForm?.index === index && <View style={{ gap: 8, backgroundColor: kleuren.muted, borderRadius: 14, padding: 12 }}><Text style={[tekst.kop, { color: kleuren.foreground }]}>Werk splitsen rond een genomen pauze</Text><TextInput accessibilityLabel="Begin van pauze" keyboardType="numbers-and-punctuation" maxLength={5} placeholder="12:00" placeholderTextColor={kleuren.mutedForeground} value={pauzeForm.begin} onChangeText={begin => setPauzeForm({ ...pauzeForm, begin })} style={veld} /><TextInput accessibilityLabel="Pauzeduur in minuten" keyboardType="number-pad" value={pauzeForm.duur} onChangeText={duur => setPauzeForm({ ...pauzeForm, duur })} style={veld} /><Button title="Pauze invoegen" variant="outline" onPress={pauze} /><Button title="Geen pauze invoegen" variant="ghost" onPress={() => setPauzeForm(null)} /></View>}
        <Scheiding />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {r.categorie === 'werken' && <Button title="Pauze in dit werkblok" variant="ghost" size="sm" disabled={bezig} onPress={() => setPauzeForm({ index, begin: minutenTijd(Math.min(tijdMinuten(r.beginTijd) + 120, tijdMinuten(r.eindTijd) - 30)), duur: '30' })} />}
          <Button title="Extra blok hierna" variant="ghost" size="sm" disabled={bezig} onPress={() => extraBlok(index)} />
          <Button title="Uit voorstel verwijderen" variant="ghost" size="sm" disabled={bezig} onPress={() => setRegels(regels.filter((_, i) => i !== index))} />
        </View>
      </Kaart>;
    })}
    {foutRegel}
    <Button title="Hele voorstel opslaan" size="lg" loading={bezig} disabled={!regels.length || (dag.revisie ?? 0) !== revisie} onPress={opslaan} fullWidth />
    <Button title="Sluiten en concept bewaren" variant="ghost" disabled={bezig} onPress={() => setRegels(null)} />
    <Button title="Concept verwijderen" variant="ghost" disabled={bezig} onPress={async () => { try { await schrijfConcept(null); setRegels(null); } catch { setFout('Concept verwijderen mislukt.'); } }} />
  </View>;
}

function EindTijdVeld({ label, waarde, disabled, commit }: { label: string; waarde: string; disabled: boolean; commit: (tijd: string) => void }) {
  const kleuren = useVeldKleuren(); const [invoer, setInvoer] = useState(waarde);
  const [vorigeWaarde, setVorigeWaarde] = useState(waarde);
  if (vorigeWaarde !== waarde) { setVorigeWaarde(waarde); setInvoer(waarde); }
  return <TextInput accessibilityLabel={label} value={invoer} editable={!disabled} maxLength={5} keyboardType="numbers-and-punctuation" onChangeText={setInvoer} onEndEditing={() => commit(invoer)} style={{ color: kleuren.foreground, backgroundColor: kleuren.input, borderWidth: 1, borderColor: kleuren.border, borderRadius: 12, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, fontVariant: ['tabular-nums'], textAlign: 'center' }} />;
}
