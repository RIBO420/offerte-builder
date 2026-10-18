"use client";

/**
 * Posten: alle kostenposten van het project als lijst, met filters op soort en
 * periode. Geen tabel: elke post is één regel met omschrijving en bedrag en een
 * gedempte regel eronder (datum · soort · scope), zodat de lijst op elke
 * breedte past zonder zijwaarts te scrollen.
 */

import { memo } from "react";
import { CalendarIcon, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { SectieLegeStaat } from "@/components/ui/sectie-paneel";
import { formatCurrency } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";
import { format } from "date-fns";
import { nl } from "@/lib/date-locale";
import { scopeNaam } from "./helpers";
import { SOORT_LABEL, type KostSoort } from "./stand";

export interface KostPost {
  id: string;
  datum: string;
  type: KostSoort;
  omschrijving: string;
  scope: string;
  totaal: number;
  bron?: string;
}

export interface PostVerwijderen {
  id: string;
  type: KostSoort;
}

interface PostenTabProps {
  kosten: KostPost[];
  filterType: string;
  onFilterTypeChange: (type: string) => void;
  filterStartDate: Date | undefined;
  onFilterStartDateChange: (date: Date | undefined) => void;
  filterEndDate: Date | undefined;
  onFilterEndDateChange: (date: Date | undefined) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onVerwijder: (post: PostVerwijderen) => void;
}

const PostRegel = memo(function PostRegel({
  post,
  onVerwijder,
}: {
  post: KostPost;
  onVerwijder: (post: PostVerwijderen) => void;
}) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_minmax(2.5rem,auto)] items-center gap-x-3 rounded-md px-3 py-2 hover:bg-muted/50">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" title={post.omschrijving}>
          {post.omschrijving}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {formatDate(post.datum)} · {SOORT_LABEL[post.type]} · {scopeNaam(post.scope)}
        </p>
      </div>
      <span className="text-end text-sm font-semibold tabular-nums">
        {formatCurrency(post.totaal)}
      </span>
      {post.bron === "urenSegmenten" ? (
        <Button
          asChild
          variant="ghost"
          size="xs"
          className="justify-self-end text-muted-foreground"
        >
          <a href="/uren" aria-label="Dagregistratie corrigeren">
            Uren
          </a>
        </Button>
      ) : (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="justify-self-end text-muted-foreground hover:text-destructive"
              aria-label={`${post.omschrijving} verwijderen`}
            >
              <Trash2 className="size-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Kostenpost verwijderen?</AlertDialogTitle>
              <AlertDialogDescription>
                {post.omschrijving} ({formatCurrency(post.totaal)}) wordt verwijderd. Dit kan
                niet ongedaan worden gemaakt.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuleren</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => onVerwijder({ id: post.id, type: post.type })}
              >
                Verwijderen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </li>
  );
});

function DatumFilter({
  label,
  waarde,
  onChange,
}: {
  label: "Van" | "Tot";
  waarde: Date | undefined;
  onChange: (date: Date | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="justify-start font-normal"
          aria-label={waarde ? `${label} ${formatDate(waarde)}` : `${label} datum kiezen`}
        >
          <CalendarIcon className="size-4 text-muted-foreground" />
          {waarde ? format(waarde, "d MMM", { locale: nl }) : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={waarde} onSelect={onChange} locale={nl} initialFocus />
      </PopoverContent>
    </Popover>
  );
}

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
  onVerwijder,
}: PostenTabProps) {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
        <Select value={filterType} onValueChange={onFilterTypeChange}>
          <SelectTrigger size="sm" className="w-40" aria-label="Filter op soort">
            <SelectValue placeholder="Alle soorten" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle soorten</SelectItem>
            <SelectItem value="materiaal">Materiaal</SelectItem>
            <SelectItem value="arbeid">Arbeid</SelectItem>
            <SelectItem value="machine">Machine</SelectItem>
          </SelectContent>
        </Select>
        <DatumFilter label="Van" waarde={filterStartDate} onChange={onFilterStartDateChange} />
        <DatumFilter label="Tot" waarde={filterEndDate} onChange={onFilterEndDateChange} />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-muted-foreground">
            <X className="size-4" />
            Filters wissen
          </Button>
        )}
        <span className="ms-auto text-xs text-muted-foreground tabular-nums">
          {kosten.length} {kosten.length === 1 ? "post" : "posten"}
          {hasActiveFilters && " (gefilterd)"}
        </span>
      </div>

      {kosten.length === 0 ? (
        <SectieLegeStaat
          tekst={hasActiveFilters ? "Geen posten binnen deze filters." : "Nog geen kostenposten."}
          hint={
            hasActiveFilters
              ? "Wis de filters om alle posten te zien."
              : "Posten komen uit uren-, machine- en materiaalregistraties."
          }
        />
      ) : (
        <ul className="flex flex-col p-1">
          {kosten.map((post) => (
            <PostRegel key={`${post.type}-${post.id}`} post={post} onVerwijder={onVerwijder} />
          ))}
        </ul>
      )}
    </div>
  );
}
