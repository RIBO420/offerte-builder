"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  Calculator,
  Info,
  Leaf,
  Loader2,
  CalendarDays,
} from "lucide-react";
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
// Stap 4: Prijsoverzicht
// ---------------------------------------------------------------------------

interface Stap4PrijsoverzichtProps {
  data: FormData;
  akkoordVoorwaarden: boolean;
  onAkkoordChange: (value: boolean) => void;
  onVersturen: () => void;
  isSubmitting: boolean;
  onStartdatumChange: (datum: Date | undefined) => void;
}

export function Stap4Prijsoverzicht({
  data,
  akkoordVoorwaarden,
  onAkkoordChange,
  onVersturen,
  isSubmitting,
  onStartdatumChange,
}: Stap4PrijsoverzichtProps) {
  const prijs = berekenPrijs(data);

  if (!prijs) {
    return (
      <div className="space-y-6">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-xl">Prijsoverzicht</CardTitle>
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
        <CardTitle className="text-xl">Prijsoverzicht & Bevestiging</CardTitle>
        <CardDescription>
          Hieronder vindt u de indicatieprijs op basis van de door u opgegeven
          gegevens. Na uw aanvraag controleren wij de details ter plaatse.
        </CardDescription>
      </CardHeader>

      {/* Klantgegevens samenvatting */}
      <Card className="bg-gray-50 border-gray-200">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Aanvraag voor
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm">
            <div>
              <span className="text-muted-foreground">Naam: </span>
              <span className="font-medium">{data.klant.naam}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Email: </span>
              <span className="font-medium">{data.klant.email}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Adres: </span>
              <span className="font-medium">
                {data.klant.adres}, {data.klant.postcode} {data.klant.plaats}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Oppervlakte: </span>
              <span className="font-medium">{m2} m² ({typeLabel})</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prijsberekening */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4 text-green-600" />
            Indicatieprijs berekening
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-gray-100">
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
            <div className="flex justify-between text-base font-bold pt-1">
              <span>Totaal (incl. BTW)</span>
              <span className="text-green-700 tabular-nums">{formatEuro(prijs.totaal)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-lg">
        <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800">
          <span className="font-semibold">Indicatieprijs</span> — Dit is een
          indicatieprijs op basis van uw opgegeven gegevens. Na verificatie door
          ons team ontvangt u een definitieve offerte. De eindprijs kan licht
          afwijken na meting ter plaatse.
        </p>
      </div>

      {/* Gewenste startdatum */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-green-600" />
          <h3 className="text-sm font-semibold text-gray-900">Gewenste startdatum</h3>
          <Badge variant="outline" className="text-xs text-muted-foreground border-gray-300">
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

      {/* Akkoord voorwaarden */}
      <div className="flex items-start gap-3 p-4 rounded-lg border-2 border-gray-200 hover:border-green-300 transition-colors cursor-pointer"
        onClick={() => onAkkoordChange(!akkoordVoorwaarden)}
      >
        <div
          className={cn(
            "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 mt-0.5 transition-colors",
            akkoordVoorwaarden
              ? "bg-green-600 border-green-600"
              : "border-gray-300 bg-white"
          )}
        >
          {akkoordVoorwaarden && (
            <CheckCircle2 className="h-3.5 w-3.5 text-white" />
          )}
        </div>
        <p className="text-sm text-gray-700 select-none">
          Ik ga akkoord met de{" "}
          <a
            href="#"
            className="text-green-700 font-medium underline underline-offset-2 hover:text-green-900"
            onClick={(e) => e.stopPropagation()}
          >
            algemene voorwaarden
          </a>{" "}
          van Top Tuinen. Ik begrijp dat dit een indicatieprijs is en dat de
          definitieve offerte na inspectie wordt opgesteld.
        </p>
      </div>

      {/* Versturen knop */}
      <Button
        onClick={onVersturen}
        disabled={!akkoordVoorwaarden || isSubmitting}
        size="lg"
        className={cn(
          "w-full bg-green-600 hover:bg-green-700 text-white font-semibold",
          (!akkoordVoorwaarden || isSubmitting) && "opacity-50 cursor-not-allowed"
        )}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Aanvraag versturen...
          </>
        ) : (
          <>
            <Leaf className="mr-2 h-5 w-5" />
            Aanvraag versturen
          </>
        )}
      </Button>
    </div>
  );
}
