"use client";

import {
  KlantOffertesSectie,
  type KlantOfferte,
} from "@/components/klanten/klant-documenten";

/**
 * Offertes — alle offertes van deze klant, nieuwste eerst.
 *
 * De lijst komt van `useKlantWithOffertes` op de pagina (die query haalt klant
 * én offertes in één keer op), dus hier binnen géén tweede query.
 *
 * WS2: filterchips en een totaalbalk horen hier, boven of onder de lijst.
 */
export function TabOffertes({ offertes }: { offertes: KlantOfferte[] }) {
  return <KlantOffertesSectie offertes={offertes} />;
}
