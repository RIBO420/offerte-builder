"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Zap, AlertTriangle } from "lucide-react";
import { waterElektraSchema, type WaterElektraFormData } from "@/lib/validations/aanleg-scopes";
import type { WaterElektraData } from "@/types/offerte";

interface WaterElektraFormProps {
  data: WaterElektraData;
  onChange: (data: WaterElektraData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

export function WaterElektraForm({ data, onChange, onValidationChange }: WaterElektraFormProps) {
  const form = useForm<WaterElektraFormData>({
    resolver: zodResolver(waterElektraSchema),
    defaultValues: data,
    mode: "onBlur",
  });

  const { formState: { errors, isValid }, watch, setValue } = form;

  // Watch for changes and sync with parent
  useEffect(() => {
    const subscription = watch((values) => {
      if (values.verlichting !== undefined) {
        onChange({
          verlichting: values.verlichting ?? "geen",
          aantalPunten: values.aantalPunten ?? 0,
          sleuvenNodig: values.sleuvenNodig ?? true,
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
  const heeftElektra = watchedValues.verlichting !== "geen" || watchedValues.aantalPunten > 0;

  // Auto-enable sleuven when elektra is selected
  useEffect(() => {
    if (heeftElektra && !watchedValues.sleuvenNodig) {
      setValue("sleuvenNodig", true);
    }
  }, [heeftElektra, watchedValues.sleuvenNodig, setValue]);

  const totalPunten = watchedValues.aantalPunten + (
    watchedValues.verlichting === "basis" ? 2 :
    watchedValues.verlichting === "uitgebreid" ? 5 : 0
  );

  return (
    <Form {...form}>
      <form className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Water / Elektra</CardTitle>
            </div>
            <CardDescription>
              Tuinverlichting, aansluitpunten en bekabeling
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="verlichting"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Verlichting</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="elektra-verlichting">
                          <SelectValue placeholder="Selecteer niveau" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="geen">Geen verlichting</SelectItem>
                        <SelectItem value="basis">Basis (1-3 armaturen)</SelectItem>
                        <SelectItem value="uitgebreid">Uitgebreid (4+ armaturen)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Sfeer- en functionele verlichting
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="aantalPunten"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aantal aansluitpunten</FormLabel>
                    <FormControl>
                      <QuantityInput
                        id="elektra-punten"
                        min={0}
                        max={20}
                        value={field.value || 0}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        showStepper={false}
                        error={!!errors.aantalPunten}
                      />
                    </FormControl>
                    <FormDescription>
                      Stopcontacten, waterpunten, etc.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {!heeftElektra && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                Selecteer verlichting of voeg aansluitpunten toe om elektra-werkzaamheden toe te voegen aan de offerte.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Verplichte sleuven sectie - alleen tonen als er elektra is */}
        {heeftElektra && (
          <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-orange-900 dark:text-orange-100">Sleuven & Herstel (Verplicht)</CardTitle>
              </div>
              <CardDescription className="text-orange-700 dark:text-orange-300">
                Elektra zonder sleufwerk en herstel is niet toegestaan in het systeem
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert variant="default" className="border-orange-300 bg-orange-100/50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertTitle className="text-orange-900">Automatisch inbegrepen</AlertTitle>
                <AlertDescription className="text-orange-700">
                  Sleufwerk voor bekabeling en herstel van bestrating/grond worden automatisch meegenomen in de offerte.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-white p-4 dark:border-orange-800 dark:bg-orange-950/30">
                  <div className="space-y-0.5">
                    <Label className="text-base">Sleuven graven</Label>
                    <p className="text-sm text-muted-foreground">
                      Verplicht voor veilige bekabeling
                    </p>
                  </div>
                  <span className="text-sm font-medium text-orange-600">Inbegrepen</span>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-white p-4 dark:border-orange-800 dark:bg-orange-950/30">
                  <div className="space-y-0.5">
                    <Label className="text-base">Herstelwerk</Label>
                    <p className="text-sm text-muted-foreground">
                      Dichten sleuven, herstel bestrating/gras
                    </p>
                  </div>
                  <span className="text-sm font-medium text-orange-600">Inbegrepen</span>
                </div>
              </div>

              <div className="rounded-lg bg-white p-3 text-sm text-muted-foreground dark:bg-orange-950/30">
                <div className="font-medium mb-1">Automatisch berekend:</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Sleuven: geschat op basis van {totalPunten} punten
                  </li>
                  <li>Bekabeling: ~{totalPunten * 8} m (schatting)</li>
                  <li>Herstelwerk: afhankelijk van ondergrond</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </Form>
  );
}
