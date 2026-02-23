/**
 * OpnameScreen Component
 *
 * React Native component voor het opnemen van een klantgesprek en
 * het automatisch transcriberen naar tekst.
 *
 * BELANGRIJK: expo-av moet geïnstalleerd zijn:
 *   npx expo install expo-av
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Animated,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAudioRecording } from '../hooks/use-audio-recording';
import { useTranscription } from '../hooks/use-transcription';

// ============================================
// TYPES
// ============================================

export interface OpnameScreenProps {
  /** Callback wanneer de gebruiker de transcriptie wil gebruiken */
  onTranscriptGebruiken?: (transcript: string) => void;
  /** Optionele achtergrondkleur van het scherm */
  backgroundColor?: string;
}

// ============================================
// CONSTANTEN
// ============================================

const ROOD = '#DC2626';
const ROOD_DONKER = '#991B1B';
const GROEN = '#16A34A';
const ORANJE = '#D97706';
const GRIJS_DONKER = '#111827';
const GRIJS = '#374151';
const GRIJS_LICHT = '#6B7280';
const GRIJS_HEEL_LICHT = '#F3F4F6';
const WIT = '#FFFFFF';
const ACHTERGROND = '#0F172A';
const KAART = '#1E293B';
const RAND = '#334155';

// Audio-level bars voor visuele indicator
const AANTAL_BARS = 16;

// ============================================
// HELPER FUNCTIES
// ============================================

/**
 * Formatteer seconden naar mm:ss weergave
 */
