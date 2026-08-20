"use client";

/**
 * Het medewerker-gezicht van `/uren`: mijn week.
 *
 * De medewerker kijkt terug, niet vooruit (onderzoek §1): zeven dagbalken
 * onder elkaar, per dag de indienstatus als tekst, en alles wat kantoor aan
 * zijn dagen deed zichtbaar gemarkeerd — transparantie uit het logboek
 * voorkomt loonstrook-discussies. Invoer blijft in `/veld`; hier staat alleen
 * de vraag "staat alles erin en is het ingediend?".
 *
 * De weekkeuze deelt `?week=` met de Controlekamer (`useWeekKeuze`), dus een
 * gedeelde link werkt in elk gezicht.
 */

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  MessageSquareText,
} from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { REVEAL_KLASSE } from "@/components/pagina-reveal";
import { cn } from "@/lib/utils";
import { DagbalkRij } from "./dagbalk-rij";
import { gedeeldeAs } from "./film";
import { dagLabelLang, useWeekKeuze, weekLabelVan } from "./week";

type MijnWeek = NonNullable<
  FunctionReturnType<typeof api.urenControle.getMijnWeek>
>;
type WeekCorrectie = MijnWeek["correcties"][number];

/** Logboek-acties in het Nederlands — zelfde woorden als de daginspector. */
const CORRECTIE_LABEL: Record<string, string> = {
  dag_heropend: "heropend",
  segment_gecorrigeerd: "gecorrigeerd",
  dag_akkoord: "akkoord bevonden",
};

/**
 * De kopzin van de week: hoeveel van de gevulde dagen zijn ingediend. Pure
 * functie, dus de formulering is te testen zonder de pagina te renderen.
 */
export function mijnWeekZin(
  dagen: { status: "open" | "ingediend"; segmenten: unknown[] }[]
): string {
  const gevuld = dagen.filter(
    (dag) => dag.segmenten.length > 0 || dag.status === "ingediend"
  );
  const ingediend = gevuld.filter((dag) => dag.status === "ingediend").length;
  const open = gevuld.length - ingediend;
  if (gevuld.length === 0) return "nog geen uren deze week";
  if (open === 0)
    return ingediend === 1
      ? "je enige dag is ingediend"
      : `alle ${ingediend} dagen zijn ingediend`;
  return open === 1 ? "1 dag staat nog open" : `${open} dagen staan nog open`;
}

