"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CalendarClock, ListTodo } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { cn } from "@/lib/utils";
import { showErrorToast } from "@/lib/toast-utils";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

const STANDAARD_ZICHTBAAR = 5;

/**
 * Eén abonnement voor twee lezers: de kop van de dagstaat telt de open taken en
 * dit paneel toont ze. Convex dedupliceert op (query, args), dus dit is
 * dezelfde subscriptie — geen extra round-trip.
 */
export function useMijnTaken() {
  return useQuery(api.klantTaken.mijnTaken, { limit: 25 });
}

function vandaagISO(): string {
  const nu = new Date();
  const maand = `${nu.getMonth() + 1}`.padStart(2, "0");
  const dag = `${nu.getDate()}`.padStart(2, "0");
  return `${nu.getFullYear()}-${maand}-${dag}`;
}

function formatDeadline(deadline: string): string {
  const [jaar, maand, dag] = deadline.split("-").map(Number);
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
  }).format(new Date(jaar, maand - 1, dag));
}

/**
 * "Mijn taken": openstaande klanttaken van de ingelogde medewerker (kantoor
 * zonder gekoppeld medewerkerprofiel ziet alle open taken van het bedrijf —
 * zie `klantTaken.mijnTaken`).
 *
 * Gewicht `primair`, net als op het klantdossier: taken zijn werkstroom, geen
 * naslag. Het warme anker houdt "Aandacht nodig" ernaast wél het zwaarste blok.
 *
 * `verbergAlsLeeg` is de default, zodat de medewerkerpagina (een enkele kolom
 * kaarten) niet volloopt met lege dozen. De dagstaat zet hem uit: daar is een
 * gat in het raster erger dan één lege regel.
 */
export function MijnTaken({
  verbergAlsLeeg = true,
}: {
  verbergAlsLeeg?: boolean;
} = {}) {
  const taken = useMijnTaken();
  const setStatus = useMutation(api.klantTaken.setStatus);
  const [bezigMet, setBezigMet] = useState<Id<"klantTaken"> | null>(null);
  const [toonAlles, setToonAlles] = useState(false);

  if (!taken || taken.length === 0) {
    if (verbergAlsLeeg) return null;
    return (
      <SectiePaneel
        titel="Mijn taken"
        icoon={<ListTodo />}
        gewicht="primair"
        legeRegel={{
          tekst: "Geen open taken",
          hint: "Taken die je op een klantdossier aan jezelf toewijst staan hier.",
        }}
      />
    );
  }

  const handleAfronden = async (id: Id<"klantTaken">) => {
    setBezigMet(id);
    try {
      await setStatus({ id, status: "afgerond" });
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij afronden taak"
      );
    } finally {
      setBezigMet(null);
    }
  };

  const zichtbaar = toonAlles ? taken : taken.slice(0, STANDAARD_ZICHTBAAR);

  return (
    <SectiePaneel titel="Mijn taken" icoon={<ListTodo />} telling={taken.length} gewicht="primair">
      <ul className="divide-y divide-border/60">
        {zichtbaar.map((taak) => {
          const isTeLaat = taak.deadline && taak.deadline < vandaagISO();
          return (
            <li key={taak._id} className="flex items-center gap-2.5 px-3 py-1.5">
              <Checkbox
                className="shrink-0"
                checked={false}
                disabled={bezigMet === taak._id}
                onCheckedChange={() => handleAfronden(taak._id)}
                aria-label={`Taak ${taak.titel} afronden`}
              />
              <div className="min-w-0 flex-1 @[24rem]/sectie:flex @[24rem]/sectie:items-baseline @[24rem]/sectie:gap-2">
                <p
                  className="truncate text-[13px] leading-5 font-medium @[24rem]/sectie:max-w-[60%] @[24rem]/sectie:shrink-0"
                  title={taak.titel}
                >
                  {taak.titel}
                </p>
                <div className="flex min-w-0 items-center gap-2 text-xs leading-4 text-muted-foreground @[24rem]/sectie:leading-5">
                  {taak.klantNaam && (
                    <Link
                      href={`/klanten/${taak.klantId}`}
                      className="truncate hover:underline"
                    >
                      {taak.klantNaam}
                    </Link>
                  )}
                  {taak.deadline && (
                    <span
                      className={cn(
                        "flex shrink-0 items-center gap-1 tabular-nums",
                        isTeLaat && "font-medium text-status-vervallen-text"
                      )}
                    >
                      <CalendarClock className="size-3" aria-hidden="true" />
                      {formatDeadline(taak.deadline)}
                      {isTeLaat && " · te laat"}
                    </span>
                  )}
                </div>
              </div>
              {taak.prioriteit === "hoog" && (
                <span className="shrink-0 rounded bg-accent-warm/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-foreground uppercase">
                  hoog
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {taken.length > STANDAARD_ZICHTBAAR && (
        <button
          type="button"
          onClick={() => setToonAlles((vorig) => !vorig)}
          aria-expanded={toonAlles}
          className="flex min-h-7 w-full items-center border-t px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {toonAlles ? "Minder tonen" : `Alle ${taken.length} tonen`} &rarr;
        </button>
      )}
    </SectiePaneel>
  );
}
