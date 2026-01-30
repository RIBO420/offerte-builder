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
  FormDescription,
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
          <CardHeader>
            <div className="flex items-center gap-2">
              <Leaf className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Overige Werkzaamheden</CardTitle>
            </div>
            <CardDescription>
              Bladruimen, terras reinigen en overig onderhoud
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Bladruimen */}
            <FormField
              control={form.control}
              name="bladruimen"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Bladruimen</FormLabel>
                    <FormDescription>
                      Seizoensgebonden bladverwijdering
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

            {/* Terras reinigen */}
            <div className="space-y-4 rounded-lg border p-4">
              <FormField
                control={form.control}
                name="terrasReinigen"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Terras reinigen</FormLabel>
                      <FormDescription>
                        Hogedruk reiniging van terras/bestrating
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

              {watchedValues.terrasReinigen && (
                <FormField
                  control={form.control}
                  name="terrasOppervlakte"
                  render={({ field }) => (
                    <FormItem className="pt-2">
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
            <div className="space-y-4 rounded-lg border p-4">
              <FormField
                control={form.control}
                name="onkruidBestrating"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Onkruid tussen bestrating</FormLabel>
                      <FormDescription>
                        Onkruid uit voegen verwijderen
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

              {watchedValues.onkruidBestrating && (
                <FormField
                  control={form.control}
                  name="bestratingOppervlakte"
                  render={({ field }) => (
                    <FormItem className="pt-2">
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
            <div className="space-y-4 rounded-lg border p-4">
              <FormField
                control={form.control}
                name="afwateringControleren"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Afwatering controleren</FormLabel>
                      <FormDescription>
                        Controle en reiniging afvoerpunten
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

              {watchedValues.afwateringControleren && (
                <FormField
                  control={form.control}
                  name="aantalAfwateringspunten"
                  render={({ field }) => (
                    <FormItem className="pt-2">
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
            <div className="space-y-4 rounded-lg border p-4">
              <FormLabel className="text-base font-medium">Overige werkzaamheden</FormLabel>

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
                        placeholder="Beschrijf eventuele extra werkzaamheden..."
                        rows={3}
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
            {(watchedValues.bladruimen || watchedValues.terrasReinigen || watchedValues.onkruidBestrating || watchedValues.afwateringControleren) && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                <div className="font-medium mb-1">Indicatie per beurt:</div>
                <ul className="list-disc list-inside space-y-1">
                  {watchedValues.bladruimen && (
                    <li>Bladruimen: afhankelijk van tuingrootte en seizoen</li>
                  )}
                  {watchedValues.terrasReinigen && watchedValues.terrasOppervlakte && watchedValues.terrasOppervlakte > 0 && (
                    <li>Terras reinigen: ~{(Math.round(watchedValues.terrasOppervlakte * 0.05 * 4) / 4).toFixed(2)} uur</li>
                  )}
                  {watchedValues.onkruidBestrating && watchedValues.bestratingOppervlakte && watchedValues.bestratingOppervlakte > 0 && (
                    <li>Onkruid bestrating: ~{(Math.round(watchedValues.bestratingOppervlakte * 0.03 * 4) / 4).toFixed(2)} uur</li>
                  )}
                  {watchedValues.afwateringControleren && watchedValues.aantalAfwateringspunten && watchedValues.aantalAfwateringspunten > 0 && (
                    <li>Afwatering: ~{(Math.round((0.25 + watchedValues.aantalAfwateringspunten * 0.1) * 4) / 4).toFixed(2)} uur</li>
                  )}
                  {watchedValues.overigUren && watchedValues.overigUren > 0 && (
                    <li>Overig: {watchedValues.overigUren} uur</li>
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
