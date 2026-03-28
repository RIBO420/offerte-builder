"use client";

import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  Clock,
  FolderKanban,
} from "lucide-react";
import { getCapaciteitKleur } from "./capaciteit-indicator";
import { cn } from "@/lib/utils";

const MAAND_NAMEN = [
  "Januari",
  "Februari",
  "Maart",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Augustus",
  "September",
  "Oktober",
  "November",
  "December",
];

const MAAND_KORT = [
  "Jan",
  "Feb",
  "Mrt",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dec",
];

interface JaarOverzichtProps {
  initialYear?: number;
  onNavigateToMonth?: (year: number, month: number) => void;
}

// Month card in the year grid
const MaandKaart = React.memo(function MaandKaart({
  naam,
  geplandeUren,
  beschikbareUren,
  bezetting,
  aantalProjecten,
  isHuidigeMaand,
  onClick,
}: {
  naam: string;
  geplandeUren: number;
  beschikbareUren: number;
  bezetting: number;
  aantalProjecten: number;
  isHuidigeMaand: boolean;
  onClick: () => void;
}) {
  const kleuren = getCapaciteitKleur(bezetting);

  return (
    <button
      onClick={onClick}
      className="text-left w-full"
    >
      <Card
        className={cn(
          "transition-all hover:shadow-md cursor-pointer h-full",
          isHuidigeMaand && "ring-2 ring-primary"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm">{naam}</h3>
            {isHuidigeMaand && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                Nu
              </Badge>
            )}
          </div>

          {/* Heat map bar */}
          <div className="mb-3">
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", kleuren.fill)}
                style={{ width: `${Math.min(bezetting, 100)}%` }}
              />
            </div>
          </div>

          {/* Bezetting percentage */}
          <div className="flex items-center justify-between mb-2">
            <span className={cn("text-2xl font-bold", kleuren.text)}>
              {bezetting}%
            </span>
            <Badge variant="secondary" className={cn("text-xs", kleuren.bg, kleuren.text)}>
              {kleuren.label}
            </Badge>
          </div>

          {/* Stats */}
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Uren
              </span>
              <span>{geplandeUren} / {beschikbareUren}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <FolderKanban className="h-3 w-3" />
                Projecten
              </span>
              <span>{aantalProjecten}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
});

export function JaarOverzicht({
  initialYear,
  onNavigateToMonth,
}: JaarOverzichtProps) {
  const now = new Date();
  const [year, setYear] = useState(initialYear ?? now.getFullYear());

  const data = useQuery(api.weekPlanning.getCapacityOverview, { year });

  const prevYear = () => setYear(year - 1);
  const nextYear = () => setYear(year + 1);
  const goToHuidigJaar = () => setYear(now.getFullYear());

  const huidigeMaand = now.getMonth() + 1;
  const isHuidigJaar = year === now.getFullYear();

  // Year totals
  const totaalGepland = data?.maanden?.reduce((s, m) => s + m.geplandeUren, 0) ?? 0;
  const totaalBeschikbaar = data?.maanden?.reduce((s, m) => s + m.beschikbareUren, 0) ?? 0;
  const jaarBezetting =
    totaalBeschikbaar > 0
      ? Math.round((totaalGepland / totaalBeschikbaar) * 100)
      : 0;
  // Note: project counts per month may overlap across months

  if (data === undefined) {
    return <JaarOverzichtSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevYear} aria-label="Vorig jaar">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[100px] text-center">
            {year}
          </h2>
          <Button variant="outline" size="icon" onClick={nextYear} aria-label="Volgend jaar">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={goToHuidigJaar}>
          Huidig jaar
        </Button>
      </div>

      {/* Year summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Jaarbezetting</p>
                <p className="text-2xl font-bold">{jaarBezetting}%</p>
              </div>
              <div
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center",
                  getCapaciteitKleur(jaarBezetting).bg
                )}
              >
                <Calendar className={cn("h-5 w-5", getCapaciteitKleur(jaarBezetting).text)} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Geplande Uren</p>
                <p className="text-2xl font-bold">{totaalGepland}u</p>
                <p className="text-xs text-muted-foreground">
                  van {totaalBeschikbaar}u beschikbaar
                </p>
              </div>
              <div className="h-10 w-10 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-950">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Medewerkers</p>
                <p className="text-2xl font-bold">{data.totaalMedewerkers}</p>
                <p className="text-xs text-muted-foreground">actief</p>
              </div>
              <div className="h-10 w-10 rounded-full flex items-center justify-center bg-purple-100 dark:bg-purple-950">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Month grid */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {data.maanden.map((maand) => (
          <MaandKaart
            key={maand.maand}
            naam={MAAND_NAMEN[maand.maand - 1]}
            geplandeUren={maand.geplandeUren}
            beschikbareUren={maand.beschikbareUren}
            bezetting={maand.bezetting}
            aantalProjecten={maand.aantalProjecten}
            isHuidigeMaand={isHuidigJaar && maand.maand === huidigeMaand}
            onClick={() => onNavigateToMonth?.(year, maand.maand)}
          />
        ))}
      </div>

      {/* Medewerker overview */}
      {data.medewerkers.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Uren per medewerker
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                      Medewerker
                    </th>
                    {MAAND_KORT.map((naam) => (
                      <th
                        key={naam}
                        className="text-center py-2 px-1 font-medium text-muted-foreground text-xs"
                      >
                        {naam}
                      </th>
                    ))}
                    <th className="text-right py-2 pl-4 font-medium text-muted-foreground">
                      Totaal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.medewerkers.map((mw) => {
                    const totaal = mw.urenPerMaand.reduce((s, u) => s + u, 0);
                    if (totaal === 0) return null;

                    return (
                      <tr key={mw.medewerkerId} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium truncate max-w-[150px]">
                          {mw.naam}
                        </td>
                        {mw.urenPerMaand.map((uren, idx) => {
                          const maandData = data.maanden[idx];
                          const maxUren = maandData?.beschikbareUren
                            ? maandData.beschikbareUren / data.totaalMedewerkers
                            : 0;
                          const mwBezetting =
                            maxUren > 0 ? Math.round((uren / maxUren) * 100) : 0;
                          const kleuren =
                            uren > 0 ? getCapaciteitKleur(mwBezetting) : null;

                          return (
                            <td
                              key={idx}
                              className={cn(
                                "text-center py-2 px-1 text-xs",
                                kleuren && kleuren.bg,
                                kleuren && kleuren.text
                              )}
                            >
                              {uren > 0 ? `${uren}u` : "-"}
                            </td>
                          );
                        })}
                        <td className="text-right py-2 pl-4 font-medium">
                          {totaal}u
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info */}
      {data.totaalMedewerkers > 0 && (
        <p className="text-xs text-muted-foreground">
          Berekend op basis van {data.totaalMedewerkers} actieve medewerkers, 8 uur per dag, exclusief weekenden.
        </p>
      )}
    </div>
  );
}

function JaarOverzichtSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-9 w-9" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-3">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-3" />
              <Skeleton className="h-2 w-full mb-3" />
              <Skeleton className="h-8 w-12 mb-2" />
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
