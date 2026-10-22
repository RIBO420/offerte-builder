"use client";

/**
 * Uitvoering: begrote uren · werkdagen · personen in één rij. Voegt de
 * vroegere VoorcalculatieCard en BegroteUrenCard samen.
 *
 * Begrote manuren (HERO-nabouw fase 1b): met de hand, wint van de uren uit de
 * calculatie; na acceptatie staan ze op de klus in de opdrachtenbak. Leeg =
 * de calculatie-uren — daarom een aparte knop om terug te gaan naar leeg.
 */

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Calculator, Loader2, Pencil } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SectiePaneel } from "@/components/ui/sectie-paneel";

const getal = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 });

interface UitvoeringPaneelProps {
  id: string;
  status: string;
  isVrij: boolean;
  begroteUren?: number;
  calculatieUren: number;
  voorcalculatie:
    | { teamGrootte: number; geschatteDagen: number; normUrenTotaal: number }
    | null
    | undefined;
}

function foutTekst(fout: unknown): string {
  if (fout instanceof Error && "data" in fout) return String((fout as { data: unknown }).data);
  return fout instanceof Error ? fout.message : "Opslaan mislukt";
}

export function UitvoeringPaneel({
  id,
  status,
  isVrij,
  begroteUren,
  calculatieUren,
  voorcalculatie,
}: UitvoeringPaneelProps) {
  const getoondeUren = begroteUren ?? (calculatieUren > 0 ? calculatieUren : undefined);
  // Zelfde voorwaarde als de vroegere VoorcalculatieCard: zichtbaar bij een
  // concept of zodra er een voorcalculatie is.
  const toonVoorcalculatieLink = status === "concept" || !!voorcalculatie;
  const oproep = status === "concept" && !voorcalculatie && !isVrij;

  return (
    <SectiePaneel
      titel="Uitvoering"
      kopbalk
      acties={
        toonVoorcalculatieLink &&
        !oproep && (
          <Link
            href={`/offertes/${id}/voorcalculatie`}
            className="rounded px-1 text-[13px] text-primary transition-colors hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {voorcalculatie ? "Voorcalculatie →" : "Voorcalculatie invullen →"}
          </Link>
        )
      }
    >
      <dl className="grid grid-cols-3 gap-2 px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="order-last text-xs text-muted-foreground">
            {begroteUren !== undefined ? "begroot" : calculatieUren > 0 ? "uit calculatie" : "begroot"}
          </dt>
          <dd className="flex items-center gap-1 text-xl leading-tight font-semibold tabular-nums">
            {getoondeUren !== undefined ? `${getal.format(getoondeUren)} u` : "–"}
            {status !== "geaccepteerd" && (
              <BegroteUrenBewerker
                id={id}
                begroteUren={begroteUren}
                calculatieUren={calculatieUren}
              />
            )}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="order-last text-xs text-muted-foreground">werkdagen</dt>
          <dd className="text-xl leading-tight font-semibold tabular-nums">
            {voorcalculatie ? getal.format(voorcalculatie.geschatteDagen) : "–"}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="order-last text-xs text-muted-foreground">personen</dt>
          <dd className="text-xl leading-tight font-semibold tabular-nums">
            {voorcalculatie ? voorcalculatie.teamGrootte : "–"}
          </dd>
        </div>
      </dl>

      {oproep && (
        <div className="flex flex-col gap-2 border-t border-status-in-uitvoering-border bg-status-in-uitvoering/60 px-4 py-3">
          <p className="text-[13px] text-status-in-uitvoering-text">
            Vul de voorcalculatie in om de offerte te kunnen verzenden.
          </p>
          <Button asChild size="sm" className="self-start">
            <Link href={`/offertes/${id}/voorcalculatie`}>
              <Calculator />
              Voorcalculatie invullen
            </Link>
          </Button>
        </div>
      )}
    </SectiePaneel>
  );
}

function BegroteUrenBewerker({
  id,
  begroteUren,
  calculatieUren,
}: {
  id: string;
  begroteUren?: number;
  calculatieUren: number;
}) {
  const opslaan = useMutation(api.offertes.updateBegroteUren);
  const [open, setOpen] = useState(false);
  const [waarde, setWaarde] = useState<number>(begroteUren ?? calculatieUren);
  const [bezig, setBezig] = useState(false);

  const bewaar = async (begroot: number | null) => {
    setBezig(true);
    try {
      await opslaan({ id: id as Id<"offertes">, begroteUren: begroot });
      toast.success(begroot === null ? "Uren uit de calculatie hersteld" : "Begrote uren opgeslagen");
      setOpen(false);
    } catch (fout) {
      toast.error(foutTekst(fout));
    } finally {
      setBezig(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setWaarde(begroteUren ?? calculatieUren);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Begrote manuren aanpassen"
          className="text-muted-foreground"
        >
          <Pencil />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <div className="space-y-1">
          <label htmlFor="begrote-uren" className="text-sm font-semibold">
            Begrote manuren
          </label>
          <p className="text-xs text-muted-foreground">
            Na acceptatie staan deze uren op de klus in de opdrachtenbak.
            {calculatieUren > 0 && ` De calculatie komt op ${getal.format(calculatieUren)} u.`}
          </p>
        </div>
        <NumberInput
          id="begrote-uren"
          value={waarde}
          onChange={setWaarde}
          min={0}
          step={1}
          decimals={1}
          debounceMs={0}
          suffix="u"
        />
        <div className="flex flex-wrap justify-end gap-2">
          {begroteUren !== undefined && (
            <Button variant="ghost" size="sm" onClick={() => bewaar(null)} disabled={bezig}>
              Calculatie gebruiken
            </Button>
          )}
          <Button size="sm" onClick={() => bewaar(waarde)} disabled={bezig}>
            {bezig && <Loader2 className="animate-spin" />}
            Opslaan
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
