"use client";

import { useFormContext, Controller } from "react-hook-form";
import { m } from "framer-motion";
import { CertificatenList } from "./certificaat-form";
import type { MedewerkerFormData } from "./medewerker-form";

export function MedewerkerFormCertificaten() {
  const form = useFormContext<MedewerkerFormData>();

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
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
    </m.div>
  );
}
