import React, { useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { Text } from '../ui/Tekst';
import { Camera, ImageIcon } from 'lucide-react-native';
import { usePhotoCapture } from '../../hooks/use-photo-capture';
import { useVeldOpdracht } from '../../hooks/use-veld-opdracht';
import { useVeldServerActie } from '../../hooks/use-veld-server-actie';
import { Button } from '../ui';
import { Melding, Segment } from '../werk/Bouwstenen';
import { tekst } from '../../theme';
import { BezoekFoto } from './BezoekFoto';
import { useIsDonker, useVeldKleuren } from './BuitenModus';

export interface BezoekFotoData { id: string; fase: 'voor' | 'na'; url: string | null; doorNaam: string; magVerwijderen?: boolean }

const KOLOMMEN = 4;
const TUSSENRUIMTE = 8;
const faseNaam = (fase: unknown) => (fase === 'voor' ? 'Voorfoto' : 'Nafoto');

/**
 * Foto's maken bij een bezoek, met direct daaronder wat er al bij staat: de
 * opgeslagen foto's van de server én wat nog op dit toestel wacht. Zo ziet de
 * medewerker meteen dat zijn foto erbij zit, ook zonder verbinding.
 */
export function BezoekFotoActies({ werkitemId, datum, fotos = [], naam }: { werkitemId: string; datum: string; fotos?: BezoekFotoData[]; naam?: string }) {
  const kleuren = useVeldKleuren(); const { takePhoto, pickFromGallery } = usePhotoCapture();
  const { verstuur, wachtrij } = useVeldOpdracht(); const { voerUit } = useVeldServerActie();
  const [fase, setFase] = useState<'voor' | 'na'>('na');
  const [bezig, setBezig] = useState<'camera' | 'galerij' | null>(null);
  const [melding, setMelding] = useState<string | null>(null); const [fout, setFout] = useState<string | null>(null);
  const [breedte, setBreedte] = useState(0);
  const tegel = breedte ? Math.floor((breedte - TUSSENRUIMTE * (KOLOMMEN - 1)) / KOLOMMEN) : 0;
  const wachtend = wachtrij.filter(r => r.type === 'foto' && r.payload.werkitemId === werkitemId && r.payload.datum === datum && typeof r.payload.localUri === 'string');
  const opgeslagen = fotos.filter(f => f.url);
  const aantal = opgeslagen.length + wachtend.length;

  const kiesFoto = async (camera: boolean) => {
    setBezig(camera ? 'camera' : 'galerij'); setMelding(null); setFout(null);
    try {
      const foto = camera ? await takePhoto('situatie') : await pickFromGallery();
      const resultaat = await verstuur('foto', { werkitemId, datum, fase, localUri: foto.uri });
      if (resultaat.status === 'conflict') setFout(resultaat.fout ?? 'Controleer de foto in de wachtrij.');
      else if (resultaat.status !== 'wacht') setMelding(`${faseNaam(fase)} toegevoegd aan dit bezoek en het klantdossier.`);
    } catch (error) {
      const tekst = error instanceof Error ? error.message : 'Foto opslaan is mislukt.';
      if (!/geannuleerd|cancel/i.test(tekst)) setFout(tekst);
    } finally { setBezig(null); }
  };
  const verwijder = async (id: string) => {
    setFout(null); setMelding(null);
    try { await voerUit('werkbezoek:verwijderFoto', { id }); } catch (error) { setFout(error instanceof Error ? error.message : 'Verwijderen mislukt.'); }
  };

  return <View style={{ gap: 12, width: '100%' }}>
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
      <Text accessibilityRole="header" style={[tekst.kop, { color: kleuren.foreground }]}>Foto&apos;s van dit bezoek</Text>
      {aantal > 0 && <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.mutedForeground }]}>{aantal === 1 ? '1 foto' : `${aantal} foto's`}</Text>}
    </View>

    {aantal > 0 && (
      <View onLayout={e => setBreedte(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: TUSSENRUIMTE }}>
        {tegel > 0 && <>
          {opgeslagen.map(foto => (
            <BezoekFoto key={foto.id} url={foto.url!} grootte={tegel} label={`${faseNaam(foto.fase)} van ${naam ?? 'dit bezoek'} · ${foto.doorNaam}`} onVerwijder={foto.magVerwijderen ? () => verwijder(foto.id) : undefined}>
              <TegelLabel tekst={foto.fase === 'voor' ? 'Voor' : 'Na'} />
            </BezoekFoto>
          ))}
          {wachtend.map(r => (
            <View key={r.id} accessibilityLabel={`${faseNaam(r.payload.fase)}, ${r.status === 'conflict' ? 'niet opgeslagen' : 'wordt geüpload'}`} style={{ width: tegel, height: tegel }}>
              <Image source={{ uri: String(r.payload.localUri) }} resizeMode="cover" style={{ width: tegel, height: tegel, borderRadius: 12, backgroundColor: kleuren.muted, opacity: r.status === 'conflict' ? 0.5 : 0.75 }} />
              {r.status !== 'conflict' && <ActivityIndicator color={kleuren.opBeeld} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />}
              <TegelLabel tekst={r.status === 'conflict' ? 'Mislukt' : 'Uploaden'} toon={r.status === 'conflict' ? 'fout' : 'neutraal'} />
            </View>
          ))}
        </>}
      </View>
    )}

    <Segment
      label="Soort foto"
      opties={[{ waarde: 'voor', label: 'Voor het werk' }, { waarde: 'na', label: 'Na het werk' }]}
      waarde={fase}
      onChange={setFase}
    />
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={{ flex: 1 }}><Button title="Maak foto" variant="secondary" loading={bezig === 'camera'} disabled={bezig !== null} onPress={() => kiesFoto(true)} icon={<Camera size={16} color={kleuren.primary} strokeWidth={2} />} fullWidth /></View>
      <View style={{ flex: 1 }}><Button title="Uit galerij" variant="outline" loading={bezig === 'galerij'} disabled={bezig !== null} onPress={() => kiesFoto(false)} icon={<ImageIcon size={16} color={kleuren.foreground} strokeWidth={2} />} fullWidth /></View>
    </View>
    {melding && <View accessibilityLiveRegion="polite"><Melding toon="succes" tekst={melding} /></View>}
    {wachtend.some(r => r.status === 'wacht') && <Melding toon="wachten" tekst="Foto staat op dit toestel en wordt geüpload zodra er verbinding is." />}
    {fout && <Melding toon="gemist" tekst={fout} />}
  </View>;
}

/** Klein label linksonder op een fototegel, leesbaar op elke foto. */
function TegelLabel({ tekst: label, toon = 'neutraal' }: { tekst: string; toon?: 'neutraal' | 'fout' }) {
  const kleuren = useVeldKleuren(); const donker = useIsDonker();
  return (
    <View style={{ position: 'absolute', left: 6, bottom: 6, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: toon === 'fout' ? kleuren.destructive : `${kleuren.beeldDonker}8C` }}>
      <Text style={[tekst.bijschrift, { color: toon === 'fout' ? kleuren.destructiveForeground : kleuren.opBeeld, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}
