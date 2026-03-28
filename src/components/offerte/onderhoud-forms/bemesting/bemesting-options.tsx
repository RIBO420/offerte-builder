"use client";

import type { UseFormReturn } from "react-hook-form";
import type { BemestingFormData } from "./schema";
import { FREQUENTIE_LABELS } from "./schema";
import { Switch } from "@/components/ui/switch";
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
import { TrendingUp } from "lucide-react";

// ─── Props ────────────────────────────────────────────────────────────────────

interface BemestingOptionsProps {
  form: UseFormReturn<BemestingFormData>;
  frequentie: string;
  grondanalyse: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BemestingOptions({ form, frequentie, grondanalyse }: BemestingOptionsProps) {
  const heeftMeerdereKeer = frequentie === "2x" || frequentie === "3x" || frequentie === "4x";

  return (
    <>
      {/* ── 4. Frequentie ───────────────────────────────────────────── */}
      <FormField
        control={form.control}
        name="frequentie"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Frequentie</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger id="bemesting-frequentie">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {Object.entries(FREQUENTIE_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription className="text-xs">
              {heeftMeerdereKeer
                ? "Bij meerdere beurten: 10% korting op arbeid"
                : "Hoe vaker bemest, hoe gezonder de tuin"}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Kortingsmelding bij 2x+ */}
      {heeftMeerdereKeer && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 font-medium flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 shrink-0" />
          Bij meerdere beurten: 10% korting op arbeid
        </div>
      )}

      {/* ── 5. Aanvullende opties ───────────────────────────────────── */}
      <div className="space-y-2">
        <FormLabel className="text-sm font-medium">Aanvullende opties</FormLabel>

        <div className="space-y-2">
          {/* Kalkbehandeling */}
          <FormField
            control={form.control}
            name="kalkbehandeling"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                <div className="space-y-0">
                  <FormLabel className="text-sm font-normal">Kalkbehandeling</FormLabel>
                  <p className="text-xs text-muted-foreground">Bij zure grond — verhoogt pH waarde</p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Grondanalyse */}
          <div className="space-y-2">
            <FormField
              control={form.control}
              name="grondanalyse"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                  <div className="space-y-0">
                    <FormLabel className="text-sm font-normal">Grondanalyse</FormLabel>
                    <p className="text-xs text-muted-foreground">Lab-analyse van bodemmonster</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Grondanalyse upsell */}
            {grondanalyse && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
                <p className="text-xs font-semibold text-amber-900">
                  Grondanalyse voor slechts €49
                </p>
                <p className="text-xs text-amber-800">
                  Weet exact wat uw tuin nodig heeft — gerichte bemesting zonder verspilling.
                </p>
              </div>
            )}
          </div>

          {/* Onkruidvrije bemesting */}
          <FormField
            control={form.control}
            name="onkruidvrijeBemesting"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                <div className="space-y-0">
                  <FormLabel className="text-sm font-normal">Onkruidvrije bemesting</FormLabel>
                  <p className="text-xs text-muted-foreground">Extra coating tegen onkruidkieming</p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </div>
    </>
  );
}