function formateerTijd(seconden: number): string {
  const minuten = Math.floor(seconden / 60);
  const sec = seconden % 60;
  return `${String(minuten).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ============================================
// SUB-COMPONENTEN
// ============================================

/**
 * Privacy melding bovenaan het scherm
 */
function PrivacyMelding() {
  return (
    <View style={styles.privacyContainer}>
      <Feather name="shield" size={14} color={ORANJE} />
      <Text style={styles.privacyTekst}>
        Dit gesprek wordt opgenomen voor uw offerte. De opname wordt na transcriptie verwijderd.
      </Text>
    </View>
  );
}

/**
 * Audio-level bars die reageren op geluid (gesimuleerd met animaties tijdens opname)
 */
interface AudioBarsProps {
  isActief: boolean;
}

function AudioBars({ isActief }: AudioBarsProps) {
  const barAnimaties = useRef<Animated.Value[]>(
    Array.from({ length: AANTAL_BARS }, () => new Animated.Value(0.2))
  ).current;

  const animatieRefs = useRef<Animated.CompositeAnimation[]>([]);

  const startAnimaties = useCallback(() => {
    animatieRefs.current.forEach((anim) => anim.stop());
    animatieRefs.current = barAnimaties.map((anim, index) => {
      const loopAnim = Animated.loop(
        Animated.sequence([
          Animated.delay(index * 60),
          Animated.spring(anim, {
            toValue: 0.2 + Math.random() * 0.8,
            useNativeDriver: true,
            speed: 8 + Math.random() * 12,
            bounciness: 4,
          }),
          Animated.spring(anim, {
            toValue: 0.1 + Math.random() * 0.4,
            useNativeDriver: true,
            speed: 6 + Math.random() * 10,
            bounciness: 2,
          }),
        ])
      );
      loopAnim.start();
      return loopAnim;
    });
  }, [barAnimaties]);

  const stopAnimaties = useCallback(() => {
    animatieRefs.current.forEach((anim) => anim.stop());
    barAnimaties.forEach((anim) => {
      Animated.spring(anim, {
        toValue: 0.2,
        useNativeDriver: true,
        speed: 20,
        bounciness: 0,
      }).start();
    });
  }, [barAnimaties]);

  useEffect(() => {
    if (isActief) {
      startAnimaties();
    } else {
      stopAnimaties();
    }
    return () => {
      animatieRefs.current.forEach((anim) => anim.stop());
    };
  }, [isActief, startAnimaties, stopAnimaties]);

  return (
    <View style={styles.audioBarsContainer}>
      {barAnimaties.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.audioBar,
            {
              transform: [{ scaleY: anim }],
              backgroundColor: isActief ? ROOD : GRIJS,
            },
          ]}
        />
      ))}
    </View>
  );
}

/**
 * Grote pulserende opname knop
 */
interface OpnameKnopProps {
  isOpname: boolean;
  isPaused: boolean;
  onPress: () => void;
  disabled: boolean;
}

function OpnameKnop({ isOpname, isPaused, onPress, disabled }: OpnameKnopProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isOpname && !isPaused) {
      pulseAnimRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimRef.current.start();
    } else {
      pulseAnimRef.current?.stop();
      Animated.spring(pulseAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 0,
      }).start();
    }

    return () => {
      pulseAnimRef.current?.stop();
    };
  }, [isOpname, isPaused, pulseAnim]);

  const knopKleur = isOpname ? (isPaused ? ORANJE : ROOD) : ROOD;
  const knopIcoon = isOpname ? 'square' : 'mic';

  return (
    <Animated.View
      style={[
        styles.opnameKnopOuter,
        {
          transform: [{ scale: pulseAnim }],
          borderColor: knopKleur,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={[styles.opnameKnop, { backgroundColor: knopKleur }]}
        accessibilityRole="button"
        accessibilityLabel={isOpname ? 'Stop opname' : 'Start opname'}
      >
        <Feather name={knopIcoon} size={40} color={WIT} />
      </Pressable>
    </Animated.View>
  );
}

// ============================================
// HOOFD COMPONENT
// ============================================

/**
 * OpnameScreen — volledig scherm voor klantgesprek opname en transcriptie
 *
 * @example
 * ```tsx
 * <OpnameScreen
 *   onTranscriptGebruiken={(transcript) => {
 *     console.log('Transcript:', transcript);
 *   }}
 * />
 * ```
 */
export function OpnameScreen({ onTranscriptGebruiken }: OpnameScreenProps) {
  const {
    isRecording,
    isPaused,
    duration,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    error: opnameError,
  } = useAudioRecording();

  const {
    transcribe,
    isTranscribing,
    progress: transcriptieProgress,
    error: transcriptieError,
  } = useTranscription();

  const [transcript, setTranscript] = React.useState<string | null>(null);
  const [toonTranscript, setToonTranscript] = React.useState(false);

  // Combineer fouten
  const foutmelding = opnameError ?? transcriptieError;

  /**
   * Verwerk de opname knop druk:
   * - Als er geen opname is: start een nieuwe
   * - Als er een opname is: stop en transcribeer
   */
  const handleHoofdKnop = useCallback(async () => {
    if (!isRecording) {
      // Start nieuwe opname
      setTranscript(null);
      setToonTranscript(false);
      await startRecording();
    } else {
      // Stop opname en start transcriptie
      try {
        const uri = await stopRecording();
        setToonTranscript(true);

        const tekst = await transcribe(uri);
        setTranscript(tekst);
      } catch {
        // Fouten worden al afgehandeld in de hooks
      }
    }
  }, [isRecording, startRecording, stopRecording, transcribe]);

  /**
   * Pauzeer of hervat de opname
   */
  const handlePauzeHervat = useCallback(async () => {
    if (isPaused) {
      await resumeRecording();
    } else {
      await pauseRecording();
    }
  }, [isPaused, pauseRecording, resumeRecording]);

  /**
   * Reset naar beginscherm voor een nieuwe opname
   */
  const handleOpnieuwOpnemen = useCallback(() => {
    setTranscript(null);
    setToonTranscript(false);
  }, []);

  /**
   * Gebruik de transcriptie in de parent component
   */
  const handleGebruikTranscript = useCallback(() => {
    if (transcript && onTranscriptGebruiken) {
      onTranscriptGebruiken(transcript);
    }
  }, [transcript, onTranscriptGebruiken]);

  const toonBedieningsknoppen = isRecording;
  const toonTranscriptieLoader = toonTranscript && isTranscribing;
  const toonTranscriptResultaat = toonTranscript && !isTranscribing && !!transcript;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollInhoud}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Privacy melding */}
        <PrivacyMelding />

        {/* Titel */}
        <View style={styles.titelContainer}>
          <Text style={styles.titel}>Klantgesprek</Text>
          <Text style={styles.ondertitel}>
            {!isRecording && !toonTranscript
              ? 'Druk op de microfoon om te beginnen'
              : isRecording && !isPaused
                ? 'Opname bezig...'
                : isRecording && isPaused
                  ? 'Opname gepauzeerd'
                  : toonTranscriptieLoader
                    ? 'Audio wordt verwerkt...'
                    : 'Opname voltooid'}
          </Text>
        </View>

        {/* Timer */}
        {(isRecording || (toonTranscript && duration > 0)) && (
          <View style={styles.timerContainer}>
            <Text style={styles.timerTekst}>{formateerTijd(duration)}</Text>
            {isRecording && !isPaused && (
              <View style={styles.opnameIndicator}>
                <View style={styles.opnamePunt} />
                <Text style={styles.opnameTekst}>OPNAME</Text>
              </View>
            )}
          </View>
        )}

        {/* Audio-level bars */}
        <AudioBars isActief={isRecording && !isPaused} />

        {/* Hoofd opname knop */}
        {!toonTranscript && (
          <OpnameKnop
            isOpname={isRecording}
            isPaused={isPaused}
            onPress={handleHoofdKnop}
            disabled={isTranscribing}
          />
        )}

        {/* Bedieningsknoppen tijdens opname */}
        {toonBedieningsknoppen && !toonTranscript && (
          <View style={styles.bedieningsContainer}>
            {/* Pauze / Hervat knop */}
            <Pressable
              onPress={handlePauzeHervat}
              style={styles.bedieningsKnop}
              accessibilityRole="button"
              accessibilityLabel={isPaused ? 'Hervat opname' : 'Pauzeer opname'}
            >
              <View style={[styles.bedieningsKnopIcoon, { backgroundColor: ORANJE }]}>
                <Feather name={isPaused ? 'play' : 'pause'} size={22} color={WIT} />
              </View>
              <Text style={styles.bedieningsKnopTekst}>
                {isPaused ? 'Hervatten' : 'Pauzeren'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Transcriptie loading indicator */}
        {toonTranscriptieLoader && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={ROOD} />
            <Text style={styles.loaderTekst}>Transcriberen...</Text>
            {transcriptieProgress > 0 && transcriptieProgress < 100 && (
              <View style={styles.voortgangContainer}>
                <View style={styles.voortgangBalk}>
                  <View
                    style={[
                      styles.voortgangVulling,
                      { width: `${transcriptieProgress}%` as unknown as number },
                    ]}
                  />
                </View>
                <Text style={styles.voortgangTekst}>{transcriptieProgress}%</Text>
              </View>
            )}
          </View>
        )}

        {/* Transcript resultaat */}
        {toonTranscriptResultaat && (
          <View style={styles.transcriptContainer}>
            <View style={styles.transcriptHeader}>
              <Feather name="file-text" size={18} color={GROEN} />
              <Text style={styles.transcriptTitel}>Transcriptie</Text>
            </View>

            <ScrollView
              style={styles.transcriptScroll}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              <Text style={styles.transcriptTekst} selectable>
                {transcript}
              </Text>
            </ScrollView>

            {/* Actie knoppen */}
            <View style={styles.actieKnoppen}>
              <Pressable
                onPress={handleOpnieuwOpnemen}
                style={[styles.actieKnop, styles.actieKnopSecundair]}
                accessibilityRole="button"
                accessibilityLabel="Opnieuw opnemen"
              >
                <Feather name="rotate-ccw" size={18} color={WIT} />
                <Text style={styles.actieKnopTekst}>Opnieuw opnemen</Text>
              </Pressable>

              {onTranscriptGebruiken && (
                <Pressable
                  onPress={handleGebruikTranscript}
                  style={[styles.actieKnop, styles.actieKnopPrimair]}
                  accessibilityRole="button"
                  accessibilityLabel="Gebruik transcriptie"
                >
                  <Feather name="check" size={18} color={WIT} />
                  <Text style={styles.actieKnopTekst}>Gebruik transcriptie</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Foutmelding */}
        {foutmelding && (
          <View style={styles.foutContainer}>
            <Feather name="alert-circle" size={18} color={ROOD} />
            <Text style={styles.foutTekst}>{foutmelding}</Text>
          </View>
        )}

        {/* Instructies (alleen op startscherm) */}
        {!isRecording && !toonTranscript && !foutmelding && (
          <View style={styles.instructiesContainer}>
            <View style={styles.instructieRij}>
              <View style={[styles.instructieStap, { backgroundColor: ROOD }]}>
                <Text style={styles.instructieStapNummer}>1</Text>
              </View>
              <Text style={styles.instructieTekst}>
                Druk op de microfoon knop om te beginnen
              </Text>
            </View>
            <View style={styles.instructieRij}>
              <View style={[styles.instructieStap, { backgroundColor: ORANJE }]}>
                <Text style={styles.instructieStapNummer}>2</Text>
              </View>
              <Text style={styles.instructieTekst}>
                Voer het gesprek met de klant
              </Text>
            </View>
            <View style={styles.instructieRij}>
              <View style={[styles.instructieStap, { backgroundColor: GROEN }]}>
                <Text style={styles.instructieStapNummer}>3</Text>
              </View>
              <Text style={styles.instructieTekst}>
                Druk op stop en ontvang automatisch de transcriptie
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================
// STIJLEN
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ACHTERGROND,
  },
  scrollInhoud: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },

  // Privacy melding
  privacyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    marginBottom: 24,
    gap: 8,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  privacyTekst: {
    flex: 1,
    color: ORANJE,
    fontSize: 12,
    lineHeight: 18,
  },

  // Titel
  titelContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  titel: {
    fontSize: 28,
    fontWeight: '700',
    color: WIT,
    marginBottom: 6,
  },
  ondertitel: {
    fontSize: 15,
    color: GRIJS_LICHT,
    textAlign: 'center',
  },

  // Timer
  timerContainer: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  timerTekst: {
    fontSize: 52,
    fontWeight: '200',
    color: WIT,
    fontVariant: ['tabular-nums'],
    letterSpacing: 4,
    ...Platform.select({
      ios: { fontFamily: 'Courier' },
      android: { fontFamily: 'monospace' },
    }),
  },
  opnameIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  opnamePunt: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ROOD,
  },
  opnameTekst: {
    fontSize: 11,
    fontWeight: '700',
    color: ROOD,
    letterSpacing: 2,
  },

  // Audio bars
  audioBarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    gap: 3,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  audioBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
    backgroundColor: GRIJS,
  },

  // Opname knop
  opnameKnopOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    backgroundColor: 'transparent',
  },
  opnameKnop: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bedieningsknoppen
  bedieningsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 24,
  },
  bedieningsKnop: {
    alignItems: 'center',
    gap: 8,
  },
  bedieningsKnopIcoon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bedieningsKnopTekst: {
    fontSize: 12,
    color: GRIJS_LICHT,
    fontWeight: '500',
  },

  // Transcriptie loader
  loaderContainer: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 32,
    width: '100%',
  },
  loaderTekst: {
    fontSize: 18,
    color: WIT,
    fontWeight: '500',
  },
  voortgangContainer: {
    width: '100%',
    gap: 8,
    alignItems: 'center',
  },
  voortgangBalk: {
    width: '80%',
    height: 4,
    backgroundColor: GRIJS,
    borderRadius: 2,
    overflow: 'hidden',
  },
  voortgangVulling: {
    height: '100%',
    backgroundColor: ROOD,
    borderRadius: 2,
  },
  voortgangTekst: {
    fontSize: 13,
    color: GRIJS_LICHT,
  },

  // Transcript resultaat
  transcriptContainer: {
    width: '100%',
    backgroundColor: KAART,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: RAND,
    gap: 12,
  },
  transcriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transcriptTitel: {
    fontSize: 16,
    fontWeight: '600',
    color: WIT,
  },
  transcriptScroll: {
    maxHeight: 220,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    padding: 12,
  },
  transcriptTekst: {
    fontSize: 14,
    color: GRIJS_HEEL_LICHT,
    lineHeight: 22,
  },

  // Actie knoppen
  actieKnoppen: {
    flexDirection: 'row',
    gap: 10,
  },
  actieKnop: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  actieKnopSecundair: {
    backgroundColor: GRIJS,
  },
  actieKnopPrimair: {
    backgroundColor: GROEN,
  },
  actieKnopTekst: {
    color: WIT,
    fontSize: 13,
    fontWeight: '600',
  },

  // Foutmelding
  foutContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderRadius: 10,
    padding: 14,
    gap: 10,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    marginTop: 16,
  },
  foutTekst: {
    flex: 1,
    fontSize: 13,
    color: '#FCA5A5',
    lineHeight: 19,
  },

  // Instructies
  instructiesContainer: {
    width: '100%',
    gap: 16,
    marginTop: 8,
  },
  instructieRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  instructieStap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructieStapNummer: {
    color: WIT,
    fontSize: 13,
    fontWeight: '700',
  },
  instructieTekst: {
    flex: 1,
    fontSize: 14,
    color: GRIJS_LICHT,
    lineHeight: 20,
  },
});

export default OpnameScreen;
