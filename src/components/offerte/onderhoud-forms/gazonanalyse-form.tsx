"use client";

import { useEffect } from "react";
import { useFormValidationSyncNested } from "@/hooks/use-scope-form-sync";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import {
  gazonanalyseSchema,
  type GazonanalyseFormData,
  type GazonanalyseData,
  defaultGazonanalyseData,
  SCORE_INFO,
  getHerstelOpties,
} from "./gazonanalyse/schema";
import { ConditieBeoordeling } from "./gazonanalyse/conditie-beoordeling";
import { ProblemenChecklist } from "./gazonanalyse/problemen-checklist";
import { GazonSpecificaties } from "./gazonanalyse/gazon-specificaties";
import { HerstelpadSectie } from "./gazonanalyse/herstelpad-sectie";
import { AanbevelingenSectie } from "./gazonanalyse/aanbevelingen-sectie";

// Re-export types and defaults so existing imports keep working
export type { GazonanalyseData };
export { defaultGazonanalyseData };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GazonanalyseFormProps {
  data: GazonanalyseData;
  onChange: (data: GazonanalyseData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GazonanalyseForm({
  data,
  onChange,
  onValidationChange,
}: GazonanalyseFormProps) {
  const form = useForm<GazonanalyseFormData>({
    resolver: zodResolver(gazonanalyseSchema),
    defaultValues: data,
    mode: "onChange",
  });

  const {
    formState: { errors, isValid },
    watch,
    setValue,
  } = form;

  // Sync with parent on any change
  useEffect(() => {
    const subscription = watch((values) => {
      const v = values as GazonanalyseFormData;
      onChange(v);
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  // Notify parent of validation state
  useFormValidationSyncNested(errors, isValid, onValidationChange);

  const watchedValues = watch();
  const score = watchedValues.conditieScore ?? 3;
  const scoreInfo = SCORE_INFO[score] ?? SCORE_INFO[3];
  const herstel = getHerstelOpties(score);

  const problemen = watchedValues.problemen ?? defaultGazonanalyseData.problemen;
  const aanbevelingen =
    watchedValues.aanbevelingen ?? defaultGazonanalyseData.aanbevelingen;

  // Auto-suggest toggles based on problemen
  const toonDrainage = problemen.wateroverlast;
  const toonBekalken = problemen.verzuring;
  const toonBeregeningsadvies = problemen.verdroging;

  // Toggle a herstel-actie in the array
  const toggleHerstelActie = (id: string, checked: boolean) => {
    const current = watchedValues.herstelActies ?? [];
    if (checked) {
      setValue("herstelActies", [...current, id], { shouldValidate: true });
    } else {
      setValue(
        "herstelActies",
        current.filter((a) => a !== id),
        { shouldValidate: true }
      );
    }
  };

  return (
    <Form {...form}>
      <form className="space-y-4">
        {/* 1. Gazonbeoordeling */}
        <ConditieBeoordeling
          form={form}
          score={score}
          scoreInfo={scoreInfo}
        />

        {/* 2. Problemen checklist */}
        <ProblemenChecklist
          form={form}
          problemen={problemen}
          errors={errors}
        />

        {/* 3. Gazon specificaties */}
        <GazonSpecificaties
          form={form}
          errors={errors}
          bodemtype={watchedValues.specificaties?.bodemtype}
        />

        {/* 4. Herstelpad */}
        <HerstelpadSectie
          score={score}
          titel={herstel.titel}
          omschrijving={herstel.omschrijving}
          opties={herstel.opties}
          herstelActies={watchedValues.herstelActies ?? []}
          oppervlakte={watchedValues.specificaties?.oppervlakte ?? 0}
          onToggle={toggleHerstelActie}
        />

        {/* 5. Aanvullende aanbevelingen */}
        <AanbevelingenSectie
          form={form}
          toonDrainage={toonDrainage}
          toonBekalken={toonBekalken}
          toonBeregeningsadvies={toonBeregeningsadvies}
          aanbevelingen={aanbevelingen}
        />
      </form>
    </Form>
  );
}
