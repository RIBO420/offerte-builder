/**
 * FotoGalerij — Top Tuinen Mobile App
 *
 * Component voor het weergeven en beheren van een fotogalerij.
 * Ondersteunt grid-weergave, fullscreen met pinch-to-zoom,
 * swipe-to-delete en het toevoegen van nieuwe foto's.
 *
 * VEREISTE INSTALLATIES (nog niet in package.json):
 *   expo install expo-image-picker expo-location expo-image-manipulator
 *
 * react-native-reanimated is al aanwezig.
 * react-native-gesture-handler is vereist voor GestureDetector:
 *   expo install react-native-gesture-handler
 */

import React, { useState, useCallback, useRef, type ComponentType } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Camera, Eye, Image as ImageIcoon, Map as KaartIcoon, MapPin, Plus, TriangleAlert, X, ZoomIn } from 'lucide-react-native';
import { usePhotoCapture, type CapturedPhoto, type FotoType } from '@/hooks/use-photo-capture';
import { tekst } from '../theme';
import { useVeldKleuren } from './veld/BuitenModus';
import { Drukvlak, IcoonTegel, SectieKop, toonKleuren, type Toon } from './werk/Bouwstenen';

type Icoon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

// ============================================
// CONSTANTEN & HELPERS
// ============================================

const { width: SCHERM_BREEDTE, height: SCHERM_HOOGTE } = Dimensions.get('window');
const KOLOM_BREEDTE = (SCHERM_BREEDTE - 48) / 2; // 2 kolommen met padding

/**
 * Lagen bovenop een foto of camerabeeld. Die blijven in licht én donker thema
 * donker met lichte tekst: het beeld eronder bepaalt het contrast, niet het thema.
 */
export const BEELD_OVERLAY = {
  scrim: 'rgba(0,0,0,0.55)',
  achtergrond: 'rgba(0,0,0,0.95)',
  tekst: 'rgba(255,255,255,0.96)',
  tekstGedempt: 'rgba(255,255,255,0.7)',
} as const;

const FOTO_TYPE_CONFIG: Record<FotoType, { label: string; toon: Toon; icoon: Icoon }> = {
  situatie: { label: 'Situatie',  toon: 'info',     icoon: Eye },
  detail:   { label: 'Detail',    toon: 'neutraal', icoon: ZoomIn },
  probleem: { label: 'Probleem',  toon: 'gemist',   icoon: TriangleAlert },
  overzicht:{ label: 'Overzicht', toon: 'succes',   icoon: KaartIcoon },
};

function formateerDatum(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================
// SUBCOMPONENTEN
// ============================================

interface TypeBadgeProps {
  type: FotoType;
  klein?: boolean;
}

/** Fototype als pil op een vast kaartvlak, zodat hij op elke foto leesbaar blijft. */
const TypeBadge = React.memo(({ type, klein = false }: TypeBadgeProps) => {
  const kleuren = useVeldKleuren();
  const config = FOTO_TYPE_CONFIG[type];
  const { voor } = toonKleuren(kleuren, config.toon);
  const I = config.icoon;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 4,
        backgroundColor: kleuren.card,
        borderRadius: 999,
        paddingHorizontal: klein ? 7 : 10,
        paddingVertical: klein ? 2 : 4,
      }}
    >
      <I size={klein ? 12 : 14} color={voor} strokeWidth={2.25} />
      <Text style={[klein ? tekst.bijschrift : tekst.voetnoot, { color: voor, fontWeight: '600' }]}>
        {config.label}
      </Text>
    </View>
  );
});
TypeBadge.displayName = 'TypeBadge';

// ----------------------------------------
// Foto-thumbnail in het grid
// ----------------------------------------

interface FotoItemProps {
  foto: CapturedPhoto;
  index: number;
  onTik: (index: number) => void;
  onVerwijder: (index: number) => void;
}

