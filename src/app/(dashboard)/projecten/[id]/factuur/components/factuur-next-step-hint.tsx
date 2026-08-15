"use client";

// De hint is een CSS-reveal, geen framer-motion: met `initial` opacity 0 hing
// de zichtbaarheid van dit blok aan een rAF-frame, en dat frame valt in een
// achtergrondtab niet. → src/components/pagina-reveal.tsx
import { cn } from "@/lib/utils";
import { REVEAL_KLASSE } from "@/components/pagina-reveal";
import {
  ArrowRight,
  Send,
  Clock,
  CheckCircle,
} from "lucide-react";

interface FactuurNextStepHintProps {
  factuurStatus: string;
  prefersReducedMotion: boolean;
}

export function FactuurNextStepHint({
  factuurStatus,
  // Blijft in de signatuur staan zodat de aanroepplek niet hoeft te wijzigen;
  // prefers-reduced-motion zit nu in CSS (motion-safe:) in plaats van in JS.
  prefersReducedMotion: _prefersReducedMotion,
}: FactuurNextStepHintProps) {

  switch (factuurStatus) {
    case "concept":
      return (
        <div className={cn("flex items-center gap-3 rounded-lg border border-status-gepland-border bg-status-gepland/40 p-4", REVEAL_KLASSE)}>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-status-gepland">
            <ArrowRight className="h-5 w-5 text-status-gepland-text" />
          </div>
          <div>
            <p className="font-medium text-status-gepland-text">Volgende stap: Definitief maken</p>
            <p className="text-sm text-status-gepland-text">
              Controleer de factuur en maak deze definitief om te kunnen verzenden.
            </p>
          </div>
        </div>
      );
    case "definitief":
      return (
        <div className={cn("flex items-center gap-3 rounded-lg border border-status-geaccepteerd-border bg-status-geaccepteerd/40 p-4", REVEAL_KLASSE)}>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-status-geaccepteerd">
            <Send className="h-5 w-5 text-status-geaccepteerd-text" />
          </div>
          <div>
            <p className="font-medium text-status-geaccepteerd-text">Klaar om te verzenden!</p>
            <p className="text-sm text-status-geaccepteerd-text">
              De factuur is definitief. Je kunt deze nu naar de klant versturen.
            </p>
          </div>
        </div>
      );
    case "verzonden":
      return (
        <div className={cn("flex items-center gap-3 rounded-lg border border-status-herinnering-border bg-status-herinnering/40 p-4", REVEAL_KLASSE)}>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-status-herinnering">
            <Clock className="h-5 w-5 text-status-herinnering-text" />
          </div>
          <div>
            <p className="font-medium text-status-herinnering-text">Wachten op betaling</p>
            <p className="text-sm text-status-herinnering-text">
              Markeer de factuur als betaald zodra de betaling is ontvangen.
            </p>
          </div>
        </div>
      );
    case "betaald":
      return (
        <div className={cn("flex items-center gap-3 rounded-lg border border-status-geaccepteerd-border bg-status-geaccepteerd/40 p-4", REVEAL_KLASSE)}>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-status-geaccepteerd">
            <CheckCircle className="h-5 w-5 text-status-geaccepteerd-text" />
          </div>
          <div>
            <p className="font-medium text-status-geaccepteerd-text">Project voltooid!</p>
            <p className="text-sm text-status-geaccepteerd-text">
              De factuur is betaald. Dit project is succesvol afgerond.
            </p>
          </div>
        </div>
      );
    default:
      return null;
  }
}
