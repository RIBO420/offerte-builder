/**
 * useAutoSummary Hook
 *
 * Hook die een transcript samenvat naar gestructureerde offerte-data
 * via de Next.js /api/summarize endpoint (Anthropic Claude).
 */

import { useState, useCallback } from 'react';
import Constants from 'expo-constants';

export interface SummaryResult {
  /** Lijst van klant wensen */
  klantWensen: string[];
  /** Geschatte oppervlakte in m² (optioneel) */
  geschatteOppervlakte?: number;
  /** Aanbevolen scopes/werkzaamheden */
  suggestedScopes: string[];
  /** Bijzonderheden en aandachtspunten */
  bijzonderheden: string[];
  /** Beknopte samenvatting van het gesprek */
  samenvatting: string;
}

export interface UseAutoSummaryReturn {
  /** Stuur een transcript voor samenvatting */
  summarize: (transcript: string) => Promise<SummaryResult>;
  /** Of de samenvatting bezig is */
  isSummarizing: boolean;
  /** Foutmelding, of null als er geen fout is */
  error: string | null;
}

/**
 * Haal de API base URL op uit de Expo config.
 */
function getApiBaseUrl(): string {
  const fromConfig = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  return fromConfig ?? fromEnv ?? 'http://localhost:3000';
}

/**
 * Hook voor het automatisch samenvatten van een transcript naar offerte-data.
 *
 * @example
 * ```tsx
 * function OfferteComponent() {
 *   const { summarize, isSummarizing, error } = useAutoSummary();
 *
 *   const handleSummarize = async (transcript: string) => {
 *     const result = await summarize(transcript);
 *     console.log('Klant wensen:', result.klantWensen);
 *     console.log('Scopes:', result.suggestedScopes);
 *   };
 *
 *   return (
 *     <View>
 *       {isSummarizing && <ActivityIndicator />}
 *       {error && <Text>Fout: {error}</Text>}
 *     </View>
 *   );
 * }
 * ```
 */
export function useAutoSummary(): UseAutoSummaryReturn {
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summarize = useCallback(async (transcript: string): Promise<SummaryResult> => {
    if (!transcript.trim()) {
      throw new Error('Transcript is leeg — voer een geldig transcript in');
    }

    setError(null);
    setIsSummarizing(true);

    try {
      const apiUrl = `${getApiBaseUrl()}/api/summarize`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ transcript }),
      });

      if (!response.ok) {
        let errorMessage = `Server fout: ${response.status}`;
        try {
          const errorData = (await response.json()) as { error?: string };
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          errorMessage = `Server fout: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = (await response.json()) as SummaryResult;

      // Valideer de response structuur
      if (!data.klantWensen || !Array.isArray(data.klantWensen)) {
        throw new Error('Ongeldige response van de server: klantWensen ontbreekt');
      }
      if (!data.suggestedScopes || !Array.isArray(data.suggestedScopes)) {
        throw new Error('Ongeldige response van de server: suggestedScopes ontbreekt');
      }
      if (!data.bijzonderheden || !Array.isArray(data.bijzonderheden)) {
        throw new Error('Ongeldige response van de server: bijzonderheden ontbreekt');
      }
      if (typeof data.samenvatting !== 'string') {
        throw new Error('Ongeldige response van de server: samenvatting ontbreekt');
      }

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onbekende fout bij samenvatten';
      setError(`Samenvatting mislukt: ${message}`);
      throw err;
    } finally {
      setIsSummarizing(false);
    }
  }, []);

  return {
    summarize,
    isSummarizing,
    error,
  };
}

export default useAutoSummary;
