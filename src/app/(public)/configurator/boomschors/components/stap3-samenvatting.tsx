import { format } from "date-fns";
import { nl } from "@/lib/date-locale";

import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { BeschikbaarheidsKalender } from "@/components/beschikbaarheids-kalender";

import { PRODUCT_INFO } from "./constants";
import { berekenPrijs, formatEuro, MIN_LEVERDATUM } from "./utils";
import type {
  KlantGegevens,
  BoomschorsSpecificaties,
  Samenvatting,
  FormErrors,
} from "./types";

// ---------------------------------------------------------------------------
// Stap 3: Samenvatting
// ---------------------------------------------------------------------------

interface Stap3Props {
  klantGegevens: KlantGegevens;
  specificaties: BoomschorsSpecificaties;
  samenvatting: Samenvatting;
  onSamenvattingChange: (samenvatting: Samenvatting) => void;
  errors: FormErrors;
}

export function Stap3Samenvatting({
  klantGegevens,
  specificaties,
  samenvatting,
  onSamenvattingChange,
  errors,
}: Stap3Props) {
  const berekening = berekenPrijs(specificaties);
  const productInfo = PRODUCT_INFO[specificaties.soort];

  function handleChange<K extends keyof Samenvatting>(
    field: K,
    value: Samenvatting[K]
  ) {
    onSamenvattingChange({ ...samenvatting, [field]: value });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Samenvatting &amp; bevestiging</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Controleer uw bestelling en kies een leveringsdatum.
        </p>
      </div>

      {/* Klantgegevens samenvatting */}
      <Card variant="subtle">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Uw gegevens
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="space-y-1 text-sm">
            <p className="font-medium">{klantGegevens.naam}</p>
            <p className="text-muted-foreground">{klantGegevens.email}</p>
            <p className="text-muted-foreground">{klantGegevens.telefoon}</p>
            <p className="text-muted-foreground">
              {klantGegevens.adres}, {klantGegevens.postcode}{" "}
              {klantGegevens.plaats}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Prijsoverzicht */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Prijsoverzicht
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          {/* Boomschors regel */}
          <div className="flex items-start justify-between gap-4 text-sm">
            <div>
              <p className="font-medium">
                {productInfo.label} ({specificaties.laagDikte})
              </p>
              <p className="text-muted-foreground text-xs">
                {berekening.oppervlakte} m² &rarr; {berekening.m3Nodig} m³ &times;{" "}
                {formatEuro(berekening.prijs_per_m3)}/m³
              </p>
            </div>
            <p className="font-semibold whitespace-nowrap">
              {formatEuro(berekening.schors_totaal)}
            </p>
          </div>

          {/* Bezorgkosten */}
          <div className="flex items-start justify-between gap-4 text-sm">
            <p className="text-muted-foreground">{berekening.bezorgLabel}</p>
            <p className="font-semibold whitespace-nowrap">
              {berekening.heeftBezorgMaatwerk
                ? "Nader te bepalen"
                : specificaties.bezorging === "ophalen"
                  ? "Gratis"
                  : formatEuro(berekening.bezorgkosten)}
            </p>
          </div>

          <Separator />

          {/* Subtotaal */}
          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">Subtotaal (excl. BTW)</p>
            <p className="font-medium">
              {berekening.heeftBezorgMaatwerk
                ? "—"
                : formatEuro(berekening.subtotaal)}
            </p>
          </div>

          {/* BTW */}
          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">BTW (21%)</p>
            <p className="font-medium">
              {berekening.heeftBezorgMaatwerk
                ? "—"
                : formatEuro(berekening.btw)}
            </p>
          </div>

          <Separator />

          {/* Totaal */}
          <div className="flex items-center justify-between">
            <p className="font-bold text-base">Totaal (incl. BTW)</p>
            <p className="font-bold text-lg text-primary">
              {berekening.heeftBezorgMaatwerk
                ? "Op aanvraag"
                : formatEuro(berekening.totaal)}
            </p>
          </div>

          {berekening.heeftBezorgMaatwerk && (
            <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2 mt-1">
              De bezorgkosten voor uw locatie worden nader bepaald. Wij nemen
              contact met u op voor een definitieve prijs.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Leveringsdatum via BeschikbaarheidsKalender */}
      <div className="space-y-2">
        <Label className="text-base font-medium">
          Gewenste leveringsdatum <span className="text-destructive">*</span>
        </Label>
        <p className="text-xs text-muted-foreground">
          Vroegst mogelijke levering:{" "}
          {format(MIN_LEVERDATUM, "EEEE d MMMM yyyy", { locale: nl })}
        </p>
        <BeschikbaarheidsKalender
          mode="selectie"
          minDatum={MIN_LEVERDATUM}
          selectedDatum={samenvatting.leveringsDatum}
          onDatumSelect={(datum) => handleChange("leveringsDatum", datum)}
          geblokkeerdeDagen={[0, 6]}
        />
        {errors.leveringsDatum && (
          <p className="text-destructive text-xs">{errors.leveringsDatum}</p>
        )}
      </div>

      {/* Opmerkingen */}
      <div className="space-y-1.5">
        <Label htmlFor="opmerkingen">Opmerkingen (optioneel)</Label>
        <Textarea
          id="opmerkingen"
          placeholder="Eventuele bijzonderheden voor de levering, toegangsinstructies, etc."
          value={samenvatting.opmerkingen}
          onChange={(e) => handleChange("opmerkingen", e.target.value)}
          rows={3}
        />
      </div>

      {/* Algemene voorwaarden */}
      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id="akkoord"
            checked={samenvatting.akkoordVoorwaarden}
            onCheckedChange={(checked) =>
              handleChange("akkoordVoorwaarden", checked === true)
            }
            aria-invalid={!!errors.akkoordVoorwaarden}
            className="mt-0.5"
          />
          <Label
            htmlFor="akkoord"
            className="text-sm font-normal cursor-pointer leading-relaxed"
          >
            Ik ga akkoord met de{" "}
            <a
              href="/algemene-voorwaarden"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:no-underline"
            >
              algemene voorwaarden
            </a>{" "}
            van Top Tuinen.{" "}
            <span className="text-destructive">*</span>
          </Label>
        </div>
        {errors.akkoordVoorwaarden && (
          <p className="text-destructive text-xs ml-7">
            {errors.akkoordVoorwaarden}
          </p>
        )}
      </div>
    </div>
  );
}
