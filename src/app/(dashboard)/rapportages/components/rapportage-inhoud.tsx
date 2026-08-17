"use client";

/**
 * Welk blad van /rapportages staat er? Eén `if`, en verder niets.
 *
 * Bewust géén `<Tabs>` met beide bladen in de DOM: elk blad zet zijn eigen
 * `getRapportage`-subscription op, en twee subscriptions op dezelfde query
 * naast elkaar is verspilling waarvan de gebruiker er altijd maar één ziet.
 * Onbekende `?tab=`-waardes (de acht oude tabs) landen in het verhaal, dat ze
 * naar het juiste anker doorstuurt.
 */

import { useSearchParams } from "next/navigation";
import { RapportageGrafieken } from "./grafieken-blad";
import { rapportageTabVan } from "./rapportage-tabbalk";
import { RapportageVerhaal } from "./verhaal";

export function RapportageInhoud() {
  const searchParams = useSearchParams();
  const tab = rapportageTabVan(searchParams.get("tab"));

  if (tab === "grafieken") return <RapportageGrafieken />;
  return <RapportageVerhaal />;
}
