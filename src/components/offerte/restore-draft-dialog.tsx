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
import { FileText, Trash2 } from "lucide-react";

interface RestoreDraftDialogProps {
  open: boolean;
  draftAge: string | null;
  type: "aanleg" | "onderhoud";
  onRestore: () => void;
  onDiscard: () => void;
}

export function RestoreDraftDialog({
  open,
  draftAge,
  type,
  onRestore,
  onDiscard,
}: RestoreDraftDialogProps) {
  const typeLabel = type === "aanleg" ? "aanleg" : "onderhoud";

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Concept gevonden
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Er is een onafgeronde {typeLabel} offerte gevonden van{" "}
              <strong>{draftAge}</strong>.
            </p>
            <p>Wil je verder gaan waar je gebleven was?</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onDiscard}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Verwijderen
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onRestore}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Herstellen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
