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
import { STATUS_CONFIG } from "@/lib/constants/statuses";

interface StatusChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatus: string;
  targetStatus: "concept" | "voorcalculatie" | "verzonden" | "geaccepteerd" | "afgewezen" | null;
  onConfirm: () => void;
}

export function StatusChangeDialog({
  open,
  onOpenChange,
  currentStatus,
  targetStatus,
  onConfirm,
}: StatusChangeDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Status wijzigen?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Weet u zeker dat u de status wilt wijzigen van{" "}
                <span className="font-semibold">
                  {STATUS_CONFIG[currentStatus as keyof typeof STATUS_CONFIG]?.label ?? currentStatus}
                </span>
                {" "}naar{" "}
                <span className="font-semibold">
                  {targetStatus
                    ? STATUS_CONFIG[targetStatus as keyof typeof STATUS_CONFIG]?.label ?? targetStatus
                    : ""}
                </span>
                ?
              </p>
              {targetStatus === "verzonden" && (
                <p className="text-amber-600 dark:text-amber-400 font-medium">
                  Let op: na verzending ontvangt de klant een notificatie. Dit kan niet ongedaan worden gemaakt.
                </p>
              )}
              {targetStatus === "afgewezen" && (
                <p className="text-red-600 dark:text-red-400 font-medium">
                  Weet u zeker dat u deze offerte als geweigerd wilt markeren?
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={
              targetStatus === "afgewezen"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            Bevestigen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
