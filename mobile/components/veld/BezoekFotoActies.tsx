import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { usePhotoCapture } from '../../hooks/use-photo-capture';
import { useVeldOpdracht } from '../../hooks/use-veld-opdracht';
import { Button } from '../ui';
import { useBuitenModus } from './BuitenModus';

export function BezoekFotoActies({ werkitemId, datum }: { werkitemId: string; datum: string }) {
  const { kleuren } = useBuitenModus(); const { takePhoto, pickFromGallery } = usePhotoCapture();
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
  return <View style={{ gap: 8, width: '100%' }}>
    <Text style={{ color: kleuren.foreground }}>Foto van het bezoek</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Button title="Voor" variant={fase === 'voor' ? 'secondary' : 'ghost'} disabled={bezig} onPress={() => setFase('voor')} /><Button title="Na" variant={fase === 'na' ? 'secondary' : 'ghost'} disabled={bezig} onPress={() => setFase('na')} /></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Button title="Maak foto" variant="outline" loading={bezig} onPress={() => kiesFoto(true)} /><Button title="Kies uit galerij" variant="ghost" disabled={bezig} onPress={() => kiesFoto(false)} /></View>
    {melding && <Text accessibilityLiveRegion="polite" style={{ color: kleuren.foreground }}>{melding}</Text>}
    {fout && <Text accessibilityRole="alert" style={{ color: kleuren.foreground }}>{fout}</Text>}
  </View>;
}
