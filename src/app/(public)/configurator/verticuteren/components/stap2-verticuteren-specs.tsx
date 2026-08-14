import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { GazonConditie, VerticuterenSpecs } from "./types";
import {
  CONDITIE_CONFIG,
  BIJZAAIEN_TARIEF,
  TOPDRESSING_TARIEF,
  BEMESTING_TARIEF,
} from "./constants";
import { formatEuro } from "./utils";
import { Field } from "./field";
import { PoortWaarschuwing } from "./poort-waarschuwing";

export function StapVerticuterenSpecs({
  data,
  errors,
  onChange,
}: {
  data: VerticuterenSpecs;
  errors: Record<string, string>;
  onChange: <K extends keyof VerticuterenSpecs>(
    field: K,
    value: VerticuterenSpecs[K]
  ) => void;
}) {
  const poortBreedte = parseFloat(data.poortbreedte);
  const isTeSmall = !isNaN(poortBreedte) && poortBreedte < 60;

  return (
    <div className="space-y-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-xl font-display">Verticuteren specificaties</CardTitle>
        <CardDescription>
          Geef de details van uw gazon op. Wij berekenen op basis hiervan een
          indicatieprijs voor de verticuteerdienst.
        </CardDescription>
      </CardHeader>

      {/* Oppervlakte */}
      <Field
        label="Oppervlakte gazon"
        error={errors.oppervlakte}
        hulptekst="Schat de oppervlakte van uw gazon. Minimaal 20 m². Wij controleren dit later ter plaatse."
      >
        <div className="flex items-center gap-3">
          <Input
            required
            aria-required
            type="number"
            placeholder="75"
            min={20}
            value={data.oppervlakte}
            onChange={(e) => onChange("oppervlakte", e.target.value)}
            className={cn(
              "max-w-36",
              errors.oppervlakte && "border-red-400 focus-visible:ring-red-400"
            )}
          />
          <span className="text-sm text-muted-foreground">m²</span>
        </div>
      </Field>

      {/* Conditie gazon */}
      <div className="space-y-3">
        <Label
          className={cn(
            "text-sm font-medium",
            errors.conditie && "text-red-600"
          )}
        >
          Huidige conditie van het gazon{" "}
          <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(
            Object.entries(CONDITIE_CONFIG) as [
              GazonConditie,
              (typeof CONDITIE_CONFIG)[GazonConditie],
            ][]
          ).map(([conditie, config]) => (
            <button
              key={conditie}
              type="button"
              onClick={() => onChange("conditie", conditie)}
              className={cn(
                "text-left p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-sm",
                data.conditie === conditie
                  ? config.kleur + " shadow-sm"
                  : "border-border hover:border-muted-foreground/40 bg-card"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-semibold text-sm text-foreground">
                    {config.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {config.uitleg}
                  </p>
                </div>
                {config.toeslagPercent > 0 ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs flex-shrink-0 mt-0.5",
                      data.conditie === conditie
                        ? "border-current " + config.intensiteit
                        : "border-border text-muted-foreground"
                    )}
                  >
                    +{config.toeslagPercent}%
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs flex-shrink-0 mt-0.5",
                      data.conditie === conditie
                        ? "border-green-500 text-green-700"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    Standaard
                  </Badge>
                )}
              </div>
            </button>
          ))}
        </div>
        {errors.conditie && (
          <p className="text-xs text-red-600">
            {errors.conditie}
          </p>
        )}
      </div>

      <Separator />

      {/* Extra opties */}
      <div className="space-y-4">
        <p className="text-sm font-medium text-foreground">
          Extra opties na het verticuteren
        </p>

        {/* Bijzaaien */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted">
          <div className="flex-1 pr-4">
            <p className="text-sm font-medium text-foreground">
              Bijzaaien na verticuteren
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Graaszaad inzaaien in de opengevallen plekken voor een dichter
              gazon — +{formatEuro(BIJZAAIEN_TARIEF)}/m²
            </p>
          </div>
          <Switch
            checked={data.bijzaaien}
            onCheckedChange={(checked) => onChange("bijzaaien", checked)}
          />
        </div>

        {/* Topdressing */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted">
          <div className="flex-1 pr-4">
            <p className="text-sm font-medium text-foreground">
              Topdressing aanbrengen
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Laagje zand/compost mengsel voor betere bodemstructuur —
              +{formatEuro(TOPDRESSING_TARIEF)}/m²
            </p>
          </div>
          <Switch
            checked={data.topdressing}
            onCheckedChange={(checked) => onChange("topdressing", checked)}
          />
        </div>

        {/* Bemesting — aanbevolen highlight */}
        <div
          className={cn(
            "flex items-center justify-between p-4 rounded-lg border-2 transition-colors",
            data.bemesting
              ? "border-green-400 bg-green-50"
              : "border-green-200 bg-green-50/40"
          )}
        >
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-medium text-foreground">
                Bemesting toevoegen
              </p>
              <Badge className="text-xs bg-green-600 hover:bg-green-600 text-white border-0">
                Aanbevolen
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Geeft uw gazon de voedingsstoffen die het nodig heeft na het
              verticuteren — +{formatEuro(BEMESTING_TARIEF)}/m²
            </p>
          </div>
          <Switch
            checked={data.bemesting}
            onCheckedChange={(checked) => onChange("bemesting", checked)}
          />
        </div>
      </div>

      <Separator />

      {/* Poortbreedte — bepaalt de machine-inzet en dus de prijs (WS9: bij de
          specificaties, zodat de prijsindicatie vóór de NAW-stap compleet is). */}
      <Field
        label="Poortbreedte"
        error={errors.poortbreedte}
        hulptekst="De breedte van de smalste doorgang naar uw tuin, in centimeters. Dit bepaalt welke machines we kunnen inzetten."
      >
        <div className="flex items-center gap-3">
          <Input
            required
            aria-required
            type="number"
            placeholder="120"
            min={1}
            max={500}
            value={data.poortbreedte}
            onChange={(e) => onChange("poortbreedte", e.target.value)}
            className={cn(
              "max-w-36",
              (errors.poortbreedte || isTeSmall) &&
                "border-red-400 focus-visible:ring-red-400"
            )}
          />
          <span className="text-sm text-muted-foreground">cm</span>
        </div>
      </Field>

      <PoortWaarschuwing breedte={data.poortbreedte} />
    </div>
  );
}
