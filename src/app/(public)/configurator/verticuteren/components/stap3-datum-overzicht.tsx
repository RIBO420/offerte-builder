import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Calculator, Info, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";
import { BeschikbaarheidsKalender } from "@/components/beschikbaarheids-kalender";
import type { KlantGegevens, VerticuterenSpecs } from "./types";
import {
  BASISPRIJS_PER_M2,
  BIJZAAIEN_TARIEF,
  TOPDRESSING_TARIEF,
  BEMESTING_TARIEF,
  CONDITIE_CONFIG,
} from "./constants";
import { formatEuro, berekenMinDatum, berekenPrijs } from "./utils";
import { PrijsRegelRij } from "./prijs-regel-rij";

export function Stap3DatumOverzicht({
  klant,
  specs,
  gewensteDatum,
  opmerkingen,
  akkoordVoorwaarden,
  errors,
  onDatumSelect,
  onOpmerkingenChange,
  onAkkoordChange,
  onVersturen,
  isSubmitting,
}: {
  klant: KlantGegevens;
  specs: VerticuterenSpecs;
  gewensteDatum: Date | undefined;
  opmerkingen: string;
  akkoordVoorwaarden: boolean;
  errors: Record<string, string>;
  onDatumSelect: (datum: Date) => void;
  onOpmerkingenChange: (waarde: string) => void;
  onAkkoordChange: (waarde: boolean) => void;
  onVersturen: () => void;
  isSubmitting: boolean;
}) {
  const minDatum = useMemo(() => berekenMinDatum(), []);
  const prijs = useMemo(
    () => berekenPrijs(specs, klant.poortbreedte),
    [specs, klant.poortbreedte]
  );
  const m2 = parseFloat(specs.oppervlakte);
  const conditieConfig = specs.conditie ? CONDITIE_CONFIG[specs.conditie] : null;

  return (
    <div className="space-y-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-xl">Datum & Overzicht</CardTitle>
        <CardDescription>
          Kies een gewenste startdatum en controleer het prijsoverzicht voordat
          u uw aanvraag indient.
        </CardDescription>
      </CardHeader>

      {/* Kalender */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-900">
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
          <p className="text-xs text-red-600">{errors.gewensteDatum}</p>
        )}
      </div>

      {/* Prijsoverzicht */}
      {prijs ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4 text-green-600" />
              Indicatieprijs berekening
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Klantgegevens samenvatting */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Aanvraag voor
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
                <div>
                  <span className="text-muted-foreground">Naam: </span>
                  <span className="font-medium">{klant.naam}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Oppervlakte: </span>
                  <span className="font-medium">{m2} m²</span>
                </div>
                {conditieConfig && (
                  <div>
                    <span className="text-muted-foreground">Conditie: </span>
                    <span className="font-medium">{conditieConfig.label}</span>
                  </div>
                )}
                {gewensteDatum && (
                  <div>
                    <span className="text-muted-foreground">Datum: </span>
                    <span className="font-medium">
                      {gewensteDatum.toLocaleDateString("nl-NL", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="divide-y divide-gray-100">
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
              <div className="flex justify-between text-base font-bold pt-1">
                <span>Totaal (incl. BTW)</span>
                <span className="text-green-700 tabular-nums">
                  {formatEuro(prijs.totaal)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground border rounded-lg bg-gray-50">
          <Calculator className="h-10 w-10 mb-3 opacity-40" />
          <p className="font-medium">Geen volledige gegevens</p>
          <p className="text-sm mt-1">
            Ga terug en vul alle verplichte velden in om een prijs te berekenen.
          </p>
        </div>
      )}

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

      {/* Algemene voorwaarden */}
      <div
        className="flex items-start gap-3 p-4 rounded-lg border-2 border-gray-200 hover:border-green-300 transition-colors cursor-pointer"
        onClick={() => onAkkoordChange(!akkoordVoorwaarden)}
      >
        <Checkbox
          checked={akkoordVoorwaarden}
          onCheckedChange={(checked) => onAkkoordChange(checked === true)}
          className="mt-0.5 flex-shrink-0 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
          onClick={(e) => e.stopPropagation()}
        />
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
            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Aanvraag versturen...
          </>
        ) : (
          <>
            <Scissors className="mr-2 h-5 w-5" />
            Aanvraag versturen
          </>
        )}
      </Button>
    </div>
  );
}
