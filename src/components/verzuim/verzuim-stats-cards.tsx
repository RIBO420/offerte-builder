"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Thermometer, TrendingDown, Users, Clock, AlertTriangle, Activity } from "lucide-react";

interface VerzuimStatsProps {
  stats: {
    jaar: number;
    aantalMeldingen: number;
    totaalDagen: number;
    uniekeMedewerkers: number;
    huidigZiek: number;
    gemiddeldeDuur: number;
    verzuimpercentage: number;
  } | null;
  frequentVerzuim: Array<{ medewerkerId: string; medewerkerNaam: string; aantalMeldingen: number }>;
  isLoading: boolean;
}

export function VerzuimStatsCards({ stats, frequentVerzuim, isLoading }: VerzuimStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4"><div className="animate-pulse space-y-2"><div className="h-3 bg-muted rounded w-2/3" /><div className="h-6 bg-muted rounded w-1/2" /></div></CardContent></Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Activity className="h-4 w-4" />Huidig ziek</div>
            <div className="text-2xl font-bold">{stats.huidigZiek}<span className="text-sm font-normal text-muted-foreground ml-1">medewerker{stats.huidigZiek !== 1 ? "s" : ""}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Thermometer className="h-4 w-4" />Verzuimpercentage</div>
            <div className="text-2xl font-bold">{stats.verzuimpercentage}%</div>
            <p className="text-xs text-muted-foreground">{stats.jaar}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><TrendingDown className="h-4 w-4" />Totaal ziektedagen</div>
            <div className="text-2xl font-bold">{stats.totaalDagen}</div>
            <p className="text-xs text-muted-foreground">{stats.aantalMeldingen} meldingen</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Clock className="h-4 w-4" />Gem. duur</div>
            <div className="text-2xl font-bold">{stats.gemiddeldeDuur}<span className="text-sm font-normal text-muted-foreground ml-1">dagen</span></div>
          </CardContent>
        </Card>
      </div>

      {frequentVerzuim.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4" />Frequent verzuim — 3+ meldingen in 3 maanden
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {frequentVerzuim.map((item) => (
                <Badge key={item.medewerkerId} variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                  <Users className="h-3 w-3 mr-1" />{item.medewerkerNaam} ({item.aantalMeldingen}x)
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
