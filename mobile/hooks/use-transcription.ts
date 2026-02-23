/**
 * useTranscription Hook
 *
 * Hook voor het transcriberen van audio naar tekst via de Next.js API.
 * Stuurt het audio bestand naar /api/transcribe, die OpenAI Whisper gebruikt.
 */

import { useState, useCallback } from 'react';
import Constants from 'expo-constants';

export interface UseTranscriptionReturn {
  /** Transcribeer een audio bestand naar tekst */
  transcribe: (audioUri: string) => Promise<string>;
  /** Of transcriptie bezig is */
  isTranscribing: boolean;
  /** Voortgang van 0 tot 100 */
  progress: number;
  /** Foutmelding, of null als er geen fout is */
  error: string | null;
}

/**
 * Haal de API base URL op uit de Expo config.
 * Stel in via app.json extra.apiBaseUrl of de EXPO_PUBLIC_API_URL env variabele.
 */
function getApiBaseUrl(): string {
  const fromConfig = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  return fromConfig ?? fromEnv ?? 'http://localhost:3000';
}

/**
 * Hook voor het transcriberen van audio bestanden naar tekst.
 *
 * @example
 * ```tsx
 * function OpnameComponent() {
 *   const { transcribe, isTranscribing, progress, error } = useTranscription();
 *
 *   const handleTranscribe = async (uri: string) => {
 *     const tekst = await transcribe(uri);
 *     console.log('Transcript:', tekst);
 *   };
 *
 *   return (
 *     <View>
 *       {isTranscribing && <Text>Transcriberen... {progress}%</Text>}
 *       {error && <Text>Fout: {error}</Text>}
 *     </View>
 *   );
 * }
 * ```
 */
export function useTranscription(): UseTranscriptionReturn {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const transcribe = useCallback(async (audioUri: string): Promise<string> => {
    setError(null);
    setIsTranscribing(true);
    setProgress(0);

    try {
      // Stap 1: Bereid het bestand voor (10%)
      setProgress(10);

      // Haal bestandsnaam en type op uit de URI
      const uriParts = audioUri.split('/');
      const fileName = uriParts[uriParts.length - 1] ?? 'audio.m4a';
      const fileExtension = fileName.split('.').pop()?.toLowerCase() ?? 'm4a';

      const mimeTypeMap: Record<string, string> = {
        m4a: 'audio/m4a',
        mp4: 'audio/mp4',
        wav: 'audio/wav',
        mp3: 'audio/mpeg',
        webm: 'audio/webm',
        ogg: 'audio/ogg',
      };
      const mimeType = mimeTypeMap[fileExtension] ?? 'audio/m4a';

      // Stap 2: Bouw FormData op (30%)
      setProgress(30);

      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        name: fileName,
        type: mimeType,
      } as unknown as Blob);

      // Stap 3: Verstuur naar de API (50%)
      setProgress(50);

      const apiUrl = `${getApiBaseUrl()}/api/transcribe`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
        // Laat fetch zelf de Content-Type header met boundary instellen
        headers: {
          Accept: 'application/json',
        },
      });

      // Stap 4: Verwerk response (80%)
      setProgress(80);

      if (!response.ok) {
        let errorMessage = `Server fout: ${response.status}`;
        try {
          const errorData = (await response.json()) as { error?: string };
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // JSON parsing mislukt, gebruik de status tekst
          errorMessage = `Server fout: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = (await response.json()) as { text: string; duration: number };

      if (!data.text) {
        throw new Error('Geen tekst ontvangen van de server');
      }

      // Stap 5: Klaar (100%)
      setProgress(100);

      return data.text;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onbekende fout bij transcriptie';
      setError(`Transcriptie mislukt: ${message}`);
      throw err;
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  return {
    transcribe,
    isTranscribing,
    progress,
    error,
  };
}

export default useTranscription;
