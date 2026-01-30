"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Flower2, AlertTriangle } from "lucide-react";
import { bordersOnderhoudSchema, type BordersOnderhoudFormData } from "@/lib/validations/onderhoud-scopes";
import type { BordersOnderhoudData } from "@/types/offerte";

interface BordersOnderhoudFormProps {
  data: BordersOnderhoudData;
  onChange: (data: BordersOnderhoudData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

export function BordersOnderhoudForm({ data, onChange, onValidationChange }: BordersOnderhoudFormProps) {
  const form = useForm<BordersOnderhoudFormData>({
    resolver: zodResolver(bordersOnderhoudSchema),
    defaultValues: data,
    mode: "onBlur",
  });

  const { formState: { errors, isValid }, watch } = form;

  // Watch for changes and sync with parent
  useEffect(() => {
    const subscription = watch((values) => {
      if (values.borderOppervlakte !== undefined) {
        onChange({
          borderOppervlakte: values.borderOppervlakte ?? 0,
          onderhoudsintensiteit: values.onderhoudsintensiteit ?? "gemiddeld",
          onkruidVerwijderen: values.onkruidVerwijderen ?? false,
          snoeiInBorders: values.snoeiInBorders ?? "geen",
          bodem: values.bodem ?? "open",
          afvoerGroenafval: values.afvoerGroenafval ?? false,
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

  return (
    <Form {...form}>
      <form>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Flower2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Borders Onderhoud</CardTitle>
            </div>
            <CardDescription>
              Wieden, snoei in borders en bodemonderhoud
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert variant="default" className="border-orange-300 bg-orange-50/50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertTitle className="text-orange-900">Verplicht veld</AlertTitle>
              <AlertDescription className="text-orange-700">
                Onderhoudsintensiteit is verplicht voor een correcte urenberekening.
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="borderOppervlakte"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Borderoppervlakte</FormLabel>
                    <FormControl>
                      <AreaInput
                        id="border-oppervlakte"
                        min={0}
                        value={field.value || 0}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        showStepper={false}
                        error={!!errors.borderOppervlakte}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="onderhoudsintensiteit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      Onderhoudsintensiteit
                      <span className="text-xs text-orange-600 font-normal ml-2">(verplicht)</span>
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="border-intensiteit" className="border-orange-300">
                          <SelectValue placeholder="Selecteer intensiteit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weinig">Weinig (lage beplantingsdichtheid)</SelectItem>
                        <SelectItem value="gemiddeld">Gemiddeld</SelectItem>
                        <SelectItem value="veel">Veel (hoge beplantingsdichtheid)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Bepaalt de benodigde uren voor onderhoud
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="snoeiInBorders"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Snoei in borders</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="border-snoei">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="geen">Geen snoei</SelectItem>
                        <SelectItem value="licht">Licht (uitgebloeide bloemen)</SelectItem>
                        <SelectItem value="zwaar">Zwaar (vormgeven struiken)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bodem"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bodem type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="border-bodem">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="open">Open grond (meer wieden)</SelectItem>
                        <SelectItem value="bedekt">Bedekt (schors/grind)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {watchedValues.bodem === "open"
                        ? "Open grond vereist meer wiedwerk"
                        : "Bodembedekking vermindert onkruid"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="onkruidVerwijderen"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Onkruid verwijderen</FormLabel>
                      <FormDescription>
                        Wieden en onkruid bestrijden
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

              <FormField
                control={form.control}
                name="afvoerGroenafval"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Afvoer groenafval</FormLabel>
                      <FormDescription>
                        Snoeisel en onkruid afvoeren
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
            </div>

            {watchedValues.borderOppervlakte > 0 && watchedValues.onderhoudsintensiteit && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                <div className="font-medium mb-1">Indicatie per beurt:</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Onderhoud: ~{(Math.round(watchedValues.borderOppervlakte * (
                      watchedValues.onderhoudsintensiteit === "weinig" ? 0.05 :
                      watchedValues.onderhoudsintensiteit === "gemiddeld" ? 0.08 : 0.12
                    ) * (watchedValues.bodem === "open" ? 1.3 : 1.0) * 4) / 4).toFixed(2)} uur
                  </li>
                  {watchedValues.snoeiInBorders !== "geen" && (
                    <li>
                      Snoei: ~{(Math.round(watchedValues.borderOppervlakte * (watchedValues.snoeiInBorders === "licht" ? 0.02 : 0.05) * 4) / 4).toFixed(2)} uur
                    </li>
                  )}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
