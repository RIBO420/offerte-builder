import { InfoIcon, PackageIcon, TruckIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { PRIJZEN, PRODUCT_INFO } from "./constants";
import { berekenM3, formatEuro, getBezorgInfo } from "./utils";
import type {
  BoomschorsType,
  BoomschorsSpecificaties,
  LaagDikte,
  FormErrors,
} from "./types";

// ---------------------------------------------------------------------------
// Stap 2: Boomschors specificaties
// ---------------------------------------------------------------------------

interface Stap2Props {
  specificaties: BoomschorsSpecificaties;
  onChange: (specificaties: BoomschorsSpecificaties) => void;
  errors: FormErrors;
}

export function Stap2Specificaties({ specificaties, onChange, errors }: Stap2Props) {
  function handleChange<K extends keyof BoomschorsSpecificaties>(
    field: K,
    value: BoomschorsSpecificaties[K]
  ) {
    onChange({ ...specificaties, [field]: value });
  }

  const m3Nodig = berekenM3(
    parseFloat(specificaties.oppervlakte) || 0,
    specificaties.laagDikte
  );

  const bezorgInfo =
    specificaties.bezorging === "bezorgen"
      ? getBezorgInfo(specificaties.bezorgPostcode)
      : null;

  const dikte_opties: LaagDikte[] = ["5cm", "7cm", "10cm"];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Boomschors specificaties</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Kies uw gewenste product en hoeveelheid.
        </p>
      </div>

      {/* Product keuze */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          Soort boomschors <span className="text-destructive">*</span>
        </Label>
        <RadioGroup
          value={specificaties.soort}
          onValueChange={(value) =>
            handleChange("soort", value as BoomschorsType)
          }
          className="grid gap-3 sm:grid-cols-2"
        >
          {(Object.keys(PRIJZEN) as BoomschorsType[]).map((key) => {
            const info = PRODUCT_INFO[key];
            const prijs = PRIJZEN[key];
            const isGeselecteerd = specificaties.soort === key;

            return (
              <label
                key={key}
                htmlFor={`soort-${key}`}
                className={cn(
                  "relative flex cursor-pointer rounded-xl border-2 p-4 gap-3 transition-all",
                  isGeselecteerd
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                )}
              >
                <RadioGroupItem
                  id={`soort-${key}`}
                  value={key}
                  className="mt-0.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-semibold text-sm">{info.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {info.subtitel}
                      </p>
                    </div>
                    {info.badge && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {info.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {info.beschrijving}
                  </p>
                  <p className="text-sm font-bold text-primary mt-2">
                    {formatEuro(prijs)}/m³
                  </p>
                </div>
              </label>
            );
          })}
        </RadioGroup>
        {errors.soort && (
          <p className="text-destructive text-xs">{errors.soort}</p>
        )}
      </div>

      {/* Hoeveelheid */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Hoeveelheid</Label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="oppervlakte">
              Oppervlakte (m²) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="oppervlakte"
              type="number"
              min="1"
              step="0.5"
              placeholder="bijv. 20"
              value={specificaties.oppervlakte}
              onChange={(e) => handleChange("oppervlakte", e.target.value)}
              aria-invalid={!!errors.oppervlakte}
            />
            {errors.oppervlakte && (
              <p className="text-destructive text-xs">{errors.oppervlakte}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="block">
              Gewenste laagdikte <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              {dikte_opties.map((dikte) => (
                <button
                  key={dikte}
                  type="button"
                  onClick={() => handleChange("laagDikte", dikte)}
                  className={cn(
                    "flex-1 rounded-lg border-2 py-2 text-sm font-medium transition-all",
                    specificaties.laagDikte === dikte
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  {dikte}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              7cm is de standaard aanbevolen dikte voor optimale
              onkruidonderdrukking.
            </p>
          </div>
        </div>

        {/* M3 berekening */}
        {(parseFloat(specificaties.oppervlakte) || 0) > 0 && (
          <div
            className={cn(
              "rounded-xl border p-4 flex items-start gap-3",
              m3Nodig < 1
                ? "border-destructive/50 bg-destructive/5"
                : "border-primary/30 bg-primary/5"
            )}
          >
            <InfoIcon
              className={cn(
                "size-4 shrink-0 mt-0.5",
                m3Nodig < 1 ? "text-destructive" : "text-primary"
              )}
            />
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                U heeft{" "}
                <span
                  className={cn(
                    "font-bold",
                    m3Nodig < 1 ? "text-destructive" : "text-primary"
                  )}
                >
                  {m3Nodig} m³
                </span>{" "}
                boomschors nodig
              </p>
              <p className="text-xs text-muted-foreground">
                {specificaties.oppervlakte} m² × {specificaties.laagDikte}{" "}
                laagdikte, afgerond naar boven op 0,5 m³
              </p>
              {m3Nodig < 1 && (
                <p className="text-xs text-destructive font-medium">
                  Minimale bestelling is 1 m³. Voer een grotere oppervlakte in.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bezorging */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Bezorging</Label>

        <RadioGroup
          value={specificaties.bezorging}
          onValueChange={(value) =>
            handleChange("bezorging", value as "ophalen" | "bezorgen")
          }
          className="grid gap-3 sm:grid-cols-2"
        >
          <label
            htmlFor="bezorging-ophalen"
            className={cn(
              "relative flex cursor-pointer rounded-xl border-2 p-4 gap-3 transition-all",
              specificaties.bezorging === "ophalen"
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
            )}
          >
            <RadioGroupItem
              id="bezorging-ophalen"
              value="ophalen"
              className="mt-0.5 shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <PackageIcon className="size-4 text-muted-foreground" />
                <p className="font-semibold text-sm">Ophalen</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                U haalt de boomschors zelf op bij ons depot.
              </p>
              <p className="text-sm font-bold text-green-600 mt-2">Gratis</p>
            </div>
          </label>

          <label
            htmlFor="bezorging-bezorgen"
            className={cn(
              "relative flex cursor-pointer rounded-xl border-2 p-4 gap-3 transition-all",
              specificaties.bezorging === "bezorgen"
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
            )}
          >
            <RadioGroupItem
              id="bezorging-bezorgen"
              value="bezorgen"
              className="mt-0.5 shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <TruckIcon className="size-4 text-muted-foreground" />
                <p className="font-semibold text-sm">Bezorgen</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Wij leveren bij u thuis met een containerwagen.
              </p>
              <p className="text-sm font-bold text-primary mt-2">
                Prijs op basis van afstand
              </p>
            </div>
          </label>
        </RadioGroup>

        {specificaties.bezorging === "bezorgen" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bezorgPostcode">
                Postcode bezorgadres <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bezorgPostcode"
                placeholder="1234 AB"
                value={specificaties.bezorgPostcode}
                onChange={(e) =>
                  handleChange("bezorgPostcode", e.target.value)
                }
                aria-invalid={!!errors.bezorgPostcode}
                className="max-w-[200px]"
              />
              {errors.bezorgPostcode && (
                <p className="text-destructive text-xs">
                  {errors.bezorgPostcode}
                </p>
              )}
            </div>

            {bezorgInfo && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/50 p-4">
                <div className="flex items-start gap-3">
                  <TruckIcon className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      Geschatte bezorgkosten ({bezorgInfo.label})
                    </p>
                    {bezorgInfo.type === "prijs" ? (
                      <p className="text-lg font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                        {formatEuro(bezorgInfo.prijs)}
                      </p>
                    ) : (
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                        Neem contact met ons op voor een maatwerkprijs.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 text-xs text-muted-foreground rounded-lg bg-muted/50 p-3">
              <InfoIcon className="size-3.5 shrink-0 mt-0.5" />
              <span>
                Bezorging met containerwagen — zorg voor voldoende ruimte bij
                uw oprit of inrit (minimaal 3,5 meter breed en 4 meter hoog).
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
