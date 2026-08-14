"use client";

import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calculator, Info, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { BeschikbaarheidsKalender } from "@/components/beschikbaarheids-kalender";
import type { FormData, TypeGras } from "./types";
import { TYPE_GRAS_CONFIG } from "./types";
import { berekenPrijs, formatEuro } from "./utils";

// ---------------------------------------------------------------------------
// PrijsRegelRij
// ---------------------------------------------------------------------------

function PrijsRegelRij({
  label,
  detail,
  bedrag,
  isSubtotaal,
}: {
  label: string;
  detail?: string;
  bedrag: string;
  isSubtotaal?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between py-2 gap-4",
        isSubtotaal && "font-medium"
      )}
    >
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm", isSubtotaal && "font-semibold")}>{label}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      <p className={cn("text-sm font-medium flex-shrink-0 tabular-nums", isSubtotaal && "font-semibold")}>
        {bedrag}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stap 3 (WS9): Prijsindicatie — vóór de NAW-stap, als "offertepapier"
// ---------------------------------------------------------------------------

interface StapPrijsoverzichtProps {
  data: FormData;
  onStartdatumChange: (datum: Date | undefined) => void;
}

export function StapPrijsoverzicht({
  data,
  onStartdatumChange,
}: StapPrijsoverzichtProps) {
  const prijs = berekenPrijs(data);

  if (!prijs) {
    return (
      <div className="space-y-6">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-xl font-display">Prijsindicatie</CardTitle>
        </CardHeader>
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <Calculator className="h-10 w-10 mb-3 opacity-40" />
          <p className="font-medium">Onvolledige gegevens</p>
          <p className="text-sm mt-1">
            Ga terug en vul alle verplichte velden in om een prijs te berekenen.
          </p>
        </div>
      </div>
    );
  }

  const m2 = parseFloat(data.specs.oppervlakte);
  const typeLabel =
    data.specs.typeGras
      ? TYPE_GRAS_CONFIG[data.specs.typeGras as TypeGras].label
      : "";

  return (
    <div className="space-y-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-xl font-display">Uw prijsindicatie</CardTitle>
        <CardDescription>
          Op basis van {m2} m² {typeLabel.toLowerCase()}. Na uw aanvraag
          controleren wij de details ter plaatse.
        </CardDescription>
      </CardHeader>

      {/* Prijsberekening als "offertepapier": wit vel, hairlines, serif-totaal */}
      <div className="rounded-lg border border-border bg-card shadow-sm px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex items-center justify-between gap-2 border-b border-border pb-3 mb-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Indicatieprijs
          </p>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calculator className="h-3.5 w-3.5 text-primary" />
            Gazon aanleggen
          </span>
        </div>

        <div className="divide-y divide-border">
          {/* Gazon */}
          <PrijsRegelRij
            label={prijs.gazonRegel.label}
            detail={`${m2} m² × ${formatEuro(prijs.gazonRegel.tarief)}/m²`}
            bedrag={formatEuro(prijs.gazonRegel.totaal)}
          />

          {/* Ondergrond */}
          {prijs.ondergrondRegel && (
            <PrijsRegelRij
              label={prijs.ondergrondRegel.label}
              detail={`${m2} m² × ${formatEuro(prijs.ondergrondRegel.tarief)}/m²`}
              bedrag={formatEuro(prijs.ondergrondRegel.totaal)}
            />
          )}

          {/* Drainage */}
          {prijs.drainageRegel && (
            <PrijsRegelRij
              label={prijs.drainageRegel.label}
              detail={`${prijs.drainageRegel.meters} m × ${formatEuro(prijs.drainageRegel.tarief)}/m (schatting)`}
              bedrag={formatEuro(prijs.drainageRegel.totaal)}
            />
          )}

          {/* Opsluitbanden */}
          {prijs.opsluitbandenRegel && (
            <PrijsRegelRij
              label={prijs.opsluitbandenRegel.label}
              detail={`${prijs.opsluitbandenRegel.meters} m × ${formatEuro(prijs.opsluitbandenRegel.tarief)}/m`}
              bedrag={formatEuro(prijs.opsluitbandenRegel.totaal)}
            />
          )}

          {/* Voorrijkosten */}
          <PrijsRegelRij
            label="Voorrijkosten"
            bedrag={formatEuro(prijs.voorrijkosten)}
          />

          {/* Handmatig werk toeslag */}
          {prijs.handmatigToeslag && (
            <PrijsRegelRij
              label={`Toeslag handmatig werk (${prijs.handmatigToeslagPercent}%)`}
              detail="Smalste doorgang < 80 cm — extra arbeidsintensief"
              bedrag={formatEuro(prijs.toeslagBedrag)}
            />
          )}
        </div>

        <Separator className="my-4" />

        {/* Subtotaal, BTW, Totaal */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotaal (excl. BTW)</span>
            <span className="font-medium tabular-nums">{formatEuro(prijs.subtotaal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">BTW (21%)</span>
            <span className="font-medium tabular-nums">{formatEuro(prijs.btw)}</span>
          </div>
          <Separator />
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-base font-semibold">Totaal (incl. BTW)</span>
            {/* Het heldcijfer van de wizard — displayfont, merkgroen */}
            <span className="font-display text-2xl font-semibold text-primary tabular-nums">
              {formatEuro(prijs.totaal)}
            </span>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 p-4 bg-secondary border border-border rounded-lg">
        <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-sm text-secondary-foreground">
          <span className="font-semibold">Indicatieprijs</span> — Dit is een
          indicatieprijs op basis van uw opgegeven gegevens. Na verificatie door
          ons team ontvangt u een definitieve offerte. De eindprijs kan licht
          afwijken na meting ter plaatse.
        </p>
      </div>

      {/* Gewenste startdatum */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Gewenste startdatum</h3>
          <Badge variant="outline" className="text-xs text-muted-foreground border-border">
            Optioneel
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Selecteer uw voorkeursdatum voor de start van de werkzaamheden. Wij
          bevestigen de definitieve datum na overleg.
        </p>
        <BeschikbaarheidsKalender
          mode="selectie"
          selectedDatum={data.specs.gewensteStartdatum}
          onDatumSelect={onStartdatumChange}
        />
        {data.specs.gewensteStartdatum && (
          <button
            type="button"
            onClick={() => onStartdatumChange(undefined)}
            className="text-xs text-muted-foreground hover:text-red-600 underline underline-offset-2 transition-colors"
          >
            Datum wissen
          </button>
        )}
      </div>
    </div>
  );
}
