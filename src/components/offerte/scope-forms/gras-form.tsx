"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { AreaInput, NumberInput } from "@/components/ui/number-input";
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
import { Trees, Droplets, Fence, Sparkles, ImageIcon, Info } from "lucide-react";
import { PriceEstimateBadge } from "@/components/ui/price-estimate-badge";
import { grasSchema, type GrasFormData } from "@/lib/validations/aanleg-scopes";
import type { GrasData } from "@/types/offerte";

interface GrasFormProps {
  data: GrasData;
  onChange: (data: GrasData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

export function GrasForm({ data, onChange, onValidationChange }: GrasFormProps) {
  const form = useForm<GrasFormData>({
    resolver: zodResolver(grasSchema),
    defaultValues: {
      ...data,
      kunstgras: data.kunstgras ?? false,
      drainage: data.drainage ?? false,
      drainageMeters: data.drainageMeters ?? 1,
      opsluitbanden: data.opsluitbanden ?? false,
      opsluitbandenMeters: data.opsluitbandenMeters ?? 1,
      verticuteren: data.verticuteren ?? false,
    },
    mode: "onChange",
  });

  const { formState: { errors, isValid }, watch } = form;

  // Watch for changes and sync with parent
  useEffect(() => {
    const subscription = watch((values) => {
      if (values.oppervlakte !== undefined) {
        onChange({
          oppervlakte: values.oppervlakte ?? 0,
          type: values.type ?? "graszoden",
          ondergrond: values.ondergrond ?? "bestaand",
          afwateringNodig: values.afwateringNodig ?? false,
          kunstgras: values.kunstgras ?? false,
          drainage: values.drainage ?? false,
          drainageMeters: values.drainageMeters ?? 1,
          opsluitbanden: values.opsluitbanden ?? false,
          opsluitbandenMeters: values.opsluitbandenMeters ?? 1,
          verticuteren: values.verticuteren ?? false,
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

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
  const isKunstgras = watchedValues.kunstgras === true;

  return (
    <Form {...form}>
      <form className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trees className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Gras / Gazon</CardTitle>
              </div>
              <PriceEstimateBadge
                scope="gras"
                oppervlakte={watchedValues.oppervlakte}
              />
            </div>
            <CardDescription className="text-xs">
              Zaaien, graszoden of kunstgras en ondergrondbewerking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {/* Kunstgras toggle - bovenaan */}
            <FormField
              control={form.control}
              name="kunstgras"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50/50 p-3 dark:border-green-900 dark:bg-green-950/20">
                  <div className="space-y-0">
                    <FormLabel className="text-sm font-medium flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-green-600" />
                      Kunstgras
                    </FormLabel>
                    <FormDescription className="text-xs">
                      Premium optie zonder onderhoud
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

            {isKunstgras && (
              <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Kunstgras is een premium optie die geen onderhoud vereist. Type aanleg (zaaien/graszoden) is niet van toepassing bij kunstgras.</span>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="oppervlakte"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Oppervlakte</FormLabel>
                    <FormControl>
                      <AreaInput
                        id="gras-oppervlakte"
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
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Type aanleg</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isKunstgras}
                    >
                      <FormControl>
                        <SelectTrigger id="gras-type">
                          <SelectValue placeholder="Selecteer type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="zaaien">Zaaien</SelectItem>
                        <SelectItem value="graszoden">Graszoden</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {isKunstgras
                        ? "Niet van toepassing bij kunstgras"
                        : watchedValues.type === "graszoden"
                          ? "Direct resultaat, hogere kosten"
                          : "Goedkoper, langer wachten op resultaat"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="ondergrond"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Ondergrond</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger id="gras-ondergrond">
                        <SelectValue placeholder="Selecteer ondergrond" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="bestaand">Bestaande ondergrond (opfrissen)</SelectItem>
                      <SelectItem value="nieuw">Nieuwe ondergrond (egaliseren + bezanden)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {watchedValues.ondergrond === "nieuw"
                      ? "Inclusief grondbewerking en egaliseren"
                      : "Bestaande grond wordt licht bewerkt"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="afwateringNodig"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0">
                    <FormLabel className="text-sm">Afwatering nodig</FormLabel>
                    <FormDescription className="text-xs">
                      Drainage aanleggen
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

            {/* Drainage sectie */}
            <FormField
              control={form.control}
              name="drainage"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0">
                    <FormLabel className="text-sm flex items-center gap-1.5">
                      <Droplets className="h-3.5 w-3.5 text-blue-500" />
                      Drainage nodig?
                    </FormLabel>
                    <FormDescription className="text-xs">
                      PVC-buizen voor waterafvoer
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

            {watchedValues.drainage && (
              <div className="ml-4 space-y-3 border-l-2 border-blue-200 pl-4 dark:border-blue-800">
                <FormField
                  control={form.control}
                  name="drainageMeters"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meters PVC-buis</FormLabel>
                      <FormControl>
                        <NumberInput
                          id="gras-drainage-meters"
                          min={1}
                          step={0.5}
                          decimals={1}
                          suffix="m"
                          value={field.value ?? 1}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          showStepper
                          error={!!errors.drainageMeters}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-2.5 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>PVC-buizen met kokos omhulsel voor optimale waterafvoer</span>
                </div>
              </div>
            )}

            {/* Opsluitbanden sectie */}
            <FormField
              control={form.control}
              name="opsluitbanden"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0">
                    <FormLabel className="text-sm flex items-center gap-1.5">
                      <Fence className="h-3.5 w-3.5 text-stone-500" />
                      Opsluitbanden plaatsen?
                    </FormLabel>
                    <FormDescription className="text-xs">
                      Nette afbakening van het gazon
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

            {watchedValues.opsluitbanden && (
              <div className="ml-4 space-y-3 border-l-2 border-stone-200 pl-4 dark:border-stone-700">
                <FormField
                  control={form.control}
                  name="opsluitbandenMeters"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lopende meters opsluitbanden</FormLabel>
                      <FormControl>
                        <NumberInput
                          id="gras-opsluitbanden-meters"
                          min={0.5}
                          step={0.5}
                          decimals={1}
                          suffix="m"
                          value={field.value ?? 1}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          showStepper
                          error={!!errors.opsluitbandenMeters}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-start gap-2 rounded-lg bg-stone-50 p-2.5 text-xs text-stone-600 dark:bg-stone-950/30 dark:text-stone-400">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>Opsluitbanden houden het gazon netjes afgebakend</span>
                </div>
              </div>
            )}

            {/* Verticuteren - alleen bij bestaande ondergrond */}
            {watchedValues.ondergrond === "bestaand" && (
              <FormField
                control={form.control}
                name="verticuteren"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0">
                        <FormLabel className="text-sm">Bestaand gras verticuteren?</FormLabel>
                        <FormDescription className="text-xs">
                          Verwijdert mos en dood materiaal
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </div>
                    {field.value && (
                      <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>Verticuteren verwijdert mos en dood materiaal uit bestaand gras</span>
                      </div>
                    )}
                  </FormItem>
                )}
              />
            )}

            {/* Indicatie */}
            {watchedValues.oppervlakte > 0 && (
              <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                <span className="font-medium">Indicatie:</span>{" "}
                {isKunstgras
                  ? `Kunstgras: ~${watchedValues.oppervlakte} m²`
                  : watchedValues.type === "zaaien"
                    ? `Graszaad: ~${(watchedValues.oppervlakte * 0.035).toFixed(1)} kg`
                    : `Graszoden: ~${watchedValues.oppervlakte} m²`}
                {watchedValues.ondergrond === "nieuw" && `, zand: ${(watchedValues.oppervlakte * 0.05).toFixed(1)} m³`}
                {watchedValues.afwateringNodig && `, drainage: ${Math.ceil(watchedValues.oppervlakte / 4)} m`}
                {watchedValues.drainage && watchedValues.drainageMeters && `, PVC-buis: ${watchedValues.drainageMeters} m`}
                {watchedValues.opsluitbanden && watchedValues.opsluitbandenMeters && `, opsluitbanden: ${watchedValues.opsluitbandenMeters} m`}
                {watchedValues.verticuteren && `, verticuteren: ${watchedValues.oppervlakte} m²`}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Before/After foto galerij placeholder */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Referentie foto&apos;s</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Voorbeeld van een gazonaanleg project
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Voor</p>
                <div className="flex aspect-[4/3] items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30">
                  <div className="text-center">
                    <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-1 text-xs text-muted-foreground/60">Foto wordt toegevoegd</p>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Na</p>
                <div className="flex aspect-[4/3] items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30">
                  <div className="text-center">
                    <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-1 text-xs text-muted-foreground/60">Foto wordt toegevoegd</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
