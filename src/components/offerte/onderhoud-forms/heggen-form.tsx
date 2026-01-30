"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LengthInput } from "@/components/ui/number-input";
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
import { Scissors, AlertTriangle } from "lucide-react";
import { heggenOnderhoudSchema, type HeggenOnderhoudFormData } from "@/lib/validations/onderhoud-scopes";
import type { HeggenOnderhoudData } from "@/types/offerte";

interface HeggenFormProps {
  data: HeggenOnderhoudData;
  onChange: (data: HeggenOnderhoudData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

export function HeggenForm({ data, onChange, onValidationChange }: HeggenFormProps) {
  const form = useForm<HeggenOnderhoudFormData>({
    resolver: zodResolver(heggenOnderhoudSchema),
    defaultValues: data,
    mode: "onBlur",
  });

  const { formState: { errors, isValid }, watch } = form;

  // Watch for changes and sync with parent
  useEffect(() => {
    const subscription = watch((values) => {
      if (values.lengte !== undefined) {
        onChange({
          lengte: values.lengte ?? 0,
          hoogte: values.hoogte ?? 0,
          breedte: values.breedte ?? 0,
          snoei: values.snoei ?? "beide",
          afvoerSnoeisel: values.afvoerSnoeisel ?? false,
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
  const volume = watchedValues.lengte * watchedValues.hoogte * watchedValues.breedte;
  const isVolumeComplete = watchedValues.lengte > 0 && watchedValues.hoogte > 0 && watchedValues.breedte > 0;

  return (
    <Form {...form}>
      <form>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Heggen Onderhoud</CardTitle>
            </div>
            <CardDescription>
              Snoei van heggen met volumeberekening
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert variant="default" className="border-orange-300 bg-orange-50/50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertTitle className="text-orange-900">Verplichte velden</AlertTitle>
              <AlertDescription className="text-orange-700">
                Lengte, hoogte en breedte zijn alle drie verplicht voor een correcte volumeberekening.
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="lengte"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      Lengte
                      <span className="text-xs text-orange-600 font-normal ml-2">(verplicht)</span>
                    </FormLabel>
                    <FormControl>
                      <LengthInput
                        id="heg-lengte"
                        min={0}
                        value={field.value || 0}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        showStepper={false}
                        error={!!errors.lengte}
                        className="border-orange-300"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hoogte"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      Hoogte
                      <span className="text-xs text-orange-600 font-normal ml-2">(verplicht)</span>
                    </FormLabel>
                    <FormControl>
                      <LengthInput
                        id="heg-hoogte"
                        min={0}
                        value={field.value || 0}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        showStepper={false}
                        error={!!errors.hoogte}
                        className="border-orange-300"
                      />
                    </FormControl>
                    {watchedValues.hoogte > 2 && (
                      <p className="text-xs text-orange-600">
                        Hoogte &gt;2m: toeslag voor ladder/hoogwerker
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="breedte"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      Breedte
                      <span className="text-xs text-orange-600 font-normal ml-2">(verplicht)</span>
                    </FormLabel>
                    <FormControl>
                      <LengthInput
                        id="heg-breedte"
                        min={0}
                        value={field.value || 0}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        showStepper={false}
                        error={!!errors.breedte}
                        className="border-orange-300"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isVolumeComplete && (
              <div className="rounded-lg bg-primary/10 p-4 text-center">
                <p className="text-sm text-muted-foreground">Berekend volume</p>
                <p className="text-2xl font-bold">{volume.toFixed(1)} m³</p>
              </div>
            )}

            <FormField
              control={form.control}
              name="snoei"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Snoei type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger id="heg-snoei">
                        <SelectValue placeholder="Selecteer snoei type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="zijkanten">Alleen zijkanten</SelectItem>
                      <SelectItem value="bovenkant">Alleen bovenkant</SelectItem>
                      <SelectItem value="beide">Zijkanten én bovenkant</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {watchedValues.snoei === "beide"
                      ? "Volledige snoei rondom"
                      : watchedValues.snoei === "zijkanten"
                        ? "Alleen de zijkanten bijwerken"
                        : "Alleen de bovenkant egaliseren"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="afvoerSnoeisel"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Afvoer snoeisel</FormLabel>
                    <FormDescription>
                      Snoeiafval afvoeren naar depot
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

            {isVolumeComplete && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                <div className="font-medium mb-1">Indicatie per beurt:</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Snoeitijd: ~{(Math.round(volume * (
                      watchedValues.snoei === "beide" ? 0.5 :
                      watchedValues.snoei === "zijkanten" ? 0.35 : 0.25
                    ) * (watchedValues.hoogte > 2 ? 1.3 : 1.0) * 4) / 4).toFixed(2)} uur
                  </li>
                  {watchedValues.afvoerSnoeisel && (
                    <li>
                      Geschat snoeiafval: ~{(volume * 0.1).toFixed(2)} m³
                    </li>
                  )}
                  {watchedValues.hoogte > 2 && (
                    <li className="text-orange-600">
                      Hoogte toeslag: +30% (ladder/hoogwerker nodig)
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
