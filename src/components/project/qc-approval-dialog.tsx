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
import { logger } from "@/lib/logger";
import { scopeLabel as labelVoorScope } from "@/lib/rapportage-labels";

interface QCApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kwaliteitsControleId: Id<"kwaliteitsControles">;
  scope: string;
  type: "approve" | "reject";
  onSuccess?: () => void;
}

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
  const scopeLabel = labelVoorScope(scope);

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
      logger.error("Verwerken kwaliteitscontrole-beoordeling mislukt", err, {
        module: "project/qc-approval",
        kwaliteitsControleId,
      });
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
                  <span
                    aria-hidden="true"
                    className="flex size-8 items-center justify-center rounded-full border border-status-geaccepteerd-border bg-status-geaccepteerd text-status-geaccepteerd-text"
                  >
                    <Check className="size-4" />
                  </span>
                  Kwaliteitscontrole goedkeuren
                </>
              ) : (
                <>
                  <span
                    aria-hidden="true"
                    className="flex size-8 items-center justify-center rounded-full border border-status-afgewezen-border bg-status-afgewezen text-status-afgewezen-text"
                  >
                    <X className="size-4" />
                  </span>
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
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-status-afgewezen-border bg-status-afgewezen p-3 text-sm text-status-afgewezen-text"
              >
                <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Name input */}
            <div className="space-y-2">
              <Label htmlFor="naam">
                Jouw naam <span aria-hidden="true" className="text-destructive">*</span>
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
                {!isApproval && <span aria-hidden="true" className="text-destructive">*</span>}
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
              <div className="rounded-lg border bg-surface-aandacht p-3 text-sm">
                <p className="font-medium">Let op</p>
                <p className="mt-1 text-muted-foreground">
                  Na afkeuring moeten de werkzaamheden opnieuw worden
                  gecontroleerd. De controle krijgt de status
                  &quot;Afgekeurd&quot;.
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
              variant={isApproval ? "default" : "destructive"}
            >
              {isSubmitting ? (
                <>
                  <Loader2 aria-hidden="true" className="animate-spin" />
                  Bezig...
                </>
              ) : isApproval ? (
                <>
                  <Check aria-hidden="true" />
                  Goedkeuren
                </>
              ) : (
                <>
                  <X aria-hidden="true" />
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
