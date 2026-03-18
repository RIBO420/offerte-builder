"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { STATUS_CONFIG, type OfferteStatus } from "@/lib/constants/statuses";
import type { SortableOfferte } from "./types";

interface BulkStatusPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOffertes: SortableOfferte[];
  newStatus: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const MAX_SHOWN = 10;

export function BulkStatusPreviewDialog({
  open,
  onOpenChange,
  selectedOffertes,
  newStatus,
  onConfirm,
  onCancel,
}: BulkStatusPreviewDialogProps) {
  if (!newStatus) return null;

  const newStatusConfig = STATUS_CONFIG[newStatus as OfferteStatus];
  const newStatusLabel = newStatusConfig?.label ?? newStatus;

  // Group offertes by their current status for summary
  const byCurrentStatus = selectedOffertes.reduce<Record<string, number>>((acc, o) => {
    const status = o.status;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const shownOffertes = selectedOffertes.slice(0, MAX_SHOWN);
  const remainingCount = selectedOffertes.length - MAX_SHOWN;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Status wijzigen</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {/* Summary by current status */}
              <div className="text-sm">
                {Object.entries(byCurrentStatus).map(([status, count]) => {
                  const currentConfig = STATUS_CONFIG[status as OfferteStatus];
                  const currentLabel = currentConfig?.label ?? status;
                  return (
                    <div key={status} className="flex items-center gap-2 py-0.5">
                      <span className="font-medium">{count} offerte{count !== 1 ? "s" : ""}:</span>
                      <Badge variant="outline" className="text-xs">
                        {currentLabel}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <Badge variant="outline" className="text-xs">
                        {newStatusLabel}
                      </Badge>
                    </div>
                  );
                })}
              </div>

              {/* Offerte numbers list */}
              <div className="rounded-md border bg-muted/30 p-2 max-h-48 overflow-y-auto">
                <ul className="space-y-1">
                  {shownOffertes.map((o) => {
                    const currentConfig = STATUS_CONFIG[o.status as OfferteStatus];
                    const currentLabel = currentConfig?.label ?? o.status;
                    return (
                      <li key={o._id} className="flex items-center justify-between text-xs py-0.5">
                        <span className="font-mono font-medium">{o.offerteNummer}</span>
                        <span className="text-muted-foreground flex items-center gap-1">
                          {currentLabel}
                          <ArrowRight className="h-2.5 w-2.5" />
                          {newStatusLabel}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {remainingCount > 0 && (
                  <p className="text-xs text-muted-foreground mt-2 pt-1 border-t">
                    +{remainingCount} meer
                  </p>
                )}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Annuleren</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Wijzig status
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
