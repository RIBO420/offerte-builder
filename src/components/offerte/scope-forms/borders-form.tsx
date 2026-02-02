"use client";

import { useEffect } from "react";
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
import { Flower2 } from "lucide-react";
import { PriceEstimateBadge } from "@/components/ui/price-estimate-badge";
import { bordersSchema, type BordersFormData } from "@/lib/validations/aanleg-scopes";
import type { BordersData } from "@/types/offerte";

interface BordersFormProps {
  data: BordersData;
  onChange: (data: BordersData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

export function BordersForm({ data, onChange, onValidationChange }: BordersFormProps) {
  const form = useForm<BordersFormData>({
    resolver: zodResolver(bordersSchema),
    defaultValues: data,
    mode: "onChange",
  });

  const { formState: { errors, isValid }, watch } = form;

  // Watch for changes and sync with parent
  useEffect(() => {
    const subscription = watch((values) => {
      if (values.oppervlakte !== undefined) {
        onChange({
          oppervlakte: values.oppervlakte ?? 0,
          beplantingsintensiteit: values.beplantingsintensiteit ?? "gemiddeld",
          bodemverbetering: values.bodemverbetering ?? false,
          afwerking: values.afwerking ?? "geen",
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
  const plantCount = watchedValues.oppervlakte > 0
    ? Math.round(watchedValues.oppervlakte * (
        watchedValues.beplantingsintensiteit === "weinig" ? 4 :
        watchedValues.beplantingsintensiteit === "gemiddeld" ? 6.5 : 10
      ))
    : null;

  return (
    <Form {...form}>
      <form>
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
                        <SelectItem value="weinig">Weinig (3-5 planten/m²)</SelectItem>
                        <SelectItem value="gemiddeld">Gemiddeld (5-8 planten/m²)</SelectItem>
                        <SelectItem value="veel">Veel (8-12 planten/m²)</SelectItem>
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

            <FormField
              control={form.control}
              name="bodemverbetering"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0">
                    <FormLabel className="text-sm">Bodemverbetering</FormLabel>
                    <FormDescription className="text-xs">
                      Compost/turfmolm toevoegen
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

            {watchedValues.oppervlakte > 0 && (
              <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                <span className="font-medium">Indicatie:</span> ~{plantCount} planten
                {watchedValues.afwerking !== "geen" && `, ${watchedValues.afwerking === "schors" ? "schors" : "grind"}: ${(watchedValues.oppervlakte * 0.05).toFixed(1)} m³`}
                {watchedValues.bodemverbetering && `, bodemverbeteraar: ${(watchedValues.oppervlakte * 0.03).toFixed(1)} m³`}
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
