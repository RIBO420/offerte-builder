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
      className={`rounded-md border bg-card p-2 text-sm shadow-sm ${
        magSlepen ? "cursor-grab" : ""
      } ${isDragging ? "opacity-50" : ""} ${hint ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-1.5">
        {magSlepen && (
          <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{item.naam}</p>
          {item.klantNaam && (
            <p className="truncate text-xs text-muted-foreground">{item.klantNaam}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Badge variant="outline" className="text-[10px]">
              {item.type === "project" ? "Project" : "Onderhoudsbeurt"}
            </Badge>
            {item.geschatteUren != null && (
              <Badge variant="secondary" className="text-[10px]">
                {item.geschatteUren} u
              </Badge>
            )}
            {item.voorzieneDatum && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <CalendarClock className="h-3 w-3" />
                {item.voorzieneDatum}
              </Badge>
            )}
            {item.voorkeursTeamNaam && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <Users className="h-3 w-3" />
                {item.voorkeursTeamNaam}
              </Badge>
            )}
          </div>
          {item.beschikbaarheidsVenster?.notitie && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {item.beschikbaarheidsVenster.notitie}
            </p>
          )}
          {hint && <p className="mt-1 text-[11px] text-amber-600">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

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

  return (
    <aside
      ref={setNodeRef}
      data-testid="opdrachtenbak"
      className={`flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30 ${
        isOver ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="border-b p-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Inbox className="h-4 w-4" />
          Opdrachtenbak
          <Badge variant="secondary">{items?.length ?? 0}</Badge>
        </h2>
        <div className="mt-2">
          <Select
            value={filterDatum ?? "geen"}
            onValueChange={(w) => onFilterDatum(w === "geen" ? null : w)}
          >
            <SelectTrigger className="h-8 text-xs">
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
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {items === undefined ? (
          <p className="text-xs text-muted-foreground">Laden…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Geen ongeplande werkitems in deze periode. Beurten verschijnen
            hier vanzelf in de weken waarin ze relevant zijn.
          </p>
        ) : (
          items.map((item) => (
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
        <p className="border-t p-2 text-[11px] text-muted-foreground">
          Sleep een kaart naar het bord om te plannen; sleep een blok hierheen
          om het terug in de bak te leggen.
        </p>
      )}
    </aside>
  );
}
