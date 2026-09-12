/**
 * Eén invoerveld met label en foutmelding — de bouwsteen van de gedeelde
 * klantvelden. Het label draagt de verplicht-ster zelf (`"Achternaam *"`),
 * zodat een test of screenreader het veld onder precies die naam vindt.
 */

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

export function Veld({
  id,
  label,
  fout,
  className,
  children,
}: {
  id: string;
  label: string;
  fout?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className ?? "space-y-1.5"}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {fout && <p className="text-xs text-destructive">{fout}</p>}
    </div>
  );
}

/**
 * Het tweekoloms-raster van de dossierformulieren: reageert op de breedte
 * van de `@container/sectie`, niet op het scherm. Een dialoog staat niet in
 * zo'n container en geeft de veldcomponenten zijn eigen viewport-raster mee.
 */
export const VELD_RASTER = "grid gap-3 @[34rem]/sectie:grid-cols-2";
