"use client";

import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Users, Clock, TrendingUp } from "lucide-react";
import { CapaciteitIndicator, getCapaciteitKleur } from "./capaciteit-indicator";
import { cn } from "@/lib/utils";

const KWARTAAL_LABELS = ["Q1 (Jan - Mrt)", "Q2 (Apr - Jun)", "Q3 (Jul - Sep)", "Q4 (Okt - Dec)"];

interface KwartaalOverzichtProps {
  initialYear?: number;
  initialQuarter?: number;
}

// Week row in the quarter table
const WeekRij = React.memo(function WeekRij({
  weekNummer,
  startDatum,
  aantalTaken,
  geplandeUren,
  bezetting,
  aantalMedewerkers,
}: {
  weekNummer: number;
  startDatum: string;
  aantalTaken: number;
  geplandeUren: number;
  bezetting: number;
  aantalMedewerkers: number;
}) {
  const kleuren = getCapaciteitKleur(bezetting);

  // Format startDatum for display
  const datum = new Date(startDatum + "T00:00:00");
  const datumLabel = datum.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });

  return (
    <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors">
      {/* Week number & date */}
      <div className="w-28 shrink-0">
        <span className="text-sm font-medium">Week {weekNummer}</span>
        <p className="text-xs text-muted-foreground">{datumLabel}</p>
      </div>

      {/* Capacity bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", kleuren.fill)}
              style={{ width: `${Math.min(bezetting, 100)}%` }}
            />
          </div>
          <span className={cn("text-xs font-medium w-10 text-right", kleuren.text)}>
            {bezetting}%
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
        <span className="flex items-center gap-1" title="Geplande uren">
          <Clock className="h-3 w-3" />
          {geplandeUren}u
        </span>
        <span className="flex items-center gap-1" title="Medewerkers ingepland">
          <Users className="h-3 w-3" />
          {aantalMedewerkers}
        </span>
        <Badge variant="secondary" className="text-xs">
          {aantalTaken} taken
        </Badge>
      </div>
    </div>
  );
});

export function KwartaalOverzicht({
  initialYear,
  initialQuarter,
}: KwartaalOverzichtProps) {
  const now = new Date();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [quarter, setQuarter] = useState(initialQuarter ?? currentQuarter);

  const data = useQuery(api.weekPlanning.listByQuarter, { year, quarter });

  const prevQuarter = () => {
    if (quarter === 1) {
      setYear(year - 1);
      setQuarter(4);
    } else {
      setQuarter(quarter - 1);
    }
  };

  const nextQuarter = () => {
    if (quarter === 4) {
      setYear(year + 1);
      setQuarter(1);
    } else {
      setQuarter(quarter + 1);
    }
  };

  const goToHuidigKwartaal = () => {
    setYear(now.getFullYear());
    setQuarter(currentQuarter);
  };

  // Summary stats
  const totaalUren = data?.weken?.reduce((s, w) => s + w.geplandeUren, 0) ?? 0;
  const totaalBeschikbaar = data?.weken?.reduce((s, w) => s + w.beschikbareUren, 0) ?? 0;
  const gemiddeldeBezetting =
    totaalBeschikbaar > 0
      ? Math.round((totaalUren / totaalBeschikbaar) * 100)
      : 0;
  const totaalTaken = data?.weken?.reduce((s, w) => s + w.aantalTaken, 0) ?? 0;

  if (data === undefined) {
    return <KwartaalOverzichtSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevQuarter}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[200px] text-center">
            {KWARTAAL_LABELS[quarter - 1]} {year}
          </h2>
          <Button variant="outline" size="icon" onClick={nextQuarter}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={goToHuidigKwartaal}>
          Huidig kwartaal
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Totaal Uren</p>
            <p className="text-xl font-bold">{totaalUren}u</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Beschikbaar</p>
            <p className="text-xl font-bold">{totaalBeschikbaar}u</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Gem. Bezetting</p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold">{gemiddeldeBezetting}%</p>
              <CapaciteitIndicator bezetting={gemiddeldeBezetting} variant="dot" showLabel={false} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Totaal Taken</p>
            <p className="text-xl font-bold">{totaalTaken}</p>
          </CardContent>
        </Card>
      </div>

      {/* Week list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Wekelijks overzicht
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.weken.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p className="text-sm">Geen planningsdata voor dit kwartaal</p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Header */}
              <div className="flex items-center gap-2 py-2 px-3 text-xs font-medium text-muted-foreground border-b">
                <div className="w-28 shrink-0">Week</div>
                <div className="flex-1">Capaciteit</div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="w-12 text-center">Uren</span>
                  <span className="w-8 text-center">Team</span>
                  <span className="w-16 text-center">Taken</span>
                </div>
              </div>

              {data.weken.map((week) => (
                <WeekRij
                  key={week.weekNummer}
                  weekNummer={week.weekNummer}
                  startDatum={week.startDatum}
                  aantalTaken={week.aantalTaken}
                  geplandeUren={week.geplandeUren}
                  bezetting={week.bezetting}
                  aantalMedewerkers={week.aantalMedewerkers}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team info */}
      {data.totaalMedewerkers > 0 && (
        <p className="text-xs text-muted-foreground">
          Berekend op basis van {data.totaalMedewerkers} actieve medewerkers, 8 uur per dag, 5 werkdagen per week.
        </p>
      )}
    </div>
  );
}

function KwartaalOverzichtSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-9 w-9" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-3">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-6 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 mb-2" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
