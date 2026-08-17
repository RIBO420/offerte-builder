"use client";

/**
 * De twee gedaanten van /rapportages.
 *
 * Het verhaal blijft de default: vier vragen, vier antwoorden, van boven naar
 * beneden te lezen. Daarnaast staat één extra blad met niets dan grafieken —
 * voor het moment dat je niet wilt lezen maar kijken. Geen derde variant, geen
 * instellingen: twee bladen op dezelfde cijfers.
 *
 * Het mechanisme is de bestaande `?tab=`-hook, met "verhaal" als default. Die
 * default staat níét in de URL (`useTabState` haalt hem eruit), dus een schone
 * `/rapportages` landt altijd in het verhaal — ook voor iedereen die de pagina
 * al gebookmarkt had.
 *
 * Belangrijk: `tab` had op deze pagina al een andere betekenis. Tot het
 * herontwerp waren er acht tabs (`?tab=marges`), en `verhaal.tsx` vangt die
 * oude waardes nog op door ze naar een anker te vertalen. Die waardes mogen
 * hier dus niet per ongeluk als "een tab die ik ken" doorgaan — vandaar
 * `isRapportageTab`, dat exact twee waardes erkent en al het andere aan de
 * oude-deeplink-omleiding laat.
 */

import { useTabState } from "@/hooks/use-tab-state";
import { cn } from "@/lib/utils";

export const RAPPORTAGE_TABS = [
  {
    id: "verhaal",
    label: "Verhaal",
    /** Voorleesnaam; de korte labels alleen zijn te mager voor een screenreader. */
    omschrijving: "Het rapport als verhaal, in vier vragen",
  },
  {
    id: "grafieken",
    label: "Grafieken",
    omschrijving: "Alle cijfers als grafiek, op één blad",
  },
] as const;

export type RapportageTab = (typeof RAPPORTAGE_TABS)[number]["id"];

/** Het verhaal is de default en staat daarom nooit als parameter in de URL. */
export const RAPPORTAGE_TAB_DEFAULT: RapportageTab = "verhaal";

/**
 * Is dit een tabwaarde die dít mechanisme kent? Alleen dan mag de waarde in de
 * URL blijven staan. `marges`, `omzet` en de rest van de oude achttallen zijn
 * geen tabs meer maar deeplinks naar een anker — die horen bij `OUDE_TABS` in
 * `verhaal.tsx`.
 */
export function isRapportageTab(
  waarde: string | null | undefined
): waarde is RapportageTab {
  return RAPPORTAGE_TABS.some((tab) => tab.id === waarde);
}

/** Welk blad hoort er bij deze URL-waarde? Alles onbekends → het verhaal. */
export function rapportageTabVan(waarde: string | null | undefined): RapportageTab {
  return isRapportageTab(waarde) ? waarde : RAPPORTAGE_TAB_DEFAULT;
}

/**
 * De keuzebalk zelf. Bewust dezelfde vormentaal als de ankernavigatie eronder
 * (tekst met een streepje eronder, geen pillen): twee rijen knoppen in
 * verschillende stijlen boven elkaar leest als twee losse besturingen terwijl
 * het één navigatie is.
 *
 * Geen framer-motion voor het streepje — dat zou de bewaker-test terecht laten
 * vallen. Het streepje is een `border-b` die er meteen staat.
 */
export function RapportageTabbalk({ className }: { className?: string }) {
  const [huidig, kies] = useTabState(RAPPORTAGE_TAB_DEFAULT);
  const actief = rapportageTabVan(huidig);

  return (
    <nav aria-label="Weergave van dit rapport" className={cn("flex", className)}>
      <ul className="-mb-px flex items-center gap-1">
        {RAPPORTAGE_TABS.map((tab) => {
          const isActief = actief === tab.id;
          return (
            <li key={tab.id}>
              <button
                type="button"
                onClick={() => kies(tab.id)}
                aria-current={isActief ? "page" : undefined}
                title={tab.omschrijving}
                className={cn(
                  "rounded-t-md border-b-2 px-3 py-1.5 text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  isActief
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
