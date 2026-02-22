"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AreaInput, QuantityInput } from "@/components/ui/number-input";
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
import { Sprout, Star, TrendingUp } from "lucide-react";

// ─── Lokaal Zod schema ────────────────────────────────────────────────────────

const bemestingstypeSchema = z.object({
  gazon: z.boolean(),
  borders: z.boolean(),
  bomen: z.boolean(),
  universeel: z.boolean(),
});

const typeDetailSchema = z.object({
  oppervlakte: z
    .number({ error: "Voer een getal in" })
    .min(0, "Oppervlakte mag niet negatief zijn"),
  seizoen: z.enum(["voorjaar", "zomer", "najaar", "heel_jaar"], {
    error: "Selecteer een seizoen",
  }),
});

const bomenDetailSchema = z.object({
  aantalBomen: z
    .number({ error: "Voer een getal in" })
    .min(0, "Aantal mag niet negatief zijn"),
  seizoen: z.enum(["voorjaar", "zomer", "najaar", "heel_jaar"], {
    error: "Selecteer een seizoen",
  }),
});

export const bemestingSchema = z
  .object({
    types: bemestingstypeSchema,
    gazonDetail: typeDetailSchema,
    bordersDetail: typeDetailSchema,
    bomenDetail: bomenDetailSchema,
    universeelDetail: typeDetailSchema,
    product: z.enum(["basis", "premium", "bio"], {
      error: "Selecteer een product",
    }),
    frequentie: z.enum(["1x", "2x", "3x", "4x"], {
      error: "Selecteer een frequentie",
    }),
    kalkbehandeling: z.boolean(),
    grondanalyse: z.boolean(),
    onkruidvrijeBemesting: z.boolean(),
  })
  .refine(
    (data) => {
      const { gazon, borders, bomen, universeel } = data.types;
      return gazon || borders || bomen || universeel;
    },
    {
      message: "Selecteer minimaal één bemestingstype",
      path: ["types"],
    }
  )
  .refine(
    (data) => {
      if (data.types.gazon) {
        return data.gazonDetail.oppervlakte > 0;
      }
      return true;
    },
    {
      message: "Gazonoppervlakte moet groter dan 0 zijn",
      path: ["gazonDetail", "oppervlakte"],
    }
  )
  .refine(
    (data) => {
      if (data.types.borders) {
        return data.bordersDetail.oppervlakte > 0;
      }
      return true;
    },
    {
      message: "Borderoppervlakte moet groter dan 0 zijn",
      path: ["bordersDetail", "oppervlakte"],
    }
  )
  .refine(
    (data) => {
      if (data.types.bomen) {
        return data.bomenDetail.aantalBomen > 0;
      }
      return true;
    },
    {
      message: "Aantal bomen moet minimaal 1 zijn",
      path: ["bomenDetail", "aantalBomen"],
    }
  )
  .refine(
    (data) => {
      if (data.types.universeel) {
        return data.universeelDetail.oppervlakte > 0;
      }
      return true;
    },
    {
      message: "Tuinoppervlakte moet groter dan 0 zijn",
      path: ["universeelDetail", "oppervlakte"],
    }
  );

export type BemestingFormData = z.infer<typeof bemestingSchema>;

// ─── Standaardwaarden ─────────────────────────────────────────────────────────

export const bemestingDefaultValues: BemestingFormData = {
  types: {
    gazon: false,
    borders: false,
    bomen: false,
    universeel: false,
  },
  gazonDetail: { oppervlakte: 0, seizoen: "voorjaar" },
  bordersDetail: { oppervlakte: 0, seizoen: "voorjaar" },
  bomenDetail: { aantalBomen: 0, seizoen: "voorjaar" },
  universeelDetail: { oppervlakte: 0, seizoen: "voorjaar" },
  product: "basis",
  frequentie: "1x",
  kalkbehandeling: false,
  grondanalyse: false,
  onkruidvrijeBemesting: false,
};

// ─── Hulpfuncties ─────────────────────────────────────────────────────────────

const SEIZOEN_LABELS: Record<string, string> = {
  voorjaar: "Voorjaar",
  zomer: "Zomer",
  najaar: "Najaar",
  heel_jaar: "Heel jaar (4x)",
};

