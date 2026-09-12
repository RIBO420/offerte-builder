"use client";

/**
 * Het afwijkende uitvoeradres: waar het werk is, terwijl het adres erboven het
 * factuuradres blijft.
 *
 * Dicht is de normale stand — bijna elk werk gebeurt op het adres dat er al
 * staat, en de uitzondering mag het gewone geval niet in de weg zitten.
 * Dichtklappen is tegelijk de manier om het adres te wissen: wat daar bij
 * opslaan van gemaakt wordt staat in `./klant-formulier-logica`
 * (`uitvoerAdresPayload`).
 *
 * De uitklapknop is bedienbaar met een screenreader: `aria-expanded` komt van
 * Radix, `aria-describedby` wijst naar de toelichting — die staat ook in
 * beeld als het blok dicht is, want juist dan wil je weten waar de knop voor
 * is. De focusring komt van `Button`.
 */

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AdresVeld } from "@/components/klanten/adres-veld";
import { Veld, VELD_RASTER } from "./veld";
import type { UitvoerAdresWaarden } from "./klant-formulier-logica";

export type UitvoerAdresVeld = keyof UitvoerAdresWaarden;

export function UitvoeradresVelden({
  open,
  onOpenChange,
  waarden,
  onChange,
  fouten,
  idPrefix,
  raster = VELD_RASTER,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  waarden: UitvoerAdresWaarden;
  onChange: (veld: UitvoerAdresVeld, waarde: string) => void;
  fouten?: Partial<Record<UitvoerAdresVeld, string>>;
  idPrefix: string;
  /** Rasterklasse om postcode en plaats; zie `TelefoonVelden`. */
  raster?: string;
}) {
  const toelichtingId = `${idPrefix}-uitvoer-toelichting`;

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-describedby={toelichtingId}
          className="-ml-2 h-8 gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronDown
            className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
          Afwijkend uitvoeradres
        </Button>
      </CollapsibleTrigger>
      <p id={toelichtingId} className="mt-1 text-xs text-muted-foreground">
        Alleen invullen als het werk ergens anders gebeurt dan op het adres
        hierboven. Het adres hierboven blijft het factuuradres; dichtklappen
        wist het uitvoeradres.
      </p>
      <CollapsibleContent className="space-y-3 pt-3">
        <Veld
          id={`${idPrefix}-uitvoer-adres`}
          label="Adres (uitvoer) *"
          fout={fouten?.adres}
        >
          <AdresVeld
            id={`${idPrefix}-uitvoer-adres`}
            waarde={waarden.adres}
            ongeldig={Boolean(fouten?.adres)}
            onChange={(waarde) => onChange("adres", waarde)}
            onAdresGekozen={(adres) => {
              onChange("adres", adres.adres);
              // Alleen overschrijven als Places het weet; anders houdt het
              // veld wat er al stond.
              if (adres.postcode) onChange("postcode", adres.postcode);
              if (adres.plaats) onChange("plaats", adres.plaats);
            }}
          />
        </Veld>
        <div className={raster}>
          <Veld
            id={`${idPrefix}-uitvoer-postcode`}
            label="Postcode (uitvoer) *"
            fout={fouten?.postcode}
          >
            <Input
              id={`${idPrefix}-uitvoer-postcode`}
              placeholder="1234 AB"
              value={waarden.postcode}
              onChange={(e) => onChange("postcode", e.target.value)}
              aria-invalid={Boolean(fouten?.postcode)}
            />
          </Veld>
          <Veld
            id={`${idPrefix}-uitvoer-plaats`}
            label="Plaats (uitvoer) *"
            fout={fouten?.plaats}
          >
            <Input
              id={`${idPrefix}-uitvoer-plaats`}
              placeholder="Landgraaf"
              value={waarden.plaats}
              onChange={(e) => onChange("plaats", e.target.value)}
              aria-invalid={Boolean(fouten?.plaats)}
            />
          </Veld>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