const FotoItem = React.memo(({ foto, index, onTik, onVerwijder }: FotoItemProps) => {
  const kleuren = useVeldKleuren();
  const verschuiving = useSharedValue(0);

  const geanimeerdeStijl = useAnimatedStyle(() => ({
    transform: [{ translateX: verschuiving.get() }],
  }));

  const handleVerwijder = useCallback(() => {
    Alert.alert(
      'Foto verwijderen',
      'Weet je zeker dat je deze foto wilt verwijderen?',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Verwijderen',
          style: 'destructive',
          onPress: () => {
            verschuiving.set(withSpring(-SCHERM_BREEDTE, {}, () => {
              scheduleOnRN(onVerwijder, index);
            }));
          },
        },
      ]
    );
  }, [index, onVerwijder, verschuiving]);

  return (
    <Animated.View
      style={[
        stijlen.fotoItem,
        { backgroundColor: kleuren.muted, borderColor: kleuren.border },
        geanimeerdeStijl,
      ]}
    >
      {/* Pressable i.p.v. Drukvlak: de foto heeft naast tikken ook lang-drukken (verwijderen). */}
      <Pressable
        onPress={() => onTik(index)}
        onLongPress={handleVerwijder}
        accessibilityRole="button"
        accessibilityLabel={`Foto ${index + 1}, ${FOTO_TYPE_CONFIG[foto.type].label}${foto.beschrijving ? `, ${foto.beschrijving}` : ''}`}
        accessibilityHint="Opent de foto groot. Lang drukken verwijdert hem"
        accessibilityActions={[{ name: 'longpress', label: 'Verwijderen' }]}
        onAccessibilityAction={e => { if (e.nativeEvent.actionName === 'longpress') handleVerwijder(); }}
        style={({ pressed }) => ({ width: '100%', height: '100%', opacity: pressed ? 0.85 : 1 })}
      >
        <Image
          source={{ uri: foto.uri }}
          style={stijlen.thumbnail}
          resizeMode="cover"
        />

        {/* Type-badge linksboven */}
        <View style={stijlen.badgePositie}>
          <TypeBadge type={foto.type} klein />
        </View>

        {/* GPS-indicator rechtsonder */}
        {foto.latitude !== undefined && (
          <View
            accessibilityLabel="Locatie vastgelegd"
            style={[stijlen.rondOpBeeld, { bottom: 6, right: 6, width: 24, height: 24, borderRadius: 12 }]}
          >
            <MapPin size={13} color={BEELD_OVERLAY.tekst} strokeWidth={2.25} />
          </View>
        )}

        {/* Beschrijving onderaan als aanwezig */}
        {foto.beschrijving !== undefined && foto.beschrijving.length > 0 && (
          <View style={stijlen.beschrijvingOverlay}>
            <Text style={[tekst.bijschrift, { color: BEELD_OVERLAY.tekst, fontWeight: '400' }]} numberOfLines={1}>
              {foto.beschrijving}
            </Text>
          </View>
        )}
      </Pressable>

      {/* Verwijder-knop rechtsboven (lange druk op de foto werkt ook) */}
      <Drukvlak
        onPress={handleVerwijder}
        accessibilityLabel="Foto verwijderen"
        buitenStijl={{ position: 'absolute', top: 0, right: 0, padding: 6 }}
        style={[stijlen.rondOpBeeld, { position: 'relative', width: 30, height: 30, borderRadius: 15 }]}
      >
        <X size={16} color={BEELD_OVERLAY.tekst} strokeWidth={2.5} />
      </Drukvlak>
    </Animated.View>
  );
});
FotoItem.displayName = 'FotoItem';

// ----------------------------------------
// Type-selector (4 knoppen)
// ----------------------------------------

interface TypeSelectorProps {
  geselecteerd: FotoType;
  onChange: (type: FotoType) => void;
}