const FREQUENTIE_LABELS: Record<string, string> = {
  "1x": "1× per jaar",
  "2x": "2× per jaar",
  "3x": "3× per jaar",
  "4x": "4× per jaar",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface BemestingFormProps {
  data: BemestingFormData;
  onChange: (data: BemestingFormData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BemestingForm({ data, onChange, onValidationChange }: BemestingFormProps) {
  const form = useForm<BemestingFormData>({
    resolver: zodResolver(bemestingSchema),
    defaultValues: data,
    mode: "onChange",
  });

  const { formState: { errors, isValid }, watch } = form;

  // Sync wijzigingen naar parent
  useEffect(() => {
    const subscription = watch((values) => {
      onChange({
        types: {
          gazon: values.types?.gazon ?? false,
          borders: values.types?.borders ?? false,
          bomen: values.types?.bomen ?? false,
          universeel: values.types?.universeel ?? false,
        },
        gazonDetail: {
          oppervlakte: values.gazonDetail?.oppervlakte ?? 0,
          seizoen: values.gazonDetail?.seizoen ?? "voorjaar",
        },
        bordersDetail: {
          oppervlakte: values.bordersDetail?.oppervlakte ?? 0,
          seizoen: values.bordersDetail?.seizoen ?? "voorjaar",
        },
        bomenDetail: {
          aantalBomen: values.bomenDetail?.aantalBomen ?? 0,
          seizoen: values.bomenDetail?.seizoen ?? "voorjaar",
        },
        universeelDetail: {
          oppervlakte: values.universeelDetail?.oppervlakte ?? 0,
          seizoen: values.universeelDetail?.seizoen ?? "voorjaar",
        },
        product: values.product ?? "basis",
        frequentie: values.frequentie ?? "1x",
        kalkbehandeling: values.kalkbehandeling ?? false,
        grondanalyse: values.grondanalyse ?? false,
        onkruidvrijeBemesting: values.onkruidvrijeBemesting ?? false,
      });
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  // Validatiestatus naar parent sturen
  useEffect(() => {
    if (onValidationChange) {
      const errorMessages: Record<string, string> = {};
      const flattenErrors = (obj: Record<string, unknown>, prefix = "") => {
        Object.entries(obj).forEach(([key, val]) => {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          if (val && typeof val === "object" && "message" in val) {
            errorMessages[fullKey] = String((val as { message: string }).message);
          } else if (val && typeof val === "object") {
            flattenErrors(val as Record<string, unknown>, fullKey);
          }
        });
      };
      flattenErrors(errors as Record<string, unknown>);
      onValidationChange(isValid, errorMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(errors), isValid]);

  const watchedValues = watch();
  const { types, product, frequentie, grondanalyse } = watchedValues;

  const heeftMeerdereKeer = frequentie === "2x" || frequentie === "3x" || frequentie === "4x";
  const isPremium = product === "premium";

  // Marge-badge kleur — altijd ~70% voor bemesting
  const MARGE_PERCENTAGE = 70;
  const margeKleur =
    MARGE_PERCENTAGE > 50
      ? "bg-green-100 text-green-800 border-green-200"
      : MARGE_PERCENTAGE >= 30
        ? "bg-orange-100 text-orange-800 border-orange-200"
        : "bg-red-100 text-red-800 border-red-200";

  return (
    <Form {...form}>
      <form>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sprout className="h-4 w-4 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Bemesting</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Gazon, borders, bomen of combinatie-pakket bemesten
                  </CardDescription>
                </div>
              </div>
              {/* Marge-indicator — alleen voor hovenier zichtbaar */}
              <div
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${margeKleur}`}
                title="Interne marge-indicatie — niet zichtbaar voor klant"
                aria-label={`Marge indicatie: ${MARGE_PERCENTAGE}%`}
              >
                <TrendingUp className="h-3 w-3" />
                <span>Marge: ~{MARGE_PERCENTAGE}%</span>
              </div>
            </div>
            <p className="text-xs text-green-700 font-medium flex items-center gap-1 mt-1">
              <Star className="h-3 w-3" />
              Hoge marge product — actief aanbieden!
            </p>
          </CardHeader>

          <CardContent className="space-y-5 pt-0">

            {/* ── 1. Bemestingstypen ──────────────────────────────────────── */}
            <div className="space-y-2">
              <FormLabel className="text-sm font-medium">
                Bemestingstype
                <span className="ml-1 text-xs text-muted-foreground font-normal">(meerdere mogelijk)</span>
              </FormLabel>

              <div className="grid gap-2 sm:grid-cols-2">
                {/* Gazon */}
                <FormField
                  control={form.control}
                  name="types.gazon"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                      <div className="space-y-0">
                        <FormLabel className="text-sm font-normal">Gazonbemesting</FormLabel>
                        <p className="text-xs text-muted-foreground">Meest voorkomend</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Borders */}
                <FormField
                  control={form.control}
                  name="types.borders"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                      <div className="space-y-0">
                        <FormLabel className="text-sm font-normal">Borderbemesting</FormLabel>
                        <p className="text-xs text-muted-foreground">Borders en perken</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Bomen */}
                <FormField
                  control={form.control}
                  name="types.bomen"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                      <div className="space-y-0">
                        <FormLabel className="text-sm font-normal">Boombemesting</FormLabel>
                        <p className="text-xs text-muted-foreground">Diepwortel injectie</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Universeel */}
                <FormField
                  control={form.control}
                  name="types.universeel"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                      <div className="space-y-0">
                        <FormLabel className="text-sm font-normal">Combinatie-pakket</FormLabel>
                        <p className="text-xs text-muted-foreground">Universele bemesting hele tuin</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Validatiefout op types-niveau */}
              {errors.types?.root?.message && (
                <p className="text-xs text-destructive">{errors.types.root.message}</p>
              )}
            </div>

            {/* ── 2. Details per type ─────────────────────────────────────── */}

            {/* Gazon details */}
            {types?.gazon && (
              <div className="rounded-lg border border-green-200 bg-green-50/40 p-3 space-y-3">
                <p className="text-xs font-semibold text-green-800">Gazonbemesting — details</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="gazonDetail.oppervlakte"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required>Gazonoppervlakte</FormLabel>
                        <FormControl>
                          <AreaInput
                            id="bemesting-gazon-opp"
                            min={0}
                            value={field.value || 0}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            showStepper={false}
                            error={!!errors.gazonDetail?.oppervlakte}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gazonDetail.seizoen"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Seizoen</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger id="bemesting-gazon-seizoen">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(SEIZOEN_LABELS).map(([val, label]) => (
                              <SelectItem key={val} value={val}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* Borders details */}
            {types?.borders && (
              <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-3 space-y-3">
                <p className="text-xs font-semibold text-purple-800">Borderbemesting — details</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="bordersDetail.oppervlakte"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required>Borderoppervlakte</FormLabel>
                        <FormControl>
                          <AreaInput
                            id="bemesting-borders-opp"
                            min={0}
                            value={field.value || 0}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            showStepper={false}
                            error={!!errors.bordersDetail?.oppervlakte}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bordersDetail.seizoen"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Seizoen</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger id="bemesting-borders-seizoen">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(SEIZOEN_LABELS).map(([val, label]) => (
                              <SelectItem key={val} value={val}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* Bomen details */}
            {types?.bomen && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-3">
                <p className="text-xs font-semibold text-amber-800">Boombemesting — details</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="bomenDetail.aantalBomen"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required>Aantal bomen</FormLabel>
                        <FormControl>
                          <QuantityInput
                            id="bemesting-bomen-aantal"
                            min={0}
                            value={field.value || 0}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            showStepper={false}
                            error={!!errors.bomenDetail?.aantalBomen}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bomenDetail.seizoen"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Seizoen</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger id="bemesting-bomen-seizoen">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(SEIZOEN_LABELS).map(([val, label]) => (
                              <SelectItem key={val} value={val}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* Universeel details */}
            {types?.universeel && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-3">
                <p className="text-xs font-semibold text-blue-800">Combinatie-pakket — details</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="universeelDetail.oppervlakte"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required>Tuinoppervlakte</FormLabel>
                        <FormControl>
                          <AreaInput
                            id="bemesting-universeel-opp"
                            min={0}
                            value={field.value || 0}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            showStepper={false}
                            error={!!errors.universeelDetail?.oppervlakte}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="universeelDetail.seizoen"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Seizoen</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger id="bemesting-universeel-seizoen">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(SEIZOEN_LABELS).map(([val, label]) => (
                              <SelectItem key={val} value={val}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* ── 3. Productkeuze ─────────────────────────────────────────── */}
            <div className="space-y-2">
              <FormLabel className="text-sm font-medium">Product</FormLabel>

              <div className="grid gap-2 sm:grid-cols-3">
                {/* Basis */}
                <button
                  type="button"
                  onClick={() => form.setValue("product", "basis", { shouldValidate: true })}
                  className={`relative flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors ${
                    product === "basis"
                      ? "border-green-400 bg-green-50 ring-1 ring-green-400"
                      : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Basis</span>
                    <Badge className="bg-green-100 text-green-800 border-green-200 border text-xs px-1.5 py-0">
                      Standaard
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Standaard bemesting</p>
                </button>

                {/* Premium — AANBEVOLEN */}
                <button
                  type="button"
                  onClick={() => form.setValue("product", "premium", { shouldValidate: true })}
                  className={`relative flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors ${
                    product === "premium"
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                      : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Premium</span>
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200 border text-xs px-1.5 py-0">
                      Aanbevolen
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Langwerkend, 150 dagen</p>
                </button>

                {/* Bio */}
                <button
                  type="button"
                  onClick={() => form.setValue("product", "bio", { shouldValidate: true })}
                  className={`relative flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors ${
                    product === "bio"
                      ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                      : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Bio</span>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 border text-xs px-1.5 py-0">
                      Eco
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Biologische bemesting</p>
                </button>
              </div>

              {/* Premium upsell card */}
              {isPremium && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-600 text-white text-xs">Meest gekozen</Badge>
                    <span className="text-xs font-semibold text-blue-900">Premium bemesting</span>
                  </div>
                  <p className="text-xs text-blue-800">
                    Premium bemesting werkt 150 dagen — de hele zomer geen omkijken naar!
                  </p>
                  <p className="text-xs text-blue-700 font-medium">
                    Slechts een kleine meerprijs per m² voor maximaal resultaat.
                  </p>
                </div>
              )}

              <FormMessage>{errors.product?.message}</FormMessage>
            </div>

            {/* ── 4. Frequentie ───────────────────────────────────────────── */}
            <FormField
              control={form.control}
              name="frequentie"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequentie</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger id="bemesting-frequentie">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(FREQUENTIE_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs">
                    {heeftMeerdereKeer
                      ? "Bij meerdere beurten: 10% korting op arbeid"
                      : "Hoe vaker bemest, hoe gezonder de tuin"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Kortingsmelding bij 2x+ */}
            {heeftMeerdereKeer && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 font-medium flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                Bij meerdere beurten: 10% korting op arbeid
              </div>
            )}

            {/* ── 5. Aanvullende opties ───────────────────────────────────── */}
            <div className="space-y-2">
              <FormLabel className="text-sm font-medium">Aanvullende opties</FormLabel>

              <div className="space-y-2">
                {/* Kalkbehandeling */}
                <FormField
                  control={form.control}
                  name="kalkbehandeling"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                      <div className="space-y-0">
                        <FormLabel className="text-sm font-normal">Kalkbehandeling</FormLabel>
                        <p className="text-xs text-muted-foreground">Bij zure grond — verhoogt pH waarde</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Grondanalyse */}
                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="grondanalyse"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                        <div className="space-y-0">
                          <FormLabel className="text-sm font-normal">Grondanalyse</FormLabel>
                          <p className="text-xs text-muted-foreground">Lab-analyse van bodemmonster</p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Grondanalyse upsell */}
                  {grondanalyse && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
                      <p className="text-xs font-semibold text-amber-900">
                        Grondanalyse voor slechts €49
                      </p>
                      <p className="text-xs text-amber-800">
                        Weet exact wat uw tuin nodig heeft — gerichte bemesting zonder verspilling.
                      </p>
                    </div>
                  )}
                </div>

                {/* Onkruidvrije bemesting */}
                <FormField
                  control={form.control}
                  name="onkruidvrijeBemesting"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                      <div className="space-y-0">
                        <FormLabel className="text-sm font-normal">Onkruidvrije bemesting</FormLabel>
                        <p className="text-xs text-muted-foreground">Extra coating tegen onkruidkieming</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* ── Indicatie ───────────────────────────────────────────────── */}
            {(types?.gazon || types?.borders || types?.bomen || types?.universeel) && (
              <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                <span className="font-medium">Indicatie: </span>
                {[
                  types?.gazon && watchedValues.gazonDetail.oppervlakte > 0 &&
                    `gazon: ${watchedValues.gazonDetail.oppervlakte} m² (${SEIZOEN_LABELS[watchedValues.gazonDetail.seizoen]})`,
                  types?.borders && watchedValues.bordersDetail.oppervlakte > 0 &&
                    `borders: ${watchedValues.bordersDetail.oppervlakte} m² (${SEIZOEN_LABELS[watchedValues.bordersDetail.seizoen]})`,
                  types?.bomen && watchedValues.bomenDetail.aantalBomen > 0 &&
                    `${watchedValues.bomenDetail.aantalBomen} boom${watchedValues.bomenDetail.aantalBomen !== 1 ? "en" : ""} (${SEIZOEN_LABELS[watchedValues.bomenDetail.seizoen]})`,
                  types?.universeel && watchedValues.universeelDetail.oppervlakte > 0 &&
                    `universeel: ${watchedValues.universeelDetail.oppervlakte} m² (${SEIZOEN_LABELS[watchedValues.universeelDetail.seizoen]})`,
                ]
                  .filter(Boolean)
                  .join(", ") || "vul oppervlakte in"}
                {" — "}
                <span className="font-medium">
                  {product === "premium" ? "Premium 150 dagen" : product === "bio" ? "Biologisch" : "Standaard"}
                </span>
                {", "}
                {FREQUENTIE_LABELS[frequentie]}
                {heeftMeerdereKeer && " (10% arbeidskorting)"}
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
