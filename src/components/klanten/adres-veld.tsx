"use client";

/**
 * Adresveld met suggesties uit Google Places.
 *
 * Het losse "Zoek bedrijf of adres"-veld bovenaan blijft bestaan voor het geval
 * je op bedrijfsnaam zoekt, maar bij een particulier begin je nu eenmaal bij
 * het adres. Dat veld doet daarom zelf ook suggesties: typ "Sittarderweg 5" en
 * kies de regel, dan vullen straat, postcode en plaats zichzelf.
 *
 * Belangrijk verschil met `BedrijfZoeken`: hier wordt alleen het ADRES
 * ingevuld. Naam en telefoonnummer blijven staan — je bent de klant aan het
 * invoeren, niet het bedrijf dat toevallig op dat adres zit.
 */

import { useCallback, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  usePlacesZoeken,
  type PlacesDetails,
  type PlacesSuggestie,
} from "@/hooks/use-places-zoeken";

export interface GevondenAdres {
  adres: string;
  postcode: string;
  plaats: string;
}

export function AdresVeld({
  id,
  waarde,
  onChange,
  onAdresGekozen,
  placeholder = "Hoofdstraat 1",
  ongeldig = false,
}: {
  id: string;
  waarde: string;
  onChange: (waarde: string) => void;
  /** Aangeroepen met straat, postcode en plaats zodra een suggestie is gekozen. */
  onAdresGekozen: (adres: GevondenAdres) => void;
  placeholder?: string;
  ongeldig?: boolean;
}) {
  // Na een keuze niet blijven zoeken op wat we zojuist zelf hebben ingevuld.
  const [zoekenActief, setZoekenActief] = useState(false);

  const verwerk = useCallback(
    (details: PlacesDetails, suggestie: PlacesSuggestie) => {
      // Zonder straat in de details is de suggestie een plaats of regio; dan is
      // de getoonde tekst het beste dat we hebben.
      onAdresGekozen({
        adres: details.adres || suggestie.hoofdtekst,
        postcode: details.postcode,
        plaats: details.plaats,
      });
      setZoekenActief(false);
    },
    [onAdresGekozen]
  );

  const { beschikbaar, suggesties, zoekt, haaltDetails, kies, herstart } =
    usePlacesZoeken({ invoer: waarde, actief: zoekenActief, onGekozen: verwerk });

  return (
    <div className="relative">
      <Input
        id={id}
        placeholder={placeholder}
        value={waarde}
        autoComplete="off"
        aria-invalid={ongeldig}
        aria-autocomplete={beschikbaar ? "list" : undefined}
        aria-expanded={suggesties.length > 0}
        onChange={(e) => {
          onChange(e.target.value);
          setZoekenActief(true);
        }}
        onBlur={() => {
          // Even wachten: een klik op een suggestie veroorzaakt eerst een blur.
          window.setTimeout(() => {
            setZoekenActief(false);
            herstart();
          }, 150);
        }}
        className={cn(zoekt && "pr-9")}
      />
      {zoekt && (
        <Loader2 className="absolute right-3 top-[calc(50%-0.5rem)] size-4 animate-spin text-muted-foreground" />
      )}

      {suggesties.length > 0 && (
        // Absoluut gepositioneerd: de suggesties mogen de velden eronder niet
        // wegduwen terwijl je typt.
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
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
                // onMouseDown: blur zou de lijst sluiten vóór de klik landt.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => kies(suggestie)}
              >
                {haaltDetails === suggestie.placeId ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                ) : (
                  <MapPin className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
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
    </div>
  );
}
