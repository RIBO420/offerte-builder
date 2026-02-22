"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info, Droplets } from "lucide-react";

// ---------------------------------------------------------------------------
// Inline Zod schema — tijdelijk, wordt later door een andere agent vervangen
// door een import uit @/lib/validations/onderhoud-scopes
// ---------------------------------------------------------------------------

// Gebruik z.output voor het formulier type zodat de boolean defaults correct
// worden opgelost (boolean ipv boolean | undefined).
const reinigingBaseSchema = z.object({
  // Terrasreiniging
  terrasreinigingAan: z.boolean(),
  terrasType: z
    .enum(["keramisch", "beton", "klinkers", "natuursteen", "hout"])
    .optional(),
  terrasOppervlakte: z.number().min(0).optional(),

  // Hogedrukspuit akkoord (verplicht als terrasreinigingAan)
  hogedrukAkkoord: z.boolean(),
  hogedrukDatumAkkoord: z.string().optional(),

  // Bladruimen
  bladruimenAan: z.boolean(),
  bladruimenOppervlakte: z.number().min(0).optional(),
  bladruimenFrequentie: z.enum(["eenmalig", "seizoen"]).optional(),
  bladafvoerAan: z.boolean(),

  // Onkruidbestrijding bestrating
  onkruidBestratingAan: z.boolean(),
  onkruidOppervlakte: z.number().min(0).optional(),
  onkruidMethode: z
    .enum(["handmatig", "branden", "heet_water", "chemisch"])
    .optional(),

  // Algereiniging / mosbestrijding
  algereinigingAan: z.boolean(),
  algereinigingOppervlakte: z.number().min(0).optional(),
  algereinigingType: z
    .enum(["dak", "bestrating", "hekwerk", "muur"])
    .optional(),
});

// Type voor react-hook-form — afgeleid van het basisschema
type ReinigingFormData = z.infer<typeof reinigingBaseSchema>;

