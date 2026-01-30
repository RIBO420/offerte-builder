"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Euro, FileText, Target } from "lucide-react";

interface KpiCardsProps {
  kpis: {
    winRate: number;
    gemiddeldeWaarde: number;
    totaleOmzet: number;
    totaalOffertes: number;
    geaccepteerdCount: number;
    afgewezenCount: number;
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function KpiCards({ kpis }: KpiCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Win Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Win Rate
          </CardTitle>
          <Target className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {kpis.winRate}%
          </div>
          <p className="text-xs text-muted-foreground">
            {kpis.geaccepteerdCount} gewonnen van {kpis.geaccepteerdCount + kpis.afgewezenCount} afgehandeld
          </p>
        </CardContent>
      </Card>

      {/* Gemiddelde Waarde */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Gem. Offerte Waarde
          </CardTitle>
          <Euro className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(kpis.gemiddeldeWaarde)}
          </div>
          <p className="text-xs text-muted-foreground">
            Over {kpis.totaalOffertes} offertes
          </p>
        </CardContent>
      </Card>

      {/* Totale Omzet */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Totale Omzet
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-amber-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">
            {formatCurrency(kpis.totaleOmzet)}
          </div>
          <p className="text-xs text-muted-foreground">
            Geaccepteerde offertes
          </p>
        </CardContent>
      </Card>

      {/* Aantal Offertes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Aantal Offertes
          </CardTitle>
          <FileText className="h-4 w-4 text-gray-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {kpis.totaalOffertes}
          </div>
          <p className="text-xs text-muted-foreground">
            In geselecteerde periode
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
