import { useMemo } from "react";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Calculator, Info } from "lucide-react";
import { BeschikbaarheidsKalender } from "@/components/beschikbaarheids-kalender";
import type { VerticuterenSpecs } from "./types";
import {
  BASISPRIJS_PER_M2,
  BIJZAAIEN_TARIEF,
  TOPDRESSING_TARIEF,
  BEMESTING_TARIEF,
  CONDITIE_CONFIG,
} from "./constants";
import { formatEuro, berekenMinDatum, berekenPrijs } from "./utils";
import { PrijsRegelRij } from "./prijs-regel-rij";

/* WS9: stap 2 — prijsindicatie & datum, vóórdat de klant NAW-gegevens invult.
   Akkoord en versturen zitten in de slotstap (Uw gegevens). */
export function StapDatumPrijs({
  specs,
  gewensteDatum,
  opmerkingen,
  errors,
  onDatumSelect,
  onOpmerkingenChange,
}: {
  specs: VerticuterenSpecs;
  gewensteDatum: Date | undefined;
  opmerkingen: string;
  errors: Record<string, string>;
  onDatumSelect: (datum: Date) => void;
  onOpmerkingenChange: (waarde: string) => void;
}) {
  const minDatum = useMemo(() => berekenMinDatum(), []);
  const prijs = useMemo(() => berekenPrijs(specs), [specs]);
  const m2 = parseFloat(specs.oppervlakte);
  const conditieConfig = specs.conditie ? CONDITIE_CONFIG[specs.conditie] : null;

  return (
    <div className="space-y-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-xl font-display">Uw prijsindicatie & datum</CardTitle>
        <CardDescription>
          Bekijk de indicatieprijs en kies een gewenste datum voor de
          werkzaamheden.
        </CardDescription>
      </CardHeader>

      {/* Prijsoverzicht als "offertepapier" */}
      {prijs ? (
        <div className="rounded-lg border border-border bg-card shadow-sm px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex items-center justify-between gap-2 border-b border-border pb-3 mb-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Indicatieprijs
            </p>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calculator className="h-3.5 w-3.5 text-primary" />
              Verticuteren{conditieConfig ? ` · conditie ${conditieConfig.label.toLowerCase()}` : ""}
            </span>
          </div>

          <div className="divide-y divide-border">
            {/* Basisprijs */}
            <PrijsRegelRij
              label="Verticuteren (basisprijs)"
              detail={`${m2} m² × ${formatEuro(BASISPRIJS_PER_M2)}/m²`}
              bedrag={formatEuro(prijs.basisprijs)}
            />

            {/* Conditie toeslag */}
            {prijs.conditioneelToeslag > 0 && conditieConfig && (
              <PrijsRegelRij
                label={`Conditie-toeslag (${conditieConfig.label.toLowerCase()}, +${prijs.conditioneelToeslagPercent}%)`}
                detail={`${m2} m² × ${formatEuro(BASISPRIJS_PER_M2)}/m² × ${prijs.conditioneelToeslagPercent}%`}
                bedrag={formatEuro(prijs.conditioneelToeslag)}
              />
            )}

            {/* Handmatig werk toeslag */}
            {prijs.handmatigToeslag && (
              <PrijsRegelRij
                label="Toeslag handmatig werk (+25%)"
                detail="Smalste doorgang < 80 cm — extra arbeidsintensief"
                bedrag={formatEuro(prijs.handmatigToeslagBedrag)}
              />
            )}

            {/* Bijzaaien */}
            {prijs.bijzaaienRegel !== null && (
              <PrijsRegelRij
                label="Bijzaaien"
                detail={`${m2} m² × ${formatEuro(BIJZAAIEN_TARIEF)}/m²`}
                bedrag={formatEuro(prijs.bijzaaienRegel)}
              />
            )}

            {/* Topdressing */}
            {prijs.topdressingRegel !== null && (
              <PrijsRegelRij
                label="Topdressing"
                detail={`${m2} m² × ${formatEuro(TOPDRESSING_TARIEF)}/m²`}
                bedrag={formatEuro(prijs.topdressingRegel)}
              />
            )}

            {/* Bemesting */}
            {prijs.bemestingRegel !== null && (
              <PrijsRegelRij
                label="Bemesting"
                detail={`${m2} m² × ${formatEuro(BEMESTING_TARIEF)}/m²`}
                bedrag={formatEuro(prijs.bemestingRegel)}
                highlight
              />
            )}

            {/* Machine-huurkosten */}
            <PrijsRegelRij
              label="Machine-huurkosten"
              bedrag={formatEuro(prijs.machineHuur)}
            />

            {/* Voorrijkosten */}
            <PrijsRegelRij
              label="Voorrijkosten"
              bedrag={formatEuro(prijs.voorrijkosten)}
            />
          </div>

          <Separator className="my-4" />

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotaal (excl. BTW)</span>
              <span className="font-medium tabular-nums">
                {formatEuro(prijs.subtotaal)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">BTW (21%)</span>
              <span className="font-medium tabular-nums">
                {formatEuro(prijs.btw)}
              </span>
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
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground border rounded-lg bg-muted">
          <Calculator className="h-10 w-10 mb-3 opacity-40" />
          <p className="font-medium">Geen volledige gegevens</p>
          <p className="text-sm mt-1">
            Ga terug en vul alle verplichte velden in om een prijs te berekenen.
          </p>
        </div>
      )}

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

      {/* Kalender */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          Gewenste datum <span className="text-red-500">*</span>
        </p>
        <BeschikbaarheidsKalender
          mode="selectie"
          selectedDatum={gewensteDatum}
          onDatumSelect={onDatumSelect}
          minDatum={minDatum}
          geblokkeerdeDagen={[0, 6]}
        />
        {errors.gewensteDatum && (
          <p className="text-xs text-red-600">
            {errors.gewensteDatum}
          </p>
        )}
      </div>

      {/* Opmerkingen */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">
          Opmerkingen{" "}
          <span className="text-muted-foreground font-normal">(optioneel)</span>
        </Label>
        <Textarea
          placeholder="Bijzonderheden over uw tuin, toegangsmoeilijkheden, specifieke wensen..."
          value={opmerkingen}
          onChange={(e) => onOpmerkingenChange(e.target.value)}
          rows={3}
          className="resize-none"
        />
      </div>
    </div>
  );
}
