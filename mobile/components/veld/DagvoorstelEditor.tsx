import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/clerk-expo';
import { wijzigVoorstelTijd, splitsVoorPauze, tijdMinuten, minutenTijd } from '../../lib/dagvoorstel-tijden';
import { Alert, View } from 'react-native';
import { Text, TextInput } from '../ui/Tekst';
import { useVeldOpdracht } from '../../hooks/use-veld-opdracht';
import * as Crypto from 'expo-crypto';
import { Check, ChevronDown, ChevronRight, ChevronUp, Coffee, Minus, Plus, SlidersHorizontal } from 'lucide-react-native';
import { BottomSheet, Button, Checkbox, Switch } from '../ui';
import { Drukvlak, Melding, Scheiding } from '../werk/Bouwstenen';
import { categorieKleur } from './categorieKleur';
import { tekst } from '../../theme';
import { WerksoortKeuze, type Werksoort } from './WerksoortKeuze';
import { KlusKiezer } from './KlusKiezer';
import { VerwijderKnop } from './VerwijderKnop';
import { useVeldKleuren } from './BuitenModus';
import { CATEGORIE_LABELS, isGeldigTijdvak, type SegmentCategorie, type VeldDagData } from '../../types/veld';

interface Regel {
  werksoort?: Werksoort; categorie: SegmentCategorie; beginTijd: string; eindTijd: string; werkitemId?: string;
  geplandeBeginTijd?: string; geplandeEindTijd?: string; notitie: string;
  afwijkingReden: string; afwijkingOvergeslagen: boolean;
}
const minuten = (tijd: string) => Number(tijd.slice(0, 2)) * 60 + Number(tijd.slice(3));
const tijd = (waarde: number) => `${Math.floor(waarde / 60).toString().padStart(2, '0')}:${(waarde % 60).toString().padStart(2, '0')}`;
/** Zelfde regel als de server (convex/veldLogica duurAfwijking): duurverschil > 15 min. */
const isAfwijkend = (r: Regel) => !!(r.geplandeBeginTijd && r.geplandeEindTijd) && Math.abs((minuten(r.eindTijd) - minuten(r.beginTijd)) - (minuten(r.geplandeEindTijd!) - minuten(r.geplandeBeginTijd!))) > 15;
/** Zonder reden of expliciet overslaan weigert de server het hele voorstel. */
const redenOntbreekt = (r: Regel) => isAfwijkend(r) && !r.afwijkingReden.trim() && !r.afwijkingOvergeslagen;

