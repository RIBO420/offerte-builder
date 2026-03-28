"use client";

import { useFormContext, Controller } from "react-hook-form";
import { m } from "framer-motion";
import { SkillsSelector } from "./skills-selector";
import type { MedewerkerFormData } from "./medewerker-form";

export function MedewerkerFormSpecialisaties() {
  const form = useFormContext<MedewerkerFormData>();

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
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
    </m.div>
  );
}
