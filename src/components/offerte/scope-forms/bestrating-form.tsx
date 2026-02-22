"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { AreaInput, QuantityInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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
import { Layers, AlertTriangle, Info, Plus, Trash2, Car, Footprints, Warehouse } from "lucide-react";
import { PriceEstimateBadge } from "@/components/ui/price-estimate-badge";
import { bestratingSchema, type BestratingFormData } from "@/lib/validations/aanleg-scopes";
import type { BestratingData, Bestratingtype, FunderingslagenData, BestratingZone } from "@/types/offerte";

// ─── Funderingsspecificaties per bestratingtype ──────────────────────────────

interface FunderingsSpec {
  gebrokenPuin: number;
  zand: number;
  brekerszand?: number;
  stabiliser?: boolean;
  beschrijving: string;
}

const FUNDERINGS_SPECS: Record<Bestratingtype, FunderingsSpec> = {
  pad: {
    gebrokenPuin: 10,
    zand: 5,
    beschrijving: "Lichte fundering geschikt voor voetgangers",
  },
  oprit: {
    gebrokenPuin: 20,
    zand: 0,
    brekerszand: 5,
    beschrijving: "Stevige fundering voor autoverkeer",
  },
  terrein: {
    gebrokenPuin: 35,
    zand: 0,
    brekerszand: 5,
    stabiliser: true,
    beschrijving: "Zware fundering voor vrachtwagens en machines",
  },
};

const BESTRATINGTYPE_OPTIONS: Array<{
  value: Bestratingtype;
  label: string;
  beschrijving: string;
  icon: React.ReactNode;
}> = [
  {
    value: "pad",
    label: "Pad",
    beschrijving: "Tuinpad, wandelpad of stoep",
    icon: <Footprints className="h-5 w-5" />,
  },
  {
    value: "oprit",
    label: "Oprit",
    beschrijving: "Oprit of parkeerplaats voor auto's",
    icon: <Car className="h-5 w-5" />,
  },
  {
    value: "terrein",
    label: "Terrein / Loods",
    beschrijving: "Bedrijfsterrein, loods of zwaar belast",
    icon: <Warehouse className="h-5 w-5" />,
  },
];

const LAAG_TOOLTIPS: Record<string, string> = {
  gebrokenPuin:
    "Gebroken puin vormt de draagkrachtige basis van de fundering. Hoe zwaarder de belasting, hoe dikker deze laag moet zijn.",
  zand:
    "Straatzand is makkelijker te verwerken en voldoende voor lichte belasting zoals voetgangers.",
  brekerszand:
    "Brekerszand is moeilijker te verwerken maar veel belastbaarder dan straatzand. Noodzakelijk bij autoverkeer.",
  stabiliser:
    "Stabiliser (cement) wordt door het brekerszand gemengd voor maximale draagkracht. Noodzakelijk bij zware belasting.",
};

const LAAG_KLEUREN: Record<string, { bg: string; border: string; text: string }> = {
  gebrokenPuin: {
    bg: "bg-stone-300 dark:bg-stone-600",
    border: "border-stone-400 dark:border-stone-500",
    text: "text-stone-800 dark:text-stone-100",
  },
  zand: {
    bg: "bg-yellow-200 dark:bg-yellow-700",
    border: "border-yellow-300 dark:border-yellow-600",
    text: "text-yellow-900 dark:text-yellow-100",
  },
  brekerszand: {
    bg: "bg-amber-300 dark:bg-amber-700",
    border: "border-amber-400 dark:border-amber-600",
    text: "text-amber-900 dark:text-amber-100",
  },
  stabiliser: {
    bg: "bg-gray-400 dark:bg-gray-600",
    border: "border-gray-500 dark:border-gray-500",
    text: "text-gray-900 dark:text-gray-100",
  },
};

// ─── Funderingsvisualisatie component ────────────────────────────────────────

