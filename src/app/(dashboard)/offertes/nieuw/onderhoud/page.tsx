"use client";

/**
 * `/offertes/nieuw/onderhoud` — het werkblad voor een onderhoud-offerte.
 *
 * Zelfde route en querystring als voorheen (`?scope=…&klantId=…&leadId=…`);
 * de wizard erachter is vervangen door het werkblad (fase B).
 */

import { Suspense } from "react";
import { Werkbank } from "@/components/offerte/werkbank";
import { WerkbankSkelet } from "@/components/offerte/werkbank/werkbank-skelet";

export default function NieuweOnderhoudOffertePage() {
  return (
    <Suspense fallback={<WerkbankSkelet />}>
      <Werkbank type="onderhoud" />
    </Suspense>
  );
}
