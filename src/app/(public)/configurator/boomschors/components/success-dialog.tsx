"use client";

import * as React from "react";
import {
  CheckCircle2Icon,
  CreditCardIcon,
  Loader2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Success Dialog (met Mollie aanbetaling)
// ---------------------------------------------------------------------------

interface SuccessDialogProps {
  open: boolean;
  referentie: string;
  klantNaam: string;
  klantEmail: string;
}

export function SuccessDialog({
  open,
  referentie,
  klantNaam,
  klantEmail,
}: SuccessDialogProps) {
  const [betalingBezig, setBetalingBezig] = React.useState(false);

  async function startAanbetaling() {
    setBetalingBezig(true);
    try {
      const response = await fetch("/api/mollie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: { currency: "EUR", value: "50.00" },
          description: `Aanbetaling boomschors ${referentie}`,
          redirectUrl: `${window.location.origin}/configurator/boomschors?betaald=true`,
          metadata: {
            referentie,
            klantNaam,
            klantEmail,
            type: "aanbetaling",
          },
        }),
      });

      const data = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.checkoutUrl) {
        toast.error(
          data.error ?? "Betaling kon niet worden gestart. Probeer het later opnieuw."
        );
        return;
      }

      window.location.href = data.checkoutUrl;
    } catch {
      toast.error(
        "Er is een fout opgetreden bij het starten van de betaling. Uw aanvraag is wel opgeslagen."
      );
    } finally {
      setBetalingBezig(false);
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="sm:max-w-md text-center">
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <div className="size-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2Icon className="size-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            Bedankt voor uw bestelling!
          </DialogTitle>
          <DialogDescription className="text-center space-y-3">
            <span className="block text-sm">
              Uw bestelling is succesvol ontvangen. Een bevestiging is
              verstuurd naar uw e-mailadres.
            </span>
            <span className="block">
              <span className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-mono font-medium">
                Referentienummer: {referentie}
              </span>
            </span>
            <span className="block text-sm text-muted-foreground">
              Wij nemen binnen 1 werkdag contact met u op om de levering te
              bevestigen.
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Aanbetaling sectie */}
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 text-left">
          <div className="flex items-start gap-3">
            <CreditCardIcon className="size-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Optionele aanbetaling</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Zet uw levering vast met een aanbetaling van €50. Dit is niet
                verplicht.
              </p>
            </div>
          </div>
          <Button
            onClick={startAanbetaling}
            disabled={betalingBezig}
            className="w-full gap-2"
          >
            {betalingBezig ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Betaling starten...
              </>
            ) : (
              <>
                <CreditCardIcon className="size-4" />
                Betaal €50 aanbetaling
              </>
            )}
          </Button>
        </div>

        <DialogFooter className="sm:justify-center mt-2">
          <Button
            variant="ghost"
            onClick={() => (window.location.href = "/")}
            className="w-full sm:w-auto text-muted-foreground"
          >
            Ga verder zonder aanbetaling
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