function FunderingsVisualisatie({ spec }: { spec: FunderingsSpec }) {
  const lagen: Array<{ key: string; label: string; dikte: number | string }> = [];

  if (spec.stabiliser) {
    lagen.push({ key: "stabiliser", label: "Stabiliser (cement)", dikte: "gemengd" });
  }
  if (spec.brekerszand && spec.brekerszand > 0) {
    lagen.push({ key: "brekerszand", label: "Brekerszand", dikte: spec.brekerszand });
  }
  if (spec.zand > 0) {
    lagen.push({ key: "zand", label: "Straatzand", dikte: spec.zand });
  }
  lagen.push({ key: "gebrokenPuin", label: "Gebroken puin", dikte: spec.gebrokenPuin });

  // Calculate total height for proportional display
  const totalCm = lagen.reduce((sum, l) => {
    if (typeof l.dikte === "number") return sum + l.dikte;
    return sum + 3; // stabiliser gets a thin bar
  }, 0);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Layers className="h-3.5 w-3.5" />
        Funderingsopbouw
      </div>
      <div className="rounded-lg border bg-muted/30 p-3">
        {/* Top: bestrating */}
        <div className="mb-1 flex items-center justify-between rounded-t-md border border-slate-400 bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200">
          <span>Bestrating</span>
        </div>

        {/* Foundation layers */}
        <div className="flex flex-col">
          {lagen.map((laag, index) => {
            const kleur = LAAG_KLEUREN[laag.key];
            const tooltip = LAAG_TOOLTIPS[laag.key];
            const isLast = index === lagen.length - 1;
            const minH =
              typeof laag.dikte === "number"
                ? Math.max(28, (laag.dikte / totalCm) * 120)
                : 24;

            return (
              <div
                key={laag.key}
                className={`flex items-center justify-between border-x border-b px-3 ${kleur.bg} ${kleur.border} ${kleur.text} ${isLast ? "rounded-b-md" : ""}`}
                style={{ minHeight: `${minH}px` }}
              >
                <span className="text-xs font-medium">{laag.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">
                    {typeof laag.dikte === "number" ? `${laag.dikte} cm` : laag.dikte}
                  </span>
                  {tooltip && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10">
                          <Info className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[220px]">
                        {tooltip}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Grond */}
        <div className="mt-1 flex items-center justify-center rounded-b-md border border-dashed border-amber-700/40 bg-amber-900/10 px-3 py-1 text-xs text-amber-800 dark:border-amber-400/30 dark:bg-amber-900/20 dark:text-amber-300">
          Ondergrond
        </div>
      </div>
      <p className="text-xs text-muted-foreground italic">{spec.beschrijving}</p>
    </div>
  );
}

// ─── Zone kaart component ────────────────────────────────────────────────────

interface ZoneKaartProps {
  zone: BestratingZone;
  index: number;
  onUpdate: (zone: BestratingZone) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function ZoneKaart({ zone, index, onUpdate, onRemove, canRemove }: ZoneKaartProps) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Zone {index + 1}</span>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Zone type selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Type</label>
        <div className="grid grid-cols-3 gap-1.5">
          {BESTRATINGTYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onUpdate({ ...zone, type: opt.value })}
              className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                zone.type === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-muted bg-muted/30 text-muted-foreground hover:bg-muted/60"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Zone oppervlakte */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Oppervlakte (m&#178;)
        </label>
        <AreaInput
          id={`zone-${zone.id}-oppervlakte`}
          min={0}
          value={zone.oppervlakte}
          onChange={(val) => onUpdate({ ...zone, oppervlakte: val })}
          showStepper={false}
        />
      </div>

      {/* Zone materiaal */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Materiaal</label>
        <Select
          value={zone.materiaal || ""}
          onValueChange={(val) => onUpdate({ ...zone, materiaal: val })}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Selecteer materiaal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tegel">Tegels</SelectItem>
            <SelectItem value="klinker">Klinkers</SelectItem>
            <SelectItem value="natuursteen">Natuursteen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mini fundering info */}
      {zone.type && (
        <div className="rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
          Fundering: {FUNDERINGS_SPECS[zone.type].gebrokenPuin} cm puin
          {FUNDERINGS_SPECS[zone.type].brekerszand
            ? ` + ${FUNDERINGS_SPECS[zone.type].brekerszand} cm brekerszand`
            : ""}
          {FUNDERINGS_SPECS[zone.type].zand > 0
            ? ` + ${FUNDERINGS_SPECS[zone.type].zand} cm straatzand`
            : ""}
          {FUNDERINGS_SPECS[zone.type].stabiliser ? " + stabiliser" : ""}
        </div>
      )}
    </div>
  );
}

// ─── Hoofdcomponent ──────────────────────────────────────────────────────────

interface BestratingFormProps {
  data: BestratingData;
  onChange: (data: BestratingData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

export function BestratingForm({ data, onChange, onValidationChange }: BestratingFormProps) {
  const form = useForm<BestratingFormData>({
    resolver: zodResolver(bestratingSchema),
    defaultValues: data,
    mode: "onChange",
  });

  const { formState: { errors, isValid }, watch } = form;

  // Local state for new fields (managed outside react-hook-form for backwards compatibility)
  const [bestratingtype, setBestratingtype] = useState<Bestratingtype | undefined>(
    data.bestratingtype
  );
  const [zones, setZones] = useState<BestratingZone[]>(
    data.zones ?? []
  );

  // Compute funderingslagen based on bestratingtype
  const funderingslagen: FunderingslagenData | undefined = bestratingtype
    ? {
        gebrokenPuin: FUNDERINGS_SPECS[bestratingtype].gebrokenPuin,
        zand: FUNDERINGS_SPECS[bestratingtype].zand,
        brekerszand: FUNDERINGS_SPECS[bestratingtype].brekerszand,
        stabiliser: FUNDERINGS_SPECS[bestratingtype].stabiliser,
      }
    : undefined;

  // Stable onChange callback
  const stableOnChange = useCallback(
    (partial: Partial<BestratingData>) => {
      onChange({
        oppervlakte: partial.oppervlakte ?? data.oppervlakte,
        typeBestrating: partial.typeBestrating ?? data.typeBestrating,
        snijwerk: partial.snijwerk ?? data.snijwerk,
        onderbouw: partial.onderbouw ?? data.onderbouw,
        bestratingtype: partial.bestratingtype ?? bestratingtype,
        funderingslagen: partial.funderingslagen ?? funderingslagen,
        zones: partial.zones ?? (zones.length > 0 ? zones : undefined),
      });
    },
    [onChange, data, bestratingtype, funderingslagen, zones]
  );

  // Watch for changes from react-hook-form and sync with parent
  useEffect(() => {
    const subscription = watch((values) => {
      if (values.oppervlakte !== undefined && values.typeBestrating !== undefined) {
        stableOnChange({
          oppervlakte: values.oppervlakte ?? 0,
          typeBestrating: values.typeBestrating ?? "tegel",
          snijwerk: values.snijwerk ?? "laag",
          onderbouw: {
            type: values.onderbouw?.type ?? "zandbed",
            dikteOnderlaag: values.onderbouw?.dikteOnderlaag ?? 5,
            opsluitbanden: values.onderbouw?.opsluitbanden ?? false,
          },
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, stableOnChange]);

  // Notify parent of validation state changes
  useEffect(() => {
    if (onValidationChange) {
      const errorMessages: Record<string, string> = {};
      const flattenErrors = (obj: typeof errors, prefix = "") => {
        Object.entries(obj).forEach(([key, error]) => {
          const path = prefix ? `${prefix}.${key}` : key;
          if (error && typeof error === "object" && "message" in error) {
            if (error.message) errorMessages[path] = error.message as string;
          } else if (error && typeof error === "object") {
            flattenErrors(error as typeof errors, path);
          }
        });
      };
      flattenErrors(errors);
      onValidationChange(isValid, errorMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(errors), isValid]);

  // Handlers for bestratingtype
  const handleBestratingtypeChange = (value: Bestratingtype) => {
    setBestratingtype(value);
    const newFundering = {
      gebrokenPuin: FUNDERINGS_SPECS[value].gebrokenPuin,
      zand: FUNDERINGS_SPECS[value].zand,
      brekerszand: FUNDERINGS_SPECS[value].brekerszand,
      stabiliser: FUNDERINGS_SPECS[value].stabiliser,
    };
    stableOnChange({
      bestratingtype: value,
      funderingslagen: newFundering,
    });
  };

  // Handlers for zones
  const handleAddZone = () => {
    const newZone: BestratingZone = {
      id: crypto.randomUUID(),
      type: bestratingtype ?? "pad",
      oppervlakte: 0,
      materiaal: undefined,
    };
    const newZones = [...zones, newZone];
    setZones(newZones);
    stableOnChange({ zones: newZones });
  };

  const handleUpdateZone = (index: number, updatedZone: BestratingZone) => {
    const newZones = zones.map((z, i) => (i === index ? updatedZone : z));
    setZones(newZones);
    stableOnChange({ zones: newZones });
  };

  const handleRemoveZone = (index: number) => {
    const newZones = zones.filter((_, i) => i !== index);
    setZones(newZones);
    stableOnChange({ zones: newZones.length > 0 ? newZones : undefined });
  };

  const watchedValues = watch();
  const estimatedZandVolume = watchedValues.oppervlakte > 0 && watchedValues.onderbouw?.dikteOnderlaag > 0
    ? watchedValues.oppervlakte * (watchedValues.onderbouw.dikteOnderlaag / 100)
    : null;

  // Totale zone-oppervlakte
  const totalZoneOppervlakte = zones.reduce((sum, z) => sum + (z.oppervlakte || 0), 0);

  return (
    <Form {...form}>
      <form className="space-y-3">
        {/* ─── Sectie 1: Bestratingtype selector ─── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Type bestrating</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex rounded-full p-0.5 text-muted-foreground hover:text-foreground">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[260px]">
                  Het bestratingtype bepaalt automatisch de benodigde funderingsopbouw en bijbehorende kosten.
                </TooltipContent>
              </Tooltip>
            </div>
            <CardDescription className="text-xs">
              Kies het type om automatisch de juiste fundering te berekenen
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <RadioGroup
              value={bestratingtype ?? ""}
              onValueChange={(val) => handleBestratingtypeChange(val as Bestratingtype)}
              className="grid gap-2 sm:grid-cols-3"
            >
              {BESTRATINGTYPE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  htmlFor={`bestratingtype-${opt.value}`}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
                    bestratingtype === opt.value
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-muted"
                  }`}
                >
                  <RadioGroupItem
                    value={opt.value}
                    id={`bestratingtype-${opt.value}`}
                    className="mt-0.5"
                  />
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">{opt.icon}</span>
                      <span className="text-sm font-medium">{opt.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{opt.beschrijving}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* ─── Sectie 2: Funderingsvisualisatie (als type gekozen) ─── */}
        {bestratingtype && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <CardTitle className="text-base">Berekende fundering</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Automatisch bepaald op basis van type &quot;{BESTRATINGTYPE_OPTIONS.find(o => o.value === bestratingtype)?.label}&quot;
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <FunderingsVisualisatie spec={FUNDERINGS_SPECS[bestratingtype]} />
            </CardContent>
          </Card>
        )}

        {/* ─── Sectie 3: Bestaande bestrating velden ─── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Bestrating</CardTitle>
              </div>
              <PriceEstimateBadge
                scope="bestrating"
                oppervlakte={watchedValues.oppervlakte}
              />
            </div>
            <CardDescription className="text-xs">
              Tegels, klinkers of natuursteen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="grid gap-3 md:grid-cols-3">
              <FormField
                control={form.control}
                name="oppervlakte"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Oppervlakte</FormLabel>
                    <FormControl>
                      <AreaInput
                        id="bestrating-oppervlakte"
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
                name="typeBestrating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Type bestrating</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="bestrating-type">
                          <SelectValue placeholder="Selecteer type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="tegel">Tegels</SelectItem>
                        <SelectItem value="klinker">Klinkers</SelectItem>
                        <SelectItem value="natuursteen">Natuursteen</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="snijwerk"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Snijwerk</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="bestrating-snijwerk">
                          <SelectValue placeholder="Selecteer niveau" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="laag">Laag (weinig hoeken)</SelectItem>
                        <SelectItem value="gemiddeld">Gemiddeld</SelectItem>
                        <SelectItem value="hoog">Hoog (veel rondingen/hoeken)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Meer snijwerk = hogere arbeidsfactor
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* ─── Sectie 4: Verplichte onderbouw (bestaand) ─── */}
        <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <CardTitle className="text-base text-orange-900 dark:text-orange-100">Onderbouw (Verplicht)</CardTitle>
            </div>
            <CardDescription className="text-xs text-orange-700 dark:text-orange-300">
              Wordt automatisch meegenomen in de offerte
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="onderbouw.type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Onderbouw type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="onderbouw-type">
                          <SelectValue placeholder="Selecteer type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="zandbed">Zandbed</SelectItem>
                        <SelectItem value="zand_fundering">Zand + fundering</SelectItem>
                        <SelectItem value="zware_fundering">Zware fundering</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="onderbouw.dikteOnderlaag"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Dikte onderlaag (cm)</FormLabel>
                    <FormControl>
                      <QuantityInput
                        id="onderbouw-dikte"
                        min={1}
                        max={50}
                        value={field.value || 0}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        showStepper={false}
                        error={!!errors.onderbouw?.dikteOnderlaag}
                      />
                    </FormControl>
                    <FormDescription>
                      Standaard: 5cm zand
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="onderbouw.opsluitbanden"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border border-orange-200 bg-muted/50 p-3 dark:border-orange-800 dark:bg-orange-950/30">
                  <div className="space-y-0">
                    <FormLabel className="text-sm">Opsluitbanden</FormLabel>
                    <FormDescription className="text-xs">
                      Randafwerking met beton
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

            {estimatedZandVolume !== null && (
              <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground dark:bg-orange-950/30">
                Geschat zandvolume: {estimatedZandVolume.toFixed(2)} m&#179;
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Sectie 5: Multi-zone systeem ─── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Bestratingzones</CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex rounded-full p-0.5 text-muted-foreground hover:text-foreground">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[260px]">
                    Voeg meerdere zones toe als het terrein uit verschillende bestratingtypes bestaat, bijv. een pad naar de voordeur en een oprit.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddZone}
                className="h-8 gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Zone toevoegen
              </Button>
            </div>
            <CardDescription className="text-xs">
              Optioneel: definieer aparte zones met elk een eigen type en oppervlakte
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {zones.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Nog geen zones toegevoegd. Klik op &quot;Zone toevoegen&quot; om meerdere bestratinggebieden te defini&euml;ren.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {zones.map((zone, index) => (
                    <ZoneKaart
                      key={zone.id}
                      zone={zone}
                      index={index}
                      onUpdate={(updated) => handleUpdateZone(index, updated)}
                      onRemove={() => handleRemoveZone(index)}
                      canRemove={true}
                    />
                  ))}
                </div>

                {/* Zone samenvatting */}
                {totalZoneOppervlakte > 0 && (
                  <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                    <span className="font-medium">Totaal zones:</span> {zones.length} zone{zones.length !== 1 ? "s" : ""},{" "}
                    {totalZoneOppervlakte.toFixed(1)} m&#178; totaal
                    {watchedValues.oppervlakte > 0 && totalZoneOppervlakte !== watchedValues.oppervlakte && (
                      <span className="ml-1 text-amber-600 dark:text-amber-400">
                        (verschilt van hoofdoppervlakte: {watchedValues.oppervlakte} m&#178;)
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
