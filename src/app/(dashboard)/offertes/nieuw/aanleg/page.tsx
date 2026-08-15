"use client";

/**
 * `/offertes/nieuw/aanleg` — het werkblad voor een aanleg-offerte.
 *
 * De route en haar querystring (`?scope=…&klantId=…&leadId=…`) zijn het
 * contract met de entree (tegel-dialog, klantdossier, leads); wat erachter zit
 * is sinds fase B geen 5-stapswizard meer maar één levend document.
 */

import { Suspense } from "react";
import { Werkbank } from "@/components/offerte/werkbank";
import { WerkbankSkelet } from "@/components/offerte/werkbank/werkbank-skelet";

export default function NieuweAanlegOffertePage() {
  return (
    <Suspense fallback={<WerkbankSkelet />}>
      <Werkbank type="aanleg" />
    </Suspense>
  );
}
