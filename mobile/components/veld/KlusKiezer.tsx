import React, { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useQuery } from 'convex/react';
import * as Crypto from 'expo-crypto';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { VeldStop } from '../../types/veld';
import { useVeldServerActie } from '../../hooks/use-veld-server-actie';
import { useBuitenModus } from './BuitenModus';
import { Button } from '../ui';

type KlantKeuze = { klantId: Id<'klanten'>; naam: string };
/** Geplande klussen blijven de eerste keuze; ongepland werk krijgt een echt werkitem. */
export function KlusKiezer({ datum, stops, waarde, wijzigen, disabled = false }: {
  datum: string; stops: Pick<VeldStop, 'werkitemId' | 'naam' | 'klantNaam'>[];
  waarde: string | null | undefined; wijzigen: (werkitemId: Id<'projecten'> | null) => void; disabled?: boolean;
}) {
  const { kleuren } = useBuitenModus(); const { online, voerUit } = useVeldServerActie();
  const [open, setOpen] = useState(false); const [zoek, setZoek] = useState('');
  const klanten = useQuery(api.veldKlanten.zoek, open ? { datum, zoekterm: zoek } : 'skip');
  const [klant, setKlant] = useState<KlantKeuze | null>(null); const [nieuweKlant, setNieuweKlant] = useState(false);
  const [naam, setNaam] = useState(''); const [adres, setAdres] = useState(''); const [postcode, setPostcode] = useState(''); const [plaats, setPlaats] = useState('');
  const [omschrijving, setOmschrijving] = useState(''); const [categorie, setCategorie] = useState<'aanleg' | 'onderhoud'>('onderhoud');
  const [bezig, setBezig] = useState(false); const [fout, setFout] = useState<string | null>(null);
  const [nieuwWerk, setNieuwWerk] = useState<{ werkitemId: Id<'projecten'>; naam: string } | null>(null);
  const poging = useRef<{ inhoud: string; sleutel: string } | null>(null); const vergrendeld = useRef(false);
  const stijl = { color: kleuren.foreground, borderWidth: 1, borderColor: kleuren.border, borderRadius: 10, minHeight: 48, padding: 12, fontSize: 16 };
  const selecteer = (id: Id<'projecten'>) => { wijzigen(waarde === id ? null : id); setFout(null); };
  const maak = async () => {
    if (vergrendeld.current || !omschrijving.trim() || (!klant && !nieuweKlant)) return;
    if (nieuweKlant && !naam.trim()) { setFout('Vul de naam van de klant in.'); return; }
    const inhoud = { datum, omschrijving: omschrijving.trim(), categorie,
      ...(nieuweKlant ? { nieuweKlant: { naam: naam.trim(), ...(adres.trim() ? { adres: adres.trim() } : {}), ...(postcode.trim() ? { postcode: postcode.trim() } : {}), ...(plaats.trim() ? { plaats: plaats.trim() } : {}) } } : { klantId: klant!.klantId }),
    };
    const tekst = JSON.stringify(inhoud);
    if (poging.current?.inhoud !== tekst) poging.current = { inhoud: tekst, sleutel: Crypto.randomUUID() };
    setBezig(true); setFout(null); vergrendeld.current = true;
    try {
      const resultaat = await voerUit('veldKlanten:maakUitvoeringsklus', { ...inhoud, sleutel: poging.current.sleutel }) as { werkitemId: Id<'projecten'>; klantNaam: string; werkitemNaam: string };
      setNieuwWerk({ werkitemId: resultaat.werkitemId, naam: `${resultaat.klantNaam} · ${resultaat.werkitemNaam}` });
      wijzigen(resultaat.werkitemId); setOpen(false); setKlant(null); setNieuweKlant(false); setOmschrijving(''); setNaam(''); setAdres(''); setPostcode(''); setPlaats(''); poging.current = null;
    } catch (error) { setFout(error instanceof Error ? error.message : 'De klus kon niet worden aangemaakt. Je invoer blijft staan.'); }
    finally { vergrendeld.current = false; setBezig(false); }
  };
  return <View style={{ gap: 10 }}>
    {stops.length > 0 && <Text style={{ color: kleuren.mutedForeground }}>Gepland op deze dag</Text>}
    {stops.map(stop => <Pressable key={stop.werkitemId} disabled={disabled || bezig} accessibilityRole="radio" accessibilityState={{ checked: waarde === stop.werkitemId }} onPress={() => selecteer(stop.werkitemId)} style={{ ...stijl, borderColor: waarde === stop.werkitemId ? kleuren.primary : kleuren.border }}><Text style={{ color: kleuren.foreground }}>{waarde === stop.werkitemId ? '✓ ' : ''}{stop.klantNaam ? `${stop.klantNaam} · ${stop.naam}` : stop.naam}</Text></Pressable>)}
    {nieuwWerk && !stops.some(s => s.werkitemId === nieuwWerk.werkitemId) && <Button title={`${waarde === nieuwWerk.werkitemId ? '✓ ' : ''}${nieuwWerk.naam}`} variant="outline" onPress={() => selecteer(nieuwWerk.werkitemId)} />}
    <Button title={open ? 'Andere klanten sluiten' : 'Andere klant of ongeplande klus'} variant="ghost" disabled={disabled || bezig} onPress={() => { setOpen(!open); setFout(null); }} />
    {open && <View style={{ gap: 10 }}>
      {!online && <Text style={{ color: kleuren.mutedForeground }}>Een nieuwe klant of klus aanmaken vraagt verbinding. Je kunt een bestaande geplande klus kiezen.</Text>}
      {!klant && !nieuweKlant ? <>
        <TextInput accessibilityLabel="Zoek een klant" value={zoek} onChangeText={setZoek} placeholder="Zoek naam, adres of plaats" placeholderTextColor={kleuren.mutedForeground} style={stijl} editable={!bezig} />
        {!klanten && <Text style={{ color: kleuren.mutedForeground }}>Klanten laden…</Text>}
        {klanten?.klanten.map(k => <View key={k.klantId} style={{ gap: 6 }}>
          <Text style={{ color: kleuren.foreground, fontWeight: '600' }}>{k.naam}{k.gepland ? ' · gepland' : ''}</Text>
          {(k.adres || k.plaats) && <Text style={{ color: kleuren.mutedForeground }}>{[k.adres, k.plaats].filter(Boolean).join(', ')}</Text>}
          {k.werkitems.map(w => <Button key={w.werkitemId} title={`Kies ${w.naam}`} variant="outline" onPress={() => { wijzigen(w.werkitemId); setOpen(false); }} />)}
          <Button title={`Nieuwe klus bij ${k.naam}`} variant="ghost" disabled={!online} onPress={() => { setKlant({ klantId: k.klantId, naam: k.naam }); setOmschrijving(''); }} />
        </View>)}
        {klanten?.meerResultaten && <Text style={{ color: kleuren.mutedForeground }}>Verfijn je zoekopdracht om meer klanten te vinden.</Text>}
        {klanten && klanten.klanten.length === 0 && <Text style={{ color: kleuren.mutedForeground }}>Geen klant gevonden.</Text>}
        <Button title="Nieuwe klant toevoegen" variant="outline" disabled={!online} onPress={() => { setNieuweKlant(true); setOmschrijving(''); }} />
      </> : <>
        <Text style={{ color: kleuren.foreground, fontWeight: '600' }}>{nieuweKlant ? 'Nieuwe klant en klus' : `Nieuwe klus bij ${klant?.naam}`}</Text>
        {nieuweKlant && [{ label: 'Naam klant', waarde: naam, setter: setNaam }, { label: 'Werkadres (optioneel)', waarde: adres, setter: setAdres }, { label: 'Postcode (optioneel)', waarde: postcode, setter: setPostcode }, { label: 'Plaats (optioneel)', waarde: plaats, setter: setPlaats }].map(v => <TextInput key={v.label} accessibilityLabel={v.label} placeholder={v.label} placeholderTextColor={kleuren.mutedForeground} value={v.waarde} onChangeText={v.setter} editable={!bezig} style={stijl} />)}
        <TextInput accessibilityLabel="Wat heb je bij deze klant gedaan?" placeholder="Omschrijving van het werk" placeholderTextColor={kleuren.mutedForeground} value={omschrijving} onChangeText={setOmschrijving} editable={!bezig} multiline style={stijl} />
        <View style={{ flexDirection: 'row', gap: 8 }}>{(['onderhoud', 'aanleg'] as const).map(c => <Button key={c} title={c === 'onderhoud' ? 'Tuinonderhoud' : 'Tuinaanleg'} variant={categorie === c ? 'secondary' : 'outline'} disabled={bezig} onPress={() => setCategorie(c)} />)}</View>
        <Text style={{ color: kleuren.mutedForeground }}>De klus wordt aan jouw werkdag toegevoegd. Vul daarna de tijden in en sla het urensegment op.</Text>
        <Button title="Klus toevoegen en selecteren" variant="outline" loading={bezig} disabled={!online || !omschrijving.trim() || (nieuweKlant && !naam.trim())} onPress={maak} />
        <Button title="Andere klant kiezen" variant="ghost" disabled={bezig} onPress={() => { setKlant(null); setNieuweKlant(false); }} />
      </>}
    </View>}
    {fout && <Text accessibilityRole="alert" style={{ color: kleuren.foreground }}>{fout}</Text>}
  </View>;
}
