/**
 * OpnameScreen Component
 *
 * React Native component voor het opnemen van een klantgesprek en
 * het automatisch transcriberen naar tekst.
 *
 * BELANGRIJK: expo-av moet geïnstalleerd zijn:
 *   npx expo install expo-av
 */

import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Animated,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, CircleAlert, FileText, Mic, Pause, Play, RotateCcw, Shield, Square } from 'lucide-react-native';
import { useAudioRecording } from '../hooks/use-audio-recording';
import { useTranscription } from '../hooks/use-transcription';
import { tekst } from '../theme';
import { useVeldKleuren } from './veld/BuitenModus';
import { Drukvlak, Kaart, Melding, toonKleuren, type Toon } from './werk/Bouwstenen';

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

// Kleuren komen uit het thema: opnemen = destructive (rood), pauze = warning,
// klaar = primary. Zo kloppen licht, donker en buiten-modus vanzelf.

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
    <View style={{ width: '100%', marginTop: 16, marginBottom: 24 }}>
      <Melding
        toon="wachten"
        icoon={Shield}
        tekst="Dit gesprek wordt opgenomen voor uw offerte. De opname wordt na transcriptie verwijderd."
      />
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
  const kleuren = useVeldKleuren();
  // useMemo i.p.v. useRef(...).current: zelfde stabiele Animated.Value-array,
  // maar zonder ref-toegang tijdens render (react-hooks/refs).
  const barAnimaties = useMemo<Animated.Value[]>(
    () => Array.from({ length: AANTAL_BARS }, () => new Animated.Value(0.2)),
    []
  );

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
              backgroundColor: isActief ? kleuren.destructive : kleuren.border,
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
  const kleuren = useVeldKleuren();
  // eslint-disable-next-line react-hooks/refs -- RN Animated.Value refs are stable and safe to access during render
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

  const gepauzeerd = isOpname && isPaused;
  const knopKleur = gepauzeerd ? kleuren.warning : kleuren.destructive;
  // Op de warning-vulling leest de canvaskleur het best (donker op amber, licht op oker).
  const icoonKleur = gepauzeerd ? kleuren.background : kleuren.destructiveForeground;
  const KnopIcoon = isOpname ? Square : Mic;

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
      <Drukvlak
        onPress={onPress}
        disabled={disabled}
        haptic="press"
        style={[styles.opnameKnop, { backgroundColor: knopKleur }]}
        accessibilityLabel={isOpname ? 'Stop opname' : 'Start opname'}
      >
        <KnopIcoon size={40} color={icoonKleur} strokeWidth={2.25} />
      </Drukvlak>
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
  const kleuren = useVeldKleuren();
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
    <SafeAreaView style={[styles.container, { backgroundColor: kleuren.background }]} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollInhoud}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Privacy melding */}
        <PrivacyMelding />

        {/* Titel */}
        <View style={styles.titelContainer}>
          <Text accessibilityRole="header" style={[tekst.titel1, { color: kleuren.foreground, textAlign: 'center' }]}>Klantgesprek</Text>
          <Text style={[tekst.callout, { color: kleuren.mutedForeground, textAlign: 'center' }]}>
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
            <Text style={[styles.timerTekst, tekst.cijfers, { color: kleuren.foreground }]}>{formateerTijd(duration)}</Text>
            {isRecording && !isPaused && (
              <View style={styles.opnameIndicator}>
                <View style={[styles.opnamePunt, { backgroundColor: kleuren.danger }]} />
                <Text style={[tekst.bijschrift, { color: kleuren.danger, fontWeight: '700', letterSpacing: 2 }]}>OPNAME</Text>
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
            <Drukvlak
              onPress={handlePauzeHervat}
              style={styles.bedieningsKnop}
              accessibilityLabel={isPaused ? 'Hervat opname' : 'Pauzeer opname'}
            >
              <View style={[styles.bedieningsKnopIcoon, { backgroundColor: kleuren.warning }]}>
                {isPaused
                  ? <Play size={22} color={kleuren.background} strokeWidth={2.25} />
                  : <Pause size={22} color={kleuren.background} strokeWidth={2.25} />}
              </View>
              <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontWeight: '500' }]}>
                {isPaused ? 'Hervatten' : 'Pauzeren'}
              </Text>
            </Drukvlak>
          </View>
        )}

        {/* Transcriptie loading indicator */}
        {toonTranscriptieLoader && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={kleuren.primary} />
            <Text style={[tekst.titel3, { color: kleuren.foreground, fontWeight: '500' }]}>Transcriberen...</Text>
            {transcriptieProgress > 0 && transcriptieProgress < 100 && (
              <View style={styles.voortgangContainer}>
                <View style={[styles.voortgangBalk, { backgroundColor: kleuren.primarySoft }]}>
                  <View
                    style={[
                      styles.voortgangVulling,
                      { width: `${transcriptieProgress}%` as unknown as number, backgroundColor: kleuren.primary },
                    ]}
                  />
                </View>
                <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.mutedForeground }]}>{transcriptieProgress}%</Text>
              </View>
            )}
          </View>
        )}

        {/* Transcript resultaat */}
        {toonTranscriptResultaat && (
          <Kaart style={{ width: '100%' }}>
            <View style={styles.transcriptHeader}>
              <FileText size={18} color={kleuren.primary} strokeWidth={2.25} />
              <Text accessibilityRole="header" style={[tekst.kop, { color: kleuren.foreground }]}>Transcriptie</Text>
            </View>

            <ScrollView
              style={[styles.transcriptScroll, { backgroundColor: kleuren.muted }]}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              <Text style={[tekst.callout, { color: kleuren.foreground, lineHeight: 24 }]} selectable>
                {transcript}
              </Text>
            </ScrollView>

            {/* Actie knoppen */}
            <View style={styles.actieKnoppen}>
              <Drukvlak
                onPress={handleOpnieuwOpnemen}
                buitenStijl={{ flex: 1 }}
                style={[styles.actieKnop, { backgroundColor: kleuren.muted }]}
                accessibilityLabel="Opnieuw opnemen"
              >
                <RotateCcw size={18} color={kleuren.foreground} strokeWidth={2.25} />
                <Text style={[tekst.sub, { color: kleuren.foreground, fontWeight: '600' }]} numberOfLines={1}>Opnieuw opnemen</Text>
              </Drukvlak>

              {onTranscriptGebruiken && (
                <Drukvlak
                  onPress={handleGebruikTranscript}
                  buitenStijl={{ flex: 1 }}
                  style={[styles.actieKnop, { backgroundColor: kleuren.primary }]}
                  accessibilityLabel="Gebruik transcriptie"
                >
                  <Check size={18} color={kleuren.primaryForeground} strokeWidth={2.5} />
                  <Text style={[tekst.sub, { color: kleuren.primaryForeground, fontWeight: '600' }]} numberOfLines={1}>Gebruik transcriptie</Text>
                </Drukvlak>
              )}
            </View>
          </Kaart>
        )}

        {/* Foutmelding */}
        {foutmelding && (
          <View style={{ width: '100%', marginTop: 16 }}>
            <Melding toon="gemist" icoon={CircleAlert} tekst={foutmelding} />
          </View>
        )}

        {/* Instructies (alleen op startscherm) */}
        {!isRecording && !toonTranscript && !foutmelding && (
          <View style={styles.instructiesContainer}>
            {INSTRUCTIES.map((stap, index) => {
              const { voor, achter } = toonKleuren(kleuren, stap.toon);
              return (
                <View key={stap.tekst} style={styles.instructieRij}>
                  <View style={[styles.instructieStap, { backgroundColor: achter }]}>
                    <Text style={[tekst.voetnoot, tekst.cijfers, { color: voor, fontWeight: '700' }]}>{index + 1}</Text>
                  </View>
                  <Text style={[tekst.callout, { flex: 1, color: kleuren.mutedForeground }]}>{stap.tekst}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const INSTRUCTIES: { tekst: string; toon: Toon }[] = [
  { tekst: 'Druk op de microfoon knop om te beginnen', toon: 'gemist' },
  { tekst: 'Voer het gesprek met de klant', toon: 'wachten' },
  { tekst: 'Druk op stop en ontvang automatisch de transcriptie', toon: 'succes' },
];

// ============================================
// STIJLEN (lay-out; kleuren komen uit het thema)
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollInhoud: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },

  // Titel
  titelContainer: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 6,
  },

  // Timer
  timerContainer: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  timerTekst: {
    fontSize: 56,
    lineHeight: 64,
    fontWeight: '200',
    letterSpacing: 2,
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

  // Transcriptie loader
  loaderContainer: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 32,
    width: '100%',
  },
  voortgangContainer: {
    width: '100%',
    gap: 8,
    alignItems: 'center',
  },
  voortgangBalk: {
    width: '80%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  voortgangVulling: {
    height: '100%',
    borderRadius: 3,
  },

  // Transcript resultaat
  transcriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transcriptScroll: {
    maxHeight: 220,
    borderRadius: 12,
    padding: 12,
  },

  // Actie knoppen
  actieKnoppen: {
    flexDirection: 'row',
    gap: 10,
  },
  actieKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 10,
    borderRadius: 14,
    gap: 8,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default OpnameScreen;