/** Bewerk uitsluitend nog niet bevestigde voorstellen; één atomaire opslag. */
export function DagvoorstelEditor({ dag, datum, onOpgeslagen, onBewerken }: { dag: VeldDagData; datum: string; onOpgeslagen?: (melding: string) => void; onBewerken?: (open: boolean) => void }) {
  const kleuren = useVeldKleuren(); const { verstuur } = useVeldOpdracht();
  const { userId, orgId } = useAuth();
  const conceptSleutel = userId && orgId ? `toptuinen:dagconcept:v1:${orgId}:${userId}:${datum}` : null;
  const schrijfKeten = useRef(Promise.resolve());
  const [conceptEigenaar, setConceptEigenaar] = useState(conceptSleutel);
  const [pauzeForm, setPauzeForm] = useState<{ index: number; begin: string; duur: string } | null>(null);
  const [regels, setRegels] = useState<Regel[] | null>(null);
  const [revisie, setRevisie] = useState(0); const [schuifMee, setSchuifMee] = useState(true);
  const [bezig, setBezig] = useState(false); const [fout, setFout] = useState<string | null>(null);
  const [melding, setMelding] = useState<string | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [kiezer, setKiezer] = useState<{ index: number; soort: 'categorie' | 'klus' } | null>(null);
  const poging = useRef<{ payload: string; sleutel: string } | null>(null);
  const actief = useRef(false);
  if (conceptEigenaar !== conceptSleutel) { setConceptEigenaar(conceptSleutel); setRegels(null); setPauzeForm(null); setFout(null); setMelding(null); }
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
    setBezig(true); setFout(null); setMelding(null); poging.current = null;
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
  const bewerkt = regels !== null;
  useEffect(() => { onBewerken?.(bewerkt); }, [bewerkt, onBewerken]);
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
    const zonderReden = regels.findIndex(redenOntbreekt);
    if (zonderReden >= 0) { setOpenIndex(zonderReden); return; }
    const payload = { datum, verwachteRevisie: revisie, segmenten: regels.map(r => ({ ...r, werkitemId: r.werkitemId || undefined, werksoort: r.categorie === 'anders' ? r.werksoort : undefined, notitie: r.notitie.trim() || undefined, afwijkingReden: r.afwijkingReden.trim() || undefined })) };
    const serialized = JSON.stringify(payload);
    if (poging.current?.payload !== serialized) poging.current = { payload: serialized, sleutel: Crypto.randomUUID() };
    actief.current = true; setBezig(true); setFout(null);
    try { const result = await verstuur('dagvoorstel', payload, poging.current.sleutel);
      if (result.status === 'conflict') setFout(result.fout ?? 'Controleer de wachtende invoer bovenaan de dag.');
      else {
        await schrijfConcept(null); setRegels(null); poging.current = null;
        const bericht = result.status === 'wacht' ? 'Dagvoorstel bewaard op dit toestel. Wordt verstuurd zodra je verbinding hebt.' : 'Dagvoorstel opgeslagen.';
        // De voorstelkaart verdwijnt vaak na opslaan; de ouder toont de bevestiging dan buiten de kaart.
        if (onOpgeslagen) onOpgeslagen(bericht); else setMelding(bericht);
      }
    }
    catch (error) { setFout(error instanceof Error ? error.message : 'Opslaan is mislukt. Probeer opnieuw.'); }
    finally { actief.current = false; setBezig(false); }
  };
  const veld = { color: kleuren.foreground, backgroundColor: kleuren.input, borderWidth: 1, borderColor: kleuren.randSterk, borderRadius: 12, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 };
  const foutRegel = fout && <Text accessibilityRole="alert" style={[tekst.sub, { color: kleuren.danger }]}>{fout}</Text>;
  if (!regels) return <View style={{ gap: 8 }}>{melding && <View accessibilityLiveRegion="polite"><Melding toon="succes" icoon={Check} tekst={melding} /></View>}<Button title="Aanpassen" variant="ghost" disabled={bezig} onPress={openen} icon={<SlidersHorizontal size={16} color={kleuren.foreground} strokeWidth={2} />} />{foutRegel}</View>;
  const klusNaam = (id?: string) => { const stop = dag.stops.find(s => String(s.werkitemId) === id); return stop ? stop.klantNaam ?? stop.naam : null; };
  const kiesRegel = kiezer ? regels[kiezer.index] : null;
  const redenNodig = regels.flatMap((r, i) => redenOntbreekt(r) ? [i] : []);
  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text accessibilityRole="header" style={[tekst.kop, { color: kleuren.foreground, flex: 1 }]}>Dagvoorstel aanpassen</Text>
      <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14 }]}>Meeschuiven</Text>
      <Switch value={schuifMee} onValueChange={setSchuifMee} disabled={bezig} size="sm" accessibilityLabel="Latere blokken meeschuiven" accessibilityHint="Verschuift de blokken hierna mee als je een tijd wijzigt" />
    </View>
    {(dag.revisie ?? 0) !== revisie && <Melding toon="wachten" tekst="De dag is intussen gewijzigd. Sluit en open het voorstel opnieuw voordat je opslaat." />}
    <View>
      {regels.map((r, index) => {
        const afwijkend = isAfwijkend(r);
        const open = openIndex === index;
        const naam = klusNaam(r.werkitemId) ?? CATEGORIE_LABELS[r.categorie];
        const Pijl = open ? ChevronUp : ChevronDown;
        return <View key={index} style={open ? { borderWidth: 1, borderColor: kleuren.randSterk, borderRadius: 16, paddingHorizontal: 12, paddingBottom: 12, marginVertical: 4, backgroundColor: kleuren.card } : undefined}>
          {!open && index > 0 && openIndex !== index - 1 && <Scheiding />}
          <Drukvlak onPress={() => { setOpenIndex(open ? null : index); setPauzeForm(null); }} accessibilityLabel={`${r.beginTijd} tot ${r.eindTijd}, ${naam}`} accessibilityState={{ expanded: open }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: open ? 0 : 4 }}>
            <View style={{ width: 4, height: 28, borderRadius: 2, backgroundColor: categorieKleur(kleuren, r.categorie) }} />
            <Text style={[tekst.callout, tekst.cijfers, { color: kleuren.foreground, width: 104 }]}>{r.beginTijd}–{r.eindTijd}</Text>
            <Text style={[tekst.callout, { color: kleuren.mutedForeground, flex: 1 }]} numberOfLines={1}>{naam}</Text>
            {redenOntbreekt(r) && <View accessibilityLabel="Reden nodig" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: kleuren.warning }} />}
            <Pijl size={18} color={kleuren.mutedForeground} strokeWidth={2} />
          </Drukvlak>
          {open && <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <TijdStapper label={`Begintijd blok ${index + 1}`} waarde={r.beginTijd} disabled={bezig} commit={waarde => tijdWijzigen(index, 'beginTijd', waarde)} />
              <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>tot</Text>
              <TijdStapper label={`Eindtijd blok ${index + 1}`} waarde={r.eindTijd} disabled={bezig} commit={waarde => tijdWijzigen(index, 'eindTijd', waarde)} />
            </View>
            <View style={{ borderRadius: 12, backgroundColor: kleuren.vulling, paddingHorizontal: 12 }}>
              <KeuzeRegel label="Soort" waarde={CATEGORIE_LABELS[r.categorie]} disabled={bezig} onPress={() => setKiezer({ index, soort: 'categorie' })} />
              {(r.categorie === 'werken' || r.categorie === 'afvalverwerker_bes' || r.werkitemId) && <>
                <Scheiding />
                <KeuzeRegel label="Klus" waarde={klusNaam(r.werkitemId) ?? (r.werkitemId ? 'Gekozen klus' : r.categorie === 'werken' ? 'Kies een klus' : 'Geen')} waarschuwing={r.categorie === 'werken' && !r.werkitemId} disabled={bezig} onPress={() => setKiezer({ index, soort: 'klus' })} />
              </>}
            </View>
            {r.categorie === 'anders' && <WerksoortKeuze waarde={r.werksoort} wijzigen={werksoort => aanpassen(index, { werksoort })} disabled={bezig} />}
            <TextInput accessibilityLabel={`Notitie blok ${index + 1}`} value={r.notitie} editable={!bezig} placeholder="Notitie (optioneel)" placeholderTextColor={kleuren.mutedForeground} onChangeText={notitie => aanpassen(index, { notitie })} style={veld} />
            {afwijkend && <View style={{ gap: 8 }}>
              <TextInput accessibilityLabel={`Reden afwijking blok ${index + 1}`} value={r.afwijkingReden} editable={!bezig} placeholder="Waarom wijkt de duur af?" placeholderTextColor={kleuren.mutedForeground} onChangeText={afwijkingReden => aanpassen(index, { afwijkingReden })} style={veld} />
              <Checkbox label="Reden nu overslaan" checked={r.afwijkingOvergeslagen} onCheckedChange={afwijkingOvergeslagen => aanpassen(index, { afwijkingOvergeslagen })} disabled={bezig} />
            </View>}
            {pauzeForm?.index === index && <View style={{ gap: 8, borderRadius: 12, backgroundColor: kleuren.vulling, padding: 12 }}>
              <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontWeight: '600' }]}>Pauze binnen dit werkblok</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput accessibilityLabel="Begin van pauze" keyboardType="numbers-and-punctuation" maxLength={5} placeholder="12:00" placeholderTextColor={kleuren.mutedForeground} value={pauzeForm.begin} onChangeText={begin => setPauzeForm({ ...pauzeForm, begin })} style={[veld, { width: 76, textAlign: 'center', fontVariant: ['tabular-nums'] }]} />
                <TextInput accessibilityLabel="Pauzeduur in minuten" keyboardType="number-pad" maxLength={3} value={pauzeForm.duur} onChangeText={duur => setPauzeForm({ ...pauzeForm, duur })} style={[veld, { width: 60, textAlign: 'center', fontVariant: ['tabular-nums'] }]} />
                <Text style={[tekst.sub, { color: kleuren.mutedForeground, flex: 1 }]}>min</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}><Button title="Invoegen" size="sm" onPress={pauze} fullWidth /></View>
                <View style={{ flex: 1 }}><Button title="Annuleren" size="sm" variant="ghost" onPress={() => setPauzeForm(null)} fullWidth /></View>
              </View>
            </View>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {r.categorie === 'werken' && pauzeForm?.index !== index && <Button title="Pauze" variant="ghost" size="sm" disabled={bezig} accessibilityLabel={`Pauze in werkblok ${index + 1}`} icon={<Coffee size={16} color={kleuren.foreground} strokeWidth={2} />} onPress={() => setPauzeForm({ index, begin: minutenTijd(Math.min(tijdMinuten(r.beginTijd) + 120, tijdMinuten(r.eindTijd) - 30)), duur: '30' })} />}
              <Button title="Blok erna" variant="ghost" size="sm" disabled={bezig} accessibilityLabel={`Extra blok na blok ${index + 1}`} icon={<Plus size={16} color={kleuren.foreground} strokeWidth={2} />} onPress={() => { extraBlok(index); setOpenIndex(index + 1); }} />
              <VerwijderKnop title="Weg" accessibilityLabel={`Blok ${index + 1} uit voorstel verwijderen`} size="sm" disabled={bezig} onPress={() => { setRegels(regels.filter((_, i) => i !== index)); setOpenIndex(null); }} />
            </View>
          </View>}
        </View>;
      })}
    </View>
    {foutRegel}
    {redenNodig.length > 0 && <Drukvlak onPress={() => setOpenIndex(redenNodig[0])} accessibilityRole="button" accessibilityHint="Opent het blok" style={{ borderRadius: 12 }}>
      <Melding toon="wachten" tekst={`${redenNodig.length === 1 ? `Blok ${redenNodig[0] + 1} wijkt` : `Blokken ${redenNodig.map(i => i + 1).join(', ')} wijken`} meer dan 15 minuten af van de planning. Geef een reden of kies 'Reden nu overslaan' om op te slaan.`} />
    </Drukvlak>}
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={{ flex: 1 }}><Button title="Opslaan" loading={bezig} disabled={!regels.length || (dag.revisie ?? 0) !== revisie || redenNodig.length > 0} onPress={opslaan} fullWidth /></View>
      <View style={{ flex: 1 }}><Button title="Sluiten" variant="ghost" disabled={bezig} onPress={() => { setRegels(null); setOpenIndex(null); }} accessibilityHint="Je concept blijft op dit toestel bewaard" fullWidth /></View>
    </View>
    <View style={{ alignSelf: 'center' }}>
      <VerwijderKnop title="Concept weggooien" size="sm" disabled={bezig} onPress={() => Alert.alert('Concept weggooien?', 'Je aanpassingen op dit toestel gaan verloren. Het oorspronkelijke voorstel blijft staan.', [
        { text: 'Annuleren', style: 'cancel' },
        { text: 'Weggooien', style: 'destructive', onPress: async () => { try { await schrijfConcept(null); setRegels(null); setOpenIndex(null); } catch { setFout('Concept weggooien mislukt.'); } } },
      ])} />
    </View>
    <BottomSheet isOpen={!!kiezer} onClose={() => setKiezer(null)} title={kiezer?.soort === 'klus' ? 'Klus kiezen' : 'Soort uren'}>
      {kiezer && kiesRegel && (kiezer.soort === 'categorie'
        ? <View>{(Object.entries(CATEGORIE_LABELS) as [SegmentCategorie, string][]).map(([categorie, label], i) => {
          const gekozen = kiesRegel.categorie === categorie;
          return <View key={categorie}>
            {i > 0 && <Scheiding />}
            <Drukvlak accessibilityRole="radio" accessibilityState={{ checked: gekozen }} accessibilityLabel={label} onPress={() => { aanpassen(kiezer.index, { categorie, werksoort: undefined }); setKiezer(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50 }}>
              <View style={{ width: 4, height: 22, borderRadius: 2, backgroundColor: categorieKleur(kleuren, categorie) }} />
              <Text style={[tekst.callout, { color: kleuren.foreground, flex: 1, fontWeight: gekozen ? '600' : '400' }]}>{label}</Text>
              {gekozen && <Check size={18} color={kleuren.primary} strokeWidth={2.5} />}
            </Drukvlak>
          </View>;
        })}</View>
        : <KlusKiezer datum={datum} stops={dag.stops} waarde={kiesRegel.werkitemId} wijzigen={werkitemId => { aanpassen(kiezer.index, { werkitemId: werkitemId ?? undefined }); if (werkitemId) setKiezer(null); }} disabled={bezig} />)}
    </BottomSheet>
  </View>;
}