// Volledig schema met cross-field validaties via superRefine
const reinigingSchema = reinigingBaseSchema.superRefine((data, ctx) => {
  if (data.terrasreinigingAan) {
    if (!data.terrasType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["terrasType"],
        message: "Selecteer een terras-type",
      });
    }
    if (!data.terrasOppervlakte || data.terrasOppervlakte <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["terrasOppervlakte"],
        message: "Voer een geldige oppervlakte in",
      });
    }
    if (!data.hogedrukAkkoord) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hogedrukAkkoord"],
        message: "Klant akkoord is verplicht bij terrasreiniging",
      });
    }
  }
  if (data.bladruimenAan) {
    if (!data.bladruimenOppervlakte || data.bladruimenOppervlakte <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bladruimenOppervlakte"],
        message: "Voer een geldige oppervlakte in",
      });
    }
    if (!data.bladruimenFrequentie) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bladruimenFrequentie"],
        message: "Selecteer een frequentie",
      });
    }
  }
  if (data.onkruidBestratingAan) {
    if (!data.onkruidOppervlakte || data.onkruidOppervlakte <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["onkruidOppervlakte"],
        message: "Voer een geldige oppervlakte in",
      });
    }
    if (!data.onkruidMethode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["onkruidMethode"],
        message: "Selecteer een methode",
      });
    }
  }
  if (data.algereinigingAan) {
    if (
      !data.algereinigingOppervlakte ||
      data.algereinigingOppervlakte <= 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["algereinigingOppervlakte"],
        message: "Voer een geldige oppervlakte in",
      });
    }
    if (!data.algereinigingType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["algereinigingType"],
        message: "Selecteer een type",
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Tooltip-tekst per terras-type
// ---------------------------------------------------------------------------

const TERRAS_TYPE_TOOLTIPS: Record<string, string> = {
  keramisch: "Voorzichtig, kan krasbaar zijn",
  hout: "Lagere druk, speciaal reinigingsmiddel",
  natuursteen: "Niet met hogedruk, zacht reinigen",
};

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

interface ReinigingFormProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

// ---------------------------------------------------------------------------
// Helper: vandaag als ISO-datumstring
// ---------------------------------------------------------------------------

function vandaagAlsISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Hoofd-component
// ---------------------------------------------------------------------------

export function ReinigingForm({
  data,
  onChange,
  onValidationChange,
}: ReinigingFormProps) {
  const form = useForm<ReinigingFormData>({
    resolver: zodResolver(reinigingSchema),
    defaultValues: {
      terrasreinigingAan:
        typeof data.terrasreinigingAan === "boolean"
          ? data.terrasreinigingAan
          : false,
      terrasType: (data.terrasType as ReinigingFormData["terrasType"]) ?? undefined,
      terrasOppervlakte:
        typeof data.terrasOppervlakte === "number"
          ? data.terrasOppervlakte
          : 0,

      hogedrukAkkoord:
        typeof data.hogedrukAkkoord === "boolean" ? data.hogedrukAkkoord : false,
      hogedrukDatumAkkoord:
        typeof data.hogedrukDatumAkkoord === "string"
          ? data.hogedrukDatumAkkoord
          : vandaagAlsISO(),

      bladruimenAan:
        typeof data.bladruimenAan === "boolean" ? data.bladruimenAan : false,
      bladruimenOppervlakte:
        typeof data.bladruimenOppervlakte === "number"
          ? data.bladruimenOppervlakte
          : 0,
      bladruimenFrequentie:
        (data.bladruimenFrequentie as ReinigingFormData["bladruimenFrequentie"]) ?? undefined,
      bladafvoerAan:
        typeof data.bladafvoerAan === "boolean" ? data.bladafvoerAan : false,

      onkruidBestratingAan:
        typeof data.onkruidBestratingAan === "boolean"
          ? data.onkruidBestratingAan
          : false,
      onkruidOppervlakte:
        typeof data.onkruidOppervlakte === "number"
          ? data.onkruidOppervlakte
          : 0,
      onkruidMethode:
        (data.onkruidMethode as ReinigingFormData["onkruidMethode"]) ?? undefined,

      algereinigingAan:
        typeof data.algereinigingAan === "boolean"
          ? data.algereinigingAan
          : false,
      algereinigingOppervlakte:
        typeof data.algereinigingOppervlakte === "number"
          ? data.algereinigingOppervlakte
          : 0,
      algereinigingType:
        (data.algereinigingType as ReinigingFormData["algereinigingType"]) ?? undefined,
    },
    mode: "onChange",
  });

  const {
    formState: { errors, isValid },
    watch,
  } = form;

  // Sync form values naar parent
  useEffect(() => {
    const subscription = watch((values) => {
      onChange({
        terrasreinigingAan: values.terrasreinigingAan ?? false,
        terrasType: values.terrasType ?? null,
        terrasOppervlakte: values.terrasOppervlakte ?? 0,
        hogedrukAkkoord: values.hogedrukAkkoord ?? false,
        hogedrukDatumAkkoord: values.hogedrukDatumAkkoord ?? vandaagAlsISO(),
        bladruimenAan: values.bladruimenAan ?? false,
        bladruimenOppervlakte: values.bladruimenOppervlakte ?? 0,
        bladruimenFrequentie: values.bladruimenFrequentie ?? null,
        bladafvoerAan: values.bladafvoerAan ?? false,
        onkruidBestratingAan: values.onkruidBestratingAan ?? false,
        onkruidOppervlakte: values.onkruidOppervlakte ?? 0,
        onkruidMethode: values.onkruidMethode ?? null,
        algereinigingAan: values.algereinigingAan ?? false,
        algereinigingOppervlakte: values.algereinigingOppervlakte ?? 0,
        algereinigingType: values.algereinigingType ?? null,
      });
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  // Validatiestatus doorgeven aan parent
  useEffect(() => {
    if (onValidationChange) {
      const errorMessages: Record<string, string> = {};
      Object.entries(errors).forEach(([key, error]) => {
        const fieldError = error as { message?: string } | undefined;
        if (fieldError?.message) {
          errorMessages[key] = fieldError.message;
        }
      });
      onValidationChange(isValid, errorMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(errors), isValid]);

  const watchedValues = watch();
  const terrasTypeTooltip = watchedValues.terrasType
    ? TERRAS_TYPE_TOOLTIPS[watchedValues.terrasType]
    : undefined;

  return (
    <Form {...form}>
      <form>
        <div className="space-y-4">
          {/* ----------------------------------------------------------------
              1. Terrasreiniging
          ---------------------------------------------------------------- */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Droplets className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Reinigingswerkzaamheden</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Terrasreiniging, bladruimen, onkruidbestrijding en algereiniging
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-0">

              {/* ---- Terrasreiniging sectie ---- */}
              <div className="space-y-3 rounded-lg border p-3">
                <FormField
                  control={form.control}
                  name="terrasreinigingAan"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Terrasreiniging</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Hogedruk reiniging van terras of bestrating
                        </p>
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

                {watchedValues.terrasreinigingAan && (
                  <div className="space-y-3 pl-1">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="terrasType"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center gap-1.5">
                              <FormLabel required>
                                Terras-type
                                <span className="text-xs text-orange-600 font-normal ml-2">
                                  (verplicht)
                                </span>
                              </FormLabel>
                              {terrasTypeTooltip && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    {terrasTypeTooltip}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <Select
                              value={field.value ?? ""}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger
                                  id="terras-type"
                                  className="border-orange-300"
                                >
                                  <SelectValue placeholder="Selecteer type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="keramisch">Keramisch</SelectItem>
                                <SelectItem value="beton">Beton</SelectItem>
                                <SelectItem value="klinkers">Klinkers</SelectItem>
                                <SelectItem value="natuursteen">Natuursteen</SelectItem>
                                <SelectItem value="hout">Hout</SelectItem>
                              </SelectContent>
                            </Select>
                            {watchedValues.terrasType &&
                              TERRAS_TYPE_TOOLTIPS[watchedValues.terrasType] && (
                                <FormDescription className="flex items-center gap-1 text-xs">
                                  <Info className="h-3 w-3 shrink-0" />
                                  {TERRAS_TYPE_TOOLTIPS[watchedValues.terrasType]}
                                </FormDescription>
                              )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="terrasOppervlakte"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel required>
                              Oppervlakte
                              <span className="text-xs text-orange-600 font-normal ml-2">
                                (verplicht)
                              </span>
                            </FormLabel>
                            <FormControl>
                              <AreaInput
                                id="terras-oppervlakte"
                                min={0}
                                value={field.value ?? 0}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                showStepper={false}
                                error={!!errors.terrasOppervlakte}
                                className="border-orange-300"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ---- Hogedrukspuit akkoord (verplicht als terrasreiniging aan) ---- */}
              {watchedValues.terrasreinigingAan && (
                <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50/50 p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />
                    <p className="text-sm font-medium text-orange-800">
                      Akkoord hogedrukspuit
                    </p>
                    <Badge variant="destructive" className="text-xs">
                      Verplicht
                    </Badge>
                  </div>
                  <p className="text-xs text-orange-700 leading-relaxed">
                    Bij gebruik van een hogedrukspuit kunnen er spatschade en/of
                    waterschade ontstaan. De klant gaat akkoord met het gebruik.
                  </p>

                  <FormField
                    control={form.control}
                    name="hogedrukAkkoord"
                    render={({ field }) => (
                      <FormItem className="flex items-start gap-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="mt-0.5"
                          />
                        </FormControl>
                        <div className="space-y-1">
                          <FormLabel className="text-sm font-normal leading-snug cursor-pointer">
                            Klant gaat akkoord met gebruik hogedrukspuit
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hogedrukDatumAkkoord"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">
                          Datum akkoord
                        </FormLabel>
                        <FormControl>
                          <input
                            type="date"
                            id="hogedruk-datum"
                            value={field.value ?? vandaagAlsISO()}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Handtekening placeholder */}
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      Digitale handtekening
                    </p>
                    <Textarea
                      disabled
                      rows={2}
                      placeholder="Handtekening wordt later geïmplementeerd"
                      className="resize-none text-xs text-muted-foreground cursor-not-allowed"
                    />
                  </div>
                </div>
              )}

              {/* ---- Bladruimen sectie ---- */}
              <div className="space-y-3 rounded-lg border p-3">
                <FormField
                  control={form.control}
                  name="bladruimenAan"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Bladruimen</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Seizoensgebonden bladverwijdering
                        </p>
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

                {watchedValues.bladruimenAan && (
                  <div className="space-y-3 pl-1">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="bladruimenOppervlakte"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel required>
                              Oppervlakte
                              <span className="text-xs text-orange-600 font-normal ml-2">
                                (verplicht)
                              </span>
                            </FormLabel>
                            <FormControl>
                              <AreaInput
                                id="bladruimen-oppervlakte"
                                min={0}
                                value={field.value ?? 0}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                showStepper={false}
                                error={!!errors.bladruimenOppervlakte}
                                className="border-orange-300"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="bladruimenFrequentie"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel required>
                              Frequentie
                              <span className="text-xs text-orange-600 font-normal ml-2">
                                (verplicht)
                              </span>
                            </FormLabel>
                            <Select
                              value={field.value ?? ""}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger
                                  id="bladruimen-frequentie"
                                  className="border-orange-300"
                                >
                                  <SelectValue placeholder="Selecteer frequentie" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="eenmalig">Eenmalig</SelectItem>
                                <SelectItem value="seizoen">
                                  Seizoen (okt–dec, meerdere beurten)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="bladafvoerAan"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                          <FormLabel className="text-sm font-normal">
                            Afvoer bladafval
                          </FormLabel>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>

              {/* ---- Onkruidbestrijding bestrating sectie ---- */}
              <div className="space-y-3 rounded-lg border p-3">
                <FormField
                  control={form.control}
                  name="onkruidBestratingAan"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">
                          Onkruidbestrijding bestrating
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Onkruid uit voegen en bestrating verwijderen
                        </p>
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

                {watchedValues.onkruidBestratingAan && (
                  <div className="space-y-3 pl-1">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="onkruidOppervlakte"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel required>
                              Oppervlakte
                              <span className="text-xs text-orange-600 font-normal ml-2">
                                (verplicht)
                              </span>
                            </FormLabel>
                            <FormControl>
                              <AreaInput
                                id="onkruid-oppervlakte"
                                min={0}
                                value={field.value ?? 0}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                showStepper={false}
                                error={!!errors.onkruidOppervlakte}
                                className="border-orange-300"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="onkruidMethode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel required>
                              Methode
                              <span className="text-xs text-orange-600 font-normal ml-2">
                                (verplicht)
                              </span>
                            </FormLabel>
                            <Select
                              value={field.value ?? ""}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger
                                  id="onkruid-methode"
                                  className="border-orange-300"
                                >
                                  <SelectValue placeholder="Selecteer methode" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="handmatig">Handmatig</SelectItem>
                                <SelectItem value="branden">Branden</SelectItem>
                                <SelectItem value="heet_water">Heet water</SelectItem>
                                <SelectItem value="chemisch">Chemisch</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {watchedValues.onkruidMethode === "chemisch" && (
                      <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3">
                        <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-red-700 leading-relaxed font-medium">
                          Let op: chemische onkruidbestrijding is aan wettelijke
                          regels gebonden
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ---- Algereiniging / mosbestrijding sectie ---- */}
              <div className="space-y-3 rounded-lg border p-3">
                <FormField
                  control={form.control}
                  name="algereinigingAan"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">
                          Algereiniging / mosbestrijding
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Verwijdering van algen en mos
                        </p>
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

                {watchedValues.algereinigingAan && (
                  <div className="space-y-3 pl-1">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="algereinigingOppervlakte"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel required>
                              Oppervlakte
                              <span className="text-xs text-orange-600 font-normal ml-2">
                                (verplicht)
                              </span>
                            </FormLabel>
                            <FormControl>
                              <AreaInput
                                id="algereiniging-oppervlakte"
                                min={0}
                                value={field.value ?? 0}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                showStepper={false}
                                error={!!errors.algereinigingOppervlakte}
                                className="border-orange-300"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="algereinigingType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel required>
                              Type oppervlak
                              <span className="text-xs text-orange-600 font-normal ml-2">
                                (verplicht)
                              </span>
                            </FormLabel>
                            <Select
                              value={field.value ?? ""}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger
                                  id="algereiniging-type"
                                  className="border-orange-300"
                                >
                                  <SelectValue placeholder="Selecteer type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="dak">Dak</SelectItem>
                                <SelectItem value="bestrating">Bestrating</SelectItem>
                                <SelectItem value="hekwerk">Hekwerk</SelectItem>
                                <SelectItem value="muur">Muur</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ---- Indicatie samenvatting ---- */}
              {(watchedValues.terrasreinigingAan ||
                watchedValues.bladruimenAan ||
                watchedValues.onkruidBestratingAan ||
                watchedValues.algereinigingAan) && (
                <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                  <span className="font-medium">Geselecteerd:</span>{" "}
                  {[
                    watchedValues.terrasreinigingAan &&
                      watchedValues.terrasOppervlakte &&
                      watchedValues.terrasOppervlakte > 0 &&
                      `terrasreiniging ${watchedValues.terrasOppervlakte} m²`,
                    watchedValues.bladruimenAan &&
                      watchedValues.bladruimenOppervlakte &&
                      watchedValues.bladruimenOppervlakte > 0 &&
                      `bladruimen ${watchedValues.bladruimenOppervlakte} m²${watchedValues.bladruimenFrequentie === "seizoen" ? " (seizoen)" : ""}`,
                    watchedValues.onkruidBestratingAan &&
                      watchedValues.onkruidOppervlakte &&
                      watchedValues.onkruidOppervlakte > 0 &&
                      `onkruid ${watchedValues.onkruidOppervlakte} m²`,
                    watchedValues.algereinigingAan &&
                      watchedValues.algereinigingOppervlakte &&
                      watchedValues.algereinigingOppervlakte > 0 &&
                      `algereiniging ${watchedValues.algereinigingOppervlakte} m²`,
                  ]
                    .filter(Boolean)
                    .join(", ") || "Vul oppervlaktes in voor een overzicht"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </form>
    </Form>
  );
}
