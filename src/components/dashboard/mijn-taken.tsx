"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CalendarClock, ListTodo } from "lucide-react";
import { TaakCheckbox } from "@/components/taken/taak-checkbox";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { Skeleton } from "@/components/ui/skeleton";
import { DagstaatTaakComposer } from "@/components/dashboard/taak-composer";
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
 * De eerste regel is de composer, óók zonder taken. Een lijst die je alleen
 * elders kunt vullen is een dood blok: er stond "Geen open taken" en verder
 * niets te doen. Nu is de lege staat één regel ("Nog geen taken — voeg de
 * eerste toe.") mét de composer eronder, dus de reden dat je hier kijkt is
 * ook de reden dat je hier iets kunt.
 *
 * `verbergAlsLeeg` is de default, zodat de medewerkerpagina (een enkele kolom
 * kaarten) niet volloopt met lege dozen; daar begint het blok dus pas te
 * bestaan zodra er een taak is. De dagstaat zet hem uit: daar is een gat in
 * het raster erger dan één lege regel.
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

  const laadt = taken === undefined;
  const lijst = taken ?? [];

  if (verbergAlsLeeg && lijst.length === 0) return null;

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

  const zichtbaar = toonAlles ? lijst : lijst.slice(0, STANDAARD_ZICHTBAAR);
  const leeg = !laadt && lijst.length === 0;

  return (
    <SectiePaneel
      titel="Mijn taken"
      icoon={<ListTodo />}
      telling={lijst.length}
      gewicht="primair"
      uitleg="Openstaande taken die aan jou zijn toegewezen. Wat je hier toevoegt komt op jouw naam en bij de gekozen klant te staan; toewijzen aan een collega doe je op het klantdossier. Enter slaat direct op."
      legeRegel={
        leeg
          ? { tekst: "Nog geen taken", hint: "— voeg de eerste toe." }
          : undefined
      }
    >
      <DagstaatTaakComposer metScheiding={!leeg} />

      {laadt && (
        <ul className="divide-y divide-border/60">
          {[0, 1].map((i) => (
            <li key={i} className="flex items-center gap-2.5 px-3 py-1.5">
              <Skeleton className="size-4 shrink-0 rounded-[4px]" />
              <Skeleton className="h-3.5 w-[55%]" />
            </li>
          ))}
        </ul>
      )}

      <ul className="divide-y divide-border/60">
        {zichtbaar.map((taak) => {
          const isTeLaat = taak.deadline && taak.deadline < vandaagISO();
          return (
            <li key={taak._id} className="flex items-center gap-2.5 px-3 py-1.5">
              <TaakCheckbox
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
      {lijst.length > STANDAARD_ZICHTBAAR && (
        <button
          type="button"
          onClick={() => setToonAlles((vorig) => !vorig)}
          aria-expanded={toonAlles}
          className="flex min-h-7 w-full items-center border-t px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {toonAlles ? "Minder tonen" : `Alle ${lijst.length} tonen`} &rarr;
        </button>
      )}
    </SectiePaneel>
  );
}
