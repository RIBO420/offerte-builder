import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, CalendarCheck, CreditCard } from "lucide-react";
import { formatEuro } from "./utils";

export function SuccessDialog({
  open,
  email,
  referentie,
  indicatiePrijs,
  onAanbetaling,
  onSluiten,
  isBetalingBezig,
}: {
  open: boolean;
  email: string;
  referentie: string;
  indicatiePrijs: number;
  onAanbetaling: () => void;
  onSluiten: () => void;
  isBetalingBezig: boolean;
}) {
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
                Wij beoordelen uw aanvraag binnen{" "}
                <span className="font-semibold text-foreground">2 werkdagen</span>.
                U ontvangt een bevestiging per e-mail op{" "}
                <span className="font-semibold text-foreground">{email}</span>.
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
            <CalendarCheck className="h-8 w-8 text-green-200" />
          </div>

          {/* Wat volgt */}
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              Uw aanvraag is ontvangen en geregistreerd
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              Wij nemen contact met u op voor een afspraakbevestiging
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              Na inspectie ontvangt u een definitieve offerte
            </li>
          </ul>

          {/* Aanbetaling */}
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-900 mb-1">
              Optionele aanbetaling — {formatEuro(75)}
            </p>
            <p className="text-xs text-green-800 mb-3">
              Zet uw gewenste datum zeker met een kleine aanbetaling. Dit is
              volledig optioneel en wordt verrekend met de definitieve factuur.
            </p>
            <Button
              onClick={onAanbetaling}
              disabled={isBetalingBezig}
              size="sm"
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {isBetalingBezig ? (
                <>
                  <div className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Betaling starten...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-3.5 w-3.5" />
                  Betaal {formatEuro(75)} aanbetaling (iDEAL)
                </>
              )}
            </Button>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={onSluiten}
          className="w-full"
        >
          Sluiten zonder aanbetaling
        </Button>
      </DialogContent>
    </Dialog>
  );
}
