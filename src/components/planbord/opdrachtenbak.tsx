"use client";

/**
 * Opdrachtenbak (wachtrij-zijbalk, PRD §2.2): ongeplande werkitems —
 * projecten uit geaccepteerde offertes en gegenereerde beurten. Slepen
 * bak → bord = plannen; het bord terugslepen (of de min-knop) = terug in
 * de bak. Terugkerende beurten verschijnen alleen in relevante weken
 * (filtering server-side in planbord.getWachtrij).
 *
 * Hint/filter bij het plannen van een dag: kies een dag en items die
 * buiten het beschikbaarheidsvenster van de klant vallen dimmen met een
 * hint; het voorkeursteam staat als badge op de kaart.
 */

import { useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock, GripVertical, Inbox, Users } from "lucide-react";
import { beschikbaarheidsHint } from "../../../convex/planbordLogica";
import { kolomLabel } from "./periode";
import type { BakItem } from "./adapter";

function BakKaart({
  item,
  filterDatum,
  magSlepen,
}: {
  item: BakItem;
  filterDatum: string | null;
  magSlepen: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `bak-${item._id}`,
    data: { soort: "bak", werkitemId: item._id },
    disabled: !magSlepen,
  });
  const hint = filterDatum
    ? beschikbaarheidsHint(item.beschikbaarheidsVenster, filterDatum)
    : null;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-testid="bak-item"
      className={`rounded-lg bg-muted px-2 py-2.5 text-sm transition-colors hover:bg-accent ${
        magSlepen ? "cursor-grab" : ""
      } ${isDragging ? "opacity-50" : ""} ${hint ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-2">
        {magSlepen && (
          <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate font-semibold" title={item.naam}>
              {item.naam}
            </span>
            {item.geschatteUren != null && (
              <span className="shrink-0 text-[13px] font-semibold tabular-nums">
                {item.geschatteUren} u
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[item.klantNaam, item.type === "project" ? "Project" : "Onderhoudsbeurt"]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {(item.voorzieneDatum || item.voorkeursTeamNaam) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {item.voorzieneDatum && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <CalendarClock className="h-3 w-3" aria-hidden="true" />
                  {item.voorzieneDatum}
                </Badge>
              )}
              {item.voorkeursTeamNaam && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <Users className="h-3 w-3" aria-hidden="true" />
                  {item.voorkeursTeamNaam}
                </Badge>
              )}
            </div>
          )}
          {item.beschikbaarheidsVenster?.notitie && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {item.beschikbaarheidsVenster.notitie}
            </p>
          )}
          {hint && <p className="mt-1 text-[11px] text-status-verzonden-text">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

type TypeFilter = "alle" | "project" | "onderhoudsbeurt";

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "alle", label: "Alle" },
  { id: "project", label: "Projecten" },
  { id: "onderhoudsbeurt", label: "Onderhoud" },
];

export function Opdrachtenbak({
  items,
  kolommen,
  filterDatum,
  onFilterDatum,
  magSlepen,
}: {
  items: BakItem[] | undefined;
  kolommen: string[];
  filterDatum: string | null;
  onFilterDatum: (datum: string | null) => void;
  magSlepen: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "opdrachtenbak",
    data: { soort: "bak-drop" },
  });
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("alle");
  const zichtbaar =
    items?.filter((item) => typeFilter === "alle" || item.type === typeFilter) ?? [];
  const totaalUren = (items ?? []).reduce((t, item) => t + (item.geschatteUren ?? 0), 0);

  return (
    <aside
      ref={setNodeRef}
      data-testid="opdrachtenbak"
      aria-labelledby="opdrachtenbak-titel"
      className={`flex w-full min-w-0 flex-[1_1_18.5rem] flex-col rounded-xl border bg-card p-1 sm:max-w-[21rem] ${
        isOver ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-1">
        <Inbox className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h2 id="opdrachtenbak-titel" className="font-display text-[15px] font-semibold">
          Opdrachtenbak
        </h2>
        <span className="rounded-full bg-muted px-1.5 text-xs font-semibold tabular-nums text-muted-foreground">
          {items?.length ?? 0}
        </span>
        {totaalUren > 0 && (
          <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground tabular-nums">
            {totaalUren.toLocaleString("nl-NL")} u totaal
          </span>
        )}
      </div>
      {magSlepen && (
        <p className="px-3 pb-2 text-xs text-muted-foreground">
          Sleep een kaart naar een team en dag.
        </p>
      )}

      <div className="space-y-2 px-2 pb-2">
        <div role="group" aria-label="Soort werk" className="flex flex-wrap gap-1.5">
          {TYPE_FILTERS.map((filter) => {
            const aantal =
              filter.id === "alle"
                ? (items?.length ?? 0)
                : (items?.filter((i) => i.type === filter.id).length ?? 0);
            const actief = typeFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={actief}
                onClick={() => setTypeFilter(filter.id)}
                className={`h-7 rounded-full border px-2.5 text-xs tabular-nums transition-colors ${
                  actief
                    ? "border-primary/50 bg-primary/10 font-semibold text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {filter.label} · {aantal}
              </button>
            );
          })}
        </div>
        <Select
          value={filterDatum ?? "geen"}
          onValueChange={(w) => onFilterDatum(w === "geen" ? null : w)}
        >
          <SelectTrigger className="h-8 text-xs" aria-label="Beschikbaarheid toetsen op dag">
            <SelectValue placeholder="Hint voor dag…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="geen">Geen dag-hint</SelectItem>
            {kolommen.map((datum) => {
              const label = kolomLabel(datum);
              return (
                <SelectItem key={datum} value={datum}>
                  Plannen op {label.dag} {label.datum}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto">
        {items === undefined ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">Laden…</p>
        ) : zichtbaar.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {items.length === 0
              ? "Geen ongeplande werkitems in deze periode. Beurten verschijnen hier vanzelf in de weken waarin ze relevant zijn."
              : "Niets van deze soort in de bak."}
          </p>
        ) : (
          zichtbaar.map((item) => (
            <BakKaart
              key={item._id}
              item={item}
              filterDatum={filterDatum}
              magSlepen={magSlepen}
            />
          ))
        )}
      </div>
      {magSlepen && (
        <p className="m-1 mt-2 rounded-lg border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
          Sleep een blok hierheen om het terug in de bak te leggen
        </p>
      )}
    </aside>
  );
}