/** Eén keuze als rij: label links, huidige waarde rechts, tik opent de keuzelijst. */
function KeuzeRegel({ label, waarde, onPress, disabled, waarschuwing = false }: { label: string; waarde: string; onPress: () => void; disabled: boolean; waarschuwing?: boolean }) {
  const kleuren = useVeldKleuren();
  return <Drukvlak onPress={onPress} disabled={disabled} accessibilityLabel={`${label}: ${waarde}`} accessibilityHint="Opent de keuzelijst" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46 }}>
    <Text style={[tekst.sub, { color: kleuren.mutedForeground, width: 52 }]}>{label}</Text>
    <Text style={[tekst.callout, { color: waarschuwing ? kleuren.warning : kleuren.foreground, flex: 1, textAlign: 'right' }]} numberOfLines={1}>{waarde}</Text>
    <ChevronRight size={18} color={kleuren.mutedForeground} strokeWidth={2} />
  </Drukvlak>;
}

/** Tijd met −5/+5 ernaast; het veld zelf is ook te typen (HH:MM). */
function TijdStapper({ label, waarde, disabled, commit }: { label: string; waarde: string; disabled: boolean; commit: (tijd: string) => void }) {
  const kleuren = useVeldKleuren(); const [invoer, setInvoer] = useState(waarde);
  const [vorigeWaarde, setVorigeWaarde] = useState(waarde);
  if (vorigeWaarde !== waarde) { setVorigeWaarde(waarde); setInvoer(waarde); }
  const knop = (delta: number) => <Drukvlak haptic="selection" disabled={disabled} hitSlop={4} accessibilityLabel={`${label} 5 minuten ${delta > 0 ? 'later' : 'eerder'}`} onPress={() => commit(minutenTijd(tijdMinuten(waarde) + delta))} style={{ width: 36, height: 40, alignItems: 'center', justifyContent: 'center' }}>
    {delta > 0 ? <Plus size={18} color={kleuren.foreground} strokeWidth={2.25} /> : <Minus size={18} color={kleuren.foreground} strokeWidth={2.25} />}
  </Drukvlak>;
  return <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 12, backgroundColor: kleuren.vulling }}>
    {knop(-5)}
    <TextInput accessibilityLabel={label} value={invoer} editable={!disabled} maxLength={5} keyboardType="numbers-and-punctuation" onChangeText={setInvoer} onEndEditing={() => commit(invoer)} style={{ width: 62, height: 40, color: kleuren.foreground, fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'], textAlign: 'center' }} />
    {knop(5)}
  </View>;
}
