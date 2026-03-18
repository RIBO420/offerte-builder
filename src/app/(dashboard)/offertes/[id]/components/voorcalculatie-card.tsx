"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Calculator,
  Users,
  CalendarDays,
  Clock,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VoorcalculatieCardProps {
  id: string;
  offerteStatus: string;
  voorcalculatie: {
    teamGrootte: number;
    geschatteDagen: number;
    normUrenTotaal: number;
  } | null | undefined;
}

export function VoorcalculatieCard({ id, offerteStatus, voorcalculatie }: VoorcalculatieCardProps) {
  if (offerteStatus !== "concept" && !voorcalculatie) {
    return null;
  }

  return (
    <Card
      variant="elevated"
      className={cn(
        "transition-all duration-300",
        voorcalculatie
          ? "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20"
          : "border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10"
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className={cn(
            "h-4 w-4",
            voorcalculatie ? "text-blue-600" : "text-amber-600"
          )} />
          Voorcalculatie
          {voorcalculatie && (
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
              Ingevuld
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {voorcalculatie ? (
          <div className="space-y-4">
            {/* Summary of voorcalculatie */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-white/50 dark:bg-black/10">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Users className="h-3.5 w-3.5" />
                  <span className="text-xs">Team</span>
                </div>
                <p className="text-2xl font-bold">{voorcalculatie.teamGrootte}</p>
                <p className="text-xs text-muted-foreground">personen</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/50 dark:bg-black/10">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span className="text-xs">Duur</span>
                </div>
                <p className="text-2xl font-bold">{voorcalculatie.geschatteDagen}</p>
                <p className="text-xs text-muted-foreground">dagen</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/50 dark:bg-black/10">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-xs">Uren</span>
                </div>
                <p className="text-2xl font-bold">{voorcalculatie.normUrenTotaal}</p>
                <p className="text-xs text-muted-foreground">normuren</p>
              </div>
            </div>
            <Button
              asChild
              variant="outline"
              className="w-full"
            >
              <Link href={`/offertes/${id}/voorcalculatie`}>
                <Calculator className="mr-2 h-4 w-4" />
                Voorcalculatie bewerken
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-100/50 dark:bg-amber-950/20">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Vul de voorcalculatie in om de offerte te kunnen verzenden naar de klant.
              </p>
            </div>
            <Button
              asChild
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Link href={`/offertes/${id}/voorcalculatie`}>
                <Calculator className="mr-2 h-4 w-4" />
                Voorcalculatie invullen
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
