"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Layers, AlertTriangle } from "lucide-react";
import { PriceEstimateBadge } from "@/components/ui/price-estimate-badge";
import { bestratingSchema, type BestratingFormData } from "@/lib/validations/aanleg-scopes";
import type { BestratingData } from "@/types/offerte";

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

  // Watch for changes and sync with parent
  useEffect(() => {
    const subscription = watch((values) => {
      if (values.oppervlakte !== undefined && values.typeBestrating !== undefined) {
        onChange({
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
  }, [watch, onChange]);

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

  const watchedValues = watch();
  const estimatedZandVolume = watchedValues.oppervlakte > 0 && watchedValues.onderbouw?.dikteOnderlaag > 0
    ? watchedValues.oppervlakte * (watchedValues.onderbouw.dikteOnderlaag / 100)
    : null;

  return (
    <Form {...form}>
      <form className="space-y-3">
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

        {/* Verplichte onderbouw sectie */}
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
                <FormItem className="flex items-center justify-between rounded-lg border border-orange-200 bg-white p-3 dark:border-orange-800 dark:bg-orange-950/30">
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
              <div className="rounded-lg bg-white p-2 text-xs text-muted-foreground dark:bg-orange-950/30">
                Geschat zandvolume: {estimatedZandVolume.toFixed(2)} m³
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
