"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";

// ============================================
// VerliesRedenDialog component
// ============================================

interface VerliesRedenDialogProps {
  open: boolean;
  onClose: () => void;
  onBevestig: (reden: string) => void;
}

export function VerliesRedenDialog({
  open,
  onClose,
  onBevestig,
}: VerliesRedenDialogProps) {
  const [reden, setReden] = useState("");

  function handleBevestig() {
    if (!reden.trim()) return;
    onBevestig(reden.trim());
    setReden("");
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setReden("");
      onClose();
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Lead markeren als verloren</AlertDialogTitle>
          <AlertDialogDescription>
            Geef een reden op waarom deze lead verloren is. Dit helpt bij het
            verbeteren van toekomstige offertes.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <Textarea
            placeholder="Bijv. te duur, concurrent gekozen, project geannuleerd..."
            value={reden}
            onChange={(e) => setReden(e.target.value)}
            rows={3}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!reden.trim()}
            onClick={handleBevestig}
          >
            Markeer als verloren
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
