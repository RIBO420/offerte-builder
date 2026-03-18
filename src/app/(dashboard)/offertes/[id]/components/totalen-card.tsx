"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MargeIndicator } from "@/components/ui/marge-indicator";
import { PriceBreakdownChart } from "@/components/ui/price-breakdown-chart";
import { PriceDisplay } from "@/components/ui/price-display";

interface TotalenCardProps {
  totalen: {
    materiaalkosten: number;
    arbeidskosten: number;
    totaalUren: number;
    subtotaal: number;
    marge: number;
    margePercentage: number;
    totaalExBtw: number;
    btw: number;
    totaalInclBtw: number;
  };
}

export function TotalenCard({ totalen }: TotalenCardProps) {
  return (
    <Card variant="elevated">
      <CardHeader className="pb-3">
        <CardTitle>Totalen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Marge Indicator */}
        <MargeIndicator
          percentage={totalen.margePercentage}
          size="md"
          showTarget={true}
        />

        <Separator />

        {/* Price Breakdown Chart */}
        <PriceBreakdownChart
          materialen={totalen.materiaalkosten}
          arbeid={totalen.arbeidskosten}
          marge={totalen.marge}
          btw={totalen.btw}
          showLabels={true}
          showValues={false}
        />

        <Separator />

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Materiaalkosten</span>
          <PriceDisplay amount={totalen.materiaalkosten} size="sm" animated />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Arbeidskosten</span>
          <PriceDisplay amount={totalen.arbeidskosten} size="sm" animated />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">
            ({totalen.totaalUren} uur)
          </span>
        </div>
        <Separator />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotaal</span>
          <PriceDisplay amount={totalen.subtotaal} size="sm" animated />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Marge ({totalen.margePercentage}%)
          </span>
          <PriceDisplay amount={totalen.marge} size="sm" animated />
        </div>
        <Separator />
        <div className="flex justify-between font-medium">
          <span>Totaal excl. BTW</span>
          <PriceDisplay amount={totalen.totaalExBtw} size="md" animated />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">BTW (21%)</span>
          <PriceDisplay amount={totalen.btw} size="sm" variant="muted" animated />
        </div>
        <Separator />
        <div className="flex justify-between items-center pt-2">
          <span className="text-lg font-bold text-primary">Totaal incl. BTW</span>
          <PriceDisplay
            amount={totalen.totaalInclBtw}
            size="xl"
            variant="success"
            animated
          />
        </div>
      </CardContent>
    </Card>
  );
}
