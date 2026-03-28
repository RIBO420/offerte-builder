"use client";

import type { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { QuantityInput } from "@/components/ui/number-input";
import {
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
import { AlertTriangle } from "lucide-react";
import type { BestratingFormData } from "@/lib/validations/aanleg-scopes";

// ─── Onderbouw (verplicht) card ──────────────────────────────────────────────

interface BestratingOnderbouwCardProps {
  form: UseFormReturn<BestratingFormData>;
  estimatedZandVolume: number | null;
}

export function BestratingOnderbouwCard({
  form,
  estimatedZandVolume,
}: BestratingOnderbouwCardProps) {
  const { formState: { errors } } = form;

  return (
    <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <CardTitle className="text-base text-orange-900 dark:text-orange-100">Onderbouw (Verplicht)</CardTitle>
        </div>
        <CardDescription className="text-xs text-orange-700 dark:text-orange-300">
          Wordt automatisch meegenomen in de offerte
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid gap-3 md:grid-cols-2">
          <FormField
            control={form.control}
            name="onderbouw.type"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Onderbouw type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger id="onderbouw-type">
                      <SelectValue placeholder="Selecteer type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="zandbed">Zandbed</SelectItem>
                    <SelectItem value="zand_fundering">Zand + fundering</SelectItem>
                    <SelectItem value="zware_fundering">Zware fundering</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="onderbouw.dikteOnderlaag"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Dikte onderlaag (cm)</FormLabel>
                <FormControl>
                  <QuantityInput
                    id="onderbouw-dikte"
                    min={1}
                    max={50}
                    value={field.value || 0}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    showStepper={false}
                    error={!!errors.onderbouw?.dikteOnderlaag}
                  />
                </FormControl>
                <FormDescription>
                  Standaard: 5cm zand
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="onderbouw.opsluitbanden"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border border-orange-200 bg-muted/50 p-3 dark:border-orange-800 dark:bg-orange-950/30">
              <div className="space-y-0">
                <FormLabel className="text-sm">Opsluitbanden</FormLabel>
                <FormDescription className="text-xs">
                  Randafwerking met beton
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

        <div
          className="grid transition-all duration-200 ease-in-out"
          style={{
            gridTemplateRows: estimatedZandVolume !== null ? "1fr" : "0fr",
            opacity: estimatedZandVolume !== null ? 1 : 0,
          }}
        >
          <div className="overflow-hidden">
            <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground dark:bg-orange-950/30">
              Geschat zandvolume: {estimatedZandVolume !== null ? estimatedZandVolume.toFixed(2) : "0"} m&#179;
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
