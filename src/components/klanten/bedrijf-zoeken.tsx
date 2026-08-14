"use client";

import { useCallback, useState } from "react";
import { Building2, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  usePlacesZoeken,
  type PlacesDetails,
  type PlacesSuggestie,
} from "@/hooks/use-places-zoeken";

export type GevondenBedrijf = PlacesDetails;

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
  const [invoer, setInvoer] = useState("");
  const [gekozen, setGekozen] = useState(false);

  const verwerk = useCallback(
    (details: PlacesDetails, suggestie: PlacesSuggestie) => {
      onGevonden(details);
      setGekozen(true);
      setInvoer(details.naam || suggestie.hoofdtekst);
    },
    [onGevonden]
  );

  const { beschikbaar, suggesties, zoekt, haaltDetails, kies, herstart } =
    usePlacesZoeken({ invoer, actief: !gekozen, onGekozen: verwerk });

  const wis = () => {
    setInvoer("");
    setGekozen(false);
    herstart();
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
        Vult naam, adres en telefoonnummer in. Aanpassen kan daarna gewoon.
      </p>
    </div>
  );
}
