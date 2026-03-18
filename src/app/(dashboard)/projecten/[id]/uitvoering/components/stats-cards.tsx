"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Clock,
  Users,
  Calendar,
  Wrench,
  Loader2,
} from "lucide-react";
import { formatCurrency } from "./utils";

interface StatsCardsProps {
  isLoading: boolean | null | undefined;
  urenTotals: {
    totaalUren: number;
    perMedewerker: Record<string, number>;
    perDatum: Record<string, number>;
  };
  machineTotals: {
    totaalKosten: number;
  };
}

export function StatsCards({ isLoading, urenTotals, machineTotals }: StatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Totaal uren</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <div className="text-2xl font-bold">
                {urenTotals.totaalUren.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground">
                geregistreerde uren
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Medewerkers</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <div className="text-2xl font-bold">
                {Object.keys(urenTotals.perMedewerker).length}
              </div>
              <p className="text-xs text-muted-foreground">
                hebben gewerkt
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Werkdagen</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <div className="text-2xl font-bold">
                {Object.keys(urenTotals.perDatum).length}
              </div>
              <p className="text-xs text-muted-foreground">
                geregistreerd
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Machine kosten
          </CardTitle>
          <Wrench className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <div className="text-2xl font-bold">
                {formatCurrency(machineTotals.totaalKosten)}
              </div>
              <p className="text-xs text-muted-foreground">
                totaal
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
