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

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
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
  runOnJS,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { usePhotoCapture, type CapturedPhoto, type FotoType } from '@/hooks/use-photo-capture';

// ============================================
// CONSTANTEN & HELPERS
// ============================================

const { width: SCHERM_BREEDTE, height: SCHERM_HOOGTE } = Dimensions.get('window');
const KOLOM_BREEDTE = (SCHERM_BREEDTE - 48) / 2; // 2 kolommen met padding

const FOTO_TYPE_CONFIG: Record<FotoType, { label: string; kleur: string; icoon: string }> = {
  situatie: { label: 'Situatie',  kleur: '#3b82f6', icoon: 'eye' },
  detail:   { label: 'Detail',    kleur: '#8b5cf6', icoon: 'zoom-in' },
  probleem: { label: 'Probleem',  kleur: '#ef4444', icoon: 'alert-triangle' },
  overzicht:{ label: 'Overzicht', kleur: '#10b981', icoon: 'map' },
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

const TypeBadge = React.memo(({ type, klein = false }: TypeBadgeProps) => {
  const config = FOTO_TYPE_CONFIG[type];
  return (
    <View
      style={[
        stijlen.typeBadge,
        { backgroundColor: config.kleur + '22', borderColor: config.kleur + '66' },
        klein && stijlen.typeBadgeKlein,
      ]}
    >
      <Feather
        name={config.icoon as 'eye'}
        size={klein ? 10 : 12}
        color={config.kleur}
      />
      <Text style={[stijlen.typeBadgeTekst, { color: config.kleur }, klein && stijlen.typeBadgeTekstKlein]}>
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
  const verschuiving = useSharedValue(0);

  const geanimeerdeStijl = useAnimatedStyle(() => ({
    transform: [{ translateX: verschuiving.value }],
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
            verschuiving.value = withSpring(-SCHERM_BREEDTE, {}, () => {
              runOnJS(onVerwijder)(index);
            });
          },
        },
      ]
    );
  }, [index, onVerwijder, verschuiving]);

  return (
    <Animated.View style={[stijlen.fotoItem, geanimeerdeStijl]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onTik(index)}
        onLongPress={handleVerwijder}
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
          <View style={stijlen.gpsPositie}>
            <Feather name="map-pin" size={10} color="#ffffff" />
          </View>
        )}

        {/* Verwijder-knop rechtsbovenin */}
        <TouchableOpacity
          style={stijlen.verwijderKnop}
          onPress={handleVerwijder}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Feather name="x" size={12} color="#ffffff" />
        </TouchableOpacity>

        {/* Beschrijving onderaan als aanwezig */}
        {foto.beschrijving !== undefined && foto.beschrijving.length > 0 && (
          <View style={stijlen.beschrijvingOverlay}>
            <Text style={stijlen.beschrijvingTekstKlein} numberOfLines={1}>
              {foto.beschrijving}
            </Text>
          </View>
        )}
      </TouchableOpacity>
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

