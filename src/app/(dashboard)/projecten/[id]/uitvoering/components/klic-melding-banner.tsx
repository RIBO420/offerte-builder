"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/**
 * PRJ-W01: KLIC-melding voor aanlegprojecten met grondwerk. Open = amber
 * werkvlak ("wacht op jou"), gedaan = succesreceptuur. Icoon en kop zeggen
 * het ook zonder kleur.
 */
export function KlicMeldingBanner({
  gedaan,
  onToggle,
}: {
  gedaan: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <section
      aria-label="KLIC-melding"
      className={cn(
        "flex flex-wrap items-start gap-x-3 gap-y-2 rounded-lg border px-4 py-3.5",
        gedaan
          ? "border-status-geaccepteerd-border bg-status-geaccepteerd"
          : "border-status-herinnering-border bg-surface-aandacht"
      )}
    >
      {gedaan ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-status-geaccepteerd-text" aria-hidden="true" />
      ) : (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-herinnering-text" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-[1_1_20rem] text-[13px]">
        <p className={cn("font-semibold", gedaan ? "text-status-geaccepteerd-text" : "text-foreground")}>
          {gedaan ? "KLIC-melding gedaan" : "KLIC-melding vereist"}
        </p>
        <p className={cn("mt-0.5 text-pretty", gedaan ? "text-status-geaccepteerd-text" : "text-muted-foreground")}>
          {gedaan
            ? "De KLIC-melding is bevestigd. Het project kan worden gestart."
            : "Dit aanlegproject bevat graafwerk. Een KLIC-melding is wettelijk verplicht voordat je begint met graven. Het project kan niet worden gestart zonder deze bevestiging."}
        </p>
      </div>
      <label
        htmlFor="klic-melding"
        className="flex min-h-9 shrink-0 cursor-pointer items-center gap-2 text-sm font-medium"
      >
        <Checkbox
          id="klic-melding"
          checked={gedaan}
          onCheckedChange={(checked) => onToggle(checked === true)}
        />
        KLIC-melding gedaan
      </label>
    </section>
  );
}
