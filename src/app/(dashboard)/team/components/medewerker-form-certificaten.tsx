"use client";

import { useFormContext, Controller } from "react-hook-form";
import { CertificatenList } from "./certificaat-form";
import type { MedewerkerFormData } from "./medewerker-form";

export function MedewerkerFormCertificaten() {
  const form = useFormContext<MedewerkerFormData>();

  return (
    <div>
      <Controller
        control={form.control}
        name="certificaten"
        render={({ field }) => (
          <CertificatenList
            certificaten={field.value ?? []}
            onChange={field.onChange}
          />
        )}
      />
    </div>
  );
}
