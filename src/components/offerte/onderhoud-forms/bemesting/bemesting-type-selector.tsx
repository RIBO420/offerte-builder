"use client";

import type { UseFormReturn } from "react-hook-form";
import type { BemestingFormData } from "./schema";
import { Switch } from "@/components/ui/switch";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";

// ─── Props ────────────────────────────────────────────────────────────────────

interface BemestingTypeSelectorProps {
  form: UseFormReturn<BemestingFormData>;
  typesError?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BemestingTypeSelector({ form, typesError }: BemestingTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <FormLabel className="text-sm font-medium">
        Bemestingstype
        <span className="ml-1 text-xs text-muted-foreground font-normal">(meerdere mogelijk)</span>
      </FormLabel>

      <div className="grid gap-2 sm:grid-cols-2">
        {/* Gazon */}
        <FormField
          control={form.control}
          name="types.gazon"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
              <div className="space-y-0">
                <FormLabel className="text-sm font-normal">Gazonbemesting</FormLabel>
                <p className="text-xs text-muted-foreground">Meest voorkomend</p>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Borders */}
        <FormField
          control={form.control}
          name="types.borders"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
              <div className="space-y-0">
                <FormLabel className="text-sm font-normal">Borderbemesting</FormLabel>
                <p className="text-xs text-muted-foreground">Borders en perken</p>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Bomen */}
        <FormField
          control={form.control}
          name="types.bomen"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
              <div className="space-y-0">
                <FormLabel className="text-sm font-normal">Boombemesting</FormLabel>
                <p className="text-xs text-muted-foreground">Diepwortel injectie</p>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Universeel */}
        <FormField
          control={form.control}
          name="types.universeel"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
              <div className="space-y-0">
                <FormLabel className="text-sm font-normal">Combinatie-pakket</FormLabel>
                <p className="text-xs text-muted-foreground">Universele bemesting hele tuin</p>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      {/* Validatiefout op types-niveau */}
      {typesError && (
        <p className="text-xs text-destructive">{typesError}</p>
      )}
    </div>
  );
}
