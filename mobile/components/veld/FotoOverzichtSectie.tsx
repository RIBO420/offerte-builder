import React, { useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { Text } from '../ui/Tekst';
import { tekst } from '../../theme';
import { amsterdamTijd } from '../../lib/retour-tijd';
import { BezoekFoto } from './BezoekFoto';
import { useIsDonker, useVeldKleuren } from './BuitenModus';

export type FotoFase = 'voor' | 'na';
export interface FotoOverzichtFoto { id: string; fase: FotoFase; url: string; doorNaam: string; createdAt?: number; magVerwijderen?: boolean }
/** Foto die nog op dit toestel staat (outbox), met de lokale uri. */
export interface FotoOverzichtWachtend { id: string; fase: FotoFase; uri: string; mislukt: boolean }

const KOLOMMEN = 3;
const TUSSENRUIMTE = 6;
const RADIUS = 12;
const faseNaam = (fase: FotoFase) => (fase === 'voor' ? 'Voorfoto' : 'Nafoto');
const aantalLabel = (n: number) => (n === 1 ? '1 foto' : `${n} foto’s`);

/**
 * Eén klus in het fotooverzicht: een rustige kop (klant, klus en wie er
 * fotografeerde, telling rechts) met daaronder een vierkant raster van drie
 * kolommen. Geen kaart eromheen: de foto's zijn het vlak.
 */
export function FotoOverzichtSectie({ titel, subtitel, fotos, wachtend = [], onVerwijder }: {
  titel: string; subtitel?: string | null; fotos: FotoOverzichtFoto[]; wachtend?: FotoOverzichtWachtend[];
  onVerwijder: (id: string) => Promise<void>;
}) {
  const kleuren = useVeldKleuren();
  const [breedte, setBreedte] = useState(0);
  const tegel = breedte ? Math.floor((breedte - TUSSENRUIMTE * (KOLOMMEN - 1)) / KOLOMMEN) : 0;
  const aantal = fotos.length + wachtend.length;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 2 }}>
        <View style={{ flex: 1, gap: 1 }}>
          <Text accessibilityRole="header" style={[tekst.kop, { color: kleuren.foreground }]} numberOfLines={1}>{titel}</Text>
          {subtitel ? <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground }]} numberOfLines={1}>{subtitel}</Text> : null}
        </View>
        <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.mutedForeground }]}>{aantalLabel(aantal)}</Text>
      </View>

      <View onLayout={e => setBreedte(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: TUSSENRUIMTE, minHeight: tegel || 100 }}>
        {tegel > 0 && <>
          {fotos.map(foto => {
            const tijd = foto.createdAt ? ` · ${amsterdamTijd(foto.createdAt)}` : '';
            return (
              <BezoekFoto
                key={foto.id}
                url={foto.url}
                grootte={tegel}
                label={`${faseNaam(foto.fase)} · ${titel} · door ${foto.doorNaam}${tijd}`}
                onVerwijder={foto.magVerwijderen ? () => onVerwijder(foto.id) : undefined}
              >
                <FotoOverzichtLabel tekst={foto.fase === 'voor' ? 'Voor' : 'Na'} nadruk={foto.fase === 'na'} />
              </BezoekFoto>
            );
          })}
          {wachtend.map(w => (
            <View
              key={w.id}
              accessible
              accessibilityLabel={`${faseNaam(w.fase)}, ${w.mislukt ? 'niet opgeslagen' : 'wordt geüpload'}`}
              style={{ width: tegel, height: tegel }}
            >
              <Image source={{ uri: w.uri }} resizeMode="cover" style={{ width: tegel, height: tegel, borderRadius: RADIUS, backgroundColor: kleuren.muted, opacity: w.mislukt ? 0.4 : 0.55 }} />
              <FotoOverzichtLabel tekst={w.mislukt ? 'Mislukt' : 'Uploaden'} bezig={!w.mislukt} fout={w.mislukt} />
            </View>
          ))}
        </>}
      </View>
    </View>
  );
}

/** Laadstaat: een kop en drie lege tegels, zodat het scherm niet verspringt. */
export function FotoOverzichtSkelet() {
  const kleuren = useVeldKleuren();
  const [breedte, setBreedte] = useState(0);
  const tegel = breedte ? Math.floor((breedte - TUSSENRUIMTE * (KOLOMMEN - 1)) / KOLOMMEN) : 0;
  return (
    <View accessible accessibilityLabel="Foto’s laden" style={{ gap: 10 }}>
      <View style={{ gap: 6, paddingHorizontal: 2 }}>
        <View style={{ width: '45%', height: 14, borderRadius: 7, backgroundColor: kleuren.muted }} />
        <View style={{ width: '30%', height: 10, borderRadius: 5, backgroundColor: kleuren.muted }} />
      </View>
      <View onLayout={e => setBreedte(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', gap: TUSSENRUIMTE, minHeight: tegel || 100 }}>
        {tegel > 0 && [0, 1, 2].map(i => <View key={i} style={{ width: tegel, height: tegel, borderRadius: RADIUS, backgroundColor: kleuren.muted }} />)}
      </View>
    </View>
  );
}

/**
 * Klein label linksonder op een tegel: een licht (of in donker: donker) matglas
 * pilletje uit de tokens, leesbaar op elke foto. "Na" krijgt het merkgroen.
 */
function FotoOverzichtLabel({ tekst: label, nadruk, bezig, fout }: { tekst: string; nadruk?: boolean; bezig?: boolean; fout?: boolean }) {
  const kleuren = useVeldKleuren();
  const donker = useIsDonker();
  const kleur = fout ? kleuren.danger : nadruk ? kleuren.primary : kleuren.foreground;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', left: 5, bottom: 5, flexDirection: 'row', alignItems: 'center', gap: 4,
        borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2,
        backgroundColor: kleuren.surfaceOverlay, borderWidth: donker ? 0 : 0.5, borderColor: kleuren.border,
      }}
    >
      {bezig && <ActivityIndicator size="small" color={kleuren.mutedForeground} style={{ transform: [{ scale: 0.6 }], width: 12, height: 12 }} />}
      <Text style={[tekst.bijschrift, { color: kleur, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}
