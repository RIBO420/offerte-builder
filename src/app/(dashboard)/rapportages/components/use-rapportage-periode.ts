"use client";

/**
 * De periodekeuze van /rapportages, op één plek.
 *
 * Beide bladen (het verhaal en het grafiekenblad) rekenen met dezelfde
 * `getRapportage`-query en dus met dezelfde periode. De keuze staat daarom in
 * de URL en niet in component-state: dat is het gedeelde niveau waar beide
 * bladen bij kunnen, het overleeft een tabwissel zonder dat er iets doorgegeven
 * hoeft te worden, en het blijft deelbaar en herlaadbaar. Zou elk blad een
 * eigen state houden, dan kon "Augustus" op het ene blad naast "Dit jaar" op
 * het andere staan — precies het soort verschil dat R2 uitsluit.
 *
 * `tab` wordt hier bewust *niet* blind gewist. Bij het herontwerp deed
 * `verhaal.tsx` dat wél, want `tab` was toen alleen nog een overblijfsel van de
 * acht oude tabs. Nu is het ook de tabkeuze zelf; een periodewissel op het
 * grafiekenblad zou je dan terug naar het verhaal gooien. Onbekende (oude)
 * waardes verdwijnen nog steeds, zodat de deeplink-omleiding blijft werken.
 */

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isPeriodePreset, type PeriodePreset } from "@/lib/rapportage-labels";
import type { AangepastBereik } from "./periode-kiezer";
import { isRapportageTab } from "./rapportage-tabbalk";

export const STANDAARD_PRESET: PeriodePreset = "dit-jaar";

export interface RapportagePeriodeKeuze {
  preset: PeriodePreset;
  /** Alleen gevuld bij preset "aangepast" mét beide grenzen. */
  aangepast: AangepastBereik | undefined;
  kiesPeriode: (nieuw: PeriodePreset, bereik?: AangepastBereik) => void;
}

export function useRapportagePeriode(): RapportagePeriodeKeuze {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const presetUitUrl = searchParams.get("periode");
  const preset: PeriodePreset = isPeriodePreset(presetUitUrl)
    ? presetUitUrl
    : STANDAARD_PRESET;

  const van = Number(searchParams.get("van")) || undefined;
  const tot = Number(searchParams.get("tot")) || undefined;
  // Gememoïseerd omdat dit object rechtstreeks in de query-args belandt: een
  // nieuwe objectidentiteit per render zou elke render een nieuwe subscription
  // opzetten.
  const aangepast: AangepastBereik | undefined = useMemo(
    () => (preset === "aangepast" && van && tot ? { van, tot } : undefined),
    [preset, van, tot]
  );

  const kiesPeriode = useCallback(
    (nieuw: PeriodePreset, bereik?: AangepastBereik) => {
      const params = new URLSearchParams(searchParams.toString());
      // Zie de kopnoot: alleen een tabwaarde die dit mechanisme níét kent is
      // een oud overblijfsel en mag weg.
      if (!isRapportageTab(params.get("tab"))) params.delete("tab");
      if (nieuw === STANDAARD_PRESET) {
        params.delete("periode");
      } else {
        params.set("periode", nieuw);
      }
      if (nieuw === "aangepast" && bereik) {
        params.set("van", String(bereik.van));
        params.set("tot", String(bereik.tot));
      } else {
        params.delete("van");
        params.delete("tot");
      }
      const query = params.toString();
      router.replace(`${pathname}${query ? `?${query}` : ""}`, {
        scroll: false,
      });
    },
    [pathname, router, searchParams]
  );

  return { preset, aangepast, kiesPeriode };
}
