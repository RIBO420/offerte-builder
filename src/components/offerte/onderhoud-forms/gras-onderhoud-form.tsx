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
    mode: "onBlur",
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
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trees className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Gras Onderhoud</CardTitle>
            </div>
            <CardDescription>
              Maaien, kanten steken en verticuteren
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="grasAanwezig"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Gras aanwezig</FormLabel>
                    <FormDescription>
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

                <div className="space-y-4">
                  <FormLabel className="text-base font-medium">Werkzaamheden</FormLabel>

                  <FormField
                    control={form.control}
                    name="maaien"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Maaien</FormLabel>
                          <FormDescription>
                            Regelmatig gazon maaien
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
                    name="kantenSteken"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Kanten steken</FormLabel>
                          <FormDescription>
                            Randen van het gazon bijwerken
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
                    name="verticuteren"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Verticuteren</FormLabel>
                          <FormDescription>
                            Mos en vilt verwijderen (optioneel, 1-2x per jaar)
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
                    name="afvoerGras"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Afvoer gras</FormLabel>
                          <FormDescription>
                            Maaisel afvoeren (anders mulchen)
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

                {watchedValues.grasOppervlakte > 0 && (
                  <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                    <div className="font-medium mb-1">Indicatie per beurt:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {watchedValues.maaien && (
                        <li>Maaien: ~{(watchedValues.grasOppervlakte * 0.02).toFixed(1)} uur</li>
                      )}
                      {watchedValues.kantenSteken && (
                        <li>Kanten steken: ~{(Math.sqrt(watchedValues.grasOppervlakte) * 4 * 0.01).toFixed(1)} uur</li>
                      )}
                      {watchedValues.verticuteren && (
                        <li>Verticuteren: ~{(watchedValues.grasOppervlakte * 0.03).toFixed(1)} uur</li>
                      )}
                    </ul>
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
