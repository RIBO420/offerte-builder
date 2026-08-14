"use client";

import type { UseFormReturn, FieldErrors } from "react-hook-form";
import type { BemestingFormData } from "./schema";
import { SEIZOEN_LABELS } from "./schema";
import { AreaInput, QuantityInput } from "@/components/ui/number-input";
import {
  FormControl,
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface BemestingTypeDetailsProps {
  form: UseFormReturn<BemestingFormData>;
  types: {
    gazon?: boolean;
    borders?: boolean;
    bomen?: boolean;
    universeel?: boolean;
  };
  errors: FieldErrors<BemestingFormData>;
}

// ─── Seizoen Select (herbruikbaar) ────────────────────────────────────────────

function SeizoenSelect({
  form,
  name,
  id,
}: {
  form: UseFormReturn<BemestingFormData>;
  name: "gazonDetail.seizoen" | "bordersDetail.seizoen" | "bomenDetail.seizoen" | "universeelDetail.seizoen";
  id: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Seizoen</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger id={id}>
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {Object.entries(SEIZOEN_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BemestingTypeDetails({ form, types, errors }: BemestingTypeDetailsProps) {
  return (
    <>
      {/* Gazon details */}
      {types?.gazon && (
        <div className="rounded-lg border border-status-geaccepteerd-border bg-status-geaccepteerd/40 p-3 space-y-3">
          <p className="text-xs font-semibold text-status-geaccepteerd-text">Gazonbemesting — details</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="gazonDetail.oppervlakte"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Gazonoppervlakte</FormLabel>
                  <FormControl>
                    <AreaInput
                      id="bemesting-gazon-opp"
                      min={0}
                      value={field.value || 0}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      showStepper={false}
                      error={!!errors.gazonDetail?.oppervlakte}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SeizoenSelect form={form} name="gazonDetail.seizoen" id="bemesting-gazon-seizoen" />
          </div>
        </div>
      )}

      {/* Borders details */}
      {types?.borders && (
        <div className="rounded-lg border border-status-nacalculatie-border bg-status-nacalculatie/40 p-3 space-y-3">
          <p className="text-xs font-semibold text-status-nacalculatie-text">Borderbemesting — details</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="bordersDetail.oppervlakte"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Borderoppervlakte</FormLabel>
                  <FormControl>
                    <AreaInput
                      id="bemesting-borders-opp"
                      min={0}
                      value={field.value || 0}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      showStepper={false}
                      error={!!errors.bordersDetail?.oppervlakte}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SeizoenSelect form={form} name="bordersDetail.seizoen" id="bemesting-borders-seizoen" />
          </div>
        </div>
      )}

      {/* Bomen details */}
      {types?.bomen && (
        <div className="rounded-lg border border-status-herinnering-border bg-status-herinnering/40 p-3 space-y-3">
          <p className="text-xs font-semibold text-status-herinnering-text">Boombemesting — details</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="bomenDetail.aantalBomen"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Aantal bomen</FormLabel>
                  <FormControl>
                    <QuantityInput
                      id="bemesting-bomen-aantal"
                      min={0}
                      value={field.value || 0}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      showStepper={false}
                      error={!!errors.bomenDetail?.aantalBomen}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SeizoenSelect form={form} name="bomenDetail.seizoen" id="bemesting-bomen-seizoen" />
          </div>
        </div>
      )}

      {/* Universeel details */}
      {types?.universeel && (
        <div className="rounded-lg border border-status-gepland-border bg-status-gepland/40 p-3 space-y-3">
          <p className="text-xs font-semibold text-status-gepland-text">Combinatie-pakket — details</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="universeelDetail.oppervlakte"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Tuinoppervlakte</FormLabel>
                  <FormControl>
                    <AreaInput
                      id="bemesting-universeel-opp"
                      min={0}
                      value={field.value || 0}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      showStepper={false}
                      error={!!errors.universeelDetail?.oppervlakte}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SeizoenSelect form={form} name="universeelDetail.seizoen" id="bemesting-universeel-seizoen" />
          </div>
        </div>
      )}
    </>
  );
}
