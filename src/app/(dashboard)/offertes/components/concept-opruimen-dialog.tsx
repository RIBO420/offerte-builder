"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Archive, Brush, Loader2 } from "lucide-react";
import { toast } from "sonner";

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

/**
 * §5.3c: Opruimactie voor verweesde concepten.
 *
 * Kantoor-actie in de offerte-lijst: toont concept-offertes ouder dan X dagen
 * zonder klantkoppeling en zet ze op gearchiveerd (soft delete, herstelbaar
 * via het archief). Bewust géén automatische cron en géén hard delete.
 */
export function ConceptOpruimenDialog() {
  const [open, setOpen] = useState(false);
  const [dagen, setDagen] = useState(14);
  const [isArchiving, setIsArchiving] = useState(false);

  const verweesdeConcepten = useQuery(
    api.offertes.listVerweesdeConcepten,
    open ? { ouderDanDagen: dagen } : "skip"
  );
  const bulkRemove = useMutation(api.offertes.bulkRemove);

  const concepten = verweesdeConcepten ?? [];
  const isLoading = open && verweesdeConcepten === undefined;

  const handleArchiveer = async () => {
    if (concepten.length === 0) return;
    setIsArchiving(true);
    try {
      await bulkRemove({ ids: concepten.map((c) => c._id) });
      toast.success(
        `${concepten.length} verweesde concept${concepten.length === 1 ? "" : "en"} gearchiveerd`,
        { description: "Te herstellen via het archief (binnen 30 dagen)" }
      );
      setOpen(false);
    } catch {
      toast.error("Fout bij archiveren van concepten");
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Brush className="mr-2 h-4 w-4" />
          Concepten opruimen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Verweesde concepten opruimen</DialogTitle>
          <DialogDescription>
            Concept-offertes zonder klantkoppeling die langer dan de gekozen
            periode niet zijn aangeraakt. Archiveren is herstelbaar via het
            archief; er wordt niets definitief verwijderd.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Ouder dan</span>
          <Select
            value={String(dagen)}
            onValueChange={(v) => setDagen(Number(v))}
          >
            <SelectTrigger className="w-32" aria-label="Ouder dan aantal dagen">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dagen</SelectItem>
              <SelectItem value="14">14 dagen</SelectItem>
              <SelectItem value="30">30 dagen</SelectItem>
              <SelectItem value="90">90 dagen</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary">{concepten.length} gevonden</Badge>
        </div>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : concepten.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Geen verweesde concepten ouder dan {dagen} dagen
            </p>
          ) : (
            concepten.map((c) => (
              <div
                key={c._id}
                className="flex items-center justify-between rounded-md border p-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.offerteNummer}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.type === "aanleg" ? "Aanleg" : "Onderhoud"} ·{" "}
                    {c.klantNaam}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(c.updatedAt)}
                </span>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuleren
          </Button>
          <Button
            onClick={handleArchiveer}
            disabled={concepten.length === 0 || isArchiving}
          >
            {isArchiving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Archive className="mr-2 h-4 w-4" />
            )}
            Archiveer {concepten.length > 0 ? `(${concepten.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
