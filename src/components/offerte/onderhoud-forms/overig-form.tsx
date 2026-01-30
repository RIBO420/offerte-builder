"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AreaInput, QuantityInput, HoursInput } from "@/components/ui/number-input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Leaf } from "lucide-react";
import { overigeOnderhoudSchema, type OverigeOnderhoudFormData } from "@/lib/validations/onderhoud-scopes";
import type { OverigeOnderhoudData } from "@/types/offerte";

interface OverigFormProps {
  data: OverigeOnderhoudData;
  onChange: (data: OverigeOnderhoudData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

export function OverigForm({ data, onChange, onValidationChange }: OverigFormProps) {
  const form = useForm<OverigeOnderhoudFormData>({
    resolver: zodResolver(overigeOnderhoudSchema),
    defaultValues: data,
    mode: "onBlur",
  });

  const { formState: { errors, isValid }, watch } = form;

  // Watch for changes and sync with parent
  useEffect(() => {
    const subscription = watch((values) => {
      onChange({
        bladruimen: values.bladruimen ?? false,
        terrasReinigen: values.terrasReinigen ?? false,
        terrasOppervlakte: values.terrasOppervlakte,
        onkruidBestrating: values.onkruidBestrating ?? false,
        bestratingOppervlakte: values.bestratingOppervlakte,
        afwateringControleren: values.afwateringControleren ?? false,
        aantalAfwateringspunten: values.aantalAfwateringspunten,
        overigNotities: values.overigNotities,
        overigUren: values.overigUren,
      });
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
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Overige Werkzaamheden</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Bladruimen, terras reinigen en overig onderhoud
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {/* Bladruimen */}
            <FormField
              control={form.control}
              name="bladruimen"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                  <div className="space-y-0">
                    <FormLabel className="text-sm">Bladruimen</FormLabel>
                    <p className="text-xs text-muted-foreground">Seizoensgebonden bladverwijdering</p>
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

            {/* Terras reinigen */}
            <div className="space-y-3 rounded-lg border p-3">
              <FormField
                control={form.control}
                name="terrasReinigen"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div className="space-y-0">
                      <FormLabel className="text-sm">Terras reinigen</FormLabel>
                      <p className="text-xs text-muted-foreground">Hogedruk reiniging terras/bestrating</p>
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

              {watchedValues.terrasReinigen && (
                <FormField
                  control={form.control}
                  name="terrasOppervlakte"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Terras oppervlakte</FormLabel>
                      <FormControl>
                        <AreaInput
                          id="overig-terras-opp"
                          min={0}
                          value={field.value || 0}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          showStepper={false}
                          error={!!errors.terrasOppervlakte}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Onkruid bestrating */}
            <div className="space-y-3 rounded-lg border p-3">
              <FormField
                control={form.control}
                name="onkruidBestrating"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div className="space-y-0">
                      <FormLabel className="text-sm">Onkruid tussen bestrating</FormLabel>
                      <p className="text-xs text-muted-foreground">Onkruid uit voegen verwijderen</p>
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

              {watchedValues.onkruidBestrating && (
                <FormField
                  control={form.control}
                  name="bestratingOppervlakte"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Bestrating oppervlakte</FormLabel>
                      <FormControl>
                        <AreaInput
                          id="overig-bestrating-opp"
                          min={0}
                          value={field.value || 0}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          showStepper={false}
                          error={!!errors.bestratingOppervlakte}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Afwatering controleren */}
            <div className="space-y-3 rounded-lg border p-3">
              <FormField
                control={form.control}
                name="afwateringControleren"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div className="space-y-0">
                      <FormLabel className="text-sm">Afwatering controleren</FormLabel>
                      <p className="text-xs text-muted-foreground">Controle en reiniging afvoerpunten</p>
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

              {watchedValues.afwateringControleren && (
                <FormField
                  control={form.control}
                  name="aantalAfwateringspunten"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Aantal afwateringspunten</FormLabel>
                      <FormControl>
                        <QuantityInput
                          id="overig-afwatering-punten"
                          min={0}
                          value={field.value || 0}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          showStepper={false}
                          error={!!errors.aantalAfwateringspunten}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Overig vrij veld */}
            <div className="space-y-3 rounded-lg border p-3">
              <FormLabel className="text-sm font-medium">Overige werkzaamheden</FormLabel>

              <FormField
                control={form.control}
                name="overigNotities"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Omschrijving</FormLabel>
                    <FormControl>
                      <Textarea
                        id="overig-notities"
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Beschrijf extra werkzaamheden..."
                        rows={2}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchedValues.overigNotities && (
                <FormField
                  control={form.control}
                  name="overigUren"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Geschatte uren</FormLabel>
                      <FormControl>
                        <HoursInput
                          id="overig-uren"
                          min={0}
                          value={field.value || 0}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          showStepper={false}
                          error={!!errors.overigUren}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Indicatie */}
            {(watchedValues.bladruimen || watchedValues.terrasReinigen || watchedValues.onkruidBestrating || watchedValues.afwateringControleren || (watchedValues.overigUren && watchedValues.overigUren > 0)) && (
              <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                <span className="font-medium">Indicatie:</span>{" "}
                {[
                  watchedValues.bladruimen && "bladruimen (variabel)",
                  watchedValues.terrasReinigen && watchedValues.terrasOppervlakte && watchedValues.terrasOppervlakte > 0 && `terras: ~${(Math.round(watchedValues.terrasOppervlakte * 0.05 * 4) / 4).toFixed(2)}u`,
                  watchedValues.onkruidBestrating && watchedValues.bestratingOppervlakte && watchedValues.bestratingOppervlakte > 0 && `onkruid: ~${(Math.round(watchedValues.bestratingOppervlakte * 0.03 * 4) / 4).toFixed(2)}u`,
                  watchedValues.afwateringControleren && watchedValues.aantalAfwateringspunten && watchedValues.aantalAfwateringspunten > 0 && `afwatering: ~${(Math.round((0.25 + watchedValues.aantalAfwateringspunten * 0.1) * 4) / 4).toFixed(2)}u`,
                  watchedValues.overigUren && watchedValues.overigUren > 0 && `overig: ${watchedValues.overigUren}u`,
                ].filter(Boolean).join(", ")}
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
