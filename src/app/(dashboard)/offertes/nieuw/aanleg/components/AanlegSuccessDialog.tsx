"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calculator,
  Edit,
  PartyPopper,
  ArrowRight,
} from "lucide-react";

interface AanlegSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerteId: string | null;
  offerteNummer: string | null;
}

export function AanlegSuccessDialog({
  open,
  onOpenChange,
  offerteId,
  offerteNummer,
}: AanlegSuccessDialogProps) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
            <PartyPopper className="h-8 w-8 text-green-600" />
          </div>
          <DialogTitle className="text-center text-xl">
            Offerte {offerteNummer} aangemaakt!
          </DialogTitle>
          <DialogDescription className="text-center">
            Je offerte is succesvol opgeslagen. Wat wil je nu doen?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <Card
            className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            onClick={() => {
              onOpenChange(false);
              router.push(`/offertes/${offerteId}/voorcalculatie`);
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
                  <Calculator className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">Voorcalculatie invullen</p>
                    <Badge variant="secondary" className="text-xs bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      Aanbevolen
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Bepaal teamgrootte en geschatte projectduur
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-blue-500 shrink-0 mt-2.5" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-muted-foreground/30 transition-colors"
            onClick={() => {
              onOpenChange(false);
              router.push(`/offertes/${offerteId}/bewerken`);
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Edit className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Offerte bewerken</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Pas regels en prijzen aan
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 mt-2.5" />
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="sm:justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              router.push(`/offertes/${offerteId}`);
            }}
          >
            Bekijk offerte
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              router.push("/offertes");
            }}
          >
            Naar overzicht
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
