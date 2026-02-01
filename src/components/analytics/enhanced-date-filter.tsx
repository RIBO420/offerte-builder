"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  ChevronDown,
  ArrowLeftRight,
  Calendar as CalendarIcon,
  X,
} from "lucide-react";
import type { DateRange } from "react-day-picker";

export type DateRangePreset =
  | "deze-week"
  | "deze-maand"
  | "vorige-maand"
  | "dit-kwartaal"
  | "vorig-kwartaal"
  | "dit-jaar"
  | "vorig-jaar"
  | "laatste-30-dagen"
  | "laatste-90-dagen"
  | "alles"
  | "custom";

interface EnhancedDateFilterProps {
  currentPreset: DateRangePreset;
  onPresetChange: (preset: DateRangePreset) => void;
  customRange?: { from: Date; to: Date };
  onCustomRangeChange?: (range: { from: Date; to: Date } | undefined) => void;
  showComparison?: boolean;
  onComparisonChange?: (enabled: boolean) => void;
  comparisonEnabled?: boolean;
}

const presetLabels: Record<DateRangePreset, string> = {
  "deze-week": "Deze Week",
  "deze-maand": "Deze Maand",
  "vorige-maand": "Vorige Maand",
  "dit-kwartaal": "Dit Kwartaal",
  "vorig-kwartaal": "Vorig Kwartaal",
  "dit-jaar": "Dit Jaar",
  "vorig-jaar": "Vorig Jaar",
  "laatste-30-dagen": "Laatste 30 Dagen",
  "laatste-90-dagen": "Laatste 90 Dagen",
  "alles": "Alle Data",
  "custom": "Aangepast",
};

const presetGroups = [
  {
    label: "Snel",
    presets: ["deze-week", "deze-maand", "dit-kwartaal", "dit-jaar"] as DateRangePreset[],
  },
  {
    label: "Vorige Periode",
    presets: ["vorige-maand", "vorig-kwartaal", "vorig-jaar"] as DateRangePreset[],
  },
  {
    label: "Laatste",
    presets: ["laatste-30-dagen", "laatste-90-dagen", "alles"] as DateRangePreset[],
  },
];

export function EnhancedDateFilter({
  currentPreset,
  onPresetChange,
  customRange,
  onCustomRangeChange,
  showComparison = true,
  onComparisonChange,
  comparisonEnabled = false,
}: EnhancedDateFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(currentPreset === "custom");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    customRange ? { from: customRange.from, to: customRange.to } : undefined
  );

  const handlePresetSelect = useCallback((preset: DateRangePreset) => {
    if (preset === "custom") {
      setShowCustomPicker(true);
    } else {
      setShowCustomPicker(false);
      onPresetChange(preset);
      setIsOpen(false);
    }
  }, [onPresetChange]);

  const handleCustomRangeSelect = useCallback((range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to && onCustomRangeChange) {
      onCustomRangeChange({ from: range.from, to: range.to });
      onPresetChange("custom");
    }
  }, [onCustomRangeChange, onPresetChange]);

  const handleApplyCustomRange = useCallback(() => {
    if (dateRange?.from && dateRange?.to) {
      setIsOpen(false);
    }
  }, [dateRange]);

  const handleClearCustomRange = useCallback(() => {
    setDateRange(undefined);
    setShowCustomPicker(false);
    onPresetChange("dit-jaar");
    onCustomRangeChange?.(undefined);
  }, [onPresetChange, onCustomRangeChange]);

  const getDisplayLabel = () => {
    if (currentPreset === "custom" && customRange) {
      return `${format(customRange.from, "d MMM", { locale: nl })} - ${format(customRange.to, "d MMM yyyy", { locale: nl })}`;
    }
    return presetLabels[currentPreset];
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2 min-w-[180px] justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{getDisplayLabel()}</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="flex">
            {/* Preset Selection */}
            <div className="p-3 border-r border-border min-w-[180px]">
              <div className="space-y-4">
                {presetGroups.map((group) => (
                  <div key={group.label}>
                    <p className="text-xs font-medium text-muted-foreground mb-2 px-2">
                      {group.label}
                    </p>
                    <div className="space-y-1">
                      {group.presets.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => handlePresetSelect(preset)}
                          className={`w-full px-2 py-1.5 text-sm text-left rounded-md transition-colors ${
                            currentPreset === preset && !showCustomPicker
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted"
                          }`}
                        >
                          {presetLabels[preset]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <Separator />

                <button
                  onClick={() => handlePresetSelect("custom")}
                  className={`w-full px-2 py-1.5 text-sm text-left rounded-md transition-colors flex items-center gap-2 ${
                    showCustomPicker
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  <CalendarIcon className="h-4 w-4" />
                  Aangepaste Periode
                </button>
              </div>
            </div>

            {/* Custom Date Picker */}
            <AnimatePresence mode="wait">
              {showCustomPicker && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium">Selecteer Periode</p>
                      {dateRange?.from && dateRange?.to && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearCustomRange}
                          className="h-7 px-2 text-xs"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Wissen
                        </Button>
                      )}
                    </div>

                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={handleCustomRangeSelect}
                      numberOfMonths={2}
                      locale={nl}
                      disabled={(date) => date > new Date()}
                      className="rounded-md border"
                    />

                    {dateRange?.from && dateRange?.to && (
                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          {format(dateRange.from, "d MMM yyyy", { locale: nl })} -{" "}
                          {format(dateRange.to, "d MMM yyyy", { locale: nl })}
                        </div>
                        <Button size="sm" onClick={handleApplyCustomRange}>
                          Toepassen
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Comparison Toggle */}
          {showComparison && (
            <>
              <Separator />
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="comparison-toggle" className="text-sm cursor-pointer">
                      vs Vorige Periode
                    </Label>
                  </div>
                  <Switch
                    id="comparison-toggle"
                    checked={comparisonEnabled}
                    onCheckedChange={onComparisonChange}
                  />
                </div>
                {comparisonEnabled && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs text-muted-foreground mt-2"
                  >
                    Vergelijk met dezelfde periode vorig jaar/kwartaal/maand
                  </motion.p>
                )}
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>

      {/* Comparison Badge */}
      {comparisonEnabled && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
        >
          <Badge variant="secondary" className="gap-1">
            <ArrowLeftRight className="h-3 w-3" />
            Vergelijking aan
          </Badge>
        </motion.div>
      )}
    </div>
  );
}
