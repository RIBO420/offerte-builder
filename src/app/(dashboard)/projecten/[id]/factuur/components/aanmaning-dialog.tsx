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
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  AlertCircle,
  AlertTriangle,
  Gavel,
} from "lucide-react";

interface AanmaningDialogProps {
  selectedType: "eerste_aanmaning" | "tweede_aanmaning" | "ingebrekestelling" | null;
  notities: string;
  onNotitiesChange: (notities: string) => void;
  onClose: () => void;
  onSend: () => void;
  isSending: boolean;
}

export function AanmaningDialog({
  selectedType,
  notities,
  onNotitiesChange,
  onClose,
  onSend,
  isSending,
}: AanmaningDialogProps) {
  return (
    <AlertDialog
      open={selectedType !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {selectedType === "eerste_aanmaning" && "1e Aanmaning versturen"}
            {selectedType === "tweede_aanmaning" && "2e Aanmaning versturen"}
            {selectedType === "ingebrekestelling" && "Ingebrekestelling versturen"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              {selectedType === "eerste_aanmaning" && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
                  <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-200">Vriendelijke aanmaning</p>
                    <p className="text-amber-700 dark:text-amber-300">
                      De klant ontvangt een vriendelijk verzoek om de openstaande factuur alsnog te voldoen.
                    </p>
                  </div>
                </div>
              )}
              {selectedType === "tweede_aanmaning" && (
                <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-900 dark:bg-orange-950">
                  <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-orange-800 dark:text-orange-200">Formele aanmaning</p>
                    <p className="text-orange-700 dark:text-orange-300">
                      De klant ontvangt een formeel verzoek met de waarschuwing dat verdere stappen volgen bij uitblijven van betaling.
                    </p>
                  </div>
                </div>
              )}
              {selectedType === "ingebrekestelling" && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
                  <Gavel className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-red-800 dark:text-red-200">Juridische ingebrekestelling</p>
                    <p className="text-red-700 dark:text-red-300">
                      De klant wordt formeel in gebreke gesteld conform art. 6:82 BW. Bij uitblijven van betaling binnen 14 dagen wordt de vordering uit handen gegeven aan een incassobureau.
                    </p>
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm font-medium mb-2">Notities (optioneel)</p>
                <Textarea
                  placeholder="Eventuele opmerkingen bij deze aanmaning..."
                  value={notities}
                  onChange={(e) => onNotitiesChange(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>
            Annuleren
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onSend}
            disabled={isSending}
            className={
              selectedType === "ingebrekestelling"
                ? "bg-red-600 hover:bg-red-700"
                : selectedType === "tweede_aanmaning"
                  ? "bg-orange-600 hover:bg-orange-700"
                  : "bg-amber-600 hover:bg-amber-700"
            }
          >
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Aanmaning Versturen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
