"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Lightbulb,
  FileText,
  Receipt,
  TrendingUp,
  Loader2,
} from "lucide-react";

interface FinishProjectSectionProps {
  showFinishDialog: boolean;
  setShowFinishDialog: (show: boolean) => void;
  handleFinishProject: () => Promise<void>;
  isFinishing: boolean;
  canFinishProject: boolean;
  hasVoorcalculatie: boolean;
  urenTotaal: number;
  begroteUren: number;
  verschilUren: number;
  verschilPercentage: string | number;
}

export function FinishProjectSection({
  showFinishDialog,
  setShowFinishDialog,
  handleFinishProject,
  isFinishing,
  canFinishProject,
  hasVoorcalculatie,
  urenTotaal,
  begroteUren,
  verschilUren,
  verschilPercentage,
}: FinishProjectSectionProps) {
  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:border-blue-900 dark:from-blue-950/30 dark:to-indigo-950/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
          <CheckCircle className="h-5 w-5" />
          Project Afronden
        </CardTitle>
        <CardDescription className="text-blue-600 dark:text-blue-300">
          Klaar met werken? Rond het project af om naar de nacalculatie te gaan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Checklist */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {urenTotaal > 0 ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
            )}
            <span className={urenTotaal > 0 ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}>
              Uren geregistreerd ({urenTotaal.toFixed(1)} uur)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hasVoorcalculatie ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
            )}
            <span className={hasVoorcalculatie ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}>
              Voorcalculatie beschikbaar
            </span>
          </div>
        </div>

        {/* Tips section */}
        <div className="rounded-lg bg-blue-100/50 dark:bg-blue-900/20 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-200">
            <Lightbulb className="h-4 w-4" />
            Na het afronden
          </div>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 ml-6">
            <li className="flex items-center gap-2">
              <FileText className="h-3 w-3" />
              Bekijk de nacalculatie en vergelijk met begroting
            </li>
            <li className="flex items-center gap-2">
              <Receipt className="h-3 w-3" />
              Maak een factuur aan voor de klant
            </li>
            <li className="flex items-center gap-2">
              <TrendingUp className="h-3 w-3" />
              Analyseer verschillen voor toekomstige projecten
            </li>
          </ul>
        </div>

        {/* Afronden button */}
        <AlertDialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
          <AlertDialogTrigger asChild>
            <Button
              size="lg"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!canFinishProject || !hasVoorcalculatie}
            >
              {!canFinishProject ? (
                <>
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  {urenTotaal <= 0 ? "Registreer eerst uren" : "Kan nog niet afronden"}
                </>
              ) : !hasVoorcalculatie ? (
                <>
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  Voorcalculatie ontbreekt
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Project Afronden
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Project afronden en naar nacalculatie?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  <p>
                    Je staat op het punt om dit project af te ronden. Hierna kun je
                    de nacalculatie bekijken en vergelijken met de voorcalculatie.
                  </p>
                  <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Totaal geregistreerde uren:</span>
                      <span className="font-medium">{urenTotaal.toFixed(1)} uur</span>
                    </div>
                    {hasVoorcalculatie && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Begroot (voorcalculatie):</span>
                          <span className="font-medium">{begroteUren.toFixed(1)} uur</span>
                        </div>
                        <div className="flex justify-between border-t pt-2 mt-2">
                          <span className="text-muted-foreground">Verschil:</span>
                          <span className={`font-medium ${verschilUren > 0 ? "text-red-600" : verschilUren < 0 ? "text-green-600" : ""}`}>
                            {verschilUren > 0 ? "+" : ""}{verschilUren.toFixed(1)} uur ({verschilPercentage}%)
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* What happens next */}
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/50 p-3 space-y-2">
                    <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Wat gebeurt er?
                    </div>
                    <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                      <li>1. Project status wordt &quot;Afgerond&quot;</li>
                      <li>2. Je wordt doorgestuurd naar de nacalculatie</li>
                      <li>3. Uren kunnen daarna niet meer worden aangepast</li>
                    </ul>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isFinishing}>Annuleren</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleFinishProject}
                disabled={isFinishing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isFinishing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Afronden...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Afronden & Naar Nacalculatie
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
