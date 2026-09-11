"use client";

import { useState, useMemo, useCallback } from "react";

export interface SortConfig<T> {
  key: keyof T | null;
  direction: "asc" | "desc";
}

/**
 * Sorteren op iets anders dan de kale celwaarde.
 *
 * De klantenlijst toont in de kolom "Naam" de weergavenaam ("Jan van der
 * Berg") maar sorteert op achternaam ("van der berg jan") — kantoor zoekt een
 * klant op zijn achternaam, niet op zijn voornaam. Zonder deze map zou zo'n
 * kolom een tweede, verborgen sorteerveld op de rij nodig hebben.
 *
 * Een accessor krijgt de hele rij en geeft de sorteersleutel terug; `null` en
 * `undefined` belanden achteraan bij oplopend sorteren, net als een lege cel.
 * Kolommen zonder accessor gebruiken gewoon `item[key]`, dus bestaande
 * aanroepen (zonder derde argument) veranderen niet.
 *
 * Geef een stabiele map mee (module-constante of `useMemo`): een nieuw
 * object per render laat de memo van `sortedData` elke keer opnieuw sorteren.
 */
export type SortAccessors<T> = Partial<
  Record<keyof T | string, (item: T) => string | number | null | undefined>
>;

/**
 * Twee sorteerwaarden vergelijken, altijd oplopend — de richting wordt pas bij
 * de aanroeper omgedraaid. Leeg telt als "hoort achteraan".
 */
function vergelijkWaarden(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  // Strings hoofdletter-ongevoelig, zodat "apple" niet achter "Zebra" valt.
  if (typeof a === "string" && typeof b === "string") {
    return a.toLowerCase().localeCompare(b.toLowerCase());
  }

  const links = a as string | number;
  const rechts = b as string | number;
  if (links < rechts) return -1;
  if (links > rechts) return 1;
  return 0;
}

export function useTableSort<T>(
  data: T[],
  defaultKey?: keyof T,
  accessors?: SortAccessors<T>
) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>({
    key: defaultKey || null,
    direction: "asc",
  });

  const sortedData = useMemo(() => {
    const key = sortConfig.key;
    if (!key) return data;

    const accessor = accessors?.[key];
    const sleutel = (item: T): unknown => (accessor ? accessor(item) : item[key]);

    return [...data].sort((a, b) => {
      const uitkomst = vergelijkWaarden(sleutel(a), sleutel(b));
      return sortConfig.direction === "asc" ? uitkomst : -uitkomst;
    });
  }, [data, sortConfig, accessors]);

  const toggleSort = useCallback((key: keyof T) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const resetSort = useCallback(() => {
    setSortConfig({
      key: defaultKey || null,
      direction: "asc",
    });
  }, [defaultKey]);

  return { sortedData, sortConfig, toggleSort, resetSort };
}
