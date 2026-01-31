"use client";

import { useState, useCallback, useMemo, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, Filter, X, Shovel, Trees } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface OfferteFilters {
  type: "alle" | "aanleg" | "onderhoud";
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  amountMin: string;
  amountMax: string;
}

interface OfferteFiltersProps {
  filters: OfferteFilters;
  onChange: (filters: OfferteFilters) => void;
  onReset: () => void;
}

export const defaultFilters: OfferteFilters = {
  type: "alle",
  dateFrom: undefined,
  dateTo: undefined,
  amountMin: "",
  amountMax: "",
};

export const OfferteFiltersComponent = memo(function OfferteFiltersComponent({
  filters,
  onChange,
  onReset,
}: OfferteFiltersProps) {
  const [open, setOpen] = useState(false);

  const activeFilterCount = useMemo(() => [
    filters.type !== "alle",
    filters.dateFrom !== undefined,
    filters.dateTo !== undefined,
    filters.amountMin !== "",
    filters.amountMax !== "",
  ].filter(Boolean).length, [filters]);

  const handleTypeChange = useCallback((value: string) => {
    onChange({ ...filters, type: value as OfferteFilters["type"] });
  }, [filters, onChange]);

  const handleDateFromChange = useCallback((date: Date | undefined) => {
    onChange({ ...filters, dateFrom: date });
  }, [filters, onChange]);

  const handleDateToChange = useCallback((date: Date | undefined) => {
    onChange({ ...filters, dateTo: date });
  }, [filters, onChange]);

  const handleAmountMinChange = useCallback((value: string) => {
    onChange({ ...filters, amountMin: value });
  }, [filters, onChange]);

  const handleAmountMaxChange = useCallback((value: string) => {
    onChange({ ...filters, amountMax: value });
  }, [filters, onChange]);

  const handleReset = useCallback(() => {
    onReset();
    setOpen(false);
  }, [onReset]);

  const handleApply = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Filters</h4>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-auto p-0 text-muted-foreground hover:text-foreground"
              >
                Wissen
              </Button>
            )}
          </div>

          <Separator />

          {/* Type Filter */}
          <div className="space-y-2">
            <Label>Type offerte</Label>
            <Select value={filters.type} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle types</SelectItem>
                <SelectItem value="aanleg">
                  <div className="flex items-center gap-2">
                    <Shovel className="h-4 w-4" />
                    Aanleg
                  </div>
                </SelectItem>
                <SelectItem value="onderhoud">
                  <div className="flex items-center gap-2">
                    <Trees className="h-4 w-4" />
                    Onderhoud
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Date Range Filter */}
          <div className="space-y-2">
            <Label>Datum bereik</Label>
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal h-9",
                      !filters.dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateFrom
                      ? format(filters.dateFrom, "d MMM", { locale: nl })
                      : "Van"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateFrom}
                    onSelect={handleDateFromChange}
                    locale={nl}
                    initialFocus
                  />
                  {filters.dateFrom && (
                    <div className="p-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => handleDateFromChange(undefined)}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Wissen
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal h-9",
                      !filters.dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateTo
                      ? format(filters.dateTo, "d MMM", { locale: nl })
                      : "Tot"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateTo}
                    onSelect={handleDateToChange}
                    locale={nl}
                    initialFocus
                  />
                  {filters.dateTo && (
                    <div className="p-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => handleDateToChange(undefined)}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Wissen
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Separator />

          {/* Amount Range Filter */}
          <div className="space-y-2">
            <Label>Bedrag bereik</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  €
                </span>
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.amountMin}
                  onChange={(e) => handleAmountMinChange(e.target.value)}
                  className="pl-7 h-9"
                  min={0}
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  €
                </span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.amountMax}
                  onChange={(e) => handleAmountMaxChange(e.target.value)}
                  className="pl-7 h-9"
                  min={0}
                />
              </div>
            </div>
          </div>

          <Separator />

          <Button className="w-full" onClick={handleApply}>
            Toepassen
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
});

// Active filter badges component
export const ActiveFilters = memo(function ActiveFilters({
  filters,
  onChange,
}: {
  filters: OfferteFilters;
  onChange: (filters: OfferteFilters) => void;
}) {
  // Memoize badges array to prevent recreation on each render
  const badges = useMemo(() => {
    const result: { label: string; key: string; filterKey: keyof OfferteFilters }[] = [];

    if (filters.type !== "alle") {
      result.push({
        label: filters.type === "aanleg" ? "Aanleg" : "Onderhoud",
        key: "type",
        filterKey: "type",
      });
    }

    if (filters.dateFrom) {
      result.push({
        label: `Vanaf ${format(filters.dateFrom, "d MMM yyyy", { locale: nl })}`,
        key: "dateFrom",
        filterKey: "dateFrom",
      });
    }

    if (filters.dateTo) {
      result.push({
        label: `Tot ${format(filters.dateTo, "d MMM yyyy", { locale: nl })}`,
        key: "dateTo",
        filterKey: "dateTo",
      });
    }

    if (filters.amountMin) {
      result.push({
        label: `Min €${filters.amountMin}`,
        key: "amountMin",
        filterKey: "amountMin",
      });
    }

    if (filters.amountMax) {
      result.push({
        label: `Max €${filters.amountMax}`,
        key: "amountMax",
        filterKey: "amountMax",
      });
    }

    return result;
  }, [filters]);

  const handleRemove = useCallback((filterKey: keyof OfferteFilters) => {
    const defaultValue = filterKey === "type" ? "alle" : filterKey.includes("amount") ? "" : undefined;
    onChange({ ...filters, [filterKey]: defaultValue });
  }, [filters, onChange]);

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <Badge
          key={badge.key}
          variant="secondary"
          className="gap-1 pr-1"
        >
          {badge.label}
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-transparent"
            onClick={() => handleRemove(badge.filterKey)}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}
    </div>
  );
});
