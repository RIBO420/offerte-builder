"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { AreaInput } from "@/components/ui/number-input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Flower2, Leaf, Compass, Info, Sprout } from "lucide-react";
import { PriceEstimateBadge } from "@/components/ui/price-estimate-badge";
import { bordersSchema, type BordersFormData } from "@/lib/validations/aanleg-scopes";
import type { BordersData, Orientatie, BodemMix } from "@/types/offerte";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface BordersFormProps {
  data: BordersData;
  onChange: (data: BordersData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

// Plant suggestions per orientation
const PLANT_SUGGESTIES: Record<Exclude<Orientatie, "nvt">, { label: string; beschrijving: string; planten: string }> = {
  noord: {
    label: "Schaduwminnende planten",
    beschrijving: "Noord: veel schaduw gedurende de dag",
    planten: "Hosta's, varens, heuchera",
  },
  zuid: {
    label: "Zonminnende planten",
    beschrijving: "Zuid: volop zon gedurende de dag",
    planten: "Lavendel, salie, rozemarijn",
  },
  oost: {
    label: "Halfschaduw planten",
    beschrijving: "Oost: ochtendzon, middag schaduw",
    planten: "Hortensia, astilbe, brunnera",
  },
  west: {
    label: "Halfschaduw / zon planten",
    beschrijving: "West: middagzon, ochtend schaduw",
    planten: "Geranium, echinacea, rudbeckia",
  },
};

const ORIENTATIE_TOOLTIPS: Record<Exclude<Orientatie, "nvt">, string> = {
  noord: "Noord: meer schaduw, geschikt voor schaduwplanten",
  zuid: "Zuid: veel zon, ideaal voor mediterrane beplanting",
  oost: "Oost: ochtendzon, goede balans licht/schaduw",
  west: "West: middagzon, warm in de namiddag",
};

const DEFAULT_BODEM_MIX: BodemMix = {
  zandPercentage: 40,
  compostPercentage: 30,
  teelaardPercentage: 30,
};

export function BordersForm({ data, onChange, onValidationChange }: BordersFormProps) {
  const form = useForm<BordersFormData>({
    resolver: zodResolver(bordersSchema),
    defaultValues: data,
    mode: "onChange",
  });

  const { formState: { errors, isValid }, watch } = form;

  // Local state for optional (non-Zod) fields
  const [orientatie, setOrientatie] = useState<Orientatie | undefined>(data.orientatie);
  const [bodemVerbeteringType, setBodemVerbeteringType] = useState<"bestaand" | "nieuw">(
    data.bodemMix ? "nieuw" : "bestaand"
  );
  const [bodemMix, setBodemMix] = useState<BodemMix>(data.bodemMix ?? DEFAULT_BODEM_MIX);
  const [bemestingsschema, setBemestingsschema] = useState<boolean>(data.bemestingsschema ?? false);

  // Build complete data object, memoized to avoid recreating on every render
  const buildCompleteData = useCallback(
    (formValues: Partial<BordersFormData>): BordersData => {
      const watchBodemverbetering = formValues.bodemverbetering ?? false;
      return {
        oppervlakte: formValues.oppervlakte ?? 0,
        beplantingsintensiteit: formValues.beplantingsintensiteit ?? "gemiddeld",
        bodemverbetering: watchBodemverbetering,
        afwerking: formValues.afwerking ?? "geen",
        // Optional new fields
        ...(orientatie && { orientatie }),
        ...(watchBodemverbetering && bodemVerbeteringType === "nieuw" && { bodemMix }),
        bemestingsschema,
      };
    },
    [orientatie, bodemVerbeteringType, bodemMix, bemestingsschema]
  );

  // Watch for form field changes and sync with parent
  useEffect(() => {
    const subscription = watch((values) => {
      if (values.oppervlakte !== undefined) {
        onChange(buildCompleteData(values));
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange, buildCompleteData]);

  // Sync optional fields changes to parent
  useEffect(() => {
    const currentValues = form.getValues();
    onChange(buildCompleteData(currentValues));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orientatie, bodemVerbeteringType, bodemMix, bemestingsschema]);

  // Notify parent of validation state changes (only when errors object changes)
  useEffect(() => {
    if (onValidationChange) {
      const errorMessages: Record<string, string> = {};
      Object.entries(errors).forEach(([key, error]) => {
        if (error?.message) {
          errorMessages[key] = error.message;
        }
      });
      onValidationChange(isValid, errorMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(errors), isValid]);

  const watchedValues = watch();
  const plantCount = watchedValues.oppervlakte > 0
    ? Math.round(watchedValues.oppervlakte * (
        watchedValues.beplantingsintensiteit === "weinig" ? 4 :
        watchedValues.beplantingsintensiteit === "gemiddeld" ? 6.5 : 10
      ))
    : null;

  // Bodem mix total validation
  const bodemMixTotal = bodemMix.zandPercentage + bodemMix.compostPercentage + bodemMix.teelaardPercentage;
  const bodemMixValid = bodemMixTotal === 100;

  // Handler for bodem mix slider changes that auto-adjusts to stay at 100%
  const handleBodemMixChange = useCallback((key: keyof BodemMix, newValue: number) => {
    setBodemMix((prev) => {
      const updated = { ...prev, [key]: newValue };
      // Calculate remaining to distribute among other two keys
      const otherKeys = (Object.keys(prev) as (keyof BodemMix)[]).filter((k) => k !== key);
      const remaining = 100 - newValue;
      const otherTotal = otherKeys.reduce((sum, k) => sum + prev[k], 0);

      if (otherTotal === 0) {
        // Split evenly if both others are 0
        const each = Math.floor(remaining / otherKeys.length);
        otherKeys.forEach((k, i) => {
          updated[k] = i === otherKeys.length - 1 ? remaining - each * (otherKeys.length - 1) : each;
        });
      } else {
        // Distribute proportionally
        let distributed = 0;
        otherKeys.forEach((k, i) => {
          if (i === otherKeys.length - 1) {
            updated[k] = Math.max(0, remaining - distributed);
          } else {
            const proportion = prev[k] / otherTotal;
            const share = Math.round(remaining * proportion);
            updated[k] = Math.max(0, share);
            distributed += updated[k];
          }
        });
      }

      return updated;
    });
  }, []);

  // Plant suggestion for current orientation
  const plantSuggestie = useMemo(() => {
    if (!orientatie || orientatie === "nvt") return null;
    return PLANT_SUGGESTIES[orientatie];
  }, [orientatie]);

  return (
    <Form {...form}>
      <form className="space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flower2 className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Borders & Beplanting</CardTitle>
              </div>
              <PriceEstimateBadge
                scope="borders"
                oppervlakte={watchedValues.oppervlakte}
              />
            </div>
            <CardDescription className="text-xs">
              Grondbewerking, planten en afwerking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="oppervlakte"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Borderoppervlakte</FormLabel>
                    <FormControl>
                      <AreaInput
                        id="borders-oppervlakte"
                        min={0}
                        value={field.value || 0}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        showStepper={false}
                        error={!!errors.oppervlakte}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="beplantingsintensiteit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Beplantingsintensiteit</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="borders-intensiteit">
                          <SelectValue placeholder="Selecteer intensiteit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weinig">Weinig (3-5 planten/m2)</SelectItem>
                        <SelectItem value="gemiddeld">Gemiddeld (5-8 planten/m2)</SelectItem>
                        <SelectItem value="veel">Veel (8-12 planten/m2)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Bepaalt aantal planten en arbeidsuren
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="afwerking"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Afwerking</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger id="borders-afwerking">
                        <SelectValue placeholder="Selecteer afwerking" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="geen">Geen afwerking</SelectItem>
                      <SelectItem value="schors">Schors (boomschors)</SelectItem>
                      <SelectItem value="grind">Siergrint</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* --- A) Orientatie selector --- */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Orientatie border</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Bepaalt welke planten het best gedijen in de border
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center justify-center">
                <div className="relative grid grid-cols-3 grid-rows-3 gap-1 w-fit">
                  {/* Row 1: empty - Noord - empty */}
                  <div />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setOrientatie(orientatie === "noord" ? undefined : "noord")}
                        className={cn(
                          "flex flex-col items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium transition-all hover:bg-accent",
                          "min-w-[56px] min-h-[44px]",
                          orientatie === "noord"
                            ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                            : "border-border text-muted-foreground"
                        )}
                      >
                        <span className="text-[10px] opacity-60">N</span>
                        <Compass className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{ORIENTATIE_TOOLTIPS.noord}</TooltipContent>
                  </Tooltip>
                  <div />

                  {/* Row 2: West - center label - Oost */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setOrientatie(orientatie === "west" ? undefined : "west")}
                        className={cn(
                          "flex flex-col items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium transition-all hover:bg-accent",
                          "min-w-[56px] min-h-[44px]",
                          orientatie === "west"
                            ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                            : "border-border text-muted-foreground"
                        )}
                      >
                        <span className="text-[10px] opacity-60">W</span>
                        <Compass className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{ORIENTATIE_TOOLTIPS.west}</TooltipContent>
                  </Tooltip>

                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setOrientatie(orientatie === "nvt" ? undefined : "nvt")}
                      className={cn(
                        "flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium transition-all hover:bg-accent",
                        "min-w-[56px] min-h-[44px]",
                        orientatie === "nvt"
                          ? "border-muted-foreground bg-muted text-muted-foreground ring-1 ring-muted-foreground"
                          : "border-dashed border-border text-muted-foreground/60"
                      )}
                    >
                      nvt
                    </button>
                  </div>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setOrientatie(orientatie === "oost" ? undefined : "oost")}
                        className={cn(
                          "flex flex-col items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium transition-all hover:bg-accent",
                          "min-w-[56px] min-h-[44px]",
                          orientatie === "oost"
                            ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                            : "border-border text-muted-foreground"
                        )}
                      >
                        <span className="text-[10px] opacity-60">O</span>
                        <Compass className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{ORIENTATIE_TOOLTIPS.oost}</TooltipContent>
                  </Tooltip>

                  {/* Row 3: empty - Zuid - empty */}
                  <div />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setOrientatie(orientatie === "zuid" ? undefined : "zuid")}
                        className={cn(
                          "flex flex-col items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium transition-all hover:bg-accent",
                          "min-w-[56px] min-h-[44px]",
                          orientatie === "zuid"
                            ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                            : "border-border text-muted-foreground"
                        )}
                      >
                        <span className="text-[10px] opacity-60">Z</span>
                        <Compass className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{ORIENTATIE_TOOLTIPS.zuid}</TooltipContent>
                  </Tooltip>
                  <div />
                </div>
              </div>
              {orientatie && orientatie !== "nvt" && (
                <p className="text-center text-xs text-muted-foreground">
                  {ORIENTATIE_TOOLTIPS[orientatie]}
                </p>
              )}
            </div>

            {/* --- D) Plant-suggesties panel --- */}
            {plantSuggestie && (
              <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
                <CardContent className="flex items-start gap-3 p-3">
                  <div className="mt-0.5 rounded-full bg-green-100 p-1.5 dark:bg-green-900/40">
                    <Leaf className="h-4 w-4 text-green-700 dark:text-green-400" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-green-900 dark:text-green-100">
                        {plantSuggestie.label}
                      </span>
                      <Badge variant="outline" className="border-green-300 text-green-700 text-[10px] dark:border-green-700 dark:text-green-400">
                        Aanbevolen
                      </Badge>
                    </div>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      {plantSuggestie.beschrijving}
                    </p>
                    <p className="text-xs font-medium text-green-800 dark:text-green-200">
                      {plantSuggestie.planten}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* --- B) Bodemverbetering sectie --- */}
            <FormField
              control={form.control}
              name="bodemverbetering"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0">
                    <FormLabel className="text-sm">Bodemverbetering nodig?</FormLabel>
                    <FormDescription className="text-xs">
                      Compost/turfmolm toevoegen voor betere groei
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {watchedValues.bodemverbetering && (
              <div className="space-y-4 rounded-lg border border-dashed p-3">
                <RadioGroup
                  value={bodemVerbeteringType}
                  onValueChange={(val) => setBodemVerbeteringType(val as "bestaand" | "nieuw")}
                  className="grid gap-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="bestaand" id="bodem-bestaand" />
                    <Label htmlFor="bodem-bestaand" className="text-sm cursor-pointer">
                      Bestaande grond verbeteren
                      <span className="ml-2 text-xs text-muted-foreground">(eenvoudig)</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="nieuw" id="bodem-nieuw" />
                    <Label htmlFor="bodem-nieuw" className="text-sm cursor-pointer">
                      Volledig nieuwe grondmix
                      <span className="ml-2 text-xs text-muted-foreground">(uitgebreid)</span>
                    </Label>
                  </div>
                </RadioGroup>

                {/* Grondmix configurator */}
                {bodemVerbeteringType === "nieuw" && (
                  <div className="space-y-4 rounded-lg bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Grondmix verdeling</span>
                      <Badge
                        variant={bodemMixValid ? "secondary" : "destructive"}
                        className="text-[10px]"
                      >
                        Totaal: {bodemMixTotal}%
                      </Badge>
                    </div>

                    {/* Visual distribution bar */}
                    <div className="flex h-4 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-amber-400 transition-all duration-200"
                        style={{ width: `${bodemMix.zandPercentage}%` }}
                        title={`Zand: ${bodemMix.zandPercentage}%`}
                      />
                      <div
                        className="bg-emerald-600 transition-all duration-200"
                        style={{ width: `${bodemMix.compostPercentage}%` }}
                        title={`Compost: ${bodemMix.compostPercentage}%`}
                      />
                      <div
                        className="bg-orange-800 transition-all duration-200"
                        style={{ width: `${bodemMix.teelaardPercentage}%` }}
                        title={`Teelaard: ${bodemMix.teelaardPercentage}%`}
                      />
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                        Zand
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" />
                        Compost
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-orange-800" />
                        Teelaard
                      </span>
                    </div>

                    {/* Sliders */}
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Zand</Label>
                          <span className="text-xs font-medium tabular-nums">{bodemMix.zandPercentage}%</span>
                        </div>
                        <Slider
                          value={[bodemMix.zandPercentage]}
                          onValueChange={([val]) => handleBodemMixChange("zandPercentage", val)}
                          min={0}
                          max={100}
                          step={5}
                          className="[&_[data-slot=slider-range]]:bg-amber-400"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Compost</Label>
                          <span className="text-xs font-medium tabular-nums">{bodemMix.compostPercentage}%</span>
                        </div>
                        <Slider
                          value={[bodemMix.compostPercentage]}
                          onValueChange={([val]) => handleBodemMixChange("compostPercentage", val)}
                          min={0}
                          max={100}
                          step={5}
                          className="[&_[data-slot=slider-range]]:bg-emerald-600"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Teelaard</Label>
                          <span className="text-xs font-medium tabular-nums">{bodemMix.teelaardPercentage}%</span>
                        </div>
                        <Slider
                          value={[bodemMix.teelaardPercentage]}
                          onValueChange={([val]) => handleBodemMixChange("teelaardPercentage", val)}
                          min={0}
                          max={100}
                          step={5}
                          className="[&_[data-slot=slider-range]]:bg-orange-800"
                        />
                      </div>
                    </div>

                    {!bodemMixValid && (
                      <p className="text-xs text-destructive">
                        De verdeling moet optellen tot 100% (huidig: {bodemMixTotal}%)
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* --- C) Bemestingsschema toggle --- */}
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Bemestingsschema toevoegen?</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        150 dagen basisbemesting inbegrepen bij aanleg
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    150 dagen basisbemesting inbegrepen
                  </p>
                </div>
                <Switch
                  checked={bemestingsschema}
                  onCheckedChange={setBemestingsschema}
                />
              </div>

              {bemestingsschema && (
                <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
                  <CardContent className="flex items-start gap-3 p-3">
                    <div className="mt-0.5 rounded-full bg-blue-100 p-1.5 dark:bg-blue-900/40">
                      <Sprout className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Verlengd bemestingsschema
                      </span>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        Na de basisbemesting van 150 dagen adviseren wij een verlengd bemestingsschema
                        voor optimaal resultaat. Dit wordt meegenomen in het onderhoudsvoorstel.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Indicatie bar (existing) */}
            {watchedValues.oppervlakte > 0 && (
              <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                <span className="font-medium">Indicatie:</span> ~{plantCount} planten
                {watchedValues.afwerking !== "geen" && `, ${watchedValues.afwerking === "schors" ? "schors" : "grind"}: ${(watchedValues.oppervlakte * 0.05).toFixed(1)} m3`}
                {watchedValues.bodemverbetering && `, bodemverbeteraar: ${(watchedValues.oppervlakte * 0.03).toFixed(1)} m3`}
                {watchedValues.bodemverbetering && bodemVerbeteringType === "nieuw" && bodemMixValid && (
                  <span>
                    {" "}(mix: {bodemMix.zandPercentage}% zand, {bodemMix.compostPercentage}% compost, {bodemMix.teelaardPercentage}% teelaard)
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