const TypeSelector = React.memo(({ geselecteerd, onChange }: TypeSelectorProps) => {
  const kleuren = useVeldKleuren();
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
      {(Object.entries(FOTO_TYPE_CONFIG) as [FotoType, typeof FOTO_TYPE_CONFIG[FotoType]][]).map(
        ([type, config]) => {
          const actief = geselecteerd === type;
          const { voor, achter } = toonKleuren(kleuren, config.toon);
          const I = config.icoon;
          return (
            <Drukvlak
              key={type}
              onPress={() => onChange(type)}
              haptic="selection"
              accessibilityLabel={config.label}
              accessibilityState={{ selected: actief }}
              buitenStijl={{ flex: 1 }}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                minHeight: 60,
                paddingVertical: 8,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: actief ? voor : kleuren.border,
                backgroundColor: actief ? achter : kleuren.card,
              }}
            >
              <I size={18} color={voor} strokeWidth={2.25} />
              <Text
                numberOfLines={1}
                style={[tekst.bijschrift, { color: actief ? voor : kleuren.foreground, fontWeight: actief ? '700' : '500' }]}
              >
                {config.label}
              </Text>
            </Drukvlak>
          );
        }
      )}
    </View>
  );
});
TypeSelector.displayName = 'TypeSelector';

// ----------------------------------------
// Fullscreen foto-weergave
// ----------------------------------------

interface FullscreenFotoProps {
  foto: CapturedPhoto;
  zichtbaar: boolean;
  onSluit: () => void;
}

