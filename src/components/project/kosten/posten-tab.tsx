"use client";

import React from "react";
import { m, AnimatePresence } from "framer-motion";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Euro,
  Filter,
  X,
  Trash2,
  CalendarIcon,
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "@/lib/date-locale";
import { kostenTypeConfig, scopeDisplayNames, formatCurrency } from "./helpers";

interface KostEntry {
  id: string;
  datum: string;
  type: "materiaal" | "arbeid" | "machine" | "overig";
  omschrijving: string;
  scope: string;
  totaal: number;
}

interface PostenTabProps {
  kosten: KostEntry[] | undefined;
  filterType: string;
  onFilterTypeChange: (type: string) => void;
  filterStartDate: Date | undefined;
  onFilterStartDateChange: (date: Date | undefined) => void;
  filterEndDate: Date | undefined;
  onFilterEndDateChange: (date: Date | undefined) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onDeleteItem: (item: { id: string; type: "materiaal" | "arbeid" | "machine" | "overig" }) => void;
  onConfirmDelete: () => void;
}

const KostRow = React.memo(function KostRow({
  kost,
  index,
  onDelete,
}: {
  kost: KostEntry;
  index: number;
  onDelete: (item: { id: string; type: "materiaal" | "arbeid" | "machine" | "overig" }) => void;
}) {
  const typeConfig = kostenTypeConfig[kost.type];
  const TypeIcon = typeConfig.icon;

  return (
    <m.tr
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, delay: index * 0.02 }}
      className="border-b"
    >
      <TableCell className="font-medium">
        {format(new Date(kost.datum), "d MMM yyyy", { locale: nl })}
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="gap-1">
          <TypeIcon className="h-3 w-3" />
          {typeConfig.label}
        </Badge>
      </TableCell>
      <TableCell className="max-w-[200px] truncate">
        {kost.omschrijving}
      </TableCell>
      <TableCell>
        <Badge variant="outline">
          {scopeDisplayNames[kost.scope] || kost.scope}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums font-medium">
        {formatCurrency(kost.totaal)}
      </TableCell>
      <TableCell>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete({ id: kost.id, type: kost.type })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Kostenpost verwijderen?</AlertDialogTitle>
              <AlertDialogDescription>
                Weet je zeker dat je deze kostenpost wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuleren</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground">
                Verwijderen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </m.tr>
  );
});

export function PostenTab({
  kosten,
  filterType,
  onFilterTypeChange,
  filterStartDate,
  onFilterStartDateChange,
  filterEndDate,
  onFilterEndDateChange,
  hasActiveFilters,
  onClearFilters,
  onDeleteItem,
}: PostenTabProps) {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Select value={filterType} onValueChange={onFilterTypeChange}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter op type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle types</SelectItem>
                  <SelectItem value="materiaal">Materiaal</SelectItem>
                  <SelectItem value="arbeid">Arbeid</SelectItem>
                  <SelectItem value="machine">Machine</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[140px] justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filterStartDate ? format(filterStartDate, "d MMM", { locale: nl }) : "Van"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filterStartDate}
                    onSelect={onFilterStartDateChange}
                    locale={nl}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[140px] justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filterEndDate ? format(filterEndDate, "d MMM", { locale: nl }) : "Tot"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filterEndDate}
                    onSelect={onFilterEndDateChange}
                    locale={nl}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {hasActiveFilters && (
                <Button variant="ghost" size="icon" onClick={onClearFilters}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost entries table */}
      <Card>
        <CardHeader>
          <CardTitle>Kostenposten</CardTitle>
          <CardDescription>
            {kosten?.length || 0} {kosten?.length === 1 ? "post" : "posten"}
            {hasActiveFilters && " (gefilterd)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!kosten || kosten.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Euro className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Geen kostenposten gevonden</p>
              {hasActiveFilters && (
                <Button variant="link" onClick={onClearFilters} className="mt-2">
                  Filters wissen
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Omschrijving</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead className="text-right">Bedrag</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {kosten.map((kost, index) => (
                      <KostRow
                        key={kost.id}
                        kost={kost}
                        index={index}
                        onDelete={onDeleteItem}
                      />
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
