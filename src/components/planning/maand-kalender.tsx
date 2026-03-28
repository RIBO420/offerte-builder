"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
  X,
} from "lucide-react";
import {
  CapaciteitIndicator,
  getCapaciteitKleur,
} from "./capaciteit-indicator";
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

const DAG_NAMEN = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

interface MaandKalenderProps {
  initialYear?: number;
  initialMonth?: number;
}

interface DagDetail {
  datum: string;
  taken: Array<{
    _id: string;
    datum: string;
    uren: number | undefined;
    medewerkerId: string;
    projectId: string;
    medewerkerNaam: string;
    projectNaam: string;
    projectStatus?: string;
  }>;
  aantalTaken: number;
  uren: number;
  beschikbareUren: number;
  medewerkers: string[];
}

// Calendar day cell
const KalenderCel = React.memo(function KalenderCel({
  dag,
  isVandaag,
  isWeekend,
  dagData,
  onClick,
  isSelected,
}: {
  dag: number;
  isVandaag: boolean;
  isWeekend: boolean;
  dagData: DagDetail | null;
  onClick: () => void;
  isSelected: boolean;
}) {
  const bezetting =
    dagData && dagData.beschikbareUren > 0
      ? Math.round((dagData.uren / dagData.beschikbareUren) * 100)
      : 0;
  const kleuren = dagData ? getCapaciteitKleur(bezetting) : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-start p-1.5 sm:p-2 min-h-[60px] sm:min-h-[80px] border rounded-md text-left transition-colors",
        isWeekend && "bg-muted/30",
        isVandaag && "ring-2 ring-primary",
        isSelected && "ring-2 ring-primary bg-primary/5",
        dagData && dagData.aantalTaken > 0
          ? "hover:bg-accent/50 cursor-pointer"
          : "hover:bg-muted/20 cursor-default",
        !dagData && "opacity-60"
      )}
    >
      <span
        className={cn(
          "text-xs sm:text-sm font-medium",
          isVandaag && "text-primary font-bold",
          isWeekend && "text-muted-foreground"
        )}
      >
        {dag}
      </span>

      {dagData && dagData.aantalTaken > 0 && (
        <div className="mt-1 w-full space-y-0.5">
          <div className="flex items-center gap-1">
            <span
              className={cn("h-1.5 w-1.5 rounded-full", kleuren?.fill)}
            />
            <span className="text-[10px] sm:text-xs text-muted-foreground truncate">
              {dagData.aantalTaken} {dagData.aantalTaken === 1 ? "taak" : "taken"}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground">
            <Users className="h-2.5 w-2.5" />
            <span>{dagData.medewerkers.length}</span>
          </div>
        </div>
      )}
    </button>
  );
});

