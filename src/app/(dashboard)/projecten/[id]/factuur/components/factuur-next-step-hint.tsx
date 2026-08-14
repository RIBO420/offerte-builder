"use client";

// `m` en niet `motion`: de app draait binnen een `LazyMotion ... strict`
// (src/components/providers/motion-provider.tsx). Een `motion`-component
// daarbinnen gooit geen waarschuwing maar een échte fout, die de errorboundary
// vangt — het blok verdwijnt dan zonder dat je ziet waarom.
import { m } from "framer-motion";
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
  prefersReducedMotion,
}: FactuurNextStepHintProps) {
  const motionInitial = prefersReducedMotion ? {} : { opacity: 0, y: 10 };
  const motionAnimate = { opacity: 1, y: 0 };

  switch (factuurStatus) {
    case "concept":
      return (
        <m.div
          initial={motionInitial}
          animate={motionAnimate}
          className="flex items-center gap-3 rounded-lg border border-status-gepland-border bg-status-gepland/40 p-4"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-status-gepland">
            <ArrowRight className="h-5 w-5 text-status-gepland-text" />
          </div>
          <div>
            <p className="font-medium text-status-gepland-text">Volgende stap: Definitief maken</p>
            <p className="text-sm text-status-gepland-text">
              Controleer de factuur en maak deze definitief om te kunnen verzenden.
            </p>
          </div>
        </m.div>
      );
    case "definitief":
      return (
        <m.div
          initial={motionInitial}
          animate={motionAnimate}
          className="flex items-center gap-3 rounded-lg border border-status-geaccepteerd-border bg-status-geaccepteerd/40 p-4"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-status-geaccepteerd">
            <Send className="h-5 w-5 text-status-geaccepteerd-text" />
          </div>
          <div>
            <p className="font-medium text-status-geaccepteerd-text">Klaar om te verzenden!</p>
            <p className="text-sm text-status-geaccepteerd-text">
              De factuur is definitief. Je kunt deze nu naar de klant versturen.
            </p>
          </div>
        </m.div>
      );
    case "verzonden":
      return (
        <m.div
          initial={motionInitial}
          animate={motionAnimate}
          className="flex items-center gap-3 rounded-lg border border-status-herinnering-border bg-status-herinnering/40 p-4"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-status-herinnering">
            <Clock className="h-5 w-5 text-status-herinnering-text" />
          </div>
          <div>
            <p className="font-medium text-status-herinnering-text">Wachten op betaling</p>
            <p className="text-sm text-status-herinnering-text">
              Markeer de factuur als betaald zodra de betaling is ontvangen.
            </p>
          </div>
        </m.div>
      );
    case "betaald":
      return (
        <m.div
          initial={motionInitial}
          animate={motionAnimate}
          className="flex items-center gap-3 rounded-lg border border-status-geaccepteerd-border bg-status-geaccepteerd/40 p-4"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-status-geaccepteerd">
            <CheckCircle className="h-5 w-5 text-status-geaccepteerd-text" />
          </div>
          <div>
            <p className="font-medium text-status-geaccepteerd-text">Project voltooid!</p>
            <p className="text-sm text-status-geaccepteerd-text">
              De factuur is betaald. Dit project is succesvol afgerond.
            </p>
          </div>
        </m.div>
      );
    default:
      return null;
  }
}
