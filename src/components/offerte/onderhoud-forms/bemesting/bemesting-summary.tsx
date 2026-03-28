"use client";

import type { BemestingFormData } from "./schema";
import { SEIZOEN_LABELS, FREQUENTIE_LABELS } from "./schema";

// ─── Props ────────────────────────────────────────────────────────────────────

interface BemestingSummaryProps {
  watchedValues: BemestingFormData;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BemestingSummary({ watchedValues }: BemestingSummaryProps) {
  const { types, product, frequentie } = watchedValues;
  const heeftMeerdereKeer = frequentie === "2x" || frequentie === "3x" || frequentie === "4x";
  const hasAnyType = types?.gazon || types?.borders || types?.bomen || types?.universeel;

  if (!hasAnyType) return null;

  return (
    <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
      <span className="font-medium">Indicatie: </span>
      {[
        types?.gazon && watchedValues.gazonDetail.oppervlakte > 0 &&
          `gazon: ${watchedValues.gazonDetail.oppervlakte} m² (${SEIZOEN_LABELS[watchedValues.gazonDetail.seizoen]})`,
        types?.borders && watchedValues.bordersDetail.oppervlakte > 0 &&
          `borders: ${watchedValues.bordersDetail.oppervlakte} m² (${SEIZOEN_LABELS[watchedValues.bordersDetail.seizoen]})`,
        types?.bomen && watchedValues.bomenDetail.aantalBomen > 0 &&
          `${watchedValues.bomenDetail.aantalBomen} boom${watchedValues.bomenDetail.aantalBomen !== 1 ? "en" : ""} (${SEIZOEN_LABELS[watchedValues.bomenDetail.seizoen]})`,
        types?.universeel && watchedValues.universeelDetail.oppervlakte > 0 &&
          `universeel: ${watchedValues.universeelDetail.oppervlakte} m² (${SEIZOEN_LABELS[watchedValues.universeelDetail.seizoen]})`,
      ]
        .filter(Boolean)
        .join(", ") || "vul oppervlakte in"}
      {" — "}
      <span className="font-medium">
        {product === "premium" ? "Premium 150 dagen" : product === "bio" ? "Biologisch" : "Standaard"}
      </span>
      {", "}
      {FREQUENTIE_LABELS[frequentie]}
      {heeftMeerdereKeer && " (10% arbeidskorting)"}
    </div>
  );
}
