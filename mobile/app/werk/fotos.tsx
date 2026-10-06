import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { ImageOff, Search } from 'lucide-react-native';
import { api } from '../../convex/_generated/api';
import { VeldScherm } from '../../components/veld/VeldScherm';
import { useVeldKleuren } from '../../components/veld/BuitenModus';
import { FotoOverzichtDag } from '../../components/veld/FotoOverzichtDag';
import { FotoOverzichtSectie, FotoOverzichtSkelet, type FotoFase, type FotoOverzichtFoto, type FotoOverzichtWachtend } from '../../components/veld/FotoOverzichtSectie';
import { Button } from '../../components/ui';
import { LegeStaat, Melding, Segment } from '../../components/werk/Bouwstenen';
import { useVeldCache } from '../../hooks/use-veld-cache';
import { useVeldOpdracht } from '../../hooks/use-veld-opdracht';
import { useVeldServerActie } from '../../hooks/use-veld-server-actie';
import { useCurrentUser } from '../../hooks/use-current-user';
import { isKantoorRole } from '../../lib/roles';
import { vandaagAmsterdam, schuifDag } from '../../lib/werk-periode';
import { tekst } from '../../theme';

type FotoDag = { bezoeken: { werkitemId: string; naam: string; klantNaam: string | null; fotos: { id: string; fase: FotoFase; url: string | null; doorNaam: string; createdAt?: number; magVerwijderen?: boolean }[] }[] };
type Filter = 'alle' | FotoFase;

const aantalLabel = (n: number) => (n === 1 ? '1 foto' : `${n} foto’s`);
/** "Jan" · "Jan en Piet" · "Jan, Piet +2" */
function fotografen(namen: string[]): string | null {
  const uniek = [...new Set(namen)];
  if (!uniek.length) return null;
  if (uniek.length <= 2) return `door ${uniek.join(' en ')}`;
  return `door ${uniek.slice(0, 2).join(', ')} +${uniek.length - 2}`;
}

export default function FotoScherm() { return <VeldScherm titel="Foto’s van klussen"><Fotos /></VeldScherm>; }