// Day detail panel
function DagDetailPanel({
  dagData,
  onClose,
}: {
  dagData: DagDetail;
  onClose: () => void;
}) {
  const bezetting =
    dagData.beschikbareUren > 0
      ? Math.round((dagData.uren / dagData.beschikbareUren) * 100)
      : 0;

  // Format date for display
  const datum = new Date(dagData.datum + "T00:00:00");
  const dagLabel = datum.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Group tasks by project
  const perProject: Record<string, { projectNaam: string; taken: typeof dagData.taken }> = {};
  for (const taak of dagData.taken) {
    if (!perProject[taak.projectId]) {
      perProject[taak.projectId] = { projectNaam: taak.projectNaam, taken: [] };
    }
    perProject[taak.projectId].taken.push(taak);
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base capitalize">{dagLabel}</CardTitle>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {dagData.uren}u gepland
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {dagData.medewerkers.length} medewerkers
              </span>
              <CapaciteitIndicator bezetting={bezetting} variant="badge" />
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Sluiten">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Object.entries(perProject).map(([projectId, { projectNaam, taken }]) => (
            <div key={projectId} className="border rounded-lg p-3">
              <h4 className="font-medium text-sm mb-2">{projectNaam}</h4>
              <div className="space-y-1">
                {taken.map((taak) => (
                  <div
                    key={taak._id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">
                      {taak.medewerkerNaam}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {taak.uren ?? 8}u
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function MaandKalender({
  initialYear,
  initialMonth,
}: MaandKalenderProps) {
  const now = new Date();
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [month, setMonth] = useState(initialMonth ?? now.getMonth() + 1);
  const [selectedDag, setSelectedDag] = useState<string | null>(null);

  const data = useQuery(api.weekPlanning.listByMonth, { year, month });

  // Navigate months
  const prevMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
    setSelectedDag(null);
  };

  const nextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
    setSelectedDag(null);
  };

  const goToToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setSelectedDag(null);
  };

  // Build calendar grid
  const kalenderDagen = useMemo(() => {
    const eersteVanMaand = new Date(year, month - 1, 1);
    // Monday = 0, Sunday = 6 (ISO week style)
    let startDag = eersteVanMaand.getDay() - 1;
    if (startDag < 0) startDag = 6;

    const dagenInMaand = new Date(year, month, 0).getDate();
    const weken: Array<Array<{ dag: number; datum: string } | null>> = [];
    let huidigeWeek: Array<{ dag: number; datum: string } | null> = [];

    // Empty cells before first day
    for (let i = 0; i < startDag; i++) {
      huidigeWeek.push(null);
    }

    for (let dag = 1; dag <= dagenInMaand; dag++) {
      const datumStr = `${year}-${String(month).padStart(2, "0")}-${String(dag).padStart(2, "0")}`;
      huidigeWeek.push({ dag, datum: datumStr });

      if (huidigeWeek.length === 7) {
        weken.push(huidigeWeek);
        huidigeWeek = [];
      }
    }

    // Fill remaining cells
    if (huidigeWeek.length > 0) {
      while (huidigeWeek.length < 7) {
        huidigeWeek.push(null);
      }
      weken.push(huidigeWeek);
    }

    return weken;
  }, [year, month]);

  const vandaagStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const selectedDagData =
    selectedDag && data?.perDag?.[selectedDag]
      ? (data.perDag[selectedDag] as DagDetail)
      : null;

  if (data === undefined) {
    return <MaandKalenderSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} aria-label="Vorige maand">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[200px] text-center">
            {MAAND_NAMEN[month - 1]} {year}
          </h2>
          <Button variant="outline" size="icon" onClick={nextMonth} aria-label="Volgende maand">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={goToToday}>
          Vandaag
        </Button>
      </div>

      {/* Calendar grid */}
      <Card>
        <CardContent className="p-2 sm:p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAG_NAMEN.map((dag, i) => (
              <div
                key={dag}
                className={cn(
                  "text-center text-xs font-medium py-2",
                  i >= 5 ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {dag}
              </div>
            ))}
          </div>

          {/* Week rows */}
          {kalenderDagen.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 gap-1 mb-1">
              {week.map((cel, dagIdx) => {
                if (!cel) {
                  return <div key={dagIdx} className="min-h-[60px] sm:min-h-[80px]" />;
                }

                const dagData = data?.perDag?.[cel.datum] as DagDetail | undefined;

                return (
                  <KalenderCel
                    key={cel.datum}
                    dag={cel.dag}
                    isVandaag={cel.datum === vandaagStr}
                    isWeekend={dagIdx >= 5}
                    dagData={dagData ?? null}
                    isSelected={selectedDag === cel.datum}
                    onClick={() => {
                      if (dagData && dagData.aantalTaken > 0) {
                        setSelectedDag(
                          selectedDag === cel.datum ? null : cel.datum
                        );
                      }
                    }}
                  />
                );
              })}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Capacity legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="font-medium">Bezetting:</span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          {"< 70%"}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-yellow-500" />
          70-90%
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          {"> 90%"}
        </span>
      </div>

      {/* Selected day detail */}
      {selectedDagData && (
        <DagDetailPanel
          dagData={selectedDagData}
          onClose={() => setSelectedDag(null)}
        />
      )}
    </div>
  );
}

function MaandKalenderSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-9 w-9" />
        </div>
        <Skeleton className="h-8 w-20" />
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-[80px] rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
