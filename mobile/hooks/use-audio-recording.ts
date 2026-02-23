/**
 * useAudioRecording Hook
 *
 * Hook voor het opnemen van audio via de device microfoon.
 * Gebruikt expo-av voor audio recording.
 *
 * BELANGRIJK: expo-av moet geïnstalleerd zijn:
 *   npx expo install expo-av
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';

export interface UseAudioRecordingReturn {
  /** Of er momenteel een opname bezig is */
  isRecording: boolean;
  /** Of de opname gepauzeerd is */
  isPaused: boolean;
  /** Duur van de opname in seconden */
  duration: number;
  /** Start een nieuwe opname */
  startRecording: () => Promise<void>;
  /** Stop de opname en retourneer de file URI */
  stopRecording: () => Promise<string>;
  /** Pauzeer de lopende opname */
  pauseRecording: () => Promise<void>;
  /** Hervat een gepauzeerde opname */
  resumeRecording: () => Promise<void>;
  /** Foutmelding, of null als er geen fout is */
  error: string | null;
}

/**
 * Audio recording instellingen — hoge kwaliteit, m4a formaat
 */
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 192000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.MAX,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 192000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 192000,
  },
};

/**
 * Hook voor audio opname via de device microfoon.
 *
 * @example
 * ```tsx
 * function OpnameComponent() {
 *   const {
 *     isRecording,
 *     isPaused,
 *     duration,
 *     startRecording,
 *     stopRecording,
 *     pauseRecording,
 *     resumeRecording,
 *     error,
 *   } = useAudioRecording();
 *
 *   const handleStop = async () => {
 *     const uri = await stopRecording();
 *     console.log('Opname opgeslagen op:', uri);
 *   };
 *
 *   return (
 *     <View>
 *       <Text>Duur: {duration}s</Text>
 *       <Button onPress={startRecording} title="Start" />
 *       <Button onPress={handleStop} title="Stop" />
 *     </View>
 *   );
 * }
 * ```
 */
export function useAudioRecording(): UseAudioRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);

  /**
   * Stop de duration timer
   */
  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  /**
   * Start de duration timer
   */
  const startDurationTimer = useCallback(() => {
    stopDurationTimer();
    startTimeRef.current = Date.now();

    durationIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setDuration(pausedDurationRef.current + elapsed);
    }, 500);
  }, [stopDurationTimer]);

  /**
   * Vraag microfoon permissie aan de gebruiker
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setError('Microfoon toegang is vereist voor het opnemen. Geef toegang via de instellingen.');
        return false;
      }
      return true;
    } catch (err) {
      setError('Kon geen toegang krijgen tot de microfoon.');
      return false;
    }
  }, []);

  /**
   * Configureer de audio sessie voor opname
   */
  const configureAudioSession = useCallback(async (): Promise<void> => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
  }, []);

  /**
   * Start een nieuwe audio opname
   */
  const startRecording = useCallback(async (): Promise<void> => {
    try {
      setError(null);

      // Vraag permissie
      const hasPermission = await requestPermission();
      if (!hasPermission) return;

      // Configureer audio sessie
      await configureAudioSession();

      // Maak nieuwe recording aan
      const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);

      recordingRef.current = recording;
      pausedDurationRef.current = 0;
      setDuration(0);
      setIsRecording(true);
      setIsPaused(false);

      startDurationTimer();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onbekende fout bij starten opname';
      setError(`Kon opname niet starten: ${message}`);
      setIsRecording(false);
    }
  }, [requestPermission, configureAudioSession, startDurationTimer]);

  /**
   * Stop de opname en retourneer de file URI
   */
  const stopRecording = useCallback(async (): Promise<string> => {
    if (!recordingRef.current) {
      throw new Error('Geen actieve opname om te stoppen');
    }

    try {
      stopDurationTimer();

      await recordingRef.current.stopAndUnloadAsync();

      const uri = recordingRef.current.getURI();
      if (!uri) {
        throw new Error('Geen URI beschikbaar na stoppen opname');
      }

      recordingRef.current = null;
      setIsRecording(false);
      setIsPaused(false);

      // Reset audio modus
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      return uri;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onbekende fout bij stoppen opname';
      setError(`Kon opname niet stoppen: ${message}`);
      setIsRecording(false);
      stopDurationTimer();
      throw err;
    }
  }, [stopDurationTimer]);

  /**
   * Pauzeer de lopende opname
   */
  const pauseRecording = useCallback(async (): Promise<void> => {
    if (!recordingRef.current || !isRecording || isPaused) return;

    try {
      await recordingRef.current.pauseAsync();

      // Sla de opgelopen duur op voor hervatting
      pausedDurationRef.current = duration;
      stopDurationTimer();

      setIsPaused(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onbekende fout bij pauzeren';
      setError(`Kon opname niet pauzeren: ${message}`);
    }
  }, [isRecording, isPaused, duration, stopDurationTimer]);

  /**
   * Hervat een gepauzeerde opname
   */
  const resumeRecording = useCallback(async (): Promise<void> => {
    if (!recordingRef.current || !isPaused) return;

    try {
      await recordingRef.current.startAsync();
      setIsPaused(false);
      startDurationTimer();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onbekende fout bij hervatten';
      setError(`Kon opname niet hervatten: ${message}`);
    }
  }, [isPaused, startDurationTimer]);

  /**
   * Cleanup bij unmount — stop lopende opname en timer
   */
  useEffect(() => {
    return () => {
      stopDurationTimer();

      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {
          // Stil falen bij unmount
        });
      }
    };
  }, [stopDurationTimer]);

  return {
    isRecording,
    isPaused,
    duration,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    error,
  };
}

export default useAudioRecording;
