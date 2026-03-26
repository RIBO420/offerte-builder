"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";

type VerlofAanvraag = {
  _id: string;
  medewerkerId: string;
  medewerkerNaam: string;
  startDatum: string;
  eindDatum: string;
  aantalDagen: number;
  type: "vakantie" | "bijzonder" | "onbetaald" | "compensatie";
  status: "aangevraagd" | "goedgekeurd" | "afgekeurd";
};

const TYPE_COLORS: Record<string, string> = {
  vakantie: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  bijzonder:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  onbetaald:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  compensatie:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const STATUS_COLORS: Record<string, string> = {
  aangevraagd:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  goedgekeurd:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  afgekeurd: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

interface VerlofKalenderProps {
  aanvragen: VerlofAanvraag[];
  maand: number; // 0-11
  jaar: number;
}

export function VerlofKalender({
  aanvragen,
  maand,
  jaar,
}: VerlofKalenderProps) {
  const kalenderData = useMemo(() => {
    const eerstedag = new Date(jaar, maand, 1);
    const laatstedag = new Date(jaar, maand + 1, 0);
    const startPad = eerstedag.getDay() === 0 ? 6 : eerstedag.getDay() - 1; // Monday=0
    const aantalDagen = laatstedag.getDate();

    // Build map of verlof per day
    const verlofPerDag: Record<number, VerlofAanvraag[]> = {};
    for (let dag = 1; dag <= aantalDagen; dag++) {
      const datumStr = `${jaar}-${String(maand + 1).padStart(2, "0")}-${String(dag).padStart(2, "0")}`;
      const dagAanvragen = aanvragen.filter(
        (a) =>
          a.status !== "afgekeurd" &&
          a.startDatum <= datumStr &&
          a.eindDatum >= datumStr
      );
      if (dagAanvragen.length > 0) {
        verlofPerDag[dag] = dagAanvragen;
      }
    }

    return { startPad, aantalDagen, verlofPerDag };
  }, [aanvragen, maand, jaar]);

  const maandNamen = [
    "Januari", "Februari", "Maart", "April", "Mei", "Juni",
    "Juli", "Augustus", "September", "Oktober", "November", "December",
  ];

  const dagNamen = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          {maandNamen[maand]} {jaar}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Header row */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dagNamen.map((dag) => (
            <div
              key={dag}
              className="text-center text-xs font-medium text-muted-foreground py-1"
            >
              {dag}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Padding for first week */}
          {Array.from({ length: kalenderData.startPad }).map((_, i) => (
            <div key={`pad-${i}`} className="h-16" />
          ))}

          {/* Days */}
          {Array.from({ length: kalenderData.aantalDagen }).map((_, i) => {
            const dag = i + 1;
            const verlof = kalenderData.verlofPerDag[dag];
            const isWeekend = (() => {
              const d = new Date(jaar, maand, dag);
              return d.getDay() === 0 || d.getDay() === 6;
            })();

            return (
              <div
                key={dag}
                className={`h-16 rounded-md border p-1 text-xs overflow-hidden ${
                  isWeekend
                    ? "bg-muted/30 text-muted-foreground"
                    : "bg-background"
                } ${verlof ? "border-primary/30" : ""}`}
              >
                <div className="font-medium mb-0.5">{dag}</div>
                {verlof?.slice(0, 2).map((a) => (
                  <div
                    key={a._id}
                    className={`truncate rounded px-1 text-[10px] leading-tight mb-0.5 ${TYPE_COLORS[a.type] ?? ""}`}
                    title={`${a.medewerkerNaam} — ${a.type}`}
                  >
                    {a.medewerkerNaam.split(" ")[0]}
                  </div>
                ))}
                {verlof && verlof.length > 2 && (
                  <div className="text-[10px] text-muted-foreground">
                    +{verlof.length - 2}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 mt-3">
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <Badge key={type} variant="outline" className={`text-xs ${color}`}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export { STATUS_COLORS, TYPE_COLORS };
