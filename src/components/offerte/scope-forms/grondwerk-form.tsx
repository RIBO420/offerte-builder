"use client";

import { useEffect } from "react";
import { useFormValidationSync } from "@/hooks/use-scope-form-sync";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { AreaInput } from "@/components/ui/number-input";
import { PriceEstimateBadge } from "@/components/ui/price-estimate-badge";
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
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Shovel, Info } from "lucide-react";
import { grondwerkSchema, type GrondwerkFormData } from "@/lib/validations/aanleg-scopes";
import type { GrondwerkData } from "@/types/offerte";

const GRONDWERK_TOOLTIPS: Record<string, string> = {
  diepte:
    "Licht grondwerk (0-15 cm) is geschikt voor borders en gazon. Standaard (15-30 cm) voor bestrating en paden. Zwaar (30+ cm) voor funderingen en vijvers. Meer diepte = meer kubieke meters = hogere kosten voor machines en afvoer.",
  afvoer:
    "Grondafvoer voegt aanzienlijke transportkosten toe. Reken op ~€25-€35 per m³ inclusief stortkosten. Overweeg of grond elders in de tuin hergebruikt kan worden om kosten te besparen.",
  egaliseren:
    "Egaliseren is nodig wanneer de ondergrond ongelijk is, bijv. na sloop of bij niveauverschillen. Dit zorgt voor een vlakke basis voor bestrating, gazon of beplanting.",
};

interface GrondwerkFormProps {
  data: GrondwerkData;
  onChange: (data: GrondwerkData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

export function GrondwerkForm({ data, onChange, onValidationChange }: GrondwerkFormProps) {
  const form = useForm<GrondwerkFormData>({
    resolver: zodResolver(grondwerkSchema),
    defaultValues: data,
    mode: "onChange",
  });

  const { formState: { errors, isValid }, watch } = form;

  // Watch for changes and sync with parent
  useEffect(() => {
    const subscription = watch((values) => {
      if (values.oppervlakte !== undefined && values.diepte !== undefined) {
        onChange({
          oppervlakte: values.oppervlakte ?? 0,
          diepte: values.diepte ?? "standaard",
          afvoerGrond: values.afvoerGrond ?? false,
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  // Notify parent of validation state changes
  useFormValidationSync(errors, isValid, onValidationChange);

  const watchedValues = watch();
  const estimatedVolume = watchedValues.afvoerGrond && watchedValues.oppervlakte > 0
    ? watchedValues.oppervlakte * (
        watchedValues.diepte === "licht" ? 0.15 :
        watchedValues.diepte === "standaard" ? 0.25 : 0.40
      )
    : null;

  return (
    <Form {...form}>
      <form>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shovel className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Grondwerk</CardTitle>
              </div>
              <PriceEstimateBadge
                scope="grondwerk"
                oppervlakte={watchedValues.oppervlakte}
              />
            </div>
            <CardDescription className="text-xs">
              Ontgraven, afvoer en machine-uren
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
                        id="grondwerk-oppervlakte"
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
                name="diepte"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1.5">
                      <FormLabel required>Diepte</FormLabel>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex rounded-full p-0.5 text-muted-foreground hover:text-foreground">
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[260px]">
                          {GRONDWERK_TOOLTIPS.diepte}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger id="grondwerk-diepte">
                          <SelectValue placeholder="Selecteer diepte" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="licht">Licht (0-15 cm)</SelectItem>
                        <SelectItem value="standaard">Standaard (15-30 cm)</SelectItem>
                        <SelectItem value="zwaar">Zwaar (30+ cm)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Diepte bepaalt de benodigde machine-uren en arbeid
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="afvoerGrond"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0">
                    <div className="flex items-center gap-1.5">
                      <FormLabel className="text-sm">Afvoer grond</FormLabel>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex rounded-full p-0.5 text-muted-foreground hover:text-foreground">
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[260px]">
                          {GRONDWERK_TOOLTIPS.afvoer}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <FormDescription className="text-xs">
                      Grond afvoeren naar depot
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

            {estimatedVolume !== null && (
              <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                Geschatte afvoer: {estimatedVolume.toFixed(1)} m³
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
