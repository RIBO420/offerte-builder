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

export function Stap2VerticuterenSpecs({
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
  return (
    <div className="space-y-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-xl">Verticuteren specificaties</CardTitle>
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
                  : "border-gray-200 hover:border-gray-300 bg-white"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-900">
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
                        : "border-gray-300 text-gray-500"
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
                        : "border-gray-300 text-gray-500"
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
          <p className="text-xs text-red-600">{errors.conditie}</p>
        )}
      </div>

      <Separator />

      {/* Extra opties */}
      <div className="space-y-4">
        <p className="text-sm font-medium text-gray-900">
          Extra opties na het verticuteren
        </p>

        {/* Bijzaaien */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50">
          <div className="flex-1 pr-4">
            <p className="text-sm font-medium text-gray-900">
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
        <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50">
          <div className="flex-1 pr-4">
            <p className="text-sm font-medium text-gray-900">
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
              <p className="text-sm font-medium text-gray-900">
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
    </div>
  );
}
