"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Check, X, Loader2, AlertTriangle } from "lucide-react";

interface QCApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kwaliteitsControleId: Id<"kwaliteitsControles">;
  scope: string;
  type: "approve" | "reject";
  onSuccess?: () => void;
}

// Scope display names
const scopeLabels: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  borders: "Borders",
  gras: "Gras",
  houtwerk: "Houtwerk",
  water_elektra: "Water & Elektra",
  specials: "Specials",
  gras_onderhoud: "Gras (Onderhoud)",
  borders_onderhoud: "Borders (Onderhoud)",
  heggen: "Heggen",
  bomen: "Bomen",
  overig: "Overig",
};

export function QCApprovalDialog({
  open,
  onOpenChange,
  kwaliteitsControleId,
  scope,
  type,
  onSuccess,
}: QCApprovalDialogProps) {
  const [naam, setNaam] = useState("");
  const [opmerkingen, setOpmerkingen] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approve = useMutation(api.kwaliteitsControles.approve);
  const reject = useMutation(api.kwaliteitsControles.reject);

  const isApproval = type === "approve";
  const scopeLabel = scopeLabels[scope] || scope;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate name
    if (!naam.trim()) {
      setError("Vul je naam in");
      return;
    }

    // For rejection, require a reason
    if (!isApproval && !opmerkingen.trim()) {
      setError("Geef een reden voor de afkeuring");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isApproval) {
        await approve({
          id: kwaliteitsControleId,
          goedgekeurdDoor: naam.trim(),
          opmerkingen: opmerkingen.trim() || undefined,
        });
      } else {
        await reject({
          id: kwaliteitsControleId,
          reden: opmerkingen.trim(),
          afgekeurdDoor: naam.trim(),
        });
      }

      // Reset form and close
      setNaam("");
      setOpmerkingen("");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error("Fout bij verwerken:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Er is een fout opgetreden. Probeer het opnieuw.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setNaam("");
      setOpmerkingen("");
      setError(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isApproval ? (
                <>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  Kwaliteitscontrole goedkeuren
                </>
              ) : (
                <>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                    <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  Kwaliteitscontrole afkeuren
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {isApproval
                ? `Bevestig de goedkeuring van de kwaliteitscontrole voor ${scopeLabel}.`
                : `Geef een reden voor het afkeuren van de kwaliteitscontrole voor ${scopeLabel}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Name input */}
            <div className="space-y-2">
              <Label htmlFor="naam">
                Jouw naam <span className="text-red-500">*</span>
              </Label>
              <Input
                id="naam"
                placeholder="Vul je naam in"
                value={naam}
                onChange={(e) => setNaam(e.target.value)}
                disabled={isSubmitting}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                {isApproval
                  ? "Je naam wordt geregistreerd als goedkeurder"
                  : "Je naam wordt geregistreerd bij de afkeuring"}
              </p>
            </div>

            {/* Comments input */}
            <div className="space-y-2">
              <Label htmlFor="opmerkingen">
                {isApproval
                  ? "Opmerkingen (optioneel)"
                  : "Reden voor afkeuring"}{" "}
                {!isApproval && <span className="text-red-500">*</span>}
              </Label>
              <Textarea
                id="opmerkingen"
                placeholder={
                  isApproval
                    ? "Eventuele opmerkingen bij de goedkeuring..."
                    : "Beschrijf waarom de controle is afgekeurd..."
                }
                value={opmerkingen}
                onChange={(e) => setOpmerkingen(e.target.value)}
                disabled={isSubmitting}
                required={!isApproval}
                rows={3}
              />
            </div>

            {/* Warning for rejection */}
            {!isApproval && (
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                <p className="font-medium">Let op:</p>
                <p className="mt-1">
                  Na afkeuring moeten de werkzaamheden opnieuw worden
                  gecontroleerd. De status wordt teruggezet naar
                  &quot;afgekeurd&quot;.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Annuleren
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className={
                isApproval
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Bezig...
                </>
              ) : isApproval ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Goedkeuren
                </>
              ) : (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Afkeuren
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
