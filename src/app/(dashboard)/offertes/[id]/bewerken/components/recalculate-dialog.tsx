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
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";

interface RecalculateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecalculate: () => void;
  isRecalculating: boolean;
}

export function RecalculateDialog({
  open,
  onOpenChange,
  onRecalculate,
  isRecalculating,
}: RecalculateDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Regels herberekenen
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Dit zal alle huidige regels vervangen door nieuwe regels
              berekend vanuit de originele scope data.
            </p>
            <p className="font-medium text-destructive">
              Handmatige wijzigingen gaan verloren!
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction
            onClick={onRecalculate}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isRecalculating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Herbereken
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
