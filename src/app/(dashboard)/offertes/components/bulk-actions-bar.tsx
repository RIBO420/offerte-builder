"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Download, Trash2 } from "lucide-react";

interface BulkActionsBarProps {
  selectedCount: number;
  bulkStatusValue: string;
  onBulkStatusChange: (value: string) => void;
  onSetBulkStatusValue: (value: string) => void;
  onClearSelection: () => void;
  onExportCSV: () => void;
  onShowDeleteDialog: () => void;
}

export function BulkActionsBar({
  selectedCount,
  bulkStatusValue,
  onBulkStatusChange,
  onSetBulkStatusValue,
  onClearSelection,
  onExportCSV,
  onShowDeleteDialog,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 bg-muted/50 rounded-lg border">
      <div className="flex items-center justify-between sm:justify-start gap-2">
        <span className="text-sm font-medium">
          {selectedCount} geselecteerd
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:h-8 sm:w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Separator orientation="vertical" className="hidden sm:block h-6" />
      <Separator orientation="horizontal" className="sm:hidden" />
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap">
        <Select
          value={bulkStatusValue}
          onValueChange={(value) => {
            onSetBulkStatusValue(value);
            onBulkStatusChange(value);
          }}
        >
          <SelectTrigger className="w-full sm:w-[180px] min-h-[44px] sm:min-h-0 sm:h-8">
            <SelectValue placeholder="Wijzig status..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="concept">Concept</SelectItem>
            <SelectItem value="voorcalculatie">Voorcalculatie</SelectItem>
            <SelectItem value="verzonden">Verzonden</SelectItem>
            <SelectItem value="geaccepteerd">Geaccepteerd</SelectItem>
            <SelectItem value="afgewezen">Afgewezen</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onExportCSV}
            className="flex-1 sm:flex-none min-h-[44px] sm:min-h-0 sm:h-8"
          >
            <Download className="mr-2 h-4 w-4" />
            Exporteer
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onShowDeleteDialog}
            className="flex-1 sm:flex-none min-h-[44px] sm:min-h-0 sm:h-8"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Verwijderen
          </Button>
        </div>
      </div>
    </div>
  );
}
