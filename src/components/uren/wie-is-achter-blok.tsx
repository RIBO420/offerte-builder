"use client";

/**
 * Blok 1 · "Wie is achter?"
 *
 * Een werklijst, geen schandpaal (onderzoek §6). Daarom: geen ranglijst, geen
 * rood, geen "te laat" — alleen de naam, de dagen die ontbreken, en wie je
 * ervoor kunt bellen. Bellen werkt buiten beter dan pushen, dus de ploeg staat
 * er bij in plaats van een herinneringsknop die niemand leest.
 *
 * Leeg is goed nieuws en krijgt dus geen leeg blok maar één regel áchter de kop:
 * "Iedereen is bij."
 */

import { UserCheck } from "lucide-react";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { dagChipLabel } from "./week";
import type { AchterloperRegel } from "./controle-types";

export function WieIsAchterBlok({ achter }: { achter: AchterloperRegel[] }) {
  if (achter.length === 0) {
    return (
      <SectiePaneel
        kopbalk
        titel="Wie is achter?"
        icoon={<UserCheck aria-hidden />}
        legeRegel={{
          tekst: "Iedereen is bij.",
          hint: "Elke werkdag van deze week is ingediend.",
        }}
        uitleg="Medewerkers met een werkdag in deze week waarvan de uren nog niet zijn ingediend."
      />
    );
  }

  return (
    <SectiePaneel
      kopbalk
      titel="Wie is achter?"
      icoon={<UserCheck aria-hidden />}
      telling={achter.length}
      uitleg="Medewerkers met een werkdag in deze week waarvan de uren nog niet zijn ingediend. Bellen werkt buiten beter dan een herinnering — daarom staat de ploeg erbij."
    >
      <ul className="divide-y">
        {achter.map((regel) => (
          <li
            key={regel.medewerkerId}
            // Container-query: op een telefoon stapelt de naam boven de chips,
            // vanaf 34rem staat alles op één regel. Nooit zijwaarts scrollen.
            className="flex flex-col gap-1.5 px-3 py-2.5 @[34rem]/sectie:flex-row @[34rem]/sectie:items-center @[34rem]/sectie:gap-3"
          >
            <p className="min-w-0 truncate text-[13px] font-medium @[34rem]/sectie:w-[11rem] @[34rem]/sectie:shrink-0">
              {regel.naam}
            </p>
            <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {regel.ontbrekendeDagen.map((datum) => (
                <li
                  key={datum}
                  className="rounded border border-status-verzonden-border bg-status-verzonden px-1.5 py-0.5 text-[11px] leading-4 font-medium tabular-nums text-status-verzonden-text"
                >
                  {dagChipLabel(datum)}
                  <span className="sr-only"> nog niet ingediend</span>
                </li>
              ))}
            </ul>
            <p className="shrink-0 truncate text-xs text-muted-foreground">
              {regel.ploegLabel ?? "geen ploeg deze week"}
            </p>
          </li>
        ))}
      </ul>
    </SectiePaneel>
  );
}
