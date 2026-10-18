"use client";

/**
 * "Per soort": begroot tegen besteed voor materiaal, arbeid, machine en
 * overig. Dubbele balkjes op één gedeelde schaal (begroot grijs, besteed
 * terracotta) en een standtekst, zodat kleur nooit het enige signaal is.
 *
 * Breed: vijf kolommen met kolomkoppen. Smal (containerquery): soort en
 * besteed bovenaan, balkjes eronder, begroot en stand onderaan — de woorden
 * "begroot"/"besteed" staan er dan zichtbaar bij in plaats van in een kop.
 */

import { cn } from "@/lib/utils";
import { euro, SOORT_LABEL, standVanSoort, type SoortRegel, type StandToon } from "./stand";

const TOON: Record<StandToon, string> = {
  normaal: "text-muted-foreground",
  gedempt: "text-muted-foreground",
  aandacht: "font-medium text-status-herinnering-text",
  over: "font-medium text-status-afgewezen-text",
};

const RIJ =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-md px-3 py-2.5 @xl/sectie:grid-cols-[7rem_minmax(0,1fr)_5.75rem_5.75rem_8rem] @xl/sectie:gap-x-3.5";

export function PerSoort({ regels, afgerond }: { regels: SoortRegel[]; afgerond: boolean }) {
  const schaal = Math.max(0, ...regels.map((r) => Math.max(r.begroot, r.besteed)));

  return (
    <div className="p-1">
      <div
        aria-hidden="true"
        className={cn(RIJ, "hidden py-1.5 text-xs text-muted-foreground @xl/sectie:grid")}
      >
        <span>Soort</span>
        <span />
        <span className="text-end">Begroot</span>
        <span className="text-end">Besteed</span>
        <span className="text-end">Stand</span>
      </div>
      <ul className="flex flex-col">
        {regels.map((r) => {
          const stand = standVanSoort(r, afgerond);
          const leeg = r.begroot <= 0 && r.besteed <= 0;
          return (
            <li key={r.soort} className={cn(RIJ, "hover:bg-muted/50")}>
              <span className={cn("order-1 font-medium @xl/sectie:order-none", leeg && "text-muted-foreground")}>
                {SOORT_LABEL[r.soort]}
              </span>

              <span
                aria-hidden="true"
                className="order-3 col-span-2 flex flex-col gap-[3px] @xl/sectie:order-none @xl/sectie:col-span-1"
              >
                {!leeg && schaal > 0 && (
                  <>
                    <span
                      className="block h-1.5 rounded-full bg-muted-foreground/50"
                      style={{ width: `${(r.begroot / schaal) * 100}%` }}
                    />
                    <span
                      className="block h-1.5 rounded-full bg-accent-warm"
                      style={{ width: `${(r.besteed / schaal) * 100}%` }}
                    />
                  </>
                )}
              </span>

              <span
                className={cn(
                  "order-4 text-sm tabular-nums @xl/sectie:order-none @xl/sectie:text-end",
                  leeg ? "text-muted-foreground" : "text-muted-foreground @xl/sectie:text-foreground"
                )}
              >
                {euro(r.begroot)}
                <span className="@xl/sectie:sr-only"> begroot</span>
              </span>

              <span
                className={cn(
                  "order-2 text-end tabular-nums @xl/sectie:order-none",
                  leeg ? "text-muted-foreground" : "font-semibold"
                )}
              >
                {euro(r.besteed)}
                <span className="font-normal text-muted-foreground @xl/sectie:sr-only"> besteed</span>
              </span>

              <span
                className={cn(
                  "order-5 text-end text-xs tabular-nums @xl/sectie:order-none",
                  TOON[stand.toon]
                )}
              >
                {stand.tekst}
              </span>
            </li>
          );
        })}
      </ul>
      <ul
        aria-label="Legenda"
        className="mx-1 mt-1 flex flex-wrap gap-x-4.5 gap-y-1 border-t px-2 pt-2 pb-2.5 text-xs text-muted-foreground"
      >
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-1.5 w-3.5 rounded-full bg-muted-foreground/50" />
          Begroot
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-1.5 w-3.5 rounded-full bg-accent-warm" />
          Besteed
        </li>
      </ul>
    </div>
  );
}
