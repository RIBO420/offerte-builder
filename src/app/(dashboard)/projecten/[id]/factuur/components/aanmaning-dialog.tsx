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
                <div className="flex items-start gap-3 rounded-lg border border-status-herinnering-border bg-status-herinnering/40 p-3">
                  <AlertCircle className="h-5 w-5 text-status-herinnering-dot mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-status-herinnering-text">Vriendelijke aanmaning</p>
                    <p className="text-status-herinnering-text">
                      De klant ontvangt een vriendelijk verzoek om de openstaande factuur alsnog te voldoen.
                    </p>
                  </div>
                </div>
              )}
              {selectedType === "tweede_aanmaning" && (
                <div className="flex items-start gap-3 rounded-lg border border-status-in-uitvoering-border bg-status-in-uitvoering/40 p-3">
                  <AlertTriangle className="h-5 w-5 text-status-in-uitvoering-dot mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-status-in-uitvoering-text">Formele aanmaning</p>
                    <p className="text-status-in-uitvoering-text">
                      De klant ontvangt een formeel verzoek met de waarschuwing dat verdere stappen volgen bij uitblijven van betaling.
                    </p>
                  </div>
                </div>
              )}
              {selectedType === "ingebrekestelling" && (
                <div className="flex items-start gap-3 rounded-lg border border-status-vervallen-border bg-status-vervallen/40 p-3">
                  <Gavel className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-status-vervallen-text">Juridische ingebrekestelling</p>
                    <p className="text-status-vervallen-text">
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
                ? "bg-destructive hover:bg-destructive/90 text-white"
                : selectedType === "tweede_aanmaning"
                  ? ""
                  : ""
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
