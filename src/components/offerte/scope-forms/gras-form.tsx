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
import { Trees } from "lucide-react";
import { PriceEstimateBadge } from "@/components/ui/price-estimate-badge";
import { grasSchema, type GrasFormData } from "@/lib/validations/aanleg-scopes";
import type { GrasData } from "@/types/offerte";

interface GrasFormProps {
  data: GrasData;
  onChange: (data: GrasData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

export function GrasForm({ data, onChange, onValidationChange }: GrasFormProps) {
  const form = useForm<GrasFormData>({
    resolver: zodResolver(grasSchema),
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
          type: values.type ?? "graszoden",
          ondergrond: values.ondergrond ?? "bestaand",
          afwateringNodig: values.afwateringNodig ?? false,
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
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trees className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Gras / Gazon</CardTitle>
              </div>
              <PriceEstimateBadge
                scope="gras"
                oppervlakte={watchedValues.oppervlakte}
              />
            </div>
            <CardDescription className="text-xs">
              Zaaien of graszoden en ondergrondbewerking
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
                        id="gras-oppervlakte"
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
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Type aanleg</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="gras-type">
                          <SelectValue placeholder="Selecteer type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="zaaien">Zaaien</SelectItem>
                        <SelectItem value="graszoden">Graszoden</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {watchedValues.type === "graszoden"
                        ? "Direct resultaat, hogere kosten"
                        : "Goedkoper, langer wachten op resultaat"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="ondergrond"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Ondergrond</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger id="gras-ondergrond">
                        <SelectValue placeholder="Selecteer ondergrond" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="bestaand">Bestaande ondergrond (opfrissen)</SelectItem>
                      <SelectItem value="nieuw">Nieuwe ondergrond (egaliseren + bezanden)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {watchedValues.ondergrond === "nieuw"
                      ? "Inclusief grondbewerking en egaliseren"
                      : "Bestaande grond wordt licht bewerkt"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="afwateringNodig"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0">
                    <FormLabel className="text-sm">Afwatering nodig</FormLabel>
                    <FormDescription className="text-xs">
                      Drainage aanleggen
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
                <span className="font-medium">Indicatie:</span>{" "}
                {watchedValues.type === "zaaien"
                  ? `Graszaad: ~${(watchedValues.oppervlakte * 0.035).toFixed(1)} kg`
                  : `Graszoden: ~${watchedValues.oppervlakte} m²`}
                {watchedValues.ondergrond === "nieuw" && `, zand: ${(watchedValues.oppervlakte * 0.05).toFixed(1)} m³`}
                {watchedValues.afwateringNodig && `, drainage: ${Math.ceil(watchedValues.oppervlakte / 4)} m`}
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
