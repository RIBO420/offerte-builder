"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays, Clock, ArrowRight, CalendarCheck2 } from "lucide-react";
import { format, addBusinessDays, isWeekend, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ProjectDuurCardProps {
  totaalDagen: number;
  totaalUren: number;
  teamGrootte?: number;
  effectieveUrenPerDag?: number;
  startDatum?: Date | null;
  onStartDatumChange?: (date: Date | null) => void;
}

/**
 * Add working days (skipping weekends)
 */
function addWorkingDays(startDate: Date, days: number): Date {
  // Round up to full days for end date calculation
  const fullDays = Math.ceil(days);
  return addBusinessDays(startDate, fullDays);
}

/**
 * Format date in Dutch
 */
function formatDateNL(date: Date): string {
  return format(date, "EEEE d MMMM yyyy", { locale: nl });
}

/**
 * Format date short
 */
function formatDateShort(date: Date): string {
  return format(date, "d MMM yyyy", { locale: nl });
}

export function ProjectDuurCard({
  totaalDagen,
  totaalUren,
  teamGrootte = 2,
  effectieveUrenPerDag = 6,
  startDatum,
  onStartDatumChange,
}: ProjectDuurCardProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Calculate end date based on start date and duration
  const eindDatum = useMemo(() => {
    if (!startDatum || totaalDagen <= 0) return null;
    return addWorkingDays(startDatum, totaalDagen);
  }, [startDatum, totaalDagen]);

  // Format total duration
  const duurWeergave = useMemo(() => {
    if (totaalDagen < 1) {
      return `${Math.round(totaalUren)} uur`;
    }
    if (totaalDagen === 1) {
      return "1 werkdag";
    }
    if (totaalDagen < 5) {
      return `${totaalDagen.toFixed(1)} werkdagen`;
    }
    const weken = Math.floor(totaalDagen / 5);
    const extraDagen = Math.round(totaalDagen % 5);
    if (extraDagen === 0) {
      return `${weken} ${weken === 1 ? "werkweek" : "werkweken"}`;
    }
    return `${weken} ${weken === 1 ? "werkweek" : "werkweken"} en ${extraDagen} ${extraDagen === 1 ? "dag" : "dagen"}`;
  }, [totaalDagen, totaalUren]);

  // Team capacity info
  const teamCapaciteit = useMemo(() => {
    const urenPerDag = teamGrootte * effectieveUrenPerDag;
    return `${teamGrootte} personen x ${effectieveUrenPerDag} uur = ${urenPerDag} uur/dag`;
  }, [teamGrootte, effectieveUrenPerDag]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Projectduur
        </CardTitle>
        <CardDescription>
          Geschatte doorlooptijd op basis van voorcalculatie
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Duration Display */}
        <div className="flex items-center justify-center p-6 bg-muted/50 rounded-lg">
          <div className="text-center">
            <p className="text-4xl font-bold tabular-nums">
              {totaalDagen.toFixed(1)}
            </p>
            <p className="text-lg text-muted-foreground">{duurWeergave}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {totaalUren.toFixed(1)} uur totaal
            </p>
          </div>
        </div>

        {/* Team Capacity */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{teamCapaciteit}</span>
        </div>

        {/* Start Date Picker */}
        <div className="space-y-2">
          <Label htmlFor="startdatum">Startdatum (optioneel)</Label>
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                id="startdatum"
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !startDatum && "text-muted-foreground"
                )}
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                {startDatum ? formatDateShort(startDatum) : "Kies een startdatum"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDatum || undefined}
                onSelect={(date) => {
                  onStartDatumChange?.(date || null);
                  setIsCalendarOpen(false);
                }}
                disabled={(date) => date < new Date() || isWeekend(date)}
                initialFocus
                locale={nl}
              />
            </PopoverContent>
          </Popover>
          {startDatum && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onStartDatumChange?.(null)}
              className="text-xs text-muted-foreground"
            >
              Datum wissen
            </Button>
          )}
        </div>

        {/* Date Range Display */}
        {startDatum && eindDatum && (
          <div className="p-4 bg-muted/30 rounded-lg space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="text-center flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Start
                </p>
                <p className="font-medium">{formatDateShort(startDatum)}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="text-center flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Geschat einde
                </p>
                <p className="font-medium">{formatDateShort(eindDatum)}</p>
              </div>
            </div>
            <div className="pt-2 border-t">
              <div className="flex items-center gap-2 text-sm">
                <CalendarCheck2 className="h-4 w-4 text-green-600" />
                <span>
                  Verwachte oplevering:{" "}
                  <span className="font-medium">{formatDateNL(eindDatum)}</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* No date selected hint */}
        {!startDatum && (
          <p className="text-sm text-muted-foreground italic">
            Selecteer een startdatum om de verwachte opleverdatum te berekenen.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
