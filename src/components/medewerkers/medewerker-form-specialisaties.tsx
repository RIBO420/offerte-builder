"use client";

import { useFormContext, Controller } from "react-hook-form";
import { SkillsSelector } from "./skills-selector";
import type { MedewerkerFormData } from "./medewerker-form";

export function MedewerkerFormSpecialisaties() {
  const form = useFormContext<MedewerkerFormData>();

  return (
    <div>
      <Controller
        control={form.control}
        name="specialisaties"
        render={({ field }) => (
          <SkillsSelector
            value={field.value ?? []}
            onChange={field.onChange}
          />
        )}
      />
    </div>
  );
}
