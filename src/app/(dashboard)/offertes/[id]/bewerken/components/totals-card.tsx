"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "./utils";
import type { Totals } from "./types";

interface TotalsCardProps {
  totals: Totals;
  btwPercentage?: number;
}

export function TotalsCard({ totals, btwPercentage }: TotalsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Totalen (preview)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Materiaalkosten</span>
          <span>{formatCurrency(totals.materiaalkosten)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Arbeidskosten</span>
          <span>{formatCurrency(totals.arbeidskosten)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">
            ({totals.totaalUren} uur)
          </span>
        </div>
        <Separator />
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotaal</span>
          <span>{formatCurrency(totals.subtotaal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            Marge ({totals.margePercentage}%)
          </span>
          <span>{formatCurrency(totals.marge)}</span>
        </div>
        <Separator />
        <div className="flex justify-between font-medium">
          <span>Totaal excl. BTW</span>
          <span>{formatCurrency(totals.totaalExBtw)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            BTW ({btwPercentage || 21}%)
          </span>
          <span>{formatCurrency(totals.btw)}</span>
        </div>
        <Separator />
        <div className="flex justify-between text-base font-bold">
          <span>Totaal incl. BTW</span>
          <span>{formatCurrency(totals.totaalInclBtw)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
