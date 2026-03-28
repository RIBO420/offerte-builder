"use client";

import { useFormContext } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import type { ReinigingFormData } from "./reiniging-form";

// ---------------------------------------------------------------------------
// Helper: vandaag als ISO-datumstring
// ---------------------------------------------------------------------------

function vandaagAlsISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReinigingHogedrukAkkoord() {
  const { control } = useFormContext<ReinigingFormData>();

  return (
    <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50/50 p-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />
        <p className="text-sm font-medium text-orange-800">
          Akkoord hogedrukspuit
        </p>
        <Badge variant="destructive" className="text-xs">
          Verplicht
        </Badge>
      </div>
      <p className="text-xs text-orange-700 leading-relaxed">
        Bij gebruik van een hogedrukspuit kunnen er spatschade en/of
        waterschade ontstaan. De klant gaat akkoord met het gebruik.
      </p>

      <FormField
        control={control}
        name="hogedrukAkkoord"
        render={({ field }) => (
          <FormItem className="flex items-start gap-3">
            <FormControl>
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
                className="mt-0.5"
              />
            </FormControl>
            <div className="space-y-1">
              <FormLabel className="text-sm font-normal leading-snug cursor-pointer">
                Klant gaat akkoord met gebruik hogedrukspuit
              </FormLabel>
              <FormMessage />
            </div>
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="hogedrukDatumAkkoord"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs text-muted-foreground">
              Datum akkoord
            </FormLabel>
            <FormControl>
              <input
                type="date"
                id="hogedruk-datum"
                value={field.value ?? vandaagAlsISO()}
                onChange={(e) => field.onChange(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Handtekening placeholder */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">
          Digitale handtekening
        </p>
        <Textarea
          disabled
          rows={2}
          placeholder="Handtekening wordt later geïmplementeerd"
          className="resize-none text-xs text-muted-foreground cursor-not-allowed"
        />
      </div>
    </div>
  );
}
