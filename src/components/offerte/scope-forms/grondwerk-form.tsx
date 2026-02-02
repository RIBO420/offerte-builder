"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { AreaInput } from "@/components/ui/number-input";
import { PriceEstimateBadge } from "@/components/ui/price-estimate-badge";
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
import { Shovel } from "lucide-react";
import { grondwerkSchema, type GrondwerkFormData } from "@/lib/validations/aanleg-scopes";
import type { GrondwerkData } from "@/types/offerte";

interface GrondwerkFormProps {
  data: GrondwerkData;
  onChange: (data: GrondwerkData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

export function GrondwerkForm({ data, onChange, onValidationChange }: GrondwerkFormProps) {
  const form = useForm<GrondwerkFormData>({
    resolver: zodResolver(grondwerkSchema),
    defaultValues: data,
    mode: "onChange",
  });

  const { formState: { errors, isValid }, watch } = form;

  // Watch for changes and sync with parent
  useEffect(() => {
    const subscription = watch((values) => {
      if (values.oppervlakte !== undefined && values.diepte !== undefined) {
        onChange({
          oppervlakte: values.oppervlakte ?? 0,
          diepte: values.diepte ?? "standaard",
          afvoerGrond: values.afvoerGrond ?? false,
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
  const estimatedVolume = watchedValues.afvoerGrond && watchedValues.oppervlakte > 0
    ? watchedValues.oppervlakte * (
        watchedValues.diepte === "licht" ? 0.15 :
        watchedValues.diepte === "standaard" ? 0.25 : 0.40
      )
    : null;

  return (
    <Form {...form}>
      <form>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shovel className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Grondwerk</CardTitle>
              </div>
              <PriceEstimateBadge
                scope="grondwerk"
                oppervlakte={watchedValues.oppervlakte}
              />
            </div>
            <CardDescription className="text-xs">
              Ontgraven, afvoer en machine-uren
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="oppervlakte"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Oppervlakte</FormLabel>
                    <FormControl>
                      <AreaInput
                        id="grondwerk-oppervlakte"
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
                name="diepte"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Diepte</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger id="grondwerk-diepte">
                          <SelectValue placeholder="Selecteer diepte" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="licht">Licht (0-15 cm)</SelectItem>
                        <SelectItem value="standaard">Standaard (15-30 cm)</SelectItem>
                        <SelectItem value="zwaar">Zwaar (30+ cm)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Diepte bepaalt de benodigde machine-uren en arbeid
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="afvoerGrond"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0">
                    <FormLabel className="text-sm">Afvoer grond</FormLabel>
                    <FormDescription className="text-xs">
                      Grond afvoeren naar depot
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

            {estimatedVolume !== null && (
              <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                Geschatte afvoer: {estimatedVolume.toFixed(1)} m³
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
