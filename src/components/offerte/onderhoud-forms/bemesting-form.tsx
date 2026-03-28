"use client";

import { useEffect } from "react";
import { useFormValidationSyncNested } from "@/hooks/use-scope-form-sync";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Sprout, Star, TrendingUp } from "lucide-react";

// Re-export schema, types and defaults from the shared module
export { bemestingSchema, bemestingDefaultValues } from "./bemesting/schema";
export type { BemestingFormData } from "./bemesting/schema";

import { bemestingSchema } from "./bemesting/schema";
import type { BemestingFormData } from "./bemesting/schema";
import { BemestingTypeSelector } from "./bemesting/bemesting-type-selector";
import { BemestingTypeDetails } from "./bemesting/bemesting-type-details";
import { BemestingProductSelector } from "./bemesting/bemesting-product-selector";
import { BemestingOptions } from "./bemesting/bemesting-options";
import { BemestingSummary } from "./bemesting/bemesting-summary";

// ─── Props ────────────────────────────────────────────────────────────────────

interface BemestingFormProps {
  data: BemestingFormData;
  onChange: (data: BemestingFormData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BemestingForm({ data, onChange, onValidationChange }: BemestingFormProps) {
  const form = useForm<BemestingFormData>({
    resolver: zodResolver(bemestingSchema),
    defaultValues: data,
    mode: "onChange",
  });

  const { formState: { errors, isValid }, watch } = form;

  // Sync wijzigingen naar parent
  useEffect(() => {
    const subscription = watch((values) => {
      onChange({
        types: {
          gazon: values.types?.gazon ?? false,
          borders: values.types?.borders ?? false,
          bomen: values.types?.bomen ?? false,
          universeel: values.types?.universeel ?? false,
        },
        gazonDetail: {
          oppervlakte: values.gazonDetail?.oppervlakte ?? 0,
          seizoen: values.gazonDetail?.seizoen ?? "voorjaar",
        },
        bordersDetail: {
          oppervlakte: values.bordersDetail?.oppervlakte ?? 0,
          seizoen: values.bordersDetail?.seizoen ?? "voorjaar",
        },
        bomenDetail: {
          aantalBomen: values.bomenDetail?.aantalBomen ?? 0,
          seizoen: values.bomenDetail?.seizoen ?? "voorjaar",
        },
        universeelDetail: {
          oppervlakte: values.universeelDetail?.oppervlakte ?? 0,
          seizoen: values.universeelDetail?.seizoen ?? "voorjaar",
        },
        product: values.product ?? "basis",
        frequentie: values.frequentie ?? "1x",
        kalkbehandeling: values.kalkbehandeling ?? false,
        grondanalyse: values.grondanalyse ?? false,
        onkruidvrijeBemesting: values.onkruidvrijeBemesting ?? false,
      });
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  // Validatiestatus naar parent sturen
  useFormValidationSyncNested(errors, isValid, onValidationChange);

  const watchedValues = watch();
  const { types, product, frequentie, grondanalyse } = watchedValues;

  // Marge-badge kleur — altijd ~70% voor bemesting
  const MARGE_PERCENTAGE = 70;
  const margeKleur =
    MARGE_PERCENTAGE > 50
      ? "bg-green-100 text-green-800 border-green-200"
      : MARGE_PERCENTAGE >= 30
        ? "bg-orange-100 text-orange-800 border-orange-200"
        : "bg-red-100 text-red-800 border-red-200";

  return (
    <Form {...form}>
      <form>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sprout className="h-4 w-4 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Bemesting</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Gazon, borders, bomen of combinatie-pakket bemesten
                  </CardDescription>
                </div>
              </div>
              {/* Marge-indicator — alleen voor hovenier zichtbaar */}
              <div
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${margeKleur}`}
                title="Interne marge-indicatie — niet zichtbaar voor klant"
                aria-label={`Marge indicatie: ${MARGE_PERCENTAGE}%`}
              >
                <TrendingUp className="h-3 w-3" />
                <span>Marge: ~{MARGE_PERCENTAGE}%</span>
              </div>
            </div>
            <p className="text-xs text-green-700 font-medium flex items-center gap-1 mt-1">
              <Star className="h-3 w-3" />
              Hoge marge product — actief aanbieden!
            </p>
          </CardHeader>

          <CardContent className="space-y-5 pt-0">
            {/* 1. Bemestingstypen */}
            <BemestingTypeSelector
              form={form}
              typesError={errors.types?.root?.message}
            />

            {/* 2. Details per type */}
            <BemestingTypeDetails
              form={form}
              types={types ?? {}}
              errors={errors}
            />

            {/* 3. Productkeuze */}
            <BemestingProductSelector
              form={form}
              product={product ?? "basis"}
              productError={errors.product?.message}
            />

            {/* 4. Frequentie + 5. Aanvullende opties */}
            <BemestingOptions
              form={form}
              frequentie={frequentie ?? "1x"}
              grondanalyse={grondanalyse ?? false}
            />

            {/* Indicatie */}
            <BemestingSummary watchedValues={watchedValues} />
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
