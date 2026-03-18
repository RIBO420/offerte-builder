"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  Wrench,
} from "lucide-react";
import { scopeLabels, formatCurrency } from "./utils";

interface OverzichtTabProps {
  urenTotals: {
    perMedewerker: Record<string, number>;
    perScope: Record<string, number>;
  };
  machineTotals: {
    totaalKosten: number;
    perMachine: Record<string, { naam: string; uren: number; kosten: number }>;
  };
}

export function OverzichtTab({ urenTotals, machineTotals }: OverzichtTabProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Uren per medewerker */}
      <Card>
        <CardHeader>
          <CardTitle>Uren per medewerker</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.entries(urenTotals.perMedewerker).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(urenTotals.perMedewerker)
                .sort(([, a], [, b]) => b - a)
                .map(([medewerker, uren]) => (
                  <div
                    key={medewerker}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{medewerker}</span>
                    </div>
                    <span className="font-medium">
                      {uren.toFixed(1)} uur
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nog geen registraties
            </p>
          )}
        </CardContent>
      </Card>

      {/* Uren per scope */}
      <Card>
        <CardHeader>
          <CardTitle>Uren per scope</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.entries(urenTotals.perScope).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(urenTotals.perScope)
                .sort(([, a], [, b]) => b - a)
                .map(([scope, uren]) => (
                  <div
                    key={scope}
                    className="flex items-center justify-between"
                  >
                    <Badge variant="outline">
                      {scopeLabels[scope] || scope}
                    </Badge>
                    <span className="font-medium">
                      {uren.toFixed(1)} uur
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Geen scopes geregistreerd
            </p>
          )}
        </CardContent>
      </Card>

      {/* Machine kosten overzicht */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Machine kosten overzicht</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.entries(machineTotals.perMachine).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(machineTotals.perMachine)
                .sort(([, a], [, b]) => b.kosten - a.kosten)
                .map(([id, data]) => (
                  <div
                    key={id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      <span>{data.naam}</span>
                      <span className="text-muted-foreground text-sm">
                        ({data.uren.toFixed(1)} uur)
                      </span>
                    </div>
                    <span className="font-medium">
                      {formatCurrency(data.kosten)}
                    </span>
                  </div>
                ))}
              <Separator />
              <div className="flex items-center justify-between font-medium">
                <span>Totaal machine kosten</span>
                <span>{formatCurrency(machineTotals.totaalKosten)}</span>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nog geen machine gebruik
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
