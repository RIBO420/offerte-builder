"use client";

/**
 * Gedeelde Places-logica voor het bedrijf-zoekveld en het adresveld.
 *
 * Stond eerst helemaal in `BedrijfZoeken`. Toen het adresveld dezelfde
 * suggesties moest krijgen was kopiëren geen optie: dan staan de debounce, het
 * sessie-token en de foutafhandeling op twee plekken en lopen ze uit elkaar —
 * precies de dingen waar de rekening van Google aan hangt.
 *
 * Kosten blijven op drie manieren beperkt:
 * - debounce van 350 ms, dus niet per toetsaanslag een call;
 * - één sessie-token per zoekactie, zodat Google het typen en het ophalen van
 *   de details samen afrekent in plaats van als losse calls;
 * - een rate limit per gebruiker aan de serverkant (convex/places.ts).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { useDebounce } from "@/hooks/use-debounce";
import { showErrorToast } from "@/lib/toast-utils";
import { api } from "../../convex/_generated/api";

export interface PlacesSuggestie {
  placeId: string;
  hoofdtekst: string;
  subtekst: string;
}

export interface PlacesDetails {
  naam: string;
  adres: string;
  postcode: string;
  plaats: string;
  telefoon?: string;
  website?: string;
}

/** Onder dit aantal tekens zoeken we niet — scheelt calls op halve woorden. */
const MINIMUM_TEKENS = 3;

export function usePlacesZoeken({
  invoer,
  actief = true,
  onGekozen,
}: {
  /** Wat de gebruiker typt; de hook debounced zelf. */
  invoer: string;
  /** Uit zetten zodra er een keuze is gemaakt, anders blijft hij zoeken. */
  actief?: boolean;
  onGekozen: (details: PlacesDetails, suggestie: PlacesSuggestie) => void;
}) {
  const zoekAction = useAction(api.places.zoek);
  const detailsAction = useAction(api.places.details);
  const beschikbaarAction = useAction(api.places.beschikbaar);

  const [beschikbaar, setBeschikbaar] = useState<boolean | null>(null);
  const [suggesties, setSuggesties] = useState<PlacesSuggestie[]>([]);
  const [zoekt, setZoekt] = useState(false);
  const [haaltDetails, setHaaltDetails] = useState<string | null>(null);

  const debouncedInvoer = useDebounce(invoer, 350);
  const sessionTokenRef = useRef<string>("");
  if (!sessionTokenRef.current) sessionTokenRef.current = crypto.randomUUID();

  useEffect(() => {
    let levend = true;
    beschikbaarAction({})
      .then((waarde) => {
        if (levend) setBeschikbaar(waarde);
      })
      .catch(() => {
        if (levend) setBeschikbaar(false);
      });
    return () => {
      levend = false;
    };
  }, [beschikbaarAction]);

  useEffect(() => {
    if (!actief || !beschikbaar) return;
    if (debouncedInvoer.trim().length < MINIMUM_TEKENS) {
      setSuggesties([]);
      return;
    }

    let levend = true;
    setZoekt(true);
    zoekAction({ invoer: debouncedInvoer, sessionToken: sessionTokenRef.current })
      .then((resultaat) => {
        if (levend) setSuggesties(resultaat);
      })
      .catch((error) => {
        if (!levend) return;
        setSuggesties([]);
        // Alleen de rate limit is het melden waard; de rest degradeert stil,
        // want handmatig invullen werkt altijd nog.
        if (error instanceof Error && error.message.includes("Te veel")) {
          showErrorToast(error.message);
        }
      })
      .finally(() => {
        if (levend) setZoekt(false);
      });

    return () => {
      levend = false;
    };
  }, [debouncedInvoer, zoekAction, actief, beschikbaar]);

  const kies = useCallback(
    async (suggestie: PlacesSuggestie) => {
      setHaaltDetails(suggestie.placeId);
      try {
        const details = await detailsAction({
          placeId: suggestie.placeId,
          sessionToken: sessionTokenRef.current,
        });
        if (!details) {
          showErrorToast("Gegevens ophalen mislukt — vul handmatig aan");
          return;
        }
        onGekozen(details, suggestie);
        setSuggesties([]);
        // Nieuwe zoekactie = nieuw token.
        sessionTokenRef.current = crypto.randomUUID();
      } catch (error) {
        showErrorToast(
          error instanceof Error ? error.message : "Gegevens ophalen mislukt"
        );
      } finally {
        setHaaltDetails(null);
      }
    },
    [detailsAction, onGekozen]
  );

  const herstart = useCallback(() => {
    setSuggesties([]);
    sessionTokenRef.current = crypto.randomUUID();
  }, []);

  return { beschikbaar, suggesties, zoekt, haaltDetails, kies, herstart };
}