const TypeSelector = React.memo(({ geselecteerd, onChange }: TypeSelectorProps) => (
  <View style={stijlen.typeSelector}>
    {(Object.entries(FOTO_TYPE_CONFIG) as [FotoType, typeof FOTO_TYPE_CONFIG[FotoType]][]).map(
      ([type, config]) => {
        const actief = geselecteerd === type;
        return (
          <TouchableOpacity
            key={type}
            style={[
              stijlen.typeSelectorKnop,
              actief && { backgroundColor: config.kleur, borderColor: config.kleur },
            ]}
            onPress={() => onChange(type)}
            activeOpacity={0.7}
          >
            <Feather
              name={config.icoon as 'eye'}
              size={16}
              color={actief ? '#ffffff' : config.kleur}
            />
            <Text
              style={[
                stijlen.typeSelectorTekst,
                { color: actief ? '#ffffff' : config.kleur },
              ]}
            >
              {config.label}
            </Text>
          </TouchableOpacity>
        );
      }
    )}
  </View>
));
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
      <View style={stijlen.fullscreenAchtergrond}>
        <SafeAreaView style={stijlen.fullscreenContainer} edges={['top', 'bottom']}>
          {/* Sluit-knop */}
          <TouchableOpacity style={stijlen.sluitKnop} onPress={onSluit}>
            <Feather name="x" size={24} color="#ffffff" />
          </TouchableOpacity>

          {/* Foto (ScrollView voor pinch-to-zoom via maximizeContentSize) */}
          <ScrollView
            style={stijlen.fullscreenScroll}
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
          <View style={stijlen.fullscreenMeta}>
            <TypeBadge type={foto.type} />
            <Text style={stijlen.fullscreenTijdstip}>{formateerDatum(foto.timestamp)}</Text>
            {foto.latitude !== undefined && (
              <View style={stijlen.gpsRij}>
                <Feather name="map-pin" size={14} color="#34d399" />
                <Text style={stijlen.gpsTekst}>Locatie vastgelegd</Text>
              </View>
            )}
            {foto.beschrijving !== undefined && foto.beschrijving.length > 0 && (
              <Text style={stijlen.fullscreenBeschrijving}>{foto.beschrijving}</Text>
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

  return (
    <Modal
      visible={zichtbaar}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleSluit}
    >
      <SafeAreaView style={stijlen.modalContainer} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={stijlen.modalHeader}>
          <TouchableOpacity onPress={handleSluit}>
            <Text style={stijlen.annulerenTekst}>Annuleren</Text>
          </TouchableOpacity>
          <Text style={stijlen.modalTitel}>Foto toevoegen</Text>
          {nieuweFoto !== null ? (
            <TouchableOpacity onPress={handleBevestig}>
              <Text style={stijlen.bevestigenTekst}>Opslaan</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>

        <ScrollView style={stijlen.modalInhoud} showsVerticalScrollIndicator={false}>
          {/* Type-selectie */}
          <Text style={stijlen.sectieLabel}>Fototype</Text>
          <TypeSelector geselecteerd={geselecteerdType} onChange={setGeselecteerdType} />

          {/* Foto-preview of actie-knoppen */}
          {nieuweFoto !== null ? (
            <>
              <Image
                source={{ uri: nieuweFoto.uri }}
                style={stijlen.voorbeeldAfbeelding}
                resizeMode="cover"
              />
              {nieuweFoto.latitude !== undefined && (
                <View style={stijlen.gpsBevestigingRij}>
                  <Feather name="map-pin" size={14} color="#34d399" />
                  <Text style={stijlen.gpsBevestigingTekst}>
                    Locatie vastgelegd ({nieuweFoto.latitude.toFixed(4)}, {nieuweFoto.longitude?.toFixed(4)})
                  </Text>
                </View>
              )}

              {/* Beschrijving-input */}
              <Text style={stijlen.sectieLabel}>Beschrijving (optioneel)</Text>
              <TextInput
                style={stijlen.beschrijvingInput}
                value={beschrijving}
                onChangeText={setBeschrijving}
                placeholder="Voeg een korte beschrijving toe..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                maxLength={300}
                returnKeyType="done"
              />
              <Text style={stijlen.tekenTeller}>{beschrijving.length}/300</Text>
            </>
          ) : (
            <View style={stijlen.actiesContainer}>
              <TouchableOpacity
                style={[stijlen.actieKnop, isBezig && stijlen.actieKnopDisabled]}
                onPress={handleMaakFoto}
                disabled={isBezig}
                activeOpacity={0.8}
              >
                <Feather name="camera" size={28} color="#3b82f6" />
                <Text style={stijlen.actieKnopTekst}>Camera</Text>
                <Text style={stijlen.actieKnopOndertitel}>Maak een nieuwe foto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[stijlen.actieKnop, isBezig && stijlen.actieKnopDisabled]}
                onPress={handleKiesUitGalerij}
                disabled={isBezig}
                activeOpacity={0.8}
              >
                <Feather name="image" size={28} color="#8b5cf6" />
                <Text style={stijlen.actieKnopTekst}>Galerij</Text>
                <Text style={stijlen.actieKnopOndertitel}>Kies uit je bibliotheek</Text>
              </TouchableOpacity>
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
  const isGecontroleerd = externeFootos !== undefined;

  const { takePhoto, pickFromGallery, photos: interneFootos, removePhoto: verwijderIntern } = usePhotoCapture();
  const fotos = isGecontroleerd ? externeFootos : interneFootos;

  const [toevoegModalZichtbaar, setToevoegModalZichtbaar] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);

  // In gecontroleerde modus houden we een extra ref bij voor de foto-lijst
  const interneFootosRef = useRef<CapturedPhoto[]>(fotos);
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
    <View style={stijlen.container}>
      {/* Header: teller + toevoeg-knop */}
      <View style={stijlen.galerĳHeader}>
        <Text style={stijlen.teller}>
          {aantalFotos}/{maxFotos} foto{aantalFotos !== 1 ? '\'s' : ''}
        </Text>
        {magMeerToevoegen && (
          <TouchableOpacity
            style={stijlen.toevoegKnop}
            onPress={() => setToevoegModalZichtbaar(true)}
            activeOpacity={0.7}
          >
            <Feather name="plus" size={16} color="#3b82f6" />
            <Text style={stijlen.toevoegKnopTekst}>Foto toevoegen</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Grid */}
      {aantalFotos === 0 ? (
        <TouchableOpacity
          style={stijlen.leegGrid}
          onPress={() => setToevoegModalZichtbaar(true)}
          activeOpacity={0.7}
        >
          <Feather name="camera" size={32} color="#9ca3af" />
          <Text style={stijlen.leegGridTekst}>Nog geen foto's</Text>
          <Text style={stijlen.leegGridOndertitel}>Tik om een foto toe te voegen</Text>
        </TouchableOpacity>
      ) : (
        <View style={stijlen.grid}>
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
// STIJLEN
// ============================================

const stijlen = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  galerĳHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  teller: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  toevoegKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  toevoegKnopTekst: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '600',
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fotoItem: {
    width: KOLOM_BREEDTE,
    height: KOLOM_BREEDTE,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1f2937',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },

  // Badge-posities
  badgePositie: {
    position: 'absolute',
    top: 6,
    left: 6,
  },
  gpsPositie: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 99,
    padding: 4,
  },
  verwijderKnop: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 99,
    padding: 4,
  },
  beschrijvingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  beschrijvingTekstKlein: {
    fontSize: 10,
    color: '#ffffff',
  },

  // Type-badge
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeBadgeKlein: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeTekst: {
    fontSize: 11,
    fontWeight: '600',
  },
  typeBadgeTekstKlein: {
    fontSize: 9,
  },

  // Type-selector
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  typeSelectorKnop: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: '#f3f4f6',
    gap: 4,
  },
  typeSelectorTekst: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Lege staat
  leegGrid: {
    height: 160,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  leegGridTekst: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  leegGridOndertitel: {
    fontSize: 13,
    color: '#9ca3af',
  },

  // Fullscreen
  fullscreenAchtergrond: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  fullscreenContainer: {
    flex: 1,
  },
  sluitKnop: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 16,
    right: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  fullscreenScroll: {
    flex: 1,
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
  fullscreenMeta: {
    padding: 16,
    gap: 8,
  },
  fullscreenTijdstip: {
    fontSize: 13,
    color: '#9ca3af',
  },
  gpsRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gpsTekst: {
    fontSize: 13,
    color: '#34d399',
  },
  fullscreenBeschrijving: {
    fontSize: 14,
    color: '#e5e7eb',
    lineHeight: 20,
  },

  // Toevoeg-modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#111827',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  annulerenTekst: {
    fontSize: 16,
    color: '#9ca3af',
    width: 60,
  },
  modalTitel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
  },
  bevestigenTekst: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3b82f6',
    textAlign: 'right',
    width: 60,
  },
  modalInhoud: {
    flex: 1,
    padding: 16,
  },
  sectieLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 8,
  },
  actiesContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actieKnop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    borderRadius: 16,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    gap: 8,
  },
  actieKnopDisabled: {
    opacity: 0.5,
  },
  actieKnopTekst: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f9fafb',
  },
  actieKnopOndertitel: {
    fontSize: 12,
    color: '#6b7280',
  },
  voorbeeldAfbeelding: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 12,
  },
  gpsBevestigingRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  gpsBevestigingTekst: {
    fontSize: 13,
    color: '#34d399',
  },
  beschrijvingInput: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    padding: 12,
    fontSize: 14,
    color: '#f9fafb',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  tekenTeller: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 4,
  },

  // GPS
  gpsBevestiging: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#064e3b',
  },
});