export function MijnWeekGezicht() {
  const { weekStart, kiesWeek, schuif, isDezeWeek } = useWeekKeuze();
  const week = useQuery(api.urenControle.getMijnWeek, { weekStart });

  const as = useMemo(() => gedeeldeAs(week?.dagen ?? []), [week]);

  /** Kantoor-acties per datum, voor de markering op de dagregel. */
  const correctiesPerDag = useMemo(() => {
    const kaart = new Map<string, string[]>();
    for (const correctie of week?.correcties ?? []) {
      const label = CORRECTIE_LABEL[correctie.actie] ?? correctie.actie;
      const bestaand = kaart.get(correctie.datum);
      if (bestaand) {
        if (!bestaand.includes(label)) bestaand.push(label);
      } else {
        kaart.set(correctie.datum, [label]);
      }
    }
    return kaart;
  }, [week]);

  const weekLabel = week?.weekLabel ?? weekLabelVan(weekStart);

  return (
    <div className={cn("flex flex-1 flex-col gap-5 p-4 md:p-8", REVEAL_KLASSE)}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-[19px] leading-7 font-semibold tracking-tight">
            {weekLabel}
            {week && (
              <span className="font-normal text-muted-foreground">
                {" — "}
                {mijnWeekZin(week.dagen)}
              </span>
            )}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Je eigen week: per dag de balk, de status en wat kantoor eventueel
            heeft aangepast. Invullen en indienen doe je op het Veld-scherm.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => schuif(-1)}
            aria-label="Vorige week"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 font-normal"
            onClick={() => kiesWeek(weekStart)}
            disabled={isDezeWeek}
          >
            Deze week
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => schuif(1)}
            aria-label="Volgende week"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      {week === undefined ? (
        <MijnWeekSkelet />
      ) : week === null ? (
        <GeenKoppeling />
      ) : (
        <div className="flex flex-col gap-4">
          <SectiePaneel
            kopbalk
            titel="Jouw week"
            icoon={<CalendarRange aria-hidden />}
          >
            <div className="divide-y divide-border/70">
              {week.dagen.map((dag, i) => {
                const correcties = correctiesPerDag.get(dag.datum);
                return (
                  <DagbalkRij
                    key={dag.datum}
                    label={dagLabelLang(dag.datum)}
                    balkLabel={dagLabelLang(dag.datum)}
                    segmenten={dag.segmenten}
                    asVanMinuten={as.asVanMinuten}
                    asTotMinuten={as.asTotMinuten}
                    uren={dag.totaalUren}
                    status={dag.status}
                    metAs={i === week.dagen.length - 1}
                    meta={
                      correcties && (
                        <span className="font-medium text-status-verzonden-text">
                          Kantoor: {correcties.join(" · ")}
                        </span>
                      )
                    }
                  />
                );
              })}
            </div>
          </SectiePaneel>

          <SectiePaneel
            kopbalk
            titel="Wat kantoor deed"
            icoon={<MessageSquareText aria-hidden />}
            uitleg="Alles wat kantoor met jouw dagen deed, uit het logboek: heropend, gecorrigeerd of akkoord bevonden. Zo zie je precies wat er met je uren gebeurd is."
            {...(week.correcties.length === 0
              ? {
                  legeRegel: {
                    tekst: "Kantoor heeft niets aan je week veranderd.",
                  },
                }
              : {})}
          >
            {week.correcties.length > 0 && (
              <ol className="divide-y divide-border/70">
                {week.correcties.map((correctie, i) => (
                  <CorrectieRegel key={i} correctie={correctie} />
                ))}
              </ol>
            )}
          </SectiePaneel>

          <div>
            <Button asChild size="sm" variant="outline" className="h-8">
              <Link href="/veld">Naar Veld</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CorrectieRegel({ correctie }: { correctie: WeekCorrectie }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-[13px]">
      <time dateTime={correctie.datum} className="shrink-0 text-xs text-muted-foreground">
        {dagLabelLang(correctie.datum)}
      </time>
      <span className="shrink-0 font-medium">
        {CORRECTIE_LABEL[correctie.actie] ?? correctie.actie}
      </span>
      <span className="min-w-0 flex-1 text-muted-foreground">
        {correctie.details}
      </span>
    </li>
  );
}

/**
 * `getMijnWeek` geeft `null` als het account niet aan een medewerker hangt.
 * Voor een veldrol is dat een instellingskwestie — benoem hem eerlijk.
 */
function GeenKoppeling() {
  return (
    <SectiePaneel
      kopbalk
      titel="Nog geen medewerker-koppeling"
      icoon={<CalendarRange aria-hidden />}
    >
      <div className="flex flex-col gap-3 px-3 py-3">
        <p className="max-w-[58ch] text-[13px] text-pretty text-muted-foreground">
          Je account is nog niet gekoppeld aan een medewerker, dus er is geen
          eigen week om te tonen. Vraag kantoor om de koppeling te leggen; je
          uren invoeren kan daarna gewoon op het Veld-scherm.
        </p>
        <div>
          <Button asChild size="sm" className="h-8">
            <Link href="/veld">Naar Veld</Link>
          </Button>
        </div>
      </div>
    </SectiePaneel>
  );
}

function MijnWeekSkelet() {
  return (
    <div
      className="flex flex-col gap-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Week laden…</span>
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2.5">
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="flex flex-col gap-3 p-3">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-[10px] w-full rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
