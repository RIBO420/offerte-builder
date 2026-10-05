import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Camera, ImageIcon } from 'lucide-react-native';
import { usePhotoCapture } from '../../hooks/use-photo-capture';
import { useVeldOpdracht } from '../../hooks/use-veld-opdracht';
import { Button } from '../ui';
import { Melding } from '../werk/Bouwstenen';
import { tekst } from '../../theme';
import { useVeldKleuren } from './BuitenModus';

export function BezoekFotoActies({ werkitemId, datum }: { werkitemId: string; datum: string }) {
  const kleuren = useVeldKleuren(); const { takePhoto, pickFromGallery } = usePhotoCapture();
  const { verstuur } = useVeldOpdracht(); const [fase, setFase] = useState<'voor' | 'na'>('na');
  const [bezig, setBezig] = useState(false); const [melding, setMelding] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const kiesFoto = async (camera: boolean) => {
    setBezig(true); setMelding(null); setFout(null);
    try {
      const foto = camera ? await takePhoto('situatie') : await pickFromGallery();
      const resultaat = await verstuur('foto', { werkitemId, datum, fase, localUri: foto.uri });
      if (resultaat.status === 'conflict') setFout(resultaat.fout ?? 'Controleer de foto in de wachtrij.');
      else setMelding(resultaat.status === 'wacht' ? 'Foto bewaard op dit toestel. Upload volgt zodra je verbinding hebt.' : 'Foto opgeslagen bij dit bezoek en in het klantdossier.');
    } catch (error) {
      const tekst = error instanceof Error ? error.message : 'Foto opslaan is mislukt.';
      if (!/geannuleerd|cancel/i.test(tekst)) setFout(tekst);
    } finally { setBezig(false); }
  };
  return <View style={{ gap: 10, width: '100%' }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
      <Text style={[tekst.kop, { color: kleuren.foreground }]}>Foto van het bezoek</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}><Button title="Voor" size="sm" variant={fase === 'voor' ? 'secondary' : 'ghost'} disabled={bezig} onPress={() => setFase('voor')} /><Button title="Na" size="sm" variant={fase === 'na' ? 'secondary' : 'ghost'} disabled={bezig} onPress={() => setFase('na')} /></View>
    </View>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={{ flex: 1 }}><Button title="Maak foto" variant="outline" loading={bezig} onPress={() => kiesFoto(true)} icon={<Camera size={16} color={kleuren.foreground} strokeWidth={2} />} fullWidth /></View>
      <View style={{ flex: 1 }}><Button title="Kies uit galerij" variant="ghost" disabled={bezig} onPress={() => kiesFoto(false)} icon={<ImageIcon size={16} color={kleuren.foreground} strokeWidth={2} />} fullWidth /></View>
    </View>
    {melding && <View accessibilityLiveRegion="polite"><Melding toon="succes" tekst={melding} /></View>}
    {fout && <Melding toon="gemist" tekst={fout} />}
  </View>;
}
