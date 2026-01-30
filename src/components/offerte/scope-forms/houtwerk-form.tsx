"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NumberInput } from "@/components/ui/number-input";
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
import { Hammer, AlertTriangle } from "lucide-react";
import { houtwerkSchema, type HoutwerkFormData } from "@/lib/validations/aanleg-scopes";
import type { HoutwerkData } from "@/types/offerte";

interface HoutwerkFormProps {
  data: HoutwerkData;
  onChange: (data: HoutwerkData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

export function HoutwerkForm({ data, onChange, onValidationChange }: HoutwerkFormProps) {
  const form = useForm<HoutwerkFormData>({
    resolver: zodResolver(houtwerkSchema),
    defaultValues: data,
    mode: "onBlur",
  });

  const { formState: { errors, isValid }, watch } = form;

  // Watch for changes and sync with parent
  useEffect(() => {
    const subscription = watch((values) => {
      if (values.typeHoutwerk !== undefined) {
        onChange({
          typeHoutwerk: values.typeHoutwerk ?? "schutting",
          afmeting: values.afmeting ?? 0,
          fundering: values.fundering ?? "standaard",
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

  const getAfmetingLabel = () => {
    switch (watchedValues.typeHoutwerk) {
      case "schutting":
        return "Lengte";
      case "vlonder":
      case "pergola":
        return "Oppervlakte";
      default:
        return "Afmeting";
    }
  };

  const getAfmetingSuffix = () => {
    switch (watchedValues.typeHoutwerk) {
      case "schutting":
        return "m";
      case "vlonder":
      case "pergola":
        return "m²";
      default:
        return "";
    }
  };

  return (
    <Form {...form}>
      <form className="space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Hammer className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Houtwerk</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Schutting, vlonder of pergola
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="typeHoutwerk"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Type houtwerk</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="houtwerk-type">
                          <SelectValue placeholder="Selecteer type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="schutting">Schutting</SelectItem>
                        <SelectItem value="vlonder">Vlonder</SelectItem>
                        <SelectItem value="pergola">Pergola</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="afmeting"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>{getAfmetingLabel()}</FormLabel>
                    <FormControl>
                      <NumberInput
                        id="houtwerk-afmeting"
                        min={0}
                        step={0.1}
                        decimals={1}
                        suffix={getAfmetingSuffix()}
                        value={field.value || 0}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        showStepper={false}
                        error={!!errors.afmeting}
                      />
                    </FormControl>
                    <FormDescription>
                      {watchedValues.typeHoutwerk === "schutting"
                        ? "Totale lengte van de schutting"
                        : "Totale oppervlakte"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Verplichte fundering sectie */}
        <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <CardTitle className="text-base text-orange-900 dark:text-orange-100">Fundering (Verplicht)</CardTitle>
            </div>
            <CardDescription className="text-xs text-orange-700 dark:text-orange-300">
              Wordt automatisch meegenomen in de offerte
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <FormField
              control={form.control}
              name="fundering"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Fundering type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger id="houtwerk-fundering">
                        <SelectValue placeholder="Selecteer fundering" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="standaard">Standaard (betonpoeren/paalvoeten)</SelectItem>
                      <SelectItem value="zwaar">Zwaar (betonpoeren in beton gegoten)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {watchedValues.fundering === "zwaar"
                      ? "Aanbevolen voor hoge schuttingen of slappe grond"
                      : "Geschikt voor standaard constructies"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchedValues.afmeting > 0 && (
              <div className="rounded-lg bg-white p-2 text-xs text-muted-foreground dark:bg-orange-950/30">
                <span className="font-medium">Indicatie:</span>{" "}
                {watchedValues.typeHoutwerk === "schutting"
                  ? `~${Math.ceil(watchedValues.afmeting / 1.8)} palen/poeren`
                  : watchedValues.typeHoutwerk === "vlonder"
                  ? `~${(watchedValues.afmeting * 3).toFixed(0)}m regelwerk, ~${Math.ceil(watchedValues.afmeting / 0.6)} poeren`
                  : "~4 staanders/poeren"}
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
