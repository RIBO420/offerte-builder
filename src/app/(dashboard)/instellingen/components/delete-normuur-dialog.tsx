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
import type { Normuur } from "./types";

interface DeleteNormuurDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  normuurToDelete: Normuur | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteNormuurDialog({
  open,
  onOpenChange,
  normuurToDelete,
  onConfirm,
  onCancel,
}: DeleteNormuurDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Normuur verwijderen?</AlertDialogTitle>
          <AlertDialogDescription>
            Weet je zeker dat je &quot;{normuurToDelete?.activiteit}&quot; wilt
            verwijderen?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Annuleren
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Verwijderen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
