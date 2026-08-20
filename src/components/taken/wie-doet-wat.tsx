"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showErrorToast } from "@/lib/toast-utils";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { NIEMAND, persoonLabel, type ToewijsbaarPersoon, type VerrijkteTaak } from "./types";

/**
 * "Wie doet wat": twee rollen per taak, in de woorden van het bedrijf zelf.
 *
 * - **Maakt het** — wie het werk uitvoert (`makerId`).
 * - **Checkt het voor verzending** — wie er nog overheen kijkt (`checkerId`).
 *
 * Iedereen met een account staat in de lijst, óók directie en kantoor. Dat is
 * een expliciete klanteis: in v1 hing een taak aan een `medewerkers`-rij, en
 * juist de mensen die het meeste uitzetten hebben die niet — daardoor was het
 * model in de praktijk onbruikbaar. Admins krijgen "(admin)" achter hun naam,
 * puur als herkenning in een lange lijst.
 *
 * "Niemand" is een echte keuze en geen lege staat: werk zonder maker moet je
 * kunnen zíen (het bord heeft er een kolom voor).
 */
export function WieDoetWat({
  taak,
  personen,
  onOpenChange,
}: {
  taak: VerrijkteTaak;
  personen: ToewijsbaarPersoon[];
  /** Meldt de aanroeper dat er een portal openstaat (composers klappen anders dicht). */
  onOpenChange?: (open: boolean) => void;
}) {
  const wijsToe = useMutation(api.klantTaken.wijsToe);
  const [bezig, setBezig] = useState(false);

  const zet = async (rol: "maker" | "checker", waarde: string) => {
    const id = waarde === NIEMAND ? null : (waarde as Id<"users">);
    setBezig(true);
    try {
      await wijsToe({
        taakId: taak._id,
        ...(rol === "maker" ? { makerId: id } : { checkerId: id }),
      });
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij toewijzen taak"
      );
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="grid gap-2 @[26rem]/taak:grid-cols-2">
      <RolSelect
        label="Maakt het"
        waarde={taak.maker?._id ?? NIEMAND}
        personen={personen}
        disabled={bezig}
        onOpenChange={onOpenChange}
        onKies={(waarde) => zet("maker", waarde)}
      />
      <RolSelect
        label="Checkt het voor verzending"
        waarde={taak.checker?._id ?? NIEMAND}
        personen={personen}
        disabled={bezig}
        onOpenChange={onOpenChange}
        onKies={(waarde) => zet("checker", waarde)}
      />
    </div>
  );
}

function RolSelect({
  label,
  waarde,
  personen,
  disabled,
  onKies,
  onOpenChange,
}: {
  label: string;
  waarde: string;
  personen: ToewijsbaarPersoon[];
  disabled?: boolean;
  onKies: (waarde: string) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <label className="grid min-w-0 gap-1">
      <span className="text-[11px] font-medium leading-4 text-muted-foreground">
        {label}
      </span>
      <Select
        value={waarde}
        disabled={disabled}
        onValueChange={onKies}
        onOpenChange={onOpenChange}
      >
        <SelectTrigger size="sm" aria-label={label} className="w-full">
          <SelectValue placeholder="Niemand" />
        </SelectTrigger>
        {/* position="popper": de item-aligned modus rekent bij compacte
            triggers een top ver onder de vouw uit — de lijst opent dan buiten
            beeld. Zelfde valkuil als de composer-selects. */}
        <SelectContent position="popper">
          <SelectItem value={NIEMAND}>Niemand</SelectItem>
          {personen.map((persoon) => (
            <SelectItem key={persoon._id} value={persoon._id}>
              {persoonLabel(persoon)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
