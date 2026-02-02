"use client";

import { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SortableList,
  type SortableItemProps,
} from "@/components/ui/sortable-list";
import { DragHandle } from "@/components/ui/drag-handle";

interface Regel {
  id: string;
  scope: string;
  omschrijving: string;
  eenheid: string;
  hoeveelheid: number;
  prijsPerEenheid: number;
  totaal: number;
  type: "materiaal" | "arbeid" | "machine";
  margePercentage?: number;
}

interface SortableRegelsTableProps {
  regels: Regel[];
  onReorder: (newRegels: Regel[]) => void;
  onEdit: (regel: Regel) => void;
  onDelete: (regelId: string) => void;
  scopeLabels: Record<string, string>;
  formatCurrency: (amount: number) => string;
  disabled?: boolean;
}

interface SortableRegelRowProps {
  regel: Regel;
  sortableProps: SortableItemProps;
  onEdit: (regel: Regel) => void;
  onDelete: (regelId: string) => void;
  scopeLabels: Record<string, string>;
  formatCurrency: (amount: number) => string;
  instellingenMargePercentage?: number;
}

function SortableRegelRow({
  regel,
  sortableProps,
  onEdit,
  onDelete,
  scopeLabels,
  formatCurrency,
  instellingenMargePercentage,
}: SortableRegelRowProps) {
  return (
    <TableRow
      ref={sortableProps.setNodeRef}
      style={sortableProps.style}
      className={cn(
        "transition-colors",
        sortableProps.isDragging && "bg-accent/50",
        sortableProps.isOver && "bg-accent/30"
      )}
    >
      <TableCell className="w-12">
        <DragHandle
          listeners={sortableProps.listeners}
          attributes={sortableProps.attributes}
          isDragging={sortableProps.isDragging}
          aria-label={`Versleep ${regel.omschrijving} om te herschikken`}
        />
      </TableCell>
      <TableCell>
        <div>
          <p className="font-medium">{regel.omschrijving}</p>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="capitalize">{regel.type}</span>
            {regel.margePercentage !== undefined && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                {regel.margePercentage}% marge
              </Badge>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{scopeLabels[regel.scope] || regel.scope}</Badge>
      </TableCell>
      <TableCell className="text-right">
        {regel.hoeveelheid} {regel.eenheid}
      </TableCell>
      <TableCell className="text-right">{formatCurrency(regel.prijsPerEenheid)}</TableCell>
      <TableCell className="text-right font-medium">{formatCurrency(regel.totaal)}</TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 sm:h-8 sm:w-8"
            onClick={() => onEdit(regel)}
            aria-label="Bewerken"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 sm:h-8 sm:w-8"
            onClick={() => onDelete(regel.id)}
            aria-label="Verwijderen"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * A sortable table for offerte regels (line items).
 * Supports drag and drop reordering with accessibility features.
 */
export function SortableRegelsTable({
  regels,
  onReorder,
  onEdit,
  onDelete,
  scopeLabels,
  formatCurrency,
  disabled = false,
}: SortableRegelsTableProps) {
  const handleReorder = useCallback(
    (newItems: Array<{ id: string | number }>) => {
      // Rebuild the regels array in the new order
      const newRegels = newItems.map((item) => {
        const regel = regels.find((r) => r.id === item.id);
        return regel!;
      }).filter(Boolean);
      onReorder(newRegels);
    },
    [regels, onReorder]
  );

  // Add id field to regels for sortable list
  const sortableItems = regels.map((regel) => ({
    ...regel,
    id: regel.id,
  }));

  if (regels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-muted-foreground">
          Nog geen regels. Klik op &quot;Regel toevoegen&quot; om te beginnen.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12" aria-label="Drag handle"></TableHead>
          <TableHead>Omschrijving</TableHead>
          <TableHead>Scope</TableHead>
          <TableHead className="text-right">Hoeveelheid</TableHead>
          <TableHead className="text-right">Prijs</TableHead>
          <TableHead className="text-right">Totaal</TableHead>
          <TableHead className="w-[80px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <SortableList
          items={sortableItems}
          onReorder={handleReorder}
          disabled={disabled}
          aria-label="Offerteregels"
          itemIdPrefix="regel"
          inline={true}
          renderItem={(item, sortableProps) => (
            <SortableRegelRow
              key={item.id}
              regel={item as Regel}
              sortableProps={sortableProps}
              onEdit={onEdit}
              onDelete={onDelete}
              scopeLabels={scopeLabels}
              formatCurrency={formatCurrency}
            />
          )}
        />
      </TableBody>
    </Table>
  );
}
