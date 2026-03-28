"use client";

import { useEffect, useState, useCallback } from "react";
import { useFormValidationSyncNested } from "@/hooks/use-scope-form-sync";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { bestratingSchema, type BestratingFormData } from "@/lib/validations/aanleg-scopes";
import type { BestratingData, Bestratingtype, FunderingslagenData, BestratingZone } from "@/types/offerte";
import { FUNDERINGS_SPECS } from "./bestrating-constants";
import { BestratingTypeSelector } from "./bestrating-type-selector";
import { BestratingDetailsCard } from "./bestrating-details-card";
import { BestratingOnderbouwCard } from "./bestrating-onderbouw-card";
import { BestratingZonesCard } from "./bestrating-zones-card";

// ─── Hoofdcomponent ──────────────────────────────────────────────────────────

interface BestratingFormProps {
  data: BestratingData;
  onChange: (data: BestratingData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

export function BestratingForm({ data, onChange, onValidationChange }: BestratingFormProps) {
  const form = useForm<BestratingFormData>({
    resolver: zodResolver(bestratingSchema),
    defaultValues: data,
    mode: "onChange",
  });

  const { formState: { errors, isValid }, watch } = form;

  // Local state for new fields (managed outside react-hook-form for backwards compatibility)
  const [bestratingtype, setBestratingtype] = useState<Bestratingtype | undefined>(
    data.bestratingtype
  );
  const [zones, setZones] = useState<BestratingZone[]>(
    data.zones ?? []
  );

  // Compute funderingslagen based on bestratingtype
  const funderingslagen: FunderingslagenData | undefined = bestratingtype
    ? {
        gebrokenPuin: FUNDERINGS_SPECS[bestratingtype].gebrokenPuin,
        zand: FUNDERINGS_SPECS[bestratingtype].zand,
        brekerszand: FUNDERINGS_SPECS[bestratingtype].brekerszand,
        stabiliser: FUNDERINGS_SPECS[bestratingtype].stabiliser,
      }
    : undefined;

  // Stable onChange callback
  const stableOnChange = useCallback(
    (partial: Partial<BestratingData>) => {
      onChange({
        oppervlakte: partial.oppervlakte ?? data.oppervlakte,
        typeBestrating: partial.typeBestrating ?? data.typeBestrating,
        snijwerk: partial.snijwerk ?? data.snijwerk,
        onderbouw: partial.onderbouw ?? data.onderbouw,
        bestratingtype: partial.bestratingtype ?? bestratingtype,
        funderingslagen: partial.funderingslagen ?? funderingslagen,
        zones: partial.zones ?? (zones.length > 0 ? zones : undefined),
      });
    },
    [onChange, data, bestratingtype, funderingslagen, zones]
  );

  // Watch for changes from react-hook-form and sync with parent
  useEffect(() => {
    const subscription = watch((values) => {
      if (values.oppervlakte !== undefined && values.typeBestrating !== undefined) {
        stableOnChange({
          oppervlakte: values.oppervlakte ?? 0,
          typeBestrating: values.typeBestrating ?? "tegel",
          snijwerk: values.snijwerk ?? "laag",
          onderbouw: {
            type: values.onderbouw?.type ?? "zandbed",
            dikteOnderlaag: values.onderbouw?.dikteOnderlaag ?? 5,
            opsluitbanden: values.onderbouw?.opsluitbanden ?? false,
          },
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, stableOnChange]);

  // Notify parent of validation state changes
  useFormValidationSyncNested(errors, isValid, onValidationChange);

  // Handlers for bestratingtype
  const handleBestratingtypeChange = (value: Bestratingtype) => {
    setBestratingtype(value);
    const newFundering = {
      gebrokenPuin: FUNDERINGS_SPECS[value].gebrokenPuin,
      zand: FUNDERINGS_SPECS[value].zand,
      brekerszand: FUNDERINGS_SPECS[value].brekerszand,
      stabiliser: FUNDERINGS_SPECS[value].stabiliser,
    };
    stableOnChange({
      bestratingtype: value,
      funderingslagen: newFundering,
    });
  };

  // Handlers for zones
  const handleAddZone = () => {
    const newZone: BestratingZone = {
      id: crypto.randomUUID(),
      type: bestratingtype ?? "pad",
      oppervlakte: 0,
      materiaal: undefined,
    };
    const newZones = [...zones, newZone];
    setZones(newZones);
    stableOnChange({ zones: newZones });
  };

  const handleUpdateZone = (index: number, updatedZone: BestratingZone) => {
    const newZones = zones.map((z, i) => (i === index ? updatedZone : z));
    setZones(newZones);
    stableOnChange({ zones: newZones });
  };

  const handleRemoveZone = (index: number) => {
    const newZones = zones.filter((_, i) => i !== index);
    setZones(newZones);
    stableOnChange({ zones: newZones.length > 0 ? newZones : undefined });
  };

  const watchedValues = watch();
  const estimatedZandVolume = watchedValues.oppervlakte > 0 && watchedValues.onderbouw?.dikteOnderlaag > 0
    ? watchedValues.oppervlakte * (watchedValues.onderbouw.dikteOnderlaag / 100)
    : null;

  // Totale zone-oppervlakte
  const totalZoneOppervlakte = zones.reduce((sum, z) => sum + (z.oppervlakte || 0), 0);

  return (
    <Form {...form}>
      <form className="space-y-3">
        {/* Sectie 1+2: Bestratingtype selector + funderingsvisualisatie */}
        <BestratingTypeSelector
          bestratingtype={bestratingtype}
          onBestratingtypeChange={handleBestratingtypeChange}
        />

        {/* Sectie 3: Bestaande bestrating velden */}
        <BestratingDetailsCard
          form={form}
          oppervlakte={watchedValues.oppervlakte}
        />

        {/* Sectie 4: Verplichte onderbouw */}
        <BestratingOnderbouwCard
          form={form}
          estimatedZandVolume={estimatedZandVolume}
        />

        {/* Sectie 5: Multi-zone systeem */}
        <BestratingZonesCard
          zones={zones}
          totalZoneOppervlakte={totalZoneOppervlakte}
          hoofdOppervlakte={watchedValues.oppervlakte}
          onAddZone={handleAddZone}
          onUpdateZone={handleUpdateZone}
          onRemoveZone={handleRemoveZone}
        />
      </form>
    </Form>
  );
}
