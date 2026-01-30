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
    mode: "onBlur",
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
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trees className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Gras / Gazon</CardTitle>
            </div>
            <CardDescription>
              Zaaien of graszoden en ondergrondbewerking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
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
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Afwatering nodig</FormLabel>
                    <FormDescription>
                      Drainage aanleggen voor waterafvoer
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
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                <div className="font-medium mb-1">Indicatie:</div>
                <ul className="list-disc list-inside space-y-1">
                  {watchedValues.type === "zaaien" ? (
                    <li>Graszaad: ~{(watchedValues.oppervlakte * 0.035).toFixed(1)} kg</li>
                  ) : (
                    <li>Graszoden: ~{watchedValues.oppervlakte} m² (+ 5% snijverlies)</li>
                  )}
                  {watchedValues.ondergrond === "nieuw" && (
                    <li>Zand voor egaliseren: ~{(watchedValues.oppervlakte * 0.05).toFixed(1)} m³</li>
                  )}
                  {watchedValues.afwateringNodig && (
                    <li>Drainageslangen: ~{Math.ceil(watchedValues.oppervlakte / 4)} m</li>
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
