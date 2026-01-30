"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { QuantityInput } from "@/components/ui/number-input";
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
import { TreeDeciduous } from "lucide-react";
import { bomenOnderhoudSchema, type BomenOnderhoudFormData } from "@/lib/validations/onderhoud-scopes";
import type { BomenOnderhoudData } from "@/types/offerte";

interface BomenFormProps {
  data: BomenOnderhoudData;
  onChange: (data: BomenOnderhoudData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

export function BomenForm({ data, onChange, onValidationChange }: BomenFormProps) {
  const form = useForm<BomenOnderhoudFormData>({
    resolver: zodResolver(bomenOnderhoudSchema),
    defaultValues: data,
    mode: "onBlur",
  });

  const { formState: { errors, isValid }, watch } = form;

  // Watch for changes and sync with parent
  useEffect(() => {
    const subscription = watch((values) => {
      if (values.aantalBomen !== undefined) {
        onChange({
          aantalBomen: values.aantalBomen ?? 0,
          snoei: values.snoei ?? "licht",
          hoogteklasse: values.hoogteklasse ?? "laag",
          afvoer: values.afvoer ?? false,
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
              <TreeDeciduous className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Bomen Onderhoud</CardTitle>
            </div>
            <CardDescription>
              Snoei van bomen per hoogteklasse
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="aantalBomen"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Aantal bomen</FormLabel>
                  <FormControl>
                    <QuantityInput
                      id="bomen-aantal"
                      min={0}
                      value={field.value || 0}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      showStepper={false}
                      error={!!errors.aantalBomen}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="snoei"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Snoei type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="bomen-snoei">
                          <SelectValue placeholder="Selecteer snoei type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="licht">Licht (onderhoudssnoei)</SelectItem>
                        <SelectItem value="zwaar">Zwaar (vormsnoei/verjonging)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {watchedValues.snoei === "zwaar"
                        ? "Intensieve snoei voor vorm of verjonging"
                        : "Regulier onderhoud en dood hout verwijderen"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hoogteklasse"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Hoogteklasse</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="bomen-hoogte">
                          <SelectValue placeholder="Selecteer hoogteklasse" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="laag">Laag (&lt;4m, vanaf grond)</SelectItem>
                        <SelectItem value="middel">Middel (4-8m, korte ladder)</SelectItem>
                        <SelectItem value="hoog">Hoog (&gt;8m, hoogwerker/klimmen)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {watchedValues.hoogteklasse === "hoog"
                        ? "Specialistisch werk, extra tijd en materieel"
                        : watchedValues.hoogteklasse === "middel"
                          ? "Ladder nodig, matige toeslag"
                          : "Vanaf grond bereikbaar"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="afvoer"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Afvoer snoeihout</FormLabel>
                    <FormDescription>
                      Takken en snoeihout afvoeren
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

            {watchedValues.aantalBomen > 0 && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                <div className="font-medium mb-1">Indicatie per beurt:</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Snoeitijd: ~{(Math.round(watchedValues.aantalBomen * (
                      watchedValues.snoei === "zwaar" ? 1.5 : 0.75
                    ) * (
                      watchedValues.hoogteklasse === "hoog" ? 2.0 :
                      watchedValues.hoogteklasse === "middel" ? 1.3 : 1.0
                    ) * 4) / 4).toFixed(2)} uur
                  </li>
                  {watchedValues.afvoer && (
                    <li>
                      Geschat snoeihout: ~{(watchedValues.aantalBomen * (watchedValues.snoei === "zwaar" ? 0.3 : 0.1)).toFixed(1)} m³
                    </li>
                  )}
                  {watchedValues.hoogteklasse === "hoog" && (
                    <li className="text-orange-600">
                      Hoogwerker of klimuitrusting nodig
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
