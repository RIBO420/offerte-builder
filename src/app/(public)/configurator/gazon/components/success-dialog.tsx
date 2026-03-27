"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  CreditCard,
  Leaf,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { AANBETALING_BEDRAG } from "./types";

interface SuccessDialogProps {
  open: boolean;
  email: string;
  referentie: string;
  klantNaam: string;
  klantEmail: string;
  onSluiten: () => void;
}

export function SuccessDialog({
  open,
  email,
  referentie,
  klantNaam,
  klantEmail,
  onSluiten,
}: SuccessDialogProps) {
  const [aanbetaalBezig, setAanbetaalBezig] = useState(false);

  const startAanbetaling = async () => {
    if (aanbetaalBezig) return;
    setAanbetaalBezig(true);

    try {
      const appUrl = window.location.origin;
      const redirectUrl = `${appUrl}/configurator/bedankt?referentie=${encodeURIComponent(referentie)}&betaald=1`;

      const response = await fetch("/api/mollie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: {
            currency: "EUR",
            value: AANBETALING_BEDRAG.toFixed(2),
          },
          description: `Aanbetaling gazon configuratie — ${referentie}`,
          redirectUrl,
          metadata: {
            referentie,
            klantNaam,
            klantEmail,
            type: "configurator",
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Fout bij starten van betaling");
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("Geen checkout URL ontvangen van Mollie");
      }
    } catch (err) {
      const foutmelding =
        err instanceof Error ? err.message : "Fout bij starten van betaling";
      toast.error(foutmelding);
      setAanbetaalBezig(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onSluiten}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-9 w-9 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                Bedankt voor uw aanvraag!
              </DialogTitle>
              <DialogDescription className="mt-3 text-sm leading-relaxed">
                Uw aanvraag is ontvangen — u ontvangt een bevestiging per email op{" "}
                <span className="font-semibold text-foreground">{email}</span>.
                Wij beoordelen uw aanvraag binnen{" "}
                <span className="font-semibold text-foreground">2 werkdagen</span>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Referentienummer */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Uw referentienummer
              </p>
              <p className="text-lg font-bold text-green-700 font-mono mt-0.5">
                {referentie}
              </p>
            </div>
            <Leaf className="h-8 w-8 text-green-200" />
          </div>

          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              Uw aanvraag is ontvangen en geregistreerd
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              Wij nemen contact met u op voor een afspraak ter plaatse
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              Na inspectie ontvangt u een definitieve offerte
            </li>
          </ul>

          {/* Aanbetaling sectie */}
          <div className="rounded-lg border-2 border-dashed border-green-200 bg-green-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-green-700" />
              <p className="text-sm font-semibold text-green-900">
                Aanbetaling (optioneel)
              </p>
            </div>
            <p className="text-xs text-green-800 leading-relaxed">
              Betaal €{AANBETALING_BEDRAG} aanbetaling om uw aanvraag prioriteit te
              geven. Uw aanvraag wordt dan direct behandeld.
            </p>
            <Button
              onClick={startAanbetaling}
              disabled={aanbetaalBezig}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium"
              size="sm"
            >
              {aanbetaalBezig ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Betaling starten...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Betaal €{AANBETALING_BEDRAG} aanbetaling om uw aanvraag te bevestigen
                </>
              )}
            </Button>
            <button
              type="button"
              onClick={onSluiten}
              className="w-full text-xs text-muted-foreground hover:text-gray-700 underline underline-offset-2 transition-colors py-1"
            >
              Of ga verder zonder aanbetaling
            </button>
          </div>
        </div>

        <Button
          onClick={onSluiten}
          variant="outline"
          className="w-full"
        >
          Sluiten
        </Button>
      </DialogContent>
    </Dialog>
  );
}