function Fotos() {
  const kleuren = useVeldKleuren(); const router = useRouter(); const { role } = useCurrentUser();
  const { wachtrij } = useVeldOpdracht(); const { voerUit } = useVeldServerActie();
  const [datum, setDatum] = useState(vandaagAmsterdam); const [zoek, setZoek] = useState('');
  const [filter, setFilter] = useState<Filter>('alle'); const [fout, setFout] = useState<string | null>(null);
  const kantoor = isKantoorRole(role);
  const eigen = useQuery(api.werkbezoek.getVoorDag, kantoor ? 'skip' : { datum }) as FotoDag | undefined;
  const alle = useQuery(api.werkbezoek.getKantoorDag, kantoor ? { datum } : 'skip') as FotoDag | undefined;
  const { data, uitCache } = useVeldCache(`fotos:${kantoor ? 'kantoor' : 'eigen'}:${datum}`, kantoor ? alle : eigen);
  const vandaag = vandaagAmsterdam();

  // Foto's die nog op dit toestel wachten, per klus.
  const wachtend = wachtrij.filter(r => r.type === 'foto' && r.payload.datum === datum && typeof r.payload.localUri === 'string');
  const wachtendVoor = (werkitemId: string | null): FotoOverzichtWachtend[] => wachtend
    .filter(r => (werkitemId === null ? !data?.bezoeken.some(b => b.werkitemId === r.payload.werkitemId) : r.payload.werkitemId === werkitemId))
    .map(r => ({ id: r.id, fase: r.payload.fase === 'voor' ? 'voor' : 'na', uri: String(r.payload.localUri), mislukt: r.status === 'conflict' }));

  // Alleen foto's met een url zijn te tonen; de rest (nog in upload of verlopen) melden we apart.
  const alleSecties = (data?.bezoeken ?? []).map(b => ({
    ...b,
    getoond: b.fotos.filter((f): f is FotoOverzichtFoto => !!f.url),
    wachtend: wachtendVoor(b.werkitemId),
  })).filter(b => b.getoond.length || b.wachtend.length);
  const losWachtend = data ? wachtendVoor(null) : [];
  const fases = new Set([...alleSecties.flatMap(b => [...b.getoond, ...b.wachtend].map(f => f.fase)), ...losWachtend.map(w => w.fase)]);
  const toonFilter = fases.size > 1;
  const actiefFilter: Filter = toonFilter ? filter : 'alle';
  const pastFase = (f: { fase: FotoFase }) => actiefFilter === 'alle' || f.fase === actiefFilter;
  const term = zoek.trim().toLowerCase();
  const secties = alleSecties
    .filter(b => !term || `${b.klantNaam ?? ''} ${b.naam}`.toLowerCase().includes(term))
    .map(b => ({ ...b, getoond: b.getoond.filter(pastFase), wachtend: b.wachtend.filter(pastFase) }))
    .filter(b => b.getoond.length || b.wachtend.length);
  const losZichtbaar = term ? [] : losWachtend.filter(pastFase);
  const nietTeTonen = data?.bezoeken.reduce((n, b) => n + b.fotos.filter(f => !f.url).length, 0) ?? 0;
  const totaal = alleSecties.reduce((n, b) => n + b.getoond.length + b.wachtend.length, losWachtend.length);
  const toonZoek = kantoor || alleSecties.length > 3 || zoek.length > 0;
  const ondertitel = `${kantoor ? 'Alle ploegen' : 'Jouw klussen'}${data ? ` · ${aantalLabel(totaal)}` : ''}`;

  const kiesDag = (richting: -1 | 0 | 1) => { setFout(null); setDatum(richting === 0 ? vandaag : schuifDag(datum, richting)); };
  const verwijder = async (id: string) => {
    setFout(null);
    try { await voerUit('werkbezoek:verwijderFoto', { id }); } catch (error) { setFout(error instanceof Error ? error.message : 'Verwijderen mislukt.'); }
  };

  return <>
    <FotoOverzichtDag datum={datum} vandaag={vandaag} ondertitel={ondertitel} onKies={kiesDag} />

    {toonZoek && (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, borderRadius: 12, paddingHorizontal: 12, backgroundColor: kleuren.muted }}>
        <Search size={17} color={kleuren.mutedForeground} strokeWidth={2} />
        <TextInput
          accessibilityLabel="Zoek klant of klus" value={zoek} onChangeText={setZoek} placeholder="Zoek klant of klus"
          placeholderTextColor={kleuren.mutedForeground} clearButtonMode="while-editing" returnKeyType="search"
          style={[tekst.callout, { flex: 1, height: 40, paddingVertical: 0, color: kleuren.foreground }]}
        />
      </View>
    )}
    {toonFilter && (
      <Segment<Filter>
        label="Toon foto’s"
        opties={[{ waarde: 'alle', label: 'Alle' }, { waarde: 'voor', label: 'Voor' }, { waarde: 'na', label: 'Na' }]}
        waarde={actiefFilter}
        onChange={setFilter}
      />
    )}

    {uitCache && <Melding tekst="Laatst geladen overzicht. Foto’s openen vraagt mogelijk verbinding." />}
    {fout && <Melding toon="gemist" tekst={fout} />}

    {!data ? <FotoOverzichtSkelet /> : (
      <View style={{ gap: 28, marginTop: 4 }}>
        {secties.map((b, i) => (
          <FotoOverzichtSectie
            key={`${b.werkitemId}-${i}`}
            titel={b.klantNaam ?? b.naam}
            subtitel={[b.klantNaam ? b.naam : null, fotografen(b.getoond.map(f => f.doorNaam))].filter(Boolean).join(' · ') || null}
            fotos={b.getoond}
            wachtend={b.wachtend}
            onVerwijder={verwijder}
          />
        ))}
        {losZichtbaar.length > 0 && (
          <FotoOverzichtSectie titel="Op dit toestel" subtitel="Wordt geüpload zodra er verbinding is" fotos={[]} wachtend={losZichtbaar} onVerwijder={verwijder} />
        )}
      </View>
    )}

    {nietTeTonen > 0 && <Melding toon="wachten" tekst={nietTeTonen === 1 ? '1 foto kan nu niet worden getoond. Mogelijk is de upload nog bezig; probeer het later opnieuw.' : `${nietTeTonen} foto’s kunnen nu niet worden getoond. Mogelijk is de upload nog bezig; probeer het later opnieuw.`} />}
    {data && !secties.length && !losZichtbaar.length && !nietTeTonen && (
      <LegeStaat
        icoon={ImageOff}
        titel="Geen foto’s gevonden"
        uitleg={term ? 'Geen klus past bij deze zoekterm.' : totaal ? 'Geen foto’s in deze selectie.' : 'Er zijn geen foto’s voor deze dag.'}
      />
    )}

    <Button title="Naar mijn werkdag" variant="outline" fullWidth onPress={() => router.push({ pathname: '/(tabs)/uren', params: { datum } })} />
  </>;
}
