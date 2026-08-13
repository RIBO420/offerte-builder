"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { Building2, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { showErrorToast } from "@/lib/toast-utils";
import { api } from "../../../convex/_generated/api";

export interface GevondenBedrijf {
  naam: string;
  adres: string;
  postcode: string;
  plaats: string;
  telefoon?: string;
  website?: string;
}

interface Suggestie {
  placeId: string;
  hoofdtekst: string;
  subtekst: string;
}

interface BedrijfZoekenProps {
  /** Aangeroepen zodra een suggestie is gekozen en de details binnen zijn. */
  onGevonden: (bedrijf: GevondenBedrijf) => void;
  label?: string;
  placeholder?: string;
}

/**
 * TT-006 — bedrijf of adres opzoeken via Google Places.
 *
 * Bewust een hulpmiddel, geen verplichte stap: staat er geen Places-sleutel op
 * de deployment, dan verdwijnt dit blok en vul je gewoon handmatig in.
 *
 * Kosten worden op drie manieren beperkt:
 * - debounce van 350 ms, dus niet per toetsaanslag een call;
 * - een sessie-token dat het typen én het ophalen van de details als één
 *   zoekactie afrekent in plaats van als losse calls;
 * - een rate limit per gebruiker aan de serverkant (convex/places.ts).
 */
export function BedrijfZoeken({
  onGevonden,
  label = "Zoek bedrijf of adres",
  placeholder = "Bijv. Bruls Prefab Beton Sittard",
}: BedrijfZoekenProps) {
  const zoekAction = useAction(api.places.zoek);
  const detailsAction = useAction(api.places.details);
  const beschikbaarAction = useAction(api.places.beschikbaar);

  const [beschikbaar, setBeschikbaar] = useState<boolean | null>(null);
  const [invoer, setInvoer] = useState("");
  const [suggesties, setSuggesties] = useState<Suggestie[]>([]);
  const [zoekt, setZoekt] = useState(false);
  const [haaltDetails, setHaaltDetails] = useState<string | null>(null);
  const [gekozen, setGekozen] = useState(false);

  const debouncedInvoer = useDebounce(invoer, 350);

  // Eén token per zoekactie: Google rekent het typen en de details dan samen af.
  const sessionTokenRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    let actief = true;
    beschikbaarAction({})
      .then((waarde) => {
        if (actief) setBeschikbaar(waarde);
      })
      .catch(() => {
        if (actief) setBeschikbaar(false);
      });
    return () => {
      actief = false;
    };
  }, [beschikbaarAction]);

  useEffect(() => {
    if (gekozen || !beschikbaar) return;
    if (debouncedInvoer.trim().length < 3) {
      setSuggesties([]);
      return;
    }

    let actief = true;
    setZoekt(true);
    zoekAction({
      invoer: debouncedInvoer,
      sessionToken: sessionTokenRef.current,
    })
      .then((resultaat) => {
        if (actief) setSuggesties(resultaat);
      })
      .catch((error) => {
        if (!actief) return;
        setSuggesties([]);
        // Alleen de rate limit is het melden waard; de rest degradeert stil.
        if (error instanceof Error && error.message.includes("Te veel")) {
          showErrorToast(error.message);
        }
      })
      .finally(() => {
        if (actief) setZoekt(false);
      });

    return () => {
      actief = false;
    };
  }, [debouncedInvoer, zoekAction, gekozen, beschikbaar]);

  const kies = useCallback(
    async (suggestie: Suggestie) => {
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
        onGevonden(details);
        setGekozen(true);
        setInvoer(details.naam || suggestie.hoofdtekst);
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
    [detailsAction, onGevonden]
  );

  const wis = () => {
    setInvoer("");
    setSuggesties([]);
    setGekozen(false);
    sessionTokenRef.current = crypto.randomUUID();
  };

  // Geen Places-sleutel op de deployment: dit blok bestaat dan niet.
  if (beschikbaar === false) return null;

  return (
    <div className="space-y-2">
      <Label htmlFor="bedrijf-zoeken">{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="bedrijf-zoeken"
          className="pl-9 pr-9"
          placeholder={placeholder}
          value={invoer}
          autoComplete="off"
          onChange={(e) => {
            setInvoer(e.target.value);
            setGekozen(false);
          }}
        />
        {zoekt && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {!zoekt && invoer && (
          <button
            type="button"
            onClick={wis}
            aria-label="Zoekopdracht wissen"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {suggesties.length > 0 && (
        <ul className="max-h-56 overflow-y-auto rounded-md border bg-popover shadow-sm">
          {suggesties.map((suggestie) => (
            <li key={suggestie.placeId}>
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "h-auto w-full justify-start gap-2 rounded-none px-3 py-2 text-left font-normal",
                  haaltDetails === suggestie.placeId && "opacity-60"
                )}
                disabled={haaltDetails !== null}
                onClick={() => kies(suggestie)}
              >
                {haaltDetails === suggestie.placeId ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {suggestie.hoofdtekst}
                  </span>
                  {suggestie.subtekst && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {suggestie.subtekst}
                    </span>
                  )}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Kies een suggestie om naam, adres en telefoonnummer automatisch in te
        vullen. Je kunt daarna alles nog aanpassen.
      </p>
    </div>
  );
}
