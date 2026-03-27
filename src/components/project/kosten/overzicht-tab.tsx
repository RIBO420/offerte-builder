"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, Users, Wrench, MoreHorizontal } from "lucide-react";
import { SummaryCard } from "./summary-card";
import { formatCurrency, type KostenDisplayData } from "./helpers";

interface ScopeTotaal {
  scope: string;
  scopeLabel: string;
  werkelijk: number;
  uren: number;
}

interface OverzichtStats {
  werkelijkeDagen: number;
  aantalMedewerkers: number;
  gemiddeldeKostenPerDag: number;
}

interface OverzichtTabProps {
  displayData: KostenDisplayData | null;
  scopeTotals: ScopeTotaal[];
  overzicht: {
    totalen: { uren: number };
    statistieken: OverzichtStats;
  } | null;
}

export function OverzichtTab({ displayData, scopeTotals, overzicht }: OverzichtTabProps) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {displayData && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Materiaal"
            gepland={displayData.geplandeKosten.materiaal}
            werkelijk={displayData.werkelijkeKosten.materiaal}
            afwijking={displayData.afwijking.materiaal}
            afwijkingPercentage={displayData.afwijkingPercentage.materiaal}
            icon={Package}
            iconColor="bg-blue-500"
          />
          <SummaryCard
            title="Arbeid"
            gepland={displayData.geplandeKosten.arbeid}
            werkelijk={displayData.werkelijkeKosten.arbeid}
            afwijking={displayData.afwijking.arbeid}
            afwijkingPercentage={displayData.afwijkingPercentage.arbeid}
            icon={Users}
            iconColor="bg-green-500"
          />
          <SummaryCard
            title="Machine"
            gepland={displayData.geplandeKosten.machine}
            werkelijk={displayData.werkelijkeKosten.machine}
            afwijking={displayData.afwijking.machine}
            afwijkingPercentage={displayData.afwijkingPercentage.machine}
            icon={Wrench}
            iconColor="bg-orange-500"
          />
          <SummaryCard
            title="Overig"
            gepland={0}
            werkelijk={displayData.werkelijkeKosten.overig}
            afwijking={displayData.werkelijkeKosten.overig}
            afwijkingPercentage={0}
            icon={MoreHorizontal}
            iconColor="bg-gray-500"
          />
        </div>
      )}

      {/* Scope Totals */}
      {scopeTotals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Kosten per Scope</CardTitle>
            <CardDescription>
              Overzicht van kosten per werkgebied
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scope</TableHead>
                    <TableHead className="text-right">Uren</TableHead>
                    <TableHead className="text-right">Werkelijk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scopeTotals.map((scope) => (
                    <TableRow key={scope.scope}>
                      <TableCell className="font-medium">{scope.scopeLabel}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {scope.uren.toFixed(1)} uur
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(scope.werkelijk)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics from overzicht */}
      {overzicht && (
        <Card>
          <CardHeader>
            <CardTitle>Statistieken</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{overzicht.statistieken.werkelijkeDagen}</p>
                <p className="text-xs text-muted-foreground">Werkdagen</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{overzicht.statistieken.aantalMedewerkers}</p>
                <p className="text-xs text-muted-foreground">Medewerkers</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{overzicht.totalen.uren.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Totaal uren</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{formatCurrency(overzicht.statistieken.gemiddeldeKostenPerDag)}</p>
                <p className="text-xs text-muted-foreground">Gem. per dag</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
