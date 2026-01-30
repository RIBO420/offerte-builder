"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarDays, ChevronDown } from "lucide-react";
import type { DateRangePreset } from "@/hooks/use-analytics";

interface AnalyticsDateFilterProps {
  currentPreset: DateRangePreset;
  onPresetChange: (preset: DateRangePreset) => void;
}

const presetLabels: Record<DateRangePreset, string> = {
  "deze-maand": "Deze Maand",
  "dit-kwartaal": "Dit Kwartaal",
  "dit-jaar": "Dit Jaar",
  "alles": "Alle Data",
};

export function AnalyticsDateFilter({
  currentPreset,
  onPresetChange,
}: AnalyticsDateFilterProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CalendarDays className="h-4 w-4" />
          {presetLabels[currentPreset]}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.entries(presetLabels) as [DateRangePreset, string][]).map(
          ([preset, label]) => (
            <DropdownMenuItem
              key={preset}
              onClick={() => onPresetChange(preset)}
              className={currentPreset === preset ? "bg-muted" : ""}
            >
              {label}
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
