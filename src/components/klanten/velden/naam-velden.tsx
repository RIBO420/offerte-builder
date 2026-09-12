"use client";

/**
 * De naamvelden van een klant, in de vorm die bij het klanttype hoort.
 *
 * Een particulier krijgt "Voornaam" en "Achternaam *" naast elkaar — de lijst
 * sorteert op achternaam, dus die twee moeten los. Elk ander type (bedrijf,
 * VvE, gemeente, overig) heeft één "Bedrijfsnaam *". Nooit allebei in beeld:
 * dan is het de vraag welke telt.
 *
 * De component rendert alleen de veldblokken, geen raster: het formulier zet
 * er zelf een tweekoloms-raster omheen, want bij een bedrijf staat daar ook
 * nog "Contactpersoon" naast. Wat er bij opslaan van deze velden wordt
 * gemaakt, staat in `./klant-formulier-logica` (`naamVelden`).
 */

import { Input } from "@/components/ui/input";
import { Veld } from "./veld";
import {
  isZakelijk,
  type KlantType,
  type NaamWaarden,
} from "./klant-formulier-logica";

export type NaamVeld = keyof NaamWaarden;

export function NaamVelden({
  klantType,
  waarden,
  onChange,
  fouten,
  idPrefix,
}: {
  klantType: KlantType;
  waarden: NaamWaarden;
  onChange: (veld: NaamVeld, waarde: string) => void;
  fouten?: Partial<Record<NaamVeld, string>>;
  /** Uniek per formulier (`nk`, `ki`, …) zodat twee formulieren naast elkaar kunnen. */
  idPrefix: string;
}) {
  if (isZakelijk(klantType)) {
    return (
      <Veld id={`${idPrefix}-naam`} label="Bedrijfsnaam *" fout={fouten?.naam}>
        <Input
          id={`${idPrefix}-naam`}
          placeholder="De Groene Tuin B.V."
          value={waarden.naam}
          onChange={(e) => onChange("naam", e.target.value)}
          aria-invalid={Boolean(fouten?.naam)}
        />
      </Veld>
    );
  }

  return (
    <>
      <Veld id={`${idPrefix}-voornaam`} label="Voornaam" fout={fouten?.voornaam}>
        <Input
          id={`${idPrefix}-voornaam`}
          placeholder="Jan"
          value={waarden.voornaam}
          onChange={(e) => onChange("voornaam", e.target.value)}
          aria-invalid={Boolean(fouten?.voornaam)}
        />
      </Veld>
      <Veld
        id={`${idPrefix}-achternaam`}
        label="Achternaam *"
        fout={fouten?.achternaam}
      >
        <Input
          id={`${idPrefix}-achternaam`}
          placeholder="van der Berg"
          value={waarden.achternaam}
          onChange={(e) => onChange("achternaam", e.target.value)}
          aria-invalid={Boolean(fouten?.achternaam)}
        />
      </Veld>
    </>
  );
}
