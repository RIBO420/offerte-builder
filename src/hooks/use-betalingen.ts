"use client";

import { useQuery, useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";

// ============================================
// TYPES
// ============================================

export type BetalingStatus =
  | "open"
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "canceled";

export type BetalingType = "aanbetaling" | "configurator" | "factuur";

export interface StartBetalingParams {
  bedrag: number; // in euro's, bijv. 150.00
  beschrijving: string;
  referentie: string;
  klantNaam: string;
  klantEmail: string;
  type: BetalingType;
  redirectUrl?: string;
  metadata?: Record<string, string>;
}

export interface StartBetalingResult {
  paymentId: string;
  checkoutUrl: string;
  status: string;
}

// ============================================
// HOOKS
// ============================================

/**
 * Haal alle betalingen op van de ingelogde gebruiker.
 */
export function useBetalingen() {
  const { user } = useCurrentUser();

  const betalingen = useQuery(
    api.betalingen.list,
    user?._id ? {} : "skip"
  );

  return {
    betalingen: betalingen ?? [],
    isLoading: user !== undefined && user !== null && betalingen === undefined,
  };
}

/**
 * Geeft een functie terug waarmee een nieuwe betaling in Convex geregistreerd kan worden.
 */
export function useCreateBetaling() {
  const createBetaling = useMutation(api.betalingen.create);

  return createBetaling;
}

/**
 * Start een Mollie betaling:
 * 1. Roept de /api/mollie route aan om een betaling bij Mollie aan te maken
 * 2. Slaat de betaling op in Convex
 * 3. Geeft de checkout URL terug zodat de gebruiker doorgestuurd kan worden
 */
export function useStartMollieBetaling() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createBetaling = useMutation(api.betalingen.create);

  const startBetaling = useCallback(
    async (params: StartBetalingParams): Promise<StartBetalingResult> => {
      setIsLoading(true);
      setError(null);

      try {
        // Zet het bedrag om naar het Mollie-formaat (string met 2 decimalen)
        const mollieValue = params.bedrag.toFixed(2);

        const appUrl =
          typeof window !== "undefined" ? window.location.origin : "";
        const redirectUrl =
          params.redirectUrl ||
          `${appUrl}/betalingen/bedankt?referentie=${encodeURIComponent(params.referentie)}`;

        // Stap 1: Maak de betaling aan bij Mollie via de API route
        const response = await fetch("/api/mollie", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: {
              currency: "EUR",
              value: mollieValue,
            },
            description: params.beschrijving,
            redirectUrl,
            metadata: {
              referentie: params.referentie,
              klantNaam: params.klantNaam,
              klantEmail: params.klantEmail,
              type: params.type,
              ...params.metadata,
            },
          }),
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          const foutmelding =
            data.error || "Fout bij aanmaken van de betaling";
          setError(foutmelding);
          throw new Error(foutmelding);
        }

        const data = (await response.json()) as StartBetalingResult;

        if (!data.checkoutUrl) {
          const foutmelding = "Geen checkout URL ontvangen van Mollie";
          setError(foutmelding);
          throw new Error(foutmelding);
        }

        // Stap 2: Registreer de betaling in Convex
        await createBetaling({
          molliePaymentId: data.paymentId,
          bedrag: params.bedrag,
          beschrijving: params.beschrijving,
          referentie: params.referentie,
          klantNaam: params.klantNaam,
          klantEmail: params.klantEmail,
          type: params.type,
          metadata: params.metadata as Record<string, unknown> | undefined,
        });

        return data;
      } catch (err) {
        const bericht =
          err instanceof Error ? err.message : "Onbekende fout bij betaling";
        setError(bericht);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [createBetaling]
  );

  return {
    startBetaling,
    isLoading,
    error,
  };
}
