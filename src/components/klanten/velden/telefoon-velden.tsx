"use client";

/**
 * "Telefoon" en "Telefoon 2" naast elkaar: vast naast mobiel, of het nummer
 * van de partner. Je vergelijkt ze bij het invoeren, en zo is meteen te zien
 * welk nummer waar staat. Beide met dezelfde validatie en foutmelding — dat
 * regelt `klantSchema`, hier staan alleen de velden.
 */

import { Input } from "@/components/ui/input";
import { Veld, VELD_RASTER } from "./veld";

export type TelefoonVeld = "telefoon" | "telefoon2";

export function TelefoonVelden({
  waarden,
  onChange,
  fouten,
  idPrefix,
  raster = VELD_RASTER,
}: {
  waarden: Record<TelefoonVeld, string>;
  onChange: (veld: TelefoonVeld, waarde: string) => void;
  fouten?: Partial<Record<TelefoonVeld, string>>;
  idPrefix: string;
  /**
   * Rasterklasse om de twee velden. Een dialoog staat niet in een
   * `@container/sectie` en geeft zijn eigen viewport-raster mee.
   */
  raster?: string;
}) {
  return (
    <div className={raster}>
      <Veld id={`${idPrefix}-telefoon`} label="Telefoon" fout={fouten?.telefoon}>
        <Input
          id={`${idPrefix}-telefoon`}
          placeholder="06-12345678"
          value={waarden.telefoon}
          onChange={(e) => onChange("telefoon", e.target.value)}
          aria-invalid={Boolean(fouten?.telefoon)}
        />
      </Veld>
      <Veld
        id={`${idPrefix}-telefoon2`}
        label="Telefoon 2"
        fout={fouten?.telefoon2}
      >
        <Input
          id={`${idPrefix}-telefoon2`}
          placeholder="045-5710000"
          value={waarden.telefoon2}
          onChange={(e) => onChange("telefoon2", e.target.value)}
          aria-invalid={Boolean(fouten?.telefoon2)}
        />
      </Veld>
    </div>
  );
}
