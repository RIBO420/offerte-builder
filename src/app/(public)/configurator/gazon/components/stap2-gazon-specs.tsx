"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Field } from "./stap1-klantgegevens";
import type { GazonSpecs, TypeGras, Ondergrond } from "./types";
import { TYPE_GRAS_CONFIG, ONDERGROND_CONFIG } from "./types";

interface Stap2GazonSpecsProps {
  data: GazonSpecs;
  errors: Record<string, string>;
  onChange: <K extends keyof GazonSpecs>(field: K, value: GazonSpecs[K]) => void;
}

export function Stap2GazonSpecs({
  data,
  errors,
  onChange,
}: Stap2GazonSpecsProps) {
  return (
    <div className="space-y-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-xl">Gazon specificaties</CardTitle>
        <CardDescription>
          Vertel ons over uw tuin en gewenste gazon. Wij controleren de
          afmetingen later on-site.
        </CardDescription>
      </CardHeader>

      {/* Oppervlakte */}
      <Field
        label="Geschatte oppervlakte"
        error={errors.oppervlakte}
        hulptekst="Meet uw tuin op of schat het oppervlak. Wij controleren dit later ter plaatse."
      >
        <div className="flex items-center gap-3">
          <Input
            required
            aria-required
            type="number"
            placeholder="50"
            min={10}
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

      {/* Type gras */}
      <div className="space-y-3">
        <Label className={cn("text-sm font-medium", errors.typeGras && "text-red-600 dark:text-red-400")}>
          Type gras <span className="text-red-500 dark:text-red-400">*</span>
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.entries(TYPE_GRAS_CONFIG) as [TypeGras, typeof TYPE_GRAS_CONFIG[TypeGras]][]).map(
            ([type, config]) => (
              <button
                key={type}
                type="button"
                onClick={() => onChange("typeGras", type)}
                className={cn(
                  "text-left p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-sm",
                  data.typeGras === type
                    ? config.kleur + " shadow-sm"
                    : "border-border hover:border-muted-foreground/40 bg-card"
                )}
              >
                <p className="font-semibold text-sm text-foreground">{config.label}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {config.uitleg}
                </p>
                <Badge
                  variant="outline"
                  className={cn(
                    "mt-3 text-xs",
                    data.typeGras === type
                      ? "border-current"
                      : "border-border"
                  )}
                >
                  {config.prijsIndicatie}
                </Badge>
              </button>
            )
          )}
        </div>
        {errors.typeGras && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.typeGras}</p>
        )}
      </div>

      {/* Ondergrond */}
      <div className="space-y-3">
        <Label className={cn("text-sm font-medium", errors.ondergrond && "text-red-600 dark:text-red-400")}>
          Huidige ondergrond <span className="text-red-500 dark:text-red-400">*</span>
        </Label>
        <div className="space-y-2">
          {(Object.entries(ONDERGROND_CONFIG) as [Ondergrond, typeof ONDERGROND_CONFIG[Ondergrond]][]).map(
            ([type, config]) => (
              <button
                key={type}
                type="button"
                onClick={() => onChange("ondergrond", type)}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-lg border-2 transition-all cursor-pointer hover:shadow-sm flex items-start justify-between gap-4",
                  data.ondergrond === type
                    ? "border-green-500 bg-green-50 dark:bg-green-950 shadow-sm"
                    : "border-border hover:border-muted-foreground/40 bg-card"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground">{config.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{config.uitleg}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {config.toeslag && (
                    <Badge
                      variant="outline"
                      className="text-xs text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-800 dark:bg-amber-950"
                    >
                      Toeslag
                    </Badge>
                  )}
                  {config.tarief > 0 && (
                    <span className="text-xs font-medium text-muted-foreground">
                      +€{config.tarief}/m²
                    </span>
                  )}
                  {config.tarief === 0 && (
                    <span className="text-xs font-medium text-green-700 dark:text-green-400">
                      Inbegrepen
                    </span>
                  )}
                </div>
              </button>
            )
          )}
        </div>
        {errors.ondergrond && (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.ondergrond}</p>
        )}
      </div>

      <Separator />

      {/* Opties */}
      <div className="space-y-4">
        <p className="text-sm font-medium text-foreground">Extra opties</p>

        {/* Drainage */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted">
          <div className="flex-1 pr-4">
            <p className="text-sm font-medium text-foreground">Drainage aanleggen</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Aanbevolen bij zware kleigrond of wateroverlast. Schatting: 1 m
              drainage per 10 m² — €15/m
            </p>
          </div>
          <Switch
            checked={data.drainage}
            onCheckedChange={(checked) => onChange("drainage", checked)}
          />
        </div>

        {/* Opsluitbanden */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted">
          <div className="flex-1 pr-4">
            <p className="text-sm font-medium text-foreground">Opsluitbanden plaatsen</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Nette afscheiding van het gazon naar borders, paden of bestrating — €18/m
            </p>
          </div>
          <Switch
            checked={data.opsluitbanden}
            onCheckedChange={(checked) => {
              onChange("opsluitbanden", checked);
              if (!checked) onChange("opsluitbandenMeters", "");
            }}
          />
        </div>

        {/* Opsluitbanden meters — alleen zichtbaar als toggle aan */}
        {data.opsluitbanden && (
          <div className="ml-4 pl-4 border-l-2 border-green-200 dark:border-green-900">
            <Field label="Aantal strekkende meters" error={errors.opsluitbandenMeters}>
              <div className="flex items-center gap-3">
                <Input
                  required
                  aria-required
                  type="number"
                  placeholder="20"
                  min={1}
                  value={data.opsluitbandenMeters}
                  onChange={(e) => onChange("opsluitbandenMeters", e.target.value)}
                  className={cn(
                    "max-w-36",
                    errors.opsluitbandenMeters &&
                      "border-red-400 focus-visible:ring-red-400"
                  )}
                />
                <span className="text-sm text-muted-foreground">m</span>
              </div>
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}
