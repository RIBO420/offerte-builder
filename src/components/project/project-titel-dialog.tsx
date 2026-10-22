"use client";

/**
 * Titel van een project wijzigen (klantbesluit okt 2026). Een project heet
 * standaard "Klantnaam – werkzaamheden"; kantoor kan dat hier aanpassen.
 * Rustig: een kleine potloodknop naast de titel in de projectkop.
 */

import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { Loader2, Pencil } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PROJECT_TITEL_MAX } from "@convex/lib/projectTitel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";

/** Ruimer dan de automatische titel; de server houdt dezelfde grens aan. */
export const TITEL_INVOER_MAX = 120;

export function ProjectTitelKnop({
  projectId,
  huidigeTitel,
}: {
  projectId: Id<"projecten">;
  huidigeTitel: string;
}) {
  const [open, setOpen] = useState(false);
  const [titel, setTitel] = useState(huidigeTitel);
  const [bezig, setBezig] = useState(false);
  const update = useMutation(api.projecten.update);

  const schoon = titel.trim();
  const ongewijzigd = schoon === huidigeTitel.trim();

  function openDialoog(volgende: boolean) {
    if (volgende) setTitel(huidigeTitel);
    setOpen(volgende);
  }

  async function opslaan(e: FormEvent) {
    e.preventDefault();
    if (!schoon || ongewijzigd) return;
    setBezig(true);
    try {
      await update({ id: projectId, naam: schoon });
      showSuccessToast("Titel gewijzigd");
      setOpen(false);
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Titel wijzigen lukte niet");
    } finally {
      setBezig(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => openDialoog(true)}
        aria-label="Titel wijzigen"
        title="Titel wijzigen"
      >
        <Pencil className="size-4" aria-hidden="true" />
      </Button>
      <Dialog open={open} onOpenChange={openDialoog}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={opslaan} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Titel wijzigen</DialogTitle>
              <DialogDescription>
                Gebruikelijk is &ldquo;Klantnaam – werkzaamheden&rdquo;, kort genoeg voor het
                weekbord (liefst onder {PROJECT_TITEL_MAX} tekens).
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-titel">Titel</Label>
              <Input
                id="project-titel"
                value={titel}
                onChange={(e) => setTitel(e.target.value)}
                maxLength={TITEL_INVOER_MAX}
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={!schoon || ongewijzigd || bezig}>
                {bezig && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
                Opslaan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
