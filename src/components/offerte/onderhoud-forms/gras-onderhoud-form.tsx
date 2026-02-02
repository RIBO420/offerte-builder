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
import { Trees } from "lucide-react";
import { grasOnderhoudSchema, type GrasOnderhoudFormData } from "@/lib/validations/onderhoud-scopes";
import type { GrasOnderhoudData } from "@/types/offerte";

interface GrasOnderhoudFormProps {
  data: GrasOnderhoudData;
  onChange: (data: GrasOnderhoudData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

export function GrasOnderhoudForm({ data, onChange, onValidationChange }: GrasOnderhoudFormProps) {
  const form = useForm<GrasOnderhoudFormData>({
    resolver: zodResolver(grasOnderhoudSchema),
    defaultValues: data,
    mode: "onChange",
  });

  const { formState: { errors, isValid }, watch } = form;

  // Watch for changes and sync with parent
  useEffect(() => {
    const subscription = watch((values) => {
      if (values.grasAanwezig !== undefined) {
        onChange({
          grasAanwezig: values.grasAanwezig ?? false,
          grasOppervlakte: values.grasOppervlakte ?? 0,
          maaien: values.maaien ?? false,
          kantenSteken: values.kantenSteken ?? false,
          verticuteren: values.verticuteren ?? false,
          afvoerGras: values.afvoerGras ?? false,
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  // Notify parent of validation state changes
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
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Trees className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Gras Onderhoud</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Maaien, kanten steken en verticuteren
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <FormField
              control={form.control}
              name="grasAanwezig"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0">
                    <FormLabel className="text-sm">Gras aanwezig</FormLabel>
                    <FormDescription className="text-xs">
                      Is er gazon in de tuin?
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

            {watchedValues.grasAanwezig && (
              <>
                <FormField
                  control={form.control}
                  name="grasOppervlakte"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Grasoppervlakte</FormLabel>
                      <FormControl>
                        <AreaInput
                          id="gras-oppervlakte"
                          min={0}
                          value={field.value || 0}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          showStepper={false}
                          error={!!errors.grasOppervlakte}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel className="text-sm font-medium">Werkzaamheden</FormLabel>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="maaien"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                          <FormLabel className="text-sm font-normal">Maaien</FormLabel>
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
                      name="kantenSteken"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                          <FormLabel className="text-sm font-normal">Kanten steken</FormLabel>
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
                      name="verticuteren"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                          <FormLabel className="text-sm font-normal">Verticuteren</FormLabel>
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
                      name="afvoerGras"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                          <FormLabel className="text-sm font-normal">Afvoer gras</FormLabel>
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
                </div>

                {watchedValues.grasOppervlakte > 0 && (
                  <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                    <span className="font-medium">Indicatie:</span>{" "}
                    {[
                      watchedValues.maaien && `maaien: ${(Math.round(watchedValues.grasOppervlakte * 0.02 * 4) / 4).toFixed(2)}u`,
                      watchedValues.kantenSteken && `kanten: ${(Math.round(Math.sqrt(watchedValues.grasOppervlakte) * 4 * 0.01 * 4) / 4).toFixed(2)}u`,
                      watchedValues.verticuteren && `verticuteren: ${(Math.round(watchedValues.grasOppervlakte * 0.03 * 4) / 4).toFixed(2)}u`,
                    ].filter(Boolean).join(", ") || "geen werkzaamheden"}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
