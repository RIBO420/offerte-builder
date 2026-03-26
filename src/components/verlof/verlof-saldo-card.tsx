"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, Clock, CheckCircle2, AlertCircle } from "lucide-react";

interface VerlofsaldoProps {
  saldo: {
    jaar: number;
    jaarlijkseAanspraak: number;
    opgenomenDagen: number;
    gereserveerdDagen: number;
    restant: number;
    beschikbaar: number;
  } | null;
  isLoading: boolean;
}

export function VerlofSaldoCard({ saldo, isLoading }: VerlofsaldoProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-8 bg-muted rounded w-1/2" />
            <div className="h-2 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!saldo) return null;

  const percentage =
    saldo.jaarlijkseAanspraak > 0
      ? Math.round(
          (saldo.opgenomenDagen / saldo.jaarlijkseAanspraak) * 100
        )
      : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Verlofsaldo {saldo.jaar}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Opgenomen</span>
            <span className="font-medium">
              {saldo.opgenomenDagen} / {saldo.jaarlijkseAanspraak} dagen
            </span>
          </div>
          <Progress value={percentage} className="h-2" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center p-2 rounded-lg bg-muted/50">
            <CheckCircle2 className="h-4 w-4 text-green-600 mb-1" />
            <span className="text-lg font-semibold">{saldo.restant}</span>
            <span className="text-xs text-muted-foreground">Restant</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-muted/50">
            <Clock className="h-4 w-4 text-yellow-600 mb-1" />
            <span className="text-lg font-semibold">
              {saldo.gereserveerdDagen}
            </span>
            <span className="text-xs text-muted-foreground">Gereserveerd</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-muted/50">
            <AlertCircle
              className={`h-4 w-4 mb-1 ${saldo.beschikbaar <= 3 ? "text-red-600" : "text-blue-600"}`}
            />
            <span className="text-lg font-semibold">
              {saldo.beschikbaar}
            </span>
            <span className="text-xs text-muted-foreground">Beschikbaar</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