function FullscreenFoto({ foto, zichtbaar, onSluit }: FullscreenFotoProps) {
  return (
    <Modal
      visible={zichtbaar}
      transparent
      animationType="fade"
      onRequestClose={onSluit}
    >
      {/* Fotoweergave: altijd een donker podium, ook in het lichte thema. */}
      <View style={{ flex: 1, backgroundColor: BEELD_OVERLAY.achtergrond }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          {/* Sluit-knop */}
          <Drukvlak
            onPress={onSluit}
            accessibilityLabel="Sluiten"
            buitenStijl={stijlen.sluitKnopPositie}
            style={[stijlen.rondOpBeeld, { position: 'relative', width: 44, height: 44, borderRadius: 22 }]}
          >
            <X size={24} color={BEELD_OVERLAY.tekst} strokeWidth={2.25} />
          </Drukvlak>

          {/* Foto (ScrollView voor pinch-to-zoom via maximizeContentSize) */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={stijlen.fullscreenScrollContent}
            maximumZoomScale={4}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            bouncesZoom
            centerContent
          >
            <Image
              source={{ uri: foto.uri }}
              style={stijlen.fullscreenAfbeelding}
              resizeMode="contain"
            />
          </ScrollView>

          {/* Metadata onderin */}
          <View style={{ padding: 16, gap: 8 }}>
            <TypeBadge type={foto.type} />
            <Text style={[tekst.voetnoot, tekst.cijfers, { color: BEELD_OVERLAY.tekstGedempt }]}>{formateerDatum(foto.timestamp)}</Text>
            {foto.latitude !== undefined && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MapPin size={14} color={BEELD_OVERLAY.tekst} strokeWidth={2.25} />
                <Text style={[tekst.voetnoot, { color: BEELD_OVERLAY.tekst }]}>Locatie vastgelegd</Text>
              </View>
            )}
            {foto.beschrijving !== undefined && foto.beschrijving.length > 0 && (
              <Text style={[tekst.callout, { color: BEELD_OVERLAY.tekst }]}>{foto.beschrijving}</Text>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ----------------------------------------
// Foto-toevoeg modal (camera/galerij + beschrijving)
// ----------------------------------------

interface FotoToevoegModalProps {
  zichtbaar: boolean;
  onSluit: () => void;
  onFotoToegevoegd: (foto: CapturedPhoto) => void;
  takePhoto: ReturnType<typeof usePhotoCapture>['takePhoto'];
  pickFromGallery: ReturnType<typeof usePhotoCapture>['pickFromGallery'];
}

function FotoToevoegModal({
  zichtbaar,
  onSluit,
  onFotoToegevoegd,
  takePhoto,
  pickFromGallery,
}: FotoToevoegModalProps) {
  const kleuren = useVeldKleuren();
  const [geselecteerdType, setGeselecteerdType] = useState<FotoType>('situatie');
  const [beschrijving, setBeschrijving] = useState('');
  const [nieuweFoto, setNieuweFoto] = useState<CapturedPhoto | null>(null);
  const [isBezig, setIsBezig] = useState(false);

  const reset = useCallback(() => {
    setNieuweFoto(null);
    setBeschrijving('');
    setGeselecteerdType('situatie');
    setIsBezig(false);
  }, []);

  const handleSluit = useCallback(() => {
    reset();
    onSluit();
  }, [reset, onSluit]);

  const handleMaakFoto = useCallback(async () => {
    setIsBezig(true);
    try {
      const foto = await takePhoto(geselecteerdType);
      setNieuweFoto(foto);
    } catch (err) {
      const bericht = err instanceof Error ? err.message : 'Foto maken mislukt.';
      Alert.alert('Fout', bericht);
    } finally {
      setIsBezig(false);
    }
  }, [takePhoto, geselecteerdType]);

  const handleKiesUitGalerij = useCallback(async () => {
    setIsBezig(true);
    try {
      const foto = await pickFromGallery();
      const metType: CapturedPhoto = { ...foto, type: geselecteerdType };
      setNieuweFoto(metType);
    } catch (err) {
      const bericht = err instanceof Error ? err.message : 'Foto kiezen mislukt.';
      Alert.alert('Fout', bericht);
    } finally {
      setIsBezig(false);
    }
  }, [pickFromGallery, geselecteerdType]);

  const handleBevestig = useCallback(() => {
    if (nieuweFoto === null) return;
    const definitief: CapturedPhoto = {
      ...nieuweFoto,
      beschrijving: beschrijving.trim() !== '' ? beschrijving.trim() : undefined,
    };
    onFotoToegevoegd(definitief);
    reset();
    onSluit();
  }, [nieuweFoto, beschrijving, onFotoToegevoegd, onSluit, reset]);

  const bronKnop = (icoon: Icoon, toon: Toon, titel: string, sub: string, onPress: () => void) => (
    <Drukvlak
      onPress={onPress}
      disabled={isBezig}
      accessibilityLabel={`${titel}, ${sub}`}
      buitenStijl={{ flex: 1 }}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 22,
        paddingHorizontal: 12,
        borderRadius: 18,
        backgroundColor: kleuren.card,
        borderWidth: 1,
        borderColor: kleuren.border,
      }}
    >
      <IcoonTegel icoon={icoon} toon={toon} grootte={48} />
      <Text style={[tekst.kop, { color: kleuren.foreground }]}>{titel}</Text>
      <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, textAlign: 'center' }]}>{sub}</Text>
    </Drukvlak>
  );

  return (
    <Modal
      visible={zichtbaar}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleSluit}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, minHeight: 56, borderBottomWidth: 1, borderBottomColor: kleuren.border }}>
          <Drukvlak onPress={handleSluit} accessibilityLabel="Annuleren" buitenStijl={{ width: 96 }} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
            <Text style={[tekst.body, { color: kleuren.primary }]}>Annuleren</Text>
          </Drukvlak>
          <Text accessibilityRole="header" style={[tekst.kop, { color: kleuren.foreground }]}>Foto toevoegen</Text>
          {nieuweFoto !== null ? (
            <Drukvlak onPress={handleBevestig} accessibilityLabel="Opslaan" buitenStijl={{ width: 96 }} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 8 }}>
              <Text style={[tekst.kop, { color: kleuren.primary }]}>Opslaan</Text>
            </Drukvlak>
          ) : (
            <View style={{ width: 96 }} />
          )}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 8 }} showsVerticalScrollIndicator={false}>
          {/* Type-selectie */}
          <SectieKop titel="Fototype" />
          <TypeSelector geselecteerd={geselecteerdType} onChange={setGeselecteerdType} />

          {/* Foto-preview of actie-knoppen */}
          {nieuweFoto !== null ? (
            <>
              <Image
                source={{ uri: nieuweFoto.uri }}
                style={{ width: '100%', height: 220, borderRadius: 18, backgroundColor: kleuren.muted }}
                resizeMode="cover"
              />
              {nieuweFoto.latitude !== undefined && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <MapPin size={14} color={kleuren.success} strokeWidth={2.25} />
                  <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.success }]}>
                    Locatie vastgelegd ({nieuweFoto.latitude.toFixed(4)}, {nieuweFoto.longitude?.toFixed(4)})
                  </Text>
                </View>
              )}

              {/* Beschrijving-input */}
              <SectieKop titel="Beschrijving (optioneel)" />
              <TextInput
                style={{
                  backgroundColor: kleuren.card,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: kleuren.border,
                  padding: 12,
                  fontSize: tekst.body.fontSize,
                  color: kleuren.foreground,
                  minHeight: 96,
                  textAlignVertical: 'top',
                }}
                value={beschrijving}
                onChangeText={setBeschrijving}
                placeholder="Voeg een korte beschrijving toe..."
                placeholderTextColor={kleuren.mutedForeground}
                accessibilityLabel="Beschrijving"
                multiline
                numberOfLines={3}
                maxLength={300}
                returnKeyType="done"
              />
              <Text style={[tekst.bijschrift, tekst.cijfers, { color: kleuren.mutedForeground, textAlign: 'right', fontWeight: '400' }]}>
                {beschrijving.length}/300
              </Text>
            </>
          ) : (
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              {bronKnop(Camera, 'primair', 'Camera', 'Maak een nieuwe foto', handleMaakFoto)}
              {bronKnop(ImageIcoon, 'info', 'Galerij', 'Kies uit je bibliotheek', handleKiesUitGalerij)}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ============================================
// HOOFD-COMPONENT
// ============================================

interface FotoGalerijProps {
  /** Maximaal aantal foto's dat toegestaan is */
  maxFotos?: number;
  /** Externe foto's (voor gecontroleerde modus) */
  fotos?: CapturedPhoto[];
  /** Callback bij wijziging van de foto-lijst */
  onChange?: (fotos: CapturedPhoto[]) => void;
}

/**
 * FotoGalerij
 *
 * Toont een grid van foto's met type-badges, GPS-indicatoren
 * en een knop om nieuwe foto's toe te voegen via camera of galerij.
 *
 * Ondersteunt zowel interne state (ongecontroleerd) als
 * externe state via `fotos` + `onChange` props.
 */
export function FotoGalerij({ maxFotos = 10, fotos: externeFootos, onChange }: FotoGalerijProps) {
  const kleuren = useVeldKleuren();
  const isGecontroleerd = externeFootos !== undefined;

  const { takePhoto, pickFromGallery, photos: interneFootos, removePhoto: verwijderIntern } = usePhotoCapture();
  const fotos = isGecontroleerd ? externeFootos : interneFootos;

  const [toevoegModalZichtbaar, setToevoegModalZichtbaar] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);

  // In gecontroleerde modus houden we een extra ref bij voor de foto-lijst
  const interneFootosRef = useRef<CapturedPhoto[]>(fotos);
  // eslint-disable-next-line react-hooks/refs -- Syncing ref with latest props for use in callbacks (standard pattern)
  interneFootosRef.current = fotos;

  const handleFotoToegevoegd = useCallback((foto: CapturedPhoto) => {
    if (isGecontroleerd && onChange !== undefined) {
      onChange([...interneFootosRef.current, foto]);
    }
    // In ongecontroleerde modus zorgt usePhotoCapture zelf voor de state-update
  }, [isGecontroleerd, onChange]);

  const handleVerwijder = useCallback((index: number) => {
    if (isGecontroleerd && onChange !== undefined) {
      onChange(interneFootosRef.current.filter((_, i) => i !== index));
    } else {
      verwijderIntern(index);
    }
    // Sluit fullscreen als de foto verwijderd wordt die bekeken wordt
    if (fullscreenIndex === index) {
      setFullscreenIndex(null);
    }
  }, [isGecontroleerd, onChange, verwijderIntern, fullscreenIndex]);

  const aantalFotos = fotos.length;
  const magMeerToevoegen = aantalFotos < maxFotos;

  return (
    <View style={{ flex: 1 }}>
      {/* Header: teller + toevoeg-knop */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, minHeight: 36 }}>
        <Text style={[tekst.sub, tekst.cijfers, { color: kleuren.mutedForeground }]}>
          {aantalFotos}/{maxFotos} foto{aantalFotos !== 1 ? '\'s' : ''}
        </Text>
        {magMeerToevoegen && (
          <Drukvlak
            onPress={() => setToevoegModalZichtbaar(true)}
            accessibilityLabel="Foto toevoegen"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: kleuren.primarySoft }}
          >
            <Plus size={16} color={kleuren.primary} strokeWidth={2.5} />
            <Text style={[tekst.voetnoot, { color: kleuren.primary, fontWeight: '600', fontSize: 14 }]}>Foto toevoegen</Text>
          </Drukvlak>
        )}
      </View>

      {/* Grid */}
      {aantalFotos === 0 ? (
        <Drukvlak
          onPress={() => setToevoegModalZichtbaar(true)}
          accessibilityLabel="Nog geen foto's. Tik om een foto toe te voegen"
          style={{
            height: 160,
            borderRadius: 18,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: kleuren.border,
            backgroundColor: kleuren.muted,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <IcoonTegel icoon={Camera} toon="neutraal" grootte={44} />
          <Text style={[tekst.kop, { color: kleuren.foreground }]}>Nog geen foto&apos;s</Text>
          <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground }]}>Tik om een foto toe te voegen</Text>
        </Drukvlak>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {fotos.map((foto, index) => (
            <FotoItem
              key={`${foto.uri}-${index}`}
              foto={foto}
              index={index}
              onTik={setFullscreenIndex}
              onVerwijder={handleVerwijder}
            />
          ))}
        </View>
      )}

      {/* Fullscreen modal */}
      {fullscreenIndex !== null && fullscreenIndex < fotos.length && (
        <FullscreenFoto
          foto={fotos[fullscreenIndex]}
          zichtbaar
          onSluit={() => setFullscreenIndex(null)}
        />
      )}

      {/* Toevoeg-modal */}
      <FotoToevoegModal
        zichtbaar={toevoegModalZichtbaar}
        onSluit={() => setToevoegModalZichtbaar(false)}
        onFotoToegevoegd={handleFotoToegevoegd}
        takePhoto={takePhoto}
        pickFromGallery={pickFromGallery}
      />
    </View>
  );
}

export default FotoGalerij;

// ============================================
// STIJLEN (lay-out; kleuren komen uit het thema)
// ============================================

const stijlen = StyleSheet.create({
  fotoItem: {
    width: KOLOM_BREEDTE,
    height: KOLOM_BREEDTE,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  badgePositie: {
    position: 'absolute',
    top: 6,
    left: 6,
  },
  rondOpBeeld: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BEELD_OVERLAY.scrim,
  },
  beschrijvingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BEELD_OVERLAY.scrim,
    paddingHorizontal: 8,
    paddingVertical: 4,
    paddingRight: 36,
  },
  sluitKnopPositie: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 16,
    right: 16,
    zIndex: 10,
  },
  fullscreenScrollContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenAfbeelding: {
    width: SCHERM_BREEDTE,
    height: SCHERM_HOOGTE * 0.7,
  },
});
