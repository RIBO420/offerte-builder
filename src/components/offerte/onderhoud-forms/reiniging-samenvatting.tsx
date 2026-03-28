"use client";

import { useFormContext } from "react-hook-form";
import type { ReinigingFormData } from "./reiniging-form";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReinigingSamenvatting() {
  const { watch } = useFormContext<ReinigingFormData>();

  const terrasreinigingAan = watch("terrasreinigingAan");
  const terrasOppervlakte = watch("terrasOppervlakte");
  const bladruimenAan = watch("bladruimenAan");
  const bladruimenOppervlakte = watch("bladruimenOppervlakte");
  const bladruimenFrequentie = watch("bladruimenFrequentie");
  const onkruidBestratingAan = watch("onkruidBestratingAan");
  const onkruidOppervlakte = watch("onkruidOppervlakte");
  const algereinigingAan = watch("algereinigingAan");
  const algereinigingOppervlakte = watch("algereinigingOppervlakte");

  const heeftSelectie =
    terrasreinigingAan ||
    bladruimenAan ||
    onkruidBestratingAan ||
    algereinigingAan;

  if (!heeftSelectie) return null;

  const items = [
    terrasreinigingAan &&
      terrasOppervlakte &&
      terrasOppervlakte > 0 &&
      `terrasreiniging ${terrasOppervlakte} m\u00B2`,
    bladruimenAan &&
      bladruimenOppervlakte &&
      bladruimenOppervlakte > 0 &&
      `bladruimen ${bladruimenOppervlakte} m\u00B2${bladruimenFrequentie === "seizoen" ? " (seizoen)" : ""}`,
    onkruidBestratingAan &&
      onkruidOppervlakte &&
      onkruidOppervlakte > 0 &&
      `onkruid ${onkruidOppervlakte} m\u00B2`,
    algereinigingAan &&
      algereinigingOppervlakte &&
      algereinigingOppervlakte > 0 &&
      `algereiniging ${algereinigingOppervlakte} m\u00B2`,
  ].filter(Boolean);

  return (
    <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
      <span className="font-medium">Geselecteerd:</span>{" "}
      {items.length > 0
        ? items.join(", ")
        : "Vul oppervlaktes in voor een overzicht"}
    </div>
  );
}
