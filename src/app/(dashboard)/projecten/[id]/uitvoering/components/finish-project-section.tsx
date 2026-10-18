"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
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
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { formatUrenKort } from "@/lib/format/uren-kort";
import { cn } from "@/lib/utils";

interface FinishProjectSectionProps {
  showFinishDialog: boolean;
  setShowFinishDialog: (show: boolean) => void;
  handleFinishProject: () => Promise<void>;
  isFinishing: boolean;
  canFinishProject: boolean;
  hasVoorcalculatie: boolean;
  urenTotaal: number;
  begroteUren: number;
  /** Open planningstaken; `null` als het project geen taken heeft. */
  openTaken: { open: number; totaal: number } | null;
}

/**
 * Zijkolom "Volgende stap: Project afronden". Korte uitleg, een checklist en
 * een omlijnde knop — de gevulde hoofdknop van de pagina is "Uren
 * registreren" in de kop.
 */
export function FinishProjectSection({
  showFinishDialog,
  setShowFinishDialog,
  handleFinishProject,
  isFinishing,
  canFinishProject,
  hasVoorcalculatie,
  urenTotaal,
  begroteUren,
  openTaken,
}: FinishProjectSectionProps) {
  const verschil = urenTotaal - begroteUren;
  const kanAfronden = canFinishProject && hasVoorcalculatie;
  const reden = urenTotaal <= 0
    ? "Registreer eerst uren."
    : !hasVoorcalculatie
      ? "Er is nog geen voorcalculatie."
      : null;

  return (
    <SectiePaneel titel="Volgende stap">
      <div className="flex flex-col gap-3 p-4">
        <h3 className="font-display text-lg font-semibold">Project afronden</h3>
        <p className="text-pretty text-[13px] text-muted-foreground">
          Klaar met werken? Na afronden opent de nacalculatie en daarna de factuur.
        </p>

        <ul className="flex flex-col gap-2 text-[13px]">
          <CheckRegel klaar={urenTotaal > 0}>
            Uren geregistreerd
            {urenTotaal > 0 && (
              <span className="text-muted-foreground tabular-nums">
                {formatUrenKort(urenTotaal)} u
              </span>
            )}
          </CheckRegel>
          <CheckRegel klaar={hasVoorcalculatie}>
            {hasVoorcalculatie ? "Voorcalculatie aanwezig" : "Voorcalculatie ontbreekt"}
          </CheckRegel>
          {openTaken && (
            <CheckRegel klaar={openTaken.open === 0}>
              {openTaken.open === 0
                ? "Alle taken afgerond"
                : `${openTaken.open} van ${openTaken.totaal} taken nog open`}
            </CheckRegel>
          )}
        </ul>

        <AlertDialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full border-primary/60 font-semibold text-primary hover:text-primary"
              disabled={!kanAfronden}
              aria-describedby={reden ? "afronden-reden" : undefined}
            >
              Project afronden
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Project afronden en naar de nacalculatie?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  <p>
                    Hierna bekijk je de nacalculatie en vergelijk je de gewerkte uren met de
                    voorcalculatie. Uren kunnen daarna niet meer worden aangepast.
                  </p>
                  <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 rounded-lg border bg-muted/50 p-4 tabular-nums">
                    <dt className="text-muted-foreground">Geregistreerd</dt>
                    <dd className="font-medium text-foreground">{formatUrenKort(urenTotaal)} uur</dd>
                    {hasVoorcalculatie && (
                      <>
                        <dt className="text-muted-foreground">Begroot</dt>
                        <dd className="font-medium text-foreground">
                          {formatUrenKort(begroteUren)} uur
                        </dd>
                        <dt className="border-t pt-1.5 text-muted-foreground">Verschil</dt>
                        <dd
                          className={cn(
                            "border-t pt-1.5 font-medium",
                            verschil > 0 ? "text-destructive" : "text-foreground"
                          )}
                        >
                          {verschil > 0 ? "+" : ""}
                          {formatUrenKort(verschil)} uur
                        </dd>
                      </>
                    )}
                  </dl>
                  {openTaken && openTaken.open > 0 && (
                    <p>
                      Let op: {openTaken.open} van {openTaken.totaal} planningstaken staan nog open.
                    </p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isFinishing}>Annuleren</AlertDialogCancel>
              <AlertDialogAction onClick={handleFinishProject} disabled={isFinishing}>
                {isFinishing ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Afronden…
                  </>
                ) : (
                  <>
                    Afronden en naar nacalculatie
                    <ArrowRight className="ml-2 size-4" />
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {reden && (
          <p id="afronden-reden" className="text-xs text-muted-foreground">
            {reden}
          </p>
        )}
      </div>
    </SectiePaneel>
  );
}

/** Zijkolom zodra de uitvoering klaar is: door naar de nacalculatie. */
export function UitvoeringKlaarSection({ projectId }: { projectId: string }) {
  return (
    <SectiePaneel titel="Volgende stap">
      <div className="flex flex-col gap-3 p-4">
        <h3 className="font-display text-lg font-semibold">Nacalculatie</h3>
        <p className="text-pretty text-[13px] text-muted-foreground">
          De uitvoering is afgerond. Vergelijk de gewerkte uren met de voorcalculatie.
        </p>
        <Button variant="outline" asChild className="w-full">
          <Link href={`/projecten/${projectId}/nacalculatie`}>
            Naar de nacalculatie
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>
    </SectiePaneel>
  );
}

function CheckRegel({ klaar, children }: { klaar: boolean; children: ReactNode }) {
  return (
    <li className={cn("flex items-center gap-2", !klaar && "text-muted-foreground")}>
      {klaar ? (
        <Check className="size-4 shrink-0 text-status-geaccepteerd-dot" strokeWidth={2.5} aria-hidden="true" />
      ) : (
        <span aria-hidden="true" className="size-4 shrink-0 rounded-full border-[1.5px] border-border" />
      )}
      <span className="sr-only">{klaar ? "Klaar: " : "Nog niet: "}</span>
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">{children}</span>
    </li>
  );
}
